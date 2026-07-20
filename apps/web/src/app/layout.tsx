import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kasir Pintar - Smart POS',
  description: 'Aplikasi Point of Sale sederhana dengan integrasi WhatsApp',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
