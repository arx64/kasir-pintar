import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('owner123', 10);

  const owner = await prisma.user.upsert({
    where: { email: 'owner@kasir.com' },
    update: {},
    create: {
      name: 'Owner',
      email: 'owner@kasir.com',
      passwordHash,
      role: Role.OWNER,
      phone: '6281234567890',
    },
  });

  const kasirPassword = await bcrypt.hash('kasir123', 10);
  const kasir = await prisma.user.upsert({
    where: { email: 'kasir@kasir.com' },
    update: {},
    create: {
      name: 'Kasir 1',
      email: 'kasir@kasir.com',
      passwordHash: kasirPassword,
      role: Role.KASIR,
    },
  });

  const categories = await Promise.all(
    ['Makanan', 'Minuman', 'Snack', 'Rokok'].map((name) =>
      prisma.category.upsert({ where: { name }, update: {}, create: { name } })
    )
  );

  const [makanan, minuman, snack] = categories;

  const products = [
    { name: 'Indomie Goreng', barcode: '8991002101412', costPrice: 2500, sellPrice: 4000, stock: 40, minStock: 10, categoryId: makanan?.id },
    { name: 'Indomie Ayam Bawang', barcode: '8991002101510', costPrice: 2500, sellPrice: 4000, stock: 3, minStock: 10, categoryId: makanan?.id },
    { name: 'Teh Botol Sosro 350ml', barcode: '8992761130030', costPrice: 3500, sellPrice: 5000, stock: 0, minStock: 5, categoryId: minuman?.id },
    { name: 'Aqua 600ml', barcode: '8993648000034', costPrice: 1500, sellPrice: 3000, stock: 24, minStock: 10, categoryId: minuman?.id },
    { name: 'Chitato Sapi Panggang', barcode: '8993175536310', costPrice: 8000, sellPrice: 12000, stock: 15, minStock: 5, categoryId: snack?.id },
    { name: 'Beng Beng', barcode: '8993648000010', costPrice: 1500, sellPrice: 2500, stock: 30, minStock: 10, categoryId: snack?.id },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { barcode: p.barcode },
      update: {},
      create: p,
    });
  }

  console.log('Seed selesai:', { owner: owner.email, kasir: kasir.email });
  console.log('Default akun:');
  console.log('Owner  -> owner@kasir.com / owner123');
  console.log('Kasir  -> kasir@kasir.com / kasir123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
