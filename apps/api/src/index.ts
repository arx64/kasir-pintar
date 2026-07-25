import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { errorHandler } from './middlewares/error-handler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { productRouter } from './modules/product/product.routes.js';
import { salesRouter } from './modules/sales/sales.routes.js';
import { expenseRouter } from './modules/expense/expense.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { reportRouter } from './modules/report/report.routes.js';
import { whatsappRouter } from './modules/whatsapp/whatsapp.routes.js';
import { customerRequestRouter } from './modules/customer-request/customer-request.routes.js';
import { settingsRouter } from './modules/settings/settings.routes.js';
import { userRouter } from './modules/user/user.routes.js';
import { stockRouter } from './modules/stock/stock.routes.js';
import { startWhatsApp } from './modules/whatsapp/whatsapp.service.js';
import { startScheduler } from './modules/scheduler/scheduler.service.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));

app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', service: 'kasir-pintar-api', time: new Date().toISOString() } });
});

app.use('/api/auth', authRouter);
app.use('/api/products', productRouter);
app.use('/api/sales', salesRouter);
app.use('/api/expenses', expenseRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reports', reportRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/customer-requests', customerRequestRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/users', userRouter);
app.use('/api/stock', stockRouter);

app.use(errorHandler);

const server = app.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT }, 'API server started');
  startScheduler();
  // WhatsApp & DB warmup bersifat non-blocking terhadap HTTP server:
  // server sudah listen & menerima request sebelum keduanya selesai.
  startWhatsApp().catch((err) => logger.warn({ err }, 'Failed to start WhatsApp at boot'));
  // Warmup koneksi Prisma agar query pertama dari kasir tidak lambat cold-start.
  prisma
    .$queryRaw`SELECT 1`
    .then(() => logger.info('Prisma connection warmed up'))
    .catch((err) => logger.warn({ err }, 'Prisma warmup failed'));
});

const shutdown = (signal: string) => {
  logger.info({ signal }, 'shutting down');
  server.close(() => process.exit(0));
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default app;
