import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { deleteSetting, getSettings, updateSettings } from './settings.service.js';

export const settingsRouter = Router();

settingsRouter.use(authenticate);

settingsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const data = await getSettings();
    res.json({ success: true, data });
  })
);

settingsRouter.put(
  '/',
  authorize('OWNER'),
  asyncHandler(async (req, res) => {
    const entries = Object.entries(req.body as Record<string, string>);
    const data = await updateSettings(Object.fromEntries(entries));
    res.json({ success: true, data });
  })
);

settingsRouter.delete(
  '/:key',
  authorize('OWNER'),
  asyncHandler(async (req, res) => {
    const data = await deleteSetting(typeof req.params.key === 'string' ? req.params.key : String(req.params.key));
    res.json({ success: true, data });
  })
);
