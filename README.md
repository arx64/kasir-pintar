# Kasir Pintar — Smart POS dengan Integrasi WhatsApp (Baileys v7)

Aplikasi Point of Sale sederhana untuk operasional harian gerai:
penjualan, pengeluaran, stok, omzet, profit, laporan, dan notifikasi
WhatsApp otomatis ke owner.

## Stack
- **Frontend**: Next.js 15 (App Router) + Tailwind CSS + Recharts
- **Backend**: Node.js + Express + TypeScript (ESM)
- **Database**: PostgreSQL + Prisma ORM
- **WhatsApp**: @whiskeysockets/baileys 7.0.0-rc13 (v7, ESM)
- **Scheduler**: node-cron

## Struktur Project
```
kasir-pintar/
├── apps/
│   ├── api/                      # Express + Prisma + Baileys
│   │   ├── src/
│   │   │   ├── config/           # env config (zod)
│   │   │   ├── lib/              # prisma, logger
│   │   │   ├── middlewares/     # auth (JWT), error handler
│   │   │   ├── modules/
│   │   │   │   ├── auth/         # login, me
│   │   │   │   ├── product/      # CRUD barang + kategori + stok
│   │   │   │   ├── sales/        # transaksi, cancel, refund
│   │   │   │   ├── expense/      # pengeluaran operasional
│   │   │   │   ├── dashboard/    # ringkasan + grafik 7 hari
│   │   │   │   ├── report/       # laporan harian/bulanan
│   │   │   │   ├── whatsapp/     # service Baileys + command bot
│   │   │   │   ├── notification/ # broadcast owner (terpisah dari POS)
│   │   │   │   ├── scheduler/    # cron laporan & cek stok
│   │   │   │   ├── customer-request/
│   │   │   │   └── settings/
│   │   │   ├── utils/           # money, date, invoice, query
│   │   │   └── index.ts         # entry point API
│   │   └── prisma/schema.prisma
│   └── web/                     # Next.js App Router
│       └── src/app/{login,dashboard,kasir,produk,penjualan,pengeluaran,laporan,whatsapp}
├── docker-compose.yml           # PostgreSQL
├── package.json                 # workspaces monorepo
└── .env.example
```

## Prasyarat
- Node.js >= 20
- PostgreSQL (via Docker atau lokal)
- npm (di Windows, panggil via `npm.cmd` jika execution policy PowerShell memblokir `npm.ps1`)

## Setup

### 1. Clone & install
```bash
npm install
```

### 2. Jalankan PostgreSQL
```bash
docker compose up -d
```
atau pakai PostgreSQL lokal, lalu set `DATABASE_URL` di `.env`.

### 3. Konfigurasi env
Salin `.env.example` → `.env`, lalu sesuaikan:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/kasir_pintar?schema=public"
JWT_SECRET=ganti-dengan-secret-acak-panjang
WA_OWNER_NUMBERS=6281234567890        # nomor owner (WhatsApp), tanpa "+"
WA_LARGE_SALE_THRESHOLD=500000
WA_LARGE_EXPENSE_THRESHOLD=200000
```

### 4. Migrasi & seed database
```bash
npm run db:generate
npm run db:migrate      # atau: npm run db:push (dev)
npm run db:seed
```

Akun default:
- Owner → `owner@kasir.com` / `owner123`
- Kasir → `kasir@kasir.com` / `kasir123`

### 5. Jalankan
```bash
npm run dev          # API + Web bersamaan
```
atau terpisah:
```bash
npm run dev:api      # http://localhost:4000
npm run dev:web      # http://localhost:3000
```

Buka `http://localhost:3000/login`.

## Koneksi WhatsApp (Baileys v7)

Saat API start, Baileys otomatis connect. Scan QR yang tampil di terminal
API dengan WhatsApp di ponsel owner (atau pakai pairing code di service).
Session disimpan di `apps/api/wa_auth`.

Untuk reset koneksi: hapus folder `apps/api/wa_auth` lalu restart API.

## Fitur WhatsApp

### Notifikasi otomatis ke owner
- Stok menipis / habis
- Transaksi nominal besar
- Refund transaksi
- Pembatalan transaksi
- Pengeluaran besar
- Laporan harian (default 21.00)
- Laporan bulanan
- Permintaan customer baru

### Command bot (kirim dari WhatsApp owner)
```
laporan hari ini
laporan bulan ini
omzet hari ini
omzet bulan ini
profit hari ini
profit bulan ini
stok
stok hampir habis
barang terlaris
pengeluaran hari ini
pengeluaran bulan ini
penjualan hari ini
penjualan bulan ini
help
```

## Role
- **Owner**: dashboard, semua transaksi, produk (CRUD), laporan, pengaturan, status WhatsApp
- **Kasir**: transaksi POS, lihat stok, catat pengeluaran, riwayat miliknya

## Endpoint API
```
GET    /health
POST   /api/auth/login
GET    /api/auth/me
GET    /api/products
POST   /api/products                 (owner)
PUT    /api/products/:id             (owner)
POST   /api/products/:id/adjust-stock (owner)
GET    /api/products/categories
POST   /api/products/categories       (owner)
GET    /api/sales
GET    /api/sales/:id
POST   /api/sales
POST   /api/sales/:id/cancel
POST   /api/sales/:id/refund         (owner)
GET    /api/expenses
POST   /api/expenses
DELETE /api/expenses/:id             (owner)
GET    /api/dashboard                 (owner)
GET    /api/reports                   (owner)
GET    /api/whatsapp/status           (owner)
POST   /api/whatsapp/connect          (owner)
POST   /api/whatsapp/test             (owner)
GET    /api/whatsapp/logs            (owner)
POST   /api/customer-requests         (public)
GET    /api/customer-requests          (owner)
PATCH  /api/customer-requests/:id/status (owner)
GET    /api/settings
PUT    /api/settings                  (owner)
```

## Scheduler
Dikonfigurasi via env (cron):
- `DAILY_REPORT_CRON` (default `0 21 * * *`)
- `MONTHLY_REPORT_CRON` (default `0 21 1 * *`)
- `STOCK_CHECK_CRON` (default `*/30 * * * *`)
- Timezone `TZ` (default `Asia/Jakarta`)

## Verifikasi Build
- API: `cd apps/api && npx tsc --noEmit` (sudah lolos)
- Web: `cd apps/web && npx next build` (sudah lolos, 12 route statik)

## Catatan
- Semua modul dipisah (POS terpisah dari WhatsApp/scheduler) sesuai arsitektur.
- Tidak ada placeholder/TODO; kode production-ready dan modular.
- Untuk Windows: jika `npm` PowerShell diblokir, gunakan `npm.cmd` / `npx.cmd` langsung.