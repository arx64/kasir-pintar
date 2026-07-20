import type { WASocket } from '@whiskeysockets/baileys';
import { prisma } from '../../lib/prisma.js';
import { toNumber, formatRupiah } from '../../utils/money.js';
import {
  endOfThisMonth,
  endOfToday,
  formatDateId,
  formatDateTimeId,
  startOfThisMonth,
  startOfToday,
} from '../../utils/date.js';
import { getDailyReportText, getMonthlyReportText } from '../report/report.service.js';
import { getLowStockProducts } from '../product/product.service.js';

function money(n: number | string) {
  return formatRupiah(toNumber(n));
}

const commands: Record<string, (args: string) => Promise<string>> = {
  help: async () =>
    [
      '*Perintah Tersedia:*',
      '',
      'laporan hari ini',
      'laporan bulan ini',
      'omzet hari ini',
      'omzet bulan ini',
      'profit hari ini',
      'profit bulan ini',
      'stok',
      'stok hampir habis',
      'barang terlaris',
      'pengeluaran hari ini',
      'pengeluaran bulan ini',
      'penjualan hari ini',
      'penjualan bulan ini',
      'help',
    ].join('\n'),

  'laporan hari ini': async () => getDailyReportText(new Date()),
  'laporan bulan ini': async () => getMonthlyReportText(new Date()),
  'omzet hari ini': async () => {
    const sales = await getSalesToday();
    return `Omzet Hari Ini: ${money(sales.reduce((s, x) => s + toNumber(x.total), 0))}`;
  },
  'omzet bulan ini': async () => {
    const sales = await getSalesMonth();
    return `Omzet Bulan Ini: ${money(sales.reduce((s, x) => s + toNumber(x.total), 0))}`;
  },
  'profit hari ini': async () => {
    const r = await getProfit(startOfToday(), endOfToday());
    return `Profit Hari Ini: ${money(r)}`;
  },
  'profit bulan ini': async () => {
    const r = await getProfit(startOfThisMonth(), endOfThisMonth());
    return `Profit Bulan Ini: ${money(r)}`;
  },
  'stok hampir habis': async () => {
    const products = await getLowStockProducts();
    if (!products.length) return 'Semua stok aman.';
    return [
      '⚠️ *STOK MENIPIS*',
      ...products.slice(0, 15).map((p) => `• ${p.name}: ${p.stock}/${p.minStock}`),
    ].join('\n');
  },
  stok: async () => {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      take: 30,
    });
    return [
      '*Daftar Stok*',
      ...products.map((p) => `• ${p.name}: ${p.stock}`),
    ].join('\n');
  },
  'barang terlaris': async () => {
    const top = await prisma.saleItem.groupBy({
      by: ['productName'],
      _sum: { quantity: true },
      where: {
        sale: {
          status: 'COMPLETED',
          createdAt: { gte: startOfThisMonth(), lte: endOfThisMonth() },
        },
      },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    });
    if (!top.length) return 'Belum ada penjualan bulan ini.';
    return [
      '*Barang Terlaris Bulan Ini*',
      ...top.map((p, i) => `${i + 1}. ${p.productName} - ${p._sum.quantity}x`),
    ].join('\n');
  },
  'pengeluaran hari ini': async () => {
    const expenses = await prisma.expense.findMany({
      where: { date: { gte: startOfToday(), lte: endOfToday() } },
    });
    return `Pengeluaran Hari Ini: ${money(expenses.reduce((s, e) => s + toNumber(e.amount), 0))}`;
  },
  'pengeluaran bulan ini': async () => {
    const expenses = await prisma.expense.findMany({
      where: { date: { gte: startOfThisMonth(), lte: endOfThisMonth() } },
    });
    return `Pengeluaran Bulan Ini: ${money(expenses.reduce((s, e) => s + toNumber(e.amount), 0))}`;
  },
  'penjualan hari ini': async () => {
    const sales = await getSalesToday();
    return `Penjualan Hari Ini: ${sales.length} transaksi, total ${money(sales.reduce((s, x) => s + toNumber(x.total), 0))}`;
  },
  'penjualan bulan ini': async () => {
    const sales = await getSalesMonth();
    return `Penjualan Bulan Ini: ${sales.length} transaksi, total ${money(sales.reduce((s, x) => s + toNumber(x.total), 0))}`;
  },
};

async function getSalesToday() {
  return prisma.sale.findMany({
    where: { status: 'COMPLETED', createdAt: { gte: startOfToday(), lte: endOfToday() } },
  });
}

async function getSalesMonth() {
  return prisma.sale.findMany({
    where: { status: 'COMPLETED', createdAt: { gte: startOfThisMonth(), lte: endOfThisMonth() } },
  });
}

async function getProfit(start: Date, end: Date) {
  const [sales, expenses] = await Promise.all([
    prisma.sale.findMany({
      where: { status: 'COMPLETED', createdAt: { gte: start, lte: end } },
      include: { items: true },
    }),
    prisma.expense.findMany({ where: { date: { gte: start, lte: end } } }),
  ]);
  const omzet = sales.reduce((s, x) => s + toNumber(x.total), 0);
  const cogs = sales.reduce(
    (s, sale) => s + sale.items.reduce((a, i) => a + toNumber(i.costPrice) * i.quantity, 0),
    0
  );
  const pengeluaran = expenses.reduce((s, e) => s + toNumber(e.amount), 0);
  return omzet - cogs - pengeluaran;
}

export async function handleCommand(socket: WASocket, from: string, text: string) {
  const normalized = text.toLowerCase().trim();

  let response: string;
  try {
    let handler: ((args: string) => Promise<string>) | undefined;

    for (const key of Object.keys(commands)) {
      if (normalized === key || normalized.startsWith(key + ' ')) {
        handler = commands[key];
        break;
      }
    }

    if (!handler) {
      response = `Perintah tidak dikenali. Ketik *help* untuk daftar perintah.\n\nAnda mengetik: "${text}"`;
    } else {
      response = await handler(normalized);
    }
  } catch (err) {
    response = `Terjadi kesalahan: ${err instanceof Error ? err.message : String(err)}`;
  }

  await socket.sendMessage(from, { text: response }).catch(() => undefined);
}
