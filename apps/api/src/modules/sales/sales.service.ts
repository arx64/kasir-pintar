import { PaymentMethod, Prisma, SaleStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import { generateInvoiceNo } from '../../utils/invoice.js';
import { toNumber } from '../../utils/money.js';
import { env } from '../../config/env.js';
import {
  notifyCancellation,
  notifyLargeSale,
  notifyRefund,
  notifyStockAlerts,
} from '../notification/notification.service.js';

export const saleItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
});

export const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1),
  paymentMethod: z.nativeEnum(PaymentMethod),
  paidAmount: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).default(0),
  note: z.string().optional(),
});

export async function createSale(cashierId: string, input: z.infer<typeof createSaleSchema>) {
  const productIds = input.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
  });

  if (products.length !== productIds.length) {
    throw new ApiError(400, 'Beberapa produk tidak ditemukan atau nonaktif');
  }

  const productMap = new Map(products.map((p) => [p.id, p]));
  let subtotal = 0;
  const prepared = input.items.map((item) => {
    const product = productMap.get(item.productId)!;
    if (product.stock < item.quantity) {
      throw new ApiError(400, `Stok ${product.name} tidak mencukupi (sisa ${product.stock})`);
    }
    const unitPrice = toNumber(product.sellPrice);
    const line = unitPrice * item.quantity;
    subtotal += line;
    return {
      product,
      quantity: item.quantity,
      unitPrice,
      costPrice: toNumber(product.costPrice),
      subtotal: line,
    };
  });

  const discount = input.discount || 0;
  const total = Math.max(subtotal - discount, 0);
  if (input.paidAmount < total) {
    throw new ApiError(400, 'Jumlah bayar kurang dari total');
  }

  const sale = await prisma.$transaction(async (tx) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const countToday = await tx.sale.count({
      where: { createdAt: { gte: todayStart } },
    });

    const invoiceNo = generateInvoiceNo(countToday + 1);
    const created = await tx.sale.create({
      data: {
        invoiceNo,
        cashierId,
        subtotal,
        discount,
        total,
        paidAmount: input.paidAmount,
        changeAmount: input.paidAmount - total,
        paymentMethod: input.paymentMethod,
        note: input.note,
        items: {
          create: prepared.map((p) => ({
            productId: p.product.id,
            productName: p.product.name,
            quantity: p.quantity,
            unitPrice: p.unitPrice,
            costPrice: p.costPrice,
            subtotal: p.subtotal,
          })),
        },
      },
      include: {
        items: true,
        cashier: { select: { id: true, name: true } },
      },
    });

    for (const p of prepared) {
      const before = p.product.stock;
      const after = before - p.quantity;
      await tx.product.update({
        where: { id: p.product.id },
        data: { stock: after },
      });
      await tx.stockLog.create({
        data: {
          productId: p.product.id,
          type: 'SALE',
          quantity: -p.quantity,
          before,
          after,
          note: `Penjualan ${invoiceNo}`,
          refId: created.id,
        },
      });
    }

    return created;
  });

  // async notifications (non-blocking)
  void notifyStockAlerts(prepared.map((p) => p.product.id));
  if (total >= env.WA_LARGE_SALE_THRESHOLD) {
    void notifyLargeSale(sale);
  }

  return sale;
}

export async function listSales(params: {
  from?: Date;
  to?: Date;
  cashierId?: string;
  status?: SaleStatus;
  page?: number;
  limit?: number;
}) {
  const page = params.page || 1;
  const limit = params.limit || 20;
  const where: Prisma.SaleWhereInput = {};

  if (params.from || params.to) {
    where.createdAt = {
      ...(params.from ? { gte: params.from } : {}),
      ...(params.to ? { lte: params.to } : {}),
    };
  }
  if (params.cashierId) where.cashierId = params.cashierId;
  if (params.status) where.status = params.status;

  const [items, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        cashier: { select: { id: true, name: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.sale.count({ where }),
  ]);

  return { items, total, page, limit };
}

export async function getSale(id: string) {
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      cashier: { select: { id: true, name: true } },
      items: true,
    },
  });
  if (!sale) throw new ApiError(404, 'Transaksi tidak ditemukan');
  return sale;
}

export async function cancelSale(id: string, actorId: string, isOwner: boolean) {
  const sale = await getSale(id);
  if (sale.status !== 'COMPLETED') throw new ApiError(400, 'Hanya transaksi selesai yang bisa dibatalkan');
  if (!isOwner && sale.cashierId !== actorId) {
    throw new ApiError(403, 'Kasir hanya bisa membatalkan transaksi miliknya');
  }

  const updated = await prisma.$transaction(async (tx) => {
    for (const item of sale.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) continue;
      const before = product.stock;
      const after = before + item.quantity;
      await tx.product.update({
        where: { id: product.id },
        data: { stock: after },
      });
      await tx.stockLog.create({
        data: {
          productId: product.id,
          type: 'CANCEL',
          quantity: item.quantity,
          before,
          after,
          note: `Pembatalan ${sale.invoiceNo}`,
          refId: sale.id,
        },
      });
    }

    return tx.sale.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
      include: {
        cashier: { select: { id: true, name: true } },
        items: true,
      },
    });
  });

  void notifyCancellation(updated);
  return updated;
}

export async function refundSale(id: string) {
  const sale = await getSale(id);
  if (sale.status !== 'COMPLETED') throw new ApiError(400, 'Hanya transaksi selesai yang bisa di-refund');

  const updated = await prisma.$transaction(async (tx) => {
    for (const item of sale.items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) continue;
      const before = product.stock;
      const after = before + item.quantity;
      await tx.product.update({
        where: { id: product.id },
        data: { stock: after },
      });
      await tx.stockLog.create({
        data: {
          productId: product.id,
          type: 'REFUND',
          quantity: item.quantity,
          before,
          after,
          note: `Refund ${sale.invoiceNo}`,
          refId: sale.id,
        },
      });
    }

    return tx.sale.update({
      where: { id },
      data: { status: 'REFUNDED', refundedAt: new Date() },
      include: {
        cashier: { select: { id: true, name: true } },
        items: true,
      },
    });
  });

  void notifyRefund(updated);
  return updated;
}
