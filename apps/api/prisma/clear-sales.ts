import { prisma } from '../src/lib/prisma.js';

async function main() {
  const args = process.argv.slice(2);
  const resetStock = !args.includes('--no-stock-reset');
  const onlyCancelled = args.includes('--only-cancelled');
  const onlyRefunded = args.includes('--only-refunded');

  const statusFilter = onlyCancelled
    ? ['CANCELLED']
    : onlyRefunded
      ? ['REFUNDED']
      : ['COMPLETED', 'CANCELLED', 'REFUNDED'];

  const sales = await prisma.sale.findMany({
    where: { status: { in: statusFilter as any } },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });

  if (sales.length === 0) {
    console.log('Tidak ada data penjualan yang cocok untuk dihapus.');
    return;
  }

  const saleIds = sales.map((sale) => sale.id);
  const affectedSaleIds = new Set<string>();

  await prisma.$transaction(async (tx) => {
    if (resetStock) {
      for (const sale of sales) {
        if (sale.status !== 'COMPLETED') continue;

        for (const item of sale.items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) continue;
          await tx.product.update({
            where: { id: product.id },
            data: { stock: product.stock + item.quantity },
          });
        }
      }
    }

    const linkedLogs = await tx.stockLog.findMany({
      where: { refId: { in: saleIds } },
      select: { id: true, refId: true },
    });

    linkedLogs.forEach((log) => {
      if (log.refId) affectedSaleIds.add(log.refId);
    });

    await tx.stockLog.deleteMany({
      where: { refId: { in: saleIds } },
    });

    await tx.sale.deleteMany({
      where: { id: { in: saleIds } },
    });
  });

  console.log(`Berhasil menghapus ${sales.length} data penjualan.`);
  console.log(`Reset stok: ${resetStock ? 'ya' : 'tidak'}`);
  if (affectedSaleIds.size > 0) {
    console.log(`Stock log terhapus untuk ${affectedSaleIds.size} transaksi.`);
  }
}

main()
  .catch((error) => {
    console.error('Gagal menghapus data penjualan:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
