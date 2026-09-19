import { Router } from 'express';
import db from '../database.js';
import { auth, requireRole } from '../middleware.js';
import { hashPassword, generateDriverCode } from '../auth.js';

const router = Router();

const VALID_ROLES = [
  'admin', 'director', 'manager', 'supervisor',
  'operator', 'dispatcher', 'driver',
];

// ─── KRIJO PUNËTOR (admin/manager) ──────────────────────────────
router.post('/', auth, requireRole('manager'), (req, res) => {
  const { username, password, name, role, phone, email, vehicle_id } = req.body;

  if (!username || !password || !name || !role)
    return res.status(400).json({ success: false, error: 'Plotëso username, password, name, role' });
  if (!VALID_ROLES.includes(role))
    return res.status(400).json({ success: false, error: 'Rol i pavlefshëm' });
  if (password.length < 4)
    return res.status(400).json({ success: false, error: 'Password min. 4 karaktere' });

  // Vetëm admin mund të krijojë admin/director
  if (['admin', 'director'].includes(role) && req.user.role !== 'admin')
    return res.status(403).json({ success: false, error: 'Vetëm admin krijon admin/director' });

  try {
    const hash = hashPassword(password);
    const autoEmail = email || `${username.toLowerCase()}@taxiapp.local`;
    const driverCode = role === 'driver' ? generateDriverCode() : null;

    const info = db.prepare(`
      INSERT INTO users (tenant_id, username, password_hash, email, name, role, phone, driver_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.tenantId, username, hash, autoEmail, name, role, phone || null, driverCode);

    // Nëse është shofer → lidh me veturë
    if (role === 'driver' && vehicle_id) {
      db.prepare('UPDATE vehicles SET driver_id = ? WHERE id = ? AND tenant_id = ?')
        .run(info.lastInsertRowid, vehicle_id, req.user.tenantId);
    }

    db.prepare(`
      INSERT INTO audit_log (tenant_id, user_id, action, entity, entity_id, details)
      VALUES (?, ?, 'create_worker', 'user', ?, ?)
    `).run(req.user.tenantId, req.user.userId, info.lastInsertRowid,
      JSON.stringify({ username, role, driverCode }));

    res.json({
      success: true,
      userId: info.lastInsertRowid,
      driverCode,
      user: { id: info.lastInsertRowid, username, name, role, email: autoEmail, driverCode },
    });
  } catch (e) {
    if (String(e.message).includes('UNIQUE'))
      return res.status(400).json({ success: false, error: 'Username ekziston' });
    res.status(500).json({ success: false, error: e.message });
  }
});

// ─── LISTA E PUNËTORËVE ────────────────────────────────────────
router.get('/', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT id, username, name, role, email, phone, driver_code, active, last_login, created_at
    FROM users WHERE tenant_id = ? ORDER BY id DESC
  `).all(req.user.tenantId);
  res.json({ success: true, workers: rows });
});

// ─── STATUSI LIVE ──────────────────────────────────────────────
router.get('/status', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.username, u.name, u.role, u.last_login,
           hl.event AS last_event, hl.at AS last_event_at
    FROM users u
    LEFT JOIN hours_log hl ON hl.id = (
      SELECT id FROM hours_log WHERE user_id = u.id ORDER BY id DESC LIMIT 1
    )
    WHERE u.tenant_id = ? AND u.active = 1
  `).all(req.user.tenantId);
  res.json({ success: true, workers: rows });
});

// ─── PËRDITËSO ─────────────────────────────────────────────────
router.put('/:id', auth, requireRole('manager'), (req, res) => {
  const { name, role, phone, email, active } = req.body;
  const id = +req.params.id;

  const target = db.prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?')
    .get(id, req.user.tenantId);
  if (!target) return res.status(404).json({ success: false, error: 'Nuk u gjet' });

  db.prepare(`
    UPDATE users SET
      name = COALESCE(?, name),
      role = COALESCE(?, role),
      phone = COALESCE(?, phone),
      email = COALESCE(?, email),
      active = COALESCE(?, active)
    WHERE id = ? AND tenant_id = ?
  `).run(name, role, phone, email, active, id, req.user.tenantId);

  res.json({ success: true });
});

// ─── RESET FJALËKALIMI ─────────────────────────────────────────
router.post('/:id/reset-password', auth, requireRole('manager'), (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4)
    return res.status(400).json({ success: false, error: 'Min. 4 karaktere' });

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ? AND tenant_id = ?')
    .run(hashPassword(newPassword), req.params.id, req.user.tenantId);

  res.json({ success: true });
});

// ─── FSHIJ ─────────────────────────────────────────────────────
router.delete('/:id', auth, requireRole('manager'), (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ? AND tenant_id = ? AND role != "admin"')
    .run(req.params.id, req.user.tenantId);
  res.json({ success: true });
});

export default router;
