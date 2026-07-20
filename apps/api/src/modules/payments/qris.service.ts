import QRCode from 'qrcode';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';

type TLV = {
  tag: string;
  length: number;
  value: string;
  children?: TLV[];
};

type GenerateQrisOptions = {
  amount: number;
  fee?:
    | { type: 'fixed'; value: number }
    | { type: 'percentage'; value: number };
};

function crc16Ccitt(input: string) {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function parseTLV(data: string): TLV[] {
  const elements: TLV[] = [];
  let pos = 0;
  while (pos < data.length) {
    if (pos + 4 > data.length) break;
    const tag = data.substring(pos, pos + 2);
    const len = Number(data.substring(pos + 2, pos + 4));
    const value = data.substring(pos + 4, pos + 4 + len);
    const node: TLV = { tag, length: len, value };
    const tagNum = Number(tag);
    const nested = (tagNum >= 26 && tagNum <= 51) || tag === '62';
    if (nested) {
      try {
        node.children = parseTLV(value);
      } catch {
        // ignore nested parse failure
      }
    }
    elements.push(node);
    pos += 4 + len;
  }
  return elements;
}

function buildTLV(elements: TLV[]): string {
  return elements
    .map((element) => {
      const value = element.children ? buildTLV(element.children) : element.value;
      return `${element.tag}${String(value.length).padStart(2, '0')}${value}`;
    })
    .join('');
}

function makeTLV(tag: string, value: string): TLV {
  return { tag, length: value.length, value };
}

function validateStaticQris(qris: string) {
  if (!qris || !qris.startsWith('000201')) {
    throw new ApiError(400, 'QRIS statis tidak valid');
  }
  if (qris.length < 20) {
    throw new ApiError(400, 'QRIS statis terlalu pendek');
  }
  const withoutCrc = qris.slice(0, -4);
  const declared = qris.slice(-4).toUpperCase();
  const actual = crc16Ccitt(withoutCrc);
  if (declared !== actual) {
    throw new ApiError(400, `CRC QRIS tidak valid (expected ${actual}, got ${declared})`);
  }
}

export function generateDynamicQris(options: GenerateQrisOptions) {
  const staticQris = env.QRIS_STATIC_CODE?.trim();
  if (!staticQris) {
    throw new ApiError(400, 'QRIS_STATIC_CODE belum diatur di environment');
  }
  if (!Number.isFinite(options.amount) || options.amount <= 0) {
    throw new ApiError(400, 'Nominal QRIS harus lebih dari 0');
  }

  validateStaticQris(staticQris);
  const elements = parseTLV(staticQris);
  const result: TLV[] = [];
  const managedTags = new Set(['54', '55', '56', '57', '63']);
  let inserted = false;

  for (const element of elements) {
    if (managedTags.has(element.tag)) continue;

    if (element.tag === '01') {
      result.push(makeTLV('01', '12'));
      continue;
    }

    if (element.tag === '58' && !inserted) {
      result.push(makeTLV('54', String(options.amount)));
      if (options.fee) {
        if (options.fee.type === 'fixed') {
          result.push(makeTLV('55', '02'));
          result.push(makeTLV('56', String(options.fee.value)));
        } else {
          result.push(makeTLV('55', '03'));
          result.push(makeTLV('57', String(options.fee.value)));
        }
      }
      inserted = true;
    }

    result.push(element);
  }

  if (!inserted) {
    result.push(makeTLV('54', String(options.amount)));
  }

  const withoutCrc = buildTLV(result) + '6304';
  const crc = crc16Ccitt(withoutCrc);
  const qrisString = withoutCrc + crc;

  return {
    amount: options.amount,
    qrisString,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  };
}

export async function generateDynamicQrisImage(options: GenerateQrisOptions) {
  const payload = generateDynamicQris(options);
  const qrImageDataUrl = await QRCode.toDataURL(payload.qrisString, { width: 320, margin: 2 });
  return { ...payload, qrImageDataUrl };
}