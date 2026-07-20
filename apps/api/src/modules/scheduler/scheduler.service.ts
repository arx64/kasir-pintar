import cron from 'node-cron';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { sendDailyReport, sendMonthlyReport, notifyStockAlerts } from '../notification/notification.service.js';

let started = false;

export function startScheduler() {
  if (started) return;
  started = true;

  const jobs = [
    {
      name: 'daily-report',
      expr: env.DAILY_REPORT_CRON,
      task: () => safe('daily-report', sendDailyReport),
    },
    {
      name: 'monthly-report',
      expr: env.MONTHLY_REPORT_CRON,
      task: () => safe('monthly-report', sendMonthlyReport),
    },
    {
      name: 'stock-check',
      expr: env.STOCK_CHECK_CRON,
      task: () => safe('stock-check', notifyStockAlerts),
    },
  ];

  for (const job of jobs) {
    if (cron.validate(job.expr)) {
      cron.schedule(job.expr, () => job.task(), { timezone: env.TZ });
      logger.info({ job: job.name, expr: job.expr }, 'Scheduler registered');
    } else {
      logger.warn({ job: job.name, expr: job.expr }, 'Invalid cron expression, skipping');
    }
  }
}

async function safe(name: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err) {
    logger.error({ err, job: name }, 'Scheduler job failed');
  }
}
