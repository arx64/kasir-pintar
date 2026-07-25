import QRCode from 'qrcode';
import { env } from '../../config/env.js';

type Fee = { type: 'fixed' | 'percentage'; value: number };

function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export async function generateDynamicQrisImage(params: {
  amount: number;
  fee?: Fee;
}) {
  let amount = params.amount;
  if (params.fee) {
    amount += params.fee.type === 'fixed' ? params.fee.value : Math.round((amount * params.fee.value) / 100);
  }

  const amountStr = amount.toFixed(0).padStart(8, '0');

  // Ambil static code dari env (atau placeholder) lalu sisipkan amount (coersive method 2623)
  // Format disederhanakan untuk demo lokal.
  const staticCode = env.QRIS_STATIC_CODE || '00020101021126270017ID.CO.QRIS.WWW';
  const base = staticCode.slice(0, -4); // hapus CRC lama
  const dynamicPayload = `${base}54${amountStr.length.toString().padStart(2, '0')}${amountStr}5802ID6304`;

  const crc = crc16(dynamicPayload);
  const qrisString = `${dynamicPayload}${crc}`;
  const qrImageDataUrl = await QRCode.toDataURL(qrisString, { width: 300, margin: 1 });
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 menit

  return { amount, qrisString, qrImageDataUrl, expiresAt };
}
