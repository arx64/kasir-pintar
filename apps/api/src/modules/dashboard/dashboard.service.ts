import { prisma } from '../../lib/prisma.js';
import { toNumber } from '../../utils/money.js';
import { endOfThisMonth, endOfToday, startOfThisMonth, startOfToday } from '../../utils/date.js';
import { getLowStockProducts } from '../product/product.service.js';

export async function getDashboardSummary() {
  const todayStart = startOfToday();
  const todayEnd = endOfToday();
  const monthStart = startOfThisMonth();
  const monthEnd = endOfThisMonth();

  const [salesToday, salesMonth, expensesToday, expensesMonth, topProducts, lowStock] =
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

  // last 7 days chart
  const chart = [] as Array<{ date: string; omzet: number; pengeluaran: number }>;
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - i);
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    const daySales = salesMonth.filter((s) => s.createdAt >= start && s.createdAt <= end);
    // for older than month start, query separately if needed
    const dayOmzet = daySales.reduce((s, x) => s + toNumber(x.total), 0);
    chart.push({
      date: start.toISOString().slice(0, 10),
      omzet: dayOmzet,
      pengeluaran: 0,
    });
  }

  const expenseLast7 = await prisma.expense.findMany({
    where: {
      date: {
        gte: new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000),
        lte: todayEnd,
      },
    },
  });

  for (const row of chart) {
    const dayStart = new Date(row.date + 'T00:00:00');
    const dayEnd = new Date(row.date + 'T23:59:59.999');
    row.pengeluaran = expenseLast7
      .filter((e) => e.date >= dayStart && e.date <= dayEnd)
      .reduce((s, e) => s + toNumber(e.amount), 0);

    // fill omzet for days outside current salesMonth fetch if empty
    if (row.omzet === 0) {
      const daySales = await prisma.sale.findMany({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: dayStart, lte: dayEnd },
        },
      });
      row.omzet = daySales.reduce((s, x) => s + toNumber(x.total), 0);
    }
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
