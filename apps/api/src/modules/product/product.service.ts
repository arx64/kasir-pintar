import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/api-error.js';

export const productSchema = z.object({
  name: z.string().min(1),
  barcode: z.string().optional().nullable(),
  costPrice: z.coerce.number().min(0),
  sellPrice: z.coerce.number().min(0),
  stock: z.coerce.number().int().min(0).default(0),
  minStock: z.coerce.number().int().min(0).default(5),
  categoryId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const categorySchema = z.object({
  name: z.string().min(1),
});

export async function listProducts(params: {
  q?: string;
  categoryId?: string;
  lowStock?: boolean;
  page?: number;
  limit?: number;
}) {
  const page = params.page || 1;
  const limit = params.limit || 50;
  const where: Prisma.ProductWhereInput = {
    isActive: true,
  };

  if (params.q) {
    where.OR = [
      { name: { contains: params.q } },
      { barcode: { contains: params.q } },
    ];
  }

  if (params.categoryId) where.categoryId = params.categoryId;
  if (params.lowStock) {
    where.stock = { lte: prisma.product.fields.minStock as unknown as number };
  }

  // Prisma can't compare two columns easily in where; filter low stock in JS if requested
  if (params.lowStock) {
    const products = await prisma.product.findMany({
      where: { isActive: true, ...(params.q ? { OR: where.OR } : {}), ...(params.categoryId ? { categoryId: params.categoryId } : {}) },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
    const filtered = products.filter((p) => p.stock <= p.minStock);
    const start = (page - 1) * limit;
    return {
      items: filtered.slice(start, start + limit),
      total: filtered.length,
      page,
      limit,
    };
  }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return { items, total, page, limit };
}

export async function getProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!product) throw new ApiError(404, 'Produk tidak ditemukan');
  return product;
}

export async function createProduct(data: z.infer<typeof productSchema>) {
  if (data.barcode) {
    const exists = await prisma.product.findUnique({ where: { barcode: data.barcode } });
    if (exists) throw new ApiError(400, 'Barcode sudah digunakan');
  }

  return prisma.product.create({
    data: {
      name: data.name,
      barcode: data.barcode || null,
      costPrice: data.costPrice,
      sellPrice: data.sellPrice,
      stock: data.stock,
      minStock: data.minStock,
      categoryId: data.categoryId || null,
      isActive: data.isActive ?? true,
    },
    include: { category: true },
  });
}

export async function updateProduct(id: string, data: Partial<z.infer<typeof productSchema>>) {
  await getProduct(id);
  if (data.barcode) {
    const exists = await prisma.product.findFirst({
      where: { barcode: data.barcode, NOT: { id } },
    });
    if (exists) throw new ApiError(400, 'Barcode sudah digunakan');
  }

  return prisma.product.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.barcode !== undefined ? { barcode: data.barcode || null } : {}),
      ...(data.costPrice !== undefined ? { costPrice: data.costPrice } : {}),
      ...(data.sellPrice !== undefined ? { sellPrice: data.sellPrice } : {}),
      ...(data.stock !== undefined ? { stock: data.stock } : {}),
      ...(data.minStock !== undefined ? { minStock: data.minStock } : {}),
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId || null } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
    include: { category: true },
  });
}

export async function adjustStock(productId: string, quantity: number, note?: string) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new ApiError(404, 'Produk tidak ditemukan');

    const after = product.stock + quantity;
    if (after < 0) throw new ApiError(400, 'Stok tidak mencukupi');

    const updated = await tx.product.update({
      where: { id: productId },
      data: { stock: after },
    });

    await tx.stockLog.create({
      data: {
        productId,
        type: quantity >= 0 ? 'RESTOCK' : 'ADJUSTMENT',
        quantity,
        before: product.stock,
        after,
        note,
      },
    });

    return updated;
  });
}

export async function listCategories() {
  return prisma.category.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { products: true } } } });
}

export async function createCategory(name: string) {
  const exists = await prisma.category.findUnique({ where: { name } });
  if (exists) throw new ApiError(400, 'Kategori sudah ada');
  return prisma.category.create({ data: { name } });
}

export async function getLowStockProducts() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { category: true },
    orderBy: { stock: 'asc' },
  });
  return products.filter((p) => p.stock <= p.minStock);
}


export async function deleteProduct(id: string) {
  await getProduct(id);
  const [salesCount, stockLogsCount] = await Promise.all([
    prisma.saleItem.count({ where: { productId: id } }),
    prisma.stockLog.count({ where: { productId: id } }),
  ]);

  if (salesCount > 0 || stockLogsCount > 0) {
    return prisma.product.update({
      where: { id },
      data: { isActive: false, barcode: null },
      include: { category: true },
    });
  }

  return prisma.product.delete({ where: { id }, include: { category: true } });
}