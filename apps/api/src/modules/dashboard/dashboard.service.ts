import { prisma } from '../../lib/prisma.js';
import { toNumber } from '../../utils/money.js';
import { endOfThisMonth, endOfToday, startOfThisMonth, startOfToday } from '../../utils/date.js';
import { getLowStockProducts } from '../product/product.service.js';

export async function getDashboardSummary() {
  const todayStart = startOfToday();
  const todayEnd = endOfToday();
  const monthStart = startOfThisMonth();
  const monthEnd = endOfThisMonth();

  // Rentang 7 hari terakhir (untuk chart) diambil sekali agar tidak ada N+1 query.
  const chartStart = new Date(todayStart);
  chartStart.setDate(chartStart.getDate() - 6);
  chartStart.setHours(0, 0, 0, 0);

  const [salesToday, salesMonth, expensesToday, expensesMonth, topProducts, lowStock, chartSales, chartExpenses] =
    await Promise.all([
      prisma.sale.findMany({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: todayStart, lte: todayEnd },
        },
        include: { items: true },
      }),
      prisma.sale.findMany({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: monthStart, lte: monthEnd },
        },
        include: { items: true },
      }),
      prisma.expense.findMany({
        where: { date: { gte: todayStart, lte: todayEnd } },
      }),
      prisma.expense.findMany({
        where: { date: { gte: monthStart, lte: monthEnd } },
      }),
      prisma.saleItem.groupBy({
        by: ['productId', 'productName'],
        _sum: { quantity: true, subtotal: true },
        where: {
          sale: {
            status: 'COMPLETED',
            createdAt: { gte: monthStart, lte: monthEnd },
          },
        },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      getLowStockProducts(),
      // Satu query untuk semua omzet 7 hari terakhir.
      prisma.sale.findMany({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: chartStart, lte: todayEnd },
        },
        select: { createdAt: true, total: true },
      }),
      // Satu query untuk semua pengeluaran 7 hari terakhir.
      prisma.expense.findMany({
        where: { date: { gte: chartStart, lte: todayEnd } },
        select: { date: true, amount: true },
      }),
    ]);

  const omzetToday = salesToday.reduce((s, x) => s + toNumber(x.total), 0);
  const omzetMonth = salesMonth.reduce((s, x) => s + toNumber(x.total), 0);
  const cogsToday = salesToday.reduce(
    (s, sale) => s + sale.items.reduce((a, i) => a + toNumber(i.costPrice) * i.quantity, 0),
    0
  );
  const cogsMonth = salesMonth.reduce(
    (s, sale) => s + sale.items.reduce((a, i) => a + toNumber(i.costPrice) * i.quantity, 0),
    0
  );
  const expenseToday = expensesToday.reduce((s, e) => s + toNumber(e.amount), 0);
  const expenseMonth = expensesMonth.reduce((s, e) => s + toNumber(e.amount), 0);
  const pendapatanToday = omzetToday - cogsToday;
  const pendapatanMonth = omzetMonth - cogsMonth;
  const profitToday = pendapatanToday - expenseToday;
  const profitMonth = pendapatanMonth - expenseMonth;

  // Susun chart 7 hari dari hasil query tunggal (tanpa loop query).
  const chart: Array<{ date: string; omzet: number; pengeluaran: number }> = [];
  const omzetByDay = new Map<string, number>();
  for (const s of chartSales) {
    const key = s.createdAt.toISOString().slice(0, 10);
    omzetByDay.set(key, (omzetByDay.get(key) || 0) + toNumber(s.total));
  }
  const expenseByDay = new Map<string, number>();
  for (const e of chartExpenses) {
    const key = e.date.toISOString().slice(0, 10);
    expenseByDay.set(key, (expenseByDay.get(key) || 0) + toNumber(e.amount));
  }
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    chart.push({
      date: key,
      omzet: omzetByDay.get(key) || 0,
      pengeluaran: expenseByDay.get(key) || 0,
    });
  }

  return {
    today: {
      totalTransaksi: salesToday.length,
      omzet: omzetToday,
      pendapatan: pendapatanToday,
      pengeluaran: expenseToday,
      profit: profitToday,
    },
    month: {
      totalTransaksi: salesMonth.length,
      omzet: omzetMonth,
      pendapatan: pendapatanMonth,
      pengeluaran: expenseMonth,
      profit: profitMonth,
    },
    topProducts: topProducts.map((p) => ({
      productId: p.productId,
      name: p.productName,
      qty: p._sum.quantity || 0,
      omzet: toNumber(p._sum.subtotal || 0),
    })),
    lowStock: lowStock.slice(0, 10),
    chart,
  };
}
