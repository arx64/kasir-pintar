import { endOfDay, endOfMonth, startOfDay, startOfMonth } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { env } from '../config/env.js';

const tz = env.TZ || 'Asia/Jakarta';

export function nowInTz(): Date {
  return toZonedTime(new Date(), tz);
}

export function startOfToday(): Date {
  const zoned = nowInTz();
  return fromZonedTime(startOfDay(zoned), tz);
}

export function endOfToday(): Date {
  const zoned = nowInTz();
  return fromZonedTime(endOfDay(zoned), tz);
}

export function startOfThisMonth(): Date {
  const zoned = nowInTz();
  return fromZonedTime(startOfMonth(zoned), tz);
}

export function endOfThisMonth(): Date {
  const zoned = nowInTz();
  return fromZonedTime(endOfMonth(zoned), tz);
}

export function parseDateRange(from?: string, to?: string) {
  const start = from ? fromZonedTime(startOfDay(new Date(from)), tz) : startOfToday();
  const end = to ? fromZonedTime(endOfDay(new Date(to)), tz) : endOfToday();
  return { start, end };
}

export function formatDateId(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: tz,
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatDateTimeId(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: tz,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
