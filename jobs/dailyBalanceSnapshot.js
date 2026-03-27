/**
 * jobs/dailyBalanceSnapshot.js – Nightly balance snapshot cron job
 *
 * KEY CONCEPT – What is a cron job?
 *
 * A cron job is a task that runs automatically on a schedule — without
 * any user pressing a button. The name comes from the Unix "cron" daemon.
 *
 * Common uses:
 *   • Send a daily summary email at 8 AM
 *   • Clean up old log files every Sunday at midnight
 *   • Snapshot financial data at end of day ← this is what we do here
 *
 * We use the `node-cron` package which lets us write schedules using
 * CRON EXPRESSION syntax:
 *
 *   '0  0  *  *  *'
 *    │  │  │  │  └── Day of week  (0-7, where 0 and 7 = Sunday)
 *    │  │  │  └───── Month        (1-12)
 *    │  │  └──────── Day of month (1-31)
 *    │  └─────────── Hour         (0-23)
 *    └────────────── Minute       (0-59)
 *
 *   '0 0 * * *'    = midnight every day
 *   '0 8 * * *'    = 8 AM every day
 *   '* /5 * * * *' = every 5 minutes  (remove the space between * and / when using)
 *
 * KEY CONCEPT – Why snapshot the balance?
 *
 * The LIVE balance row in the `balance` table is always overwritten when
 * income/expenses change. We can't go back in time to see what the balance
 * was last week from that single row.
 *
 * Each night this job inserts a new row with snapshot_type = 'daily' that
 * permanently records today's balance. The dashboard's trend chart reads
 * these daily snapshots to draw the historical line chart.
 *
 * Without this job the trend chart would always show a flat line (just the
 * one live row).
 */

const cron = require('node-cron');
const { recalculateBalance } = require('../services/balanceService');
const Balance = require('../models/balanceModel');

// ── Schedule the job ──────────────────────────────────────────────────────────
// '0 0 * * *' = run at exactly midnight every day
cron.schedule('0 0 * * *', async () => {
    try {
        console.log('[cron] Running daily balance snapshot…');

        // Step 1: Recalculate balance from scratch (income totals - expense totals)
        // This ensures the snapshot reflects the true end-of-day figures.
        const { amount_balance, total_income, total_expense } = await recalculateBalance();

        // Step 2: Write a new 'daily' row into the balance table.
        // This row is permanent — it won't be overwritten by future changes.
        await Balance.insertDailySnapshot(amount_balance, total_income, total_expense);

        console.log(`[cron] Snapshot recorded: balance = ${amount_balance.toLocaleString()}`);
    } catch (err) {
        // Log the error but don't crash the server — a snapshot failure is
        // not critical enough to take down the whole application.
        console.error('[cron] Daily snapshot failed:', err.message);
    }
});

// This message prints once when the server starts, confirming the job is armed.
console.log('[cron] Daily balance snapshot job registered (runs at midnight)');
