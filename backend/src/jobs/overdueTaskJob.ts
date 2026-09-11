import cron from 'node-cron';
import { prisma } from '../lib/prisma';

/**
 * node-cron was chosen over a full queue (Bull/BullMQ) deliberately: this job
 * has no retryable side effects, no per-item payload, and no need for
 * distributed workers - it is a single periodic UPDATE statement. Bull would
 * add a Redis dependency purely to run something node-cron already does in a
 * few lines. If this grew into something that dispatches emails/webhooks per
 * overdue task with retry semantics, Bull would become the better fit - see
 * README "known limitations".
 *
 * Runs every 5 minutes and flips isOverdue for any task whose dueDate has
 * passed and isn't already Done. This is the ONLY place isOverdue is ever
 * set - it is never computed on the fly in a GET handler, so "overdue" is a
 * durable fact you can filter/index on, not a per-request calculation.
 */
export function startOverdueTaskJob() {
  const task = cron.schedule('*/5 * * * *', async () => {
    try {
      const result = await prisma.task.updateMany({
        where: {
          dueDate: { lt: new Date() },
          status: { not: 'DONE' },
          isOverdue: false,
        },
        data: { isOverdue: true },
      });
      if (result.count > 0) {
        console.log(`[overdue-job] Flagged ${result.count} task(s) as overdue`);
      }
    } catch (err) {
      console.error('[overdue-job] Failed to flag overdue tasks:', err);
    }
  });

  return task;
}
