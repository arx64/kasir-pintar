import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { getReport } from './report.service.js';

export const reportRouter = Router();

reportRouter.use(authenticate, authorize('OWNER'));

reportRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    const data = await getReport(from, to);
    res.json({ success: true, data });
  })
);
