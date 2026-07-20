import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { env } from '../../config/env.js';

export const settingsRouter = Router();

settingsRouter.use(authenticate);

settingsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.setting.findMany();
    const data: Record<string, string> = { STORE_NAME: env.STORE_NAME };
    for (const r of rows) data[r.key] = r.value;
    res.json({ success: true, data });
  })
);

settingsRouter.put(
  '/',
  authorize('OWNER'),
  asyncHandler(async (req, res) => {
    const entries = Object.entries(req.body as Record<string, string>);
    for (const [key, value] of entries) {
      await prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }
    res.json({ success: true });
  })
);
