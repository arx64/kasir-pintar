import { prisma } from '../../lib/prisma.js';
import { toNumber } from '../../utils/money.js';
import { formatDateId, parseDateRange } from '../../utils/date.js';
import { getLowStockProducts } from '../product/product.service.js';

export async function getReport(from?: string, to?: string) {
  const { start, end } = parseDateRange(from, to);

  const [sales, expenses, topProducts] = await Promise.all([
    prisma.sale.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: start, lte: end },
      },
      include: {
        items: true,
        cashier: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.expense.findMany({
      where: { date: { gte: start, lte: end } },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' },
    }),
    prisma.saleItem.groupBy({
      by: ['productId', 'productName'],
      _sum: { quantity: true, subtotal: true },
      where: {
        sale: {
          status: 'COMPLETED',
          createdAt: { gte: start, lte: end },
        },
      },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    }),
  ]);

  const omzet = sales.reduce((s, x) => s + toNumber(x.total), 0);
  const cogs = sales.reduce(
    (s, sale) => s + sale.items.reduce((a, i) => a + toNumber(i.costPrice) * i.quantity, 0),
    0
  );
  const pengeluaran = expenses.reduce((s, e) => s + toNumber(e.amount), 0);
  const pendapatan = omzet - cogs;
  const profit = pendapatan - pengeluaran;

  return {
    period: {
      from: start,
      to: end,
      label: `${formatDateId(start)} - ${formatDateId(end)}`,
    },
    summary: {
      totalTransaksi: sales.length,
      omzet,
      cogs,
      pendapatan,
      pengeluaran,
      profit,
    },
    sales,
    expenses,
    topProducts: topProducts.map((p) => ({
      productId: p.productId,
      name: p.productName,
      qty: p._sum.quantity || 0,
      omzet: toNumber(p._sum.subtotal || 0),
    })),
  };
}

export async function getDailyReportText(date = new Date()) {
  const from = date.toISOString().slice(0, 10);
  const report = await getReport(from, from);
  const lowStock = await getLowStockProducts();
  const top = report.topProducts[0];

  return [
    '📊 *LAPORAN HARIAN*',
    `Tanggal: ${report.period.label}`,
    '',
    `Total Transaksi: ${report.summary.totalTransaksi}`,
    `Omzet: ${formatMoney(report.summary.omzet)}`,
    `Pendapatan: ${formatMoney(report.summary.pendapatan)}`,
    `Pengeluaran: ${formatMoney(report.summary.pengeluaran)}`,
    `Profit: ${formatMoney(report.summary.profit)}`,
    '',
    `Produk Terlaris: ${top ? `${top.name} (${top.qty}x)` : '-'}`,
    '',
    'Stok Hampir Habis:',
    ...(lowStock.length
      ? lowStock.slice(0, 8).map((p) => `• ${p.name}: ${p.stock}/${p.minStock}`)
      : ['• Tidak ada']),
  ].join('\n');
}

export async function getMonthlyReportText(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const from = `${y}-${m}-01`;
  const lastDay = new Date(y, date.getMonth() + 1, 0).getDate();
  const to = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
  const report = await getReport(from, to);
  const top = report.topProducts[0];

  return [
    '📈 *LAPORAN BULANAN*',
    `Periode: ${report.period.label}`,
    '',
    `Total Transaksi: ${report.summary.totalTransaksi}`,
    `Omzet: ${formatMoney(report.summary.omzet)}`,
    `Pendapatan: ${formatMoney(report.summary.pendapatan)}`,
    `Pengeluaran: ${formatMoney(report.summary.pengeluaran)}`,
    `Profit: ${formatMoney(report.summary.profit)}`,
    '',
    `Produk Terlaris: ${top ? `${top.name} (${top.qty}x)` : '-'}`,
  ].join('\n');
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(n);
}
