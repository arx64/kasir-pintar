import { Router } from 'express';
import { SaleStatus } from '@prisma/client';
import { asyncHandler } from '../../utils/async-handler.js';
import { queryString, paramString } from '../../utils/query.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { parseDateRange } from '../../utils/date.js';
import { z } from 'zod';
import { generateDynamicQrisImage } from '../payments/qris.service.js';
import {
  cancelSale,
  createSale,
  createSaleSchema,
  getSale,
  listSales,
  refundSale,
} from './sales.service.js';

export const salesRouter = Router();

salesRouter.use(authenticate);
salesRouter.post(
  '/qris/generate',
  asyncHandler(async (req, res) => {
    const body = z.object({
      amount: z.coerce.number().positive(),
      feeType: z.enum(['fixed', 'percentage']).optional(),
      feeValue: z.coerce.number().nonnegative().optional(),
    }).parse(req.body);

    const data = await generateDynamicQrisImage({
      amount: body.amount,
      ...(body.feeType && body.feeValue !== undefined
        ? { fee: { type: body.feeType, value: body.feeValue } }
        : {}),
    });

    res.json({ success: true, data });
  })
);

salesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const fromStr = queryString(req, 'from');
    const toStr = queryString(req, 'to');
    const { start, end } = fromStr || toStr
      ? parseDateRange(fromStr, toStr)
      : { start: undefined, end: undefined };
    const page = req.query.page ? Number(queryString(req, 'page')) : 1;
    const limit = req.query.limit ? Number(queryString(req, 'limit')) : 20;
    const status = queryString(req, 'status') as SaleStatus | undefined;

    const cashierId =
      req.user!.role === 'KASIR' ? req.user!.id : queryString(req, 'cashierId');

    const data = await listSales({
      from: start,
      to: end,
      cashierId,
      status,
      page,
      limit,
    });
    res.json({ success: true, data });
  })
);

salesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const sale = await getSale(paramString(req, 'id'));
    if (req.user!.role === 'KASIR' && sale.cashierId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Akses ditolak' });
    }
    res.json({ success: true, data: sale });
  })
);

salesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createSaleSchema.parse(req.body);
    const data = await createSale(req.user!.id, body);
    res.status(201).json({ success: true, data });
  })
);

salesRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const data = await cancelSale(paramString(req, 'id'), req.user!.id, req.user!.role === 'OWNER');
    res.json({ success: true, data });
  })
);

salesRouter.post(
  '/:id/refund',
  authorize('OWNER'),
  asyncHandler(async (req, res) => {
    const data = await refundSale(paramString(req, 'id'));
    res.json({ success: true, data });
  })
);
