import { Router } from 'express';
import { StockLogType } from '@prisma/client';
import { asyncHandler } from '../../utils/async-handler.js';
import { queryString, paramString } from '../../utils/query.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { parseDateRange } from '../../utils/date.js';
import { listStockLogs, listStockMovements, getStockLog } from './stock.service.js';

export const stockRouter = Router();

stockRouter.use(authenticate);

stockRouter.get(
  '/movements',
  asyncHandler(async (_req, res) => {
    const data = await listStockMovements();
    res.json({ success: true, data });
  })
);

stockRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const fromStr = queryString(req, 'from');
    const toStr = queryString(req, 'to');
    const { start, end } = fromStr || toStr ? parseDateRange(fromStr, toStr) : { start: undefined, end: undefined };
    const productId = queryString(req, 'productId');
    const type = queryString(req, 'type') as StockLogType | undefined;
    const page = req.query.page ? Number(queryString(req, 'page')) : 1;
    const limit = req.query.limit ? Number(queryString(req, 'limit')) : 50;

    const data = await listStockLogs({ productId, type, from: start, to: end, page, limit });
    res.json({ success: true, data });
  })
);

stockRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = await getStockLog(paramString(req, 'id'));
    res.json({ success: true, data });
  })
);
