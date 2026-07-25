const APP_TIME_ZONE = 'Asia/Jakarta';

export function toNumber(value: number | string) {
  return typeof value === 'number' ? value : Number(value || 0);
}

export function currency(value: number | string) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: APP_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
