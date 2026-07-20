import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { getDashboardSummary } from './dashboard.service.js';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate, authorize('OWNER'));

dashboardRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const data = await getDashboardSummary();
    res.json({ success: true, data });
  })
);
