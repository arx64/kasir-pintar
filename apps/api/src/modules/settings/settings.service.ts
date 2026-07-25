import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';

const ALLOWED_KEYS = [
  'STORE_NAME',
  'WA_OWNER_NUMBERS',
  'WA_LARGE_SALE_THRESHOLD',
  'WA_LARGE_EXPENSE_THRESHOLD',
  'QRIS_STATIC_CODE',
] as const;

export async function getSettings() {
  const rows = await prisma.setting.findMany();
  const data: Record<string, string> = {
    STORE_NAME: env.STORE_NAME,
    WA_OWNER_NUMBERS: env.WA_OWNER_NUMBERS,
    WA_LARGE_SALE_THRESHOLD: String(env.WA_LARGE_SALE_THRESHOLD),
    WA_LARGE_EXPENSE_THRESHOLD: String(env.WA_LARGE_EXPENSE_THRESHOLD),
    QRIS_STATIC_CODE: env.QRIS_STATIC_CODE,
  };
  for (const r of rows) data[r.key] = r.value;
  return data;
}

export async function updateSettings(input: Record<string, string>) {
  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED_KEYS.includes(key as (typeof ALLOWED_KEYS)[number])) {
      throw new ApiError(400, `Key setting tidak diizinkan: ${key}`);
    }
    await prisma.setting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
  }
  return getSettings();
}

export async function deleteSetting(key: string) {
  if (!ALLOWED_KEYS.includes(key as (typeof ALLOWED_KEYS)[number])) {
    throw new ApiError(400, `Key setting tidak diizinkan: ${key}`);
  }
  await prisma.setting.delete({ where: { key } }).catch(() => undefined);
  return getSettings();
}
