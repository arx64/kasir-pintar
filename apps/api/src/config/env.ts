import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().default(4000),
  API_URL: z.string().default('http://localhost:4000'),
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  WA_AUTH_DIR: z.string().default('./wa_auth'),
  WA_OWNER_NUMBERS: z.string().default(''),
  WA_LARGE_SALE_THRESHOLD: z.coerce.number().default(500000),
  WA_LARGE_EXPENSE_THRESHOLD: z.coerce.number().default(200000),
  DAILY_REPORT_CRON: z.string().default('0 21 * * *'),
  MONTHLY_REPORT_CRON: z.string().default('0 21 1 * *'),
  STOCK_CHECK_CRON: z.string().default('*/30 * * * *'),
  TZ: z.string().default('Asia/Jakarta'),
  STORE_NAME: z.string().default('Kasir Pintar'),
  QRIS_STATIC_CODE: z.string().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const env = parsed.data;

export const ownerNumbers = env.WA_OWNER_NUMBERS
  .split(',')
  .map((n) => n.trim())
  .filter(Boolean)
  .map((n) => n.replace(/\D/g, ''));
