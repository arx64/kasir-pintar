import makeWASocket, {
  Browsers,
  type CacheStore,
  type ConnectionState,
  type WAMessageContent,
  type WAMessageKey,
  type WASocket,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import NodeCache from '@cacheable/node-cache';
import QRCode from 'qrcode';
import { Boom } from '@hapi/boom';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import P from 'pino';
import { env } from '../../config/env.js';
import { ownerNumbers } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { handleCommand } from './commands.js';

const authDir = path.resolve(process.cwd(), env.WA_AUTH_DIR);
if (!existsSync(authDir)) mkdirSync(authDir, { recursive: true });

let sock: WASocket | null = null;
let connectionState: ConnectionState = { connection: 'close' };
let qrDataUrl: string | null = null;
const msgRetryCounterCache = new NodeCache() as CacheStore;

export async function startWhatsApp(): Promise<WASocket> {
  if (sock && connectionState.connection === 'open') return sock;

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();
  const waLogger = P({ level: 'warn' }, P.destination(2));
  logger.info({ version: version.join('.') }, 'using WA version');

  const socket = makeWASocket({
    version,
    logger: waLogger,
    browser: Browsers.ubuntu('Kasir Pintar'),
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, waLogger),
    },
    msgRetryCounterCache,
    generateHighQualityLinkPreview: true,
    getMessage: async (_key: WAMessageKey): Promise<WAMessageContent | undefined> => {
      return { conversation: 'OK' };
    },
  });

  sock = socket;

  socket.ev.process(async (events) => {
    if (events['connection.update']) {
      const update = events['connection.update'];
      connectionState = { ...connectionState, ...update };
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          qrDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 1 });
          logger.info('QR code generated. Buka halaman WhatsApp di browser untuk scan.');
        } catch (err) {
          logger.error({ err }, 'Failed to render QR data URL');
        }
      }

      if (connection === 'open') {
        qrDataUrl = null;
        logger.info('WhatsApp connected');
      }

      if (connection === 'close') {
        qrDataUrl = null;
        const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
        logger.warn({ code }, 'WA connection closed');
        if (code !== 401 && code !== 403) {
          await startWhatsApp();
        } else {
          logger.error('Logged out. Hapus folder wa_auth lalu restart untuk scan ulang.');
        }
      }
    }

    if (events['creds.update']) {
      await saveCreds();
    }

    if (events['messages.upsert']) {
      const upsert = events['messages.upsert'];
      if (upsert.type === 'notify') {
        for (const msg of upsert.messages) {
          if (msg.key.fromMe) continue;
          const from = msg.key.remoteJid;
          if (!from) continue;
          const text =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption;
          if (typeof text === 'string' && text.trim()) {
            await logMessage(msg.key.id || '', from, text);
            await handleCommand(socket, from, text.trim());
          }
        }
      }
    }
  });

  return socket;
}

export function getSocket(): WASocket | null {
  return sock;
}

export function isConnected(): boolean {
  return connectionState.connection === 'open';
}

const PLACEHOLDER_NUMBERS = new Set(['6281234567890', '6280000000000', '0000000000', '1234567890']);

export function getOwnerJids(): string[] {
  const fromEnv = ownerNumbers.filter((n) => n && !PLACEHOLDER_NUMBERS.has(n));
  const socket = getSocket();

  if (fromEnv.length > 0) {
    return fromEnv.map((n) => (n.includes('@') ? n : `${n}@s.whatsapp.net`));
  }

  if (socket?.user?.id) {
    return [socket.user.id];
  }

  return [];
}

export async function broadcastToOwners(message: string, meta?: Record<string, unknown>) {
  const jids = getOwnerJids();
  if (jids.length === 0) {
    logger.warn('No owner JIDs available for broadcast (WA not connected & no owner numbers configured)');
    return;
  }
  await Promise.allSettled(jids.map((jid) => sendWhatsAppMessage(jid, message, meta)));
}

async function logMessage(id: string, from: string, text: string) {
  await prisma.whatsAppLog
    .create({
      data: {
        type: 'COMMAND_REPLY',
        to: from,
        message: text,
        status: 'RECEIVED',
        meta: { messageId: id },
      },
    })
    .catch((e) => logger.error({ err: e }, 'log message failed'));
}

export async function sendWhatsAppMessage(
  to: string,
  message: string,
  meta?: Record<string, unknown>
) {
  const socket = getSocket();
  const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

  if (!socket || !isConnected()) {
    await logSend({ to, message, status: 'FAILED', type: 'NOTIFICATION', meta });
    throw new Error('WhatsApp belum terhubung');
  }

  try {
    const sent = await socket.sendMessage(jid, { text: message });
    await logSend({
      to,
      message,
      status: 'SENT',
      type: 'NOTIFICATION',
      meta: { ...meta, key: sent?.key },
    });
    return sent;
  } catch (err) {
    await logSend({
      to,
      message,
      status: 'FAILED',
      type: 'NOTIFICATION',
      meta: { ...meta, err: String(err) },
    });
    throw err;
  }
}

async function logSend(input: {
  to: string;
  message: string;
  status: string;
  type: 'NOTIFICATION' | 'COMMAND_REPLY' | 'ERROR';
  meta?: unknown;
}) {
  await prisma.whatsAppLog
    .create({
      data: {
        type: input.type,
        to: input.to,
        message: input.message,
        status: input.status,
        meta: input.meta as object,
      },
    })
    .catch((e) => logger.error({ err: e }, 'log send failed'));
}

export function getQrState() {
  return {
    connected: isConnected(),
    qr: connectionState.qr || null,
    qrDataUrl,
    connection: connectionState.connection,
  };
}