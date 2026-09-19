import { Router } from 'express';
import db from '../database.js';
import { auth } from '../middleware.js';

const router = Router();

// ─── OVERVIEW ──────────────────────────────────────────────────
router.get('/overview', auth, (req, res) => {
  const tid = req.user.tenantId;
  const get = (sql, ...p) => db.prepare(sql).get(tid, ...p);

  const ordersToday = get(`
    SELECT COUNT(*) c FROM orders
    WHERE tenant_id = ? AND date(created_at) = date('now')
  `).c;
  const ordersWaiting = get(`SELECT COUNT(*) c FROM orders WHERE tenant_id = ? AND status = 'waiting'`).c;
  const ordersActive = get(`SELECT COUNT(*) c FROM orders WHERE tenant_id = ? AND status IN ('assigned','onroute','arrived','taximeter')`).c;
  const ordersCompleted = get(`SELECT COUNT(*) c FROM orders WHERE tenant_id = ? AND status = 'completed' AND date(completed_at) = date('now')`).c;
  const revenueToday = get(`
    SELECT COALESCE(SUM(price),0) s FROM orders
    WHERE tenant_id = ? AND status = 'completed' AND date(completed_at) = date('now')
  `).s;
  const driversActive = get(`SELECT COUNT(*) c FROM users WHERE tenant_id = ? AND role = 'driver' AND active = 1`).c;

  res.json({
    success: true,
    stats: {
      ordersToday, ordersWaiting, ordersActive, ordersCompleted,
      revenueToday, driversActive,
    },
  });
});

// ─── DAILY ─────────────────────────────────────────────────────
router.get('/daily', auth, (req, res) => {
  const { date = new Date().toISOString().slice(0, 10) } = req.query;
  const rows = db.prepare(`
    SELECT
      strftime('%H', created_at) AS hour,
      COUNT(*) AS orders,
      COALESCE(SUM(price), 0) AS revenue
    FROM orders
    WHERE tenant_id = ? AND date(created_at) = ?
    GROUP BY hour ORDER BY hour
  `).all(req.user.tenantId, date);
  res.json({ success: true, daily: rows });
});

// ─── REVENUE ───────────────────────────────────────────────────
router.get('/revenue', auth, (req, res) => {
  const { from, to } = req.query;
  const parts = ['tenant_id = ?', "status = 'completed'"];
  const params = [req.user.tenantId];
  if (from) { parts.push('completed_at >= ?'); params.push(from); }
  if (to)   { parts.push('completed_at <= ?'); params.push(to); }

  const total = db.prepare(`
    SELECT COUNT(*) c, COALESCE(SUM(price),0) s
    FROM orders WHERE ${parts.join(' AND ')}
  `).get(...params);

  res.json({ success: true, revenue: { count: total.c, total: total.s } });
});

// ─── HOURS SUMMARY ─────────────────────────────────────────────
router.get('/hours-summary', auth, (req, res) => {
  const { from, to } = req.query;
  const parts = ['tenant_id = ?'];
  const params = [req.user.tenantId];
  if (from) { parts.push('at >= ?'); params.push(from); }
  if (to)   { parts.push('at <= ?'); params.push(to); }

  const rows = db.prepare(`
    SELECT user_id, event, COUNT(*) AS count, MIN(at) AS first_at, MAX(at) AS last_at
    FROM hours_log WHERE ${parts.join(' AND ')}
    GROUP BY user_id, event
  `).all(...params);

  res.json({ success: true, summary: rows });
});

export default router;
