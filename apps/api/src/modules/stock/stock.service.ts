import { Prisma, StockLogType } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/api-error.js';

export async function listStockLogs(params: {
  productId?: string;
  type?: StockLogType;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}) {
  const page = params.page || 1;
  const limit = params.limit || 50;
  const where: Prisma.StockLogWhereInput = {};

  if (params.productId) where.productId = params.productId;
  if (params.type) where.type = params.type;
  if (params.from || params.to) {
    where.createdAt = {
      ...(params.from ? { gte: params.from } : {}),
      ...(params.to ? { lte: params.to } : {}),
    };
  }

  const [items, total] = await Promise.all([
    prisma.stockLog.findMany({
      where,
      include: { product: { select: { id: true, name: true, barcode: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.stockLog.count({ where }),
  ]);

  return { items, total, page, limit };
}

export async function listStockMovements() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      barcode: true,
      stock: true,
      minStock: true,
    },
  });

  const inAgg = await prisma.stockLog.groupBy({
    by: ['productId'],
    _sum: { quantity: true },
    where: { type: { in: ['RESTOCK', 'REFUND', 'CANCEL'] } },
  });
  const outAgg = await prisma.stockLog.groupBy({
    by: ['productId'],
    _sum: { quantity: true },
    where: { type: { in: ['SALE', 'ADJUSTMENT'] } },
  });

  const inMap = new Map(inAgg.map((r) => [r.productId, r._sum.quantity || 0]));
  const outMap = new Map(outAgg.map((r) => [r.productId, r._sum.quantity || 0]));

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    barcode: p.barcode,
    stock: p.stock,
    minStock: p.minStock,
    totalIn: inMap.get(p.id) || 0,
    totalOut: Math.abs(outMap.get(p.id) || 0),
  }));
}

export async function getStockLog(id: string) {
  const log = await prisma.stockLog.findUnique({
    where: { id },
    include: { product: { select: { id: true, name: true } } },
  });
  if (!log) throw new ApiError(404, 'Riwayat stok tidak ditemukan');
  return log;
}
