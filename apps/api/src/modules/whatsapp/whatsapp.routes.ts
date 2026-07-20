import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import {
  getQrState,
  getSocket,
  isConnected,
  sendWhatsAppMessage,
  startWhatsApp,
} from './whatsapp.service.js';

export const whatsappRouter = Router();

whatsappRouter.use(authenticate, authorize('OWNER'));

whatsappRouter.get(
  '/status',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: getQrState() });
  })
);

whatsappRouter.post(
  '/connect',
  asyncHandler(async (_req, res) => {
    if (!isConnected()) {
      await startWhatsApp();
    }
    res.json({ success: true, data: getQrState() });
  })
);

whatsappRouter.post(
  '/test',
  asyncHandler(async (req, res) => {
    const { to, message } = req.body as { to?: string; message?: string };
    if (!to || !message) return res.status(400).json({ success: false, message: 'to & message wajib' });
    await sendWhatsAppMessage(to, message);
    res.json({ success: true });
  })
);

whatsappRouter.get(
  '/logs',
  asyncHandler(async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const logs = await (await import('../../lib/prisma.js')).prisma.whatsAppLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json({ success: true, data: logs });
  })
);
