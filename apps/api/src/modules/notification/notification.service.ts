import { logger } from '../../lib/logger.js';
import { broadcastToOwners, sendWhatsAppMessage } from '../whatsapp/whatsapp.service.js';
import { getDailyReportText, getMonthlyReportText } from '../report/report.service.js';
import { toNumber } from '../../utils/money.js';
import { prisma } from '../../lib/prisma.js';
import type { Sale, Expense } from '@prisma/client';

type StockAlertState = 'NORMAL' | 'LOW' | 'EMPTY';

function getStockAlertState(stock: number, minStock: number): StockAlertState {
  if (stock <= 0) return 'EMPTY';
  if (stock <= minStock) return 'LOW';
  return 'NORMAL';
}

function stockAlertSettingKey(productId: string) {
  return `stock_alert_state:${productId}`;
}

async function getPreviousStockAlertStates(productIds: string[]) {
  if (productIds.length === 0) return new Map<string, StockAlertState>();
  const settings = await prisma.setting.findMany({
    where: { key: { in: productIds.map(stockAlertSettingKey) } },
  });
  return new Map(
    settings.map((setting) => [
      setting.key.replace('stock_alert_state:', ''),
      setting.value as StockAlertState,
    ])
  );
}

async function setStockAlertState(productId: string, state: StockAlertState) {
  await prisma.setting.upsert({
    where: { key: stockAlertSettingKey(productId) },
    update: { value: state },
    create: { key: stockAlertSettingKey(productId), value: state },
  });
}

export async function notifyStockAlerts(productIds?: string[]) {
  const products = productIds?.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        include: { category: true },
        orderBy: { stock: 'asc' },
      })
    : await prisma.product.findMany({
        where: { isActive: true },
        include: { category: true },
        orderBy: { stock: 'asc' },
      });

  const previousStates = await getPreviousStockAlertStates(products.map((product) => product.id));

  for (const product of products) {
    const currentState = getStockAlertState(product.stock, product.minStock);
    const previousState = previousStates.get(product.id) ?? 'NORMAL';

    if (currentState === previousState) {
      continue;
    }

    await setStockAlertState(product.id, currentState);

    if (currentState === 'NORMAL') {
      continue;
    }

    const message =
      currentState === 'EMPTY'
        ? [
            '\u{1F6AB} *STOK HABIS*',
            `Produk: ${product.name}`,
            '',
            'Silakan segera restock.',
          ].join('\n')
        : [
            '\u{26A0}\u{FE0F} *STOK MENIPIS*',
            `Produk: ${product.name}`,
            `Sisa: ${product.stock}`,
            `Minimal: ${product.minStock}`,
            '',
            'Silakan lakukan restock.',
          ].join('\n');

    void broadcastToOwners(message, {
      productId: product.id,
      type: currentState,
      previousState,
      currentState,
    }).catch((err) => logger.error({ err, productId: product.id }, 'stock alert failed'));
  }
}

export async function notifyLargeSale(
  sale: Sale & { items?: { productName: string; quantity: number }[] }
) {
  const message = [
    '\u{1F4B0} *TRANSAKSI BESAR*',
    `Invoice: ${sale.invoiceNo}`,
    `Total: Rp ${toNumber(sale.total).toLocaleString('id-ID')}`,
    `Pembayaran: ${sale.paymentMethod}`,
    '',
    'Transaksi dengan nominal besar tercatat.',
  ].join('\n');
  await broadcastToOwners(message, { saleId: sale.id, type: 'LARGE_SALE' });
}

export async function notifyLargeExpense(
  expense: Expense & { createdBy?: { name: string } }
) {
  const message = [
    '\u{1F4B8} *PENGELUARAN BESAR*',
    `Kategori: ${expense.category}`,
    `Nominal: Rp ${toNumber(expense.amount).toLocaleString('id-ID')}`,
    expense.description ? `Keterangan: ${expense.description}` : '',
    expense.createdBy ? `Dicatat oleh: ${expense.createdBy.name}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  await broadcastToOwners(message, { expenseId: expense.id, type: 'LARGE_EXPENSE' });
}

export async function notifyRefund(
  sale: Sale & { items?: { productName: string; quantity: number }[] }
) {
  const message = [
    '\u{21A9}\u{FE0F} *REFUND TRANSAKSI*',
    `Invoice: ${sale.invoiceNo}`,
    `Total: Rp ${toNumber(sale.total).toLocaleString('id-ID')}`,
    '',
    'Stok telah dikembalikan.',
  ].join('\n');
  await broadcastToOwners(message, { saleId: sale.id, type: 'REFUND' });
}

export async function notifyCancellation(
  sale: Sale & { items?: { productName: string; quantity: number }[] }
) {
  const message = [
    '\u{274C} *PEMBATALAN TRANSAKSI*',
    `Invoice: ${sale.invoiceNo}`,
    `Total: Rp ${toNumber(sale.total).toLocaleString('id-ID')}`,
    '',
    'Transaksi dibatalkan, stok dikembalikan.',
  ].join('\n');
  await broadcastToOwners(message, { saleId: sale.id, type: 'CANCEL' });
}

export async function sendDailyReport() {
  const text = await getDailyReportText(new Date());
  await broadcastToOwners(text, { type: 'DAILY_REPORT' });
}

export async function sendMonthlyReport() {
  const text = await getMonthlyReportText(new Date());
  await broadcastToOwners(text, { type: 'MONTHLY_REPORT' });
}

export async function notifyCustomerRequest(req: {
  name: string;
  phone: string;
  message: string;
}) {
  const now = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());

  const text = [
    '\u{1F4E9} *PERMINTAAN BARU*',
    `Nama: ${req.name}`,
    `Nomor HP: ${req.phone}`,
    `Isi Permintaan: ${req.message}`,
    `Waktu: ${now}`,
  ].join('\n');
  await broadcastToOwners(text, {
    type: 'CUSTOMER_REQUEST',
    name: req.name,
    phone: req.phone,
  });
}

export async function notifyOwner(message: string, meta?: Record<string, unknown>) {
  await broadcastToOwners(message, meta);
}

export { sendWhatsAppMessage };