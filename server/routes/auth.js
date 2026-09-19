import { Router } from 'express';
import db from '../database.js';
import { auth } from '../middleware.js';
import { verifyPassword, hashPassword, signToken } from '../auth.js';

const router = Router();

// ─── LOGIN me username ──────────────────────────────────────────
router.post('/login', (req, res) => {
  const { username, password, tenant } = req.body;
  if (!username || !password)
    return res.status(400).json({ success: false, error: 'Plotëso username dhe password' });

  const tenantSlug = tenant || process.env.DEFAULT_TENANT || 'default';
  const t = db.prepare('SELECT * FROM tenants WHERE slug = ? AND active = 1').get(tenantSlug);
  if (!t) return res.status(401).json({ success: false, error: 'Kompania nuk ekziston' });

  const user = db.prepare(
    'SELECT * FROM users WHERE tenant_id = ? AND username = ? AND active = 1'
  ).get(t.id, username);
  if (!user) return res.status(401).json({ success: false, error: 'Username ose password gabim' });

  if (!verifyPassword(password, user.password_hash))
    return res.status(401).json({ success: false, error: 'Username ose password gabim' });

  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
  db.prepare(`
    INSERT INTO audit_log (tenant_id, user_id, action, entity, entity_id)
    VALUES (?, ?, 'login', 'user', ?)
  `).run(user.tenant_id, user.id, user.id);

  const token = signToken({
    userId: user.id,
    username: user.username,
    role: user.role,
    tenantId: user.tenant_id,
    tenantSlug: t.slug,
  });

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      email: user.email,
      phone: user.phone,
      driver_code: user.driver_code,
      tenantId: user.tenant_id,
      tenantSlug: t.slug,
    },
  });
});

// ─── ME ─────────────────────────────────────────────────────────
router.get('/me', auth, (req, res) => {
  const user = db.prepare(`
    SELECT id, username, name, role, email, phone, driver_code, tenant_id, last_login
    FROM users WHERE id = ?
  `).get(req.user.userId);
  if (!user) return res.status(404).json({ success: false, error: 'User nuk u gjet' });

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      email: user.email,
      phone: user.phone,
      driver_code: user.driver_code,
      tenantId: user.tenant_id,
      lastLogin: user.last_login,
    },
  });
});

// ─── CHANGE PASSWORD ────────────────────────────────────────────
router.post('/change-password', auth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ success: false, error: 'Plotëso të gjitha fushat' });
  if (newPassword.length < 4)
    return res.status(400).json({ success: false, error: 'Min. 4 karaktere' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId);
  if (!verifyPassword(currentPassword, user.password_hash))
    return res.status(401).json({ success: false, error: 'Fjalëkalimi aktual gabim' });

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .run(hashPassword(newPassword), user.id);

  db.prepare(`
    INSERT INTO audit_log (tenant_id, user_id, action, entity, entity_id)
    VALUES (?, ?, 'change_password', 'user', ?)
  `).run(user.tenant_id, user.id, user.id);

  res.json({ success: true, message: 'Fjalëkalimi u ndryshua' });
});

// ─── LOGOUT ─────────────────────────────────────────────────────
router.post('/logout', auth, (req, res) => {
  db.prepare(`
    INSERT INTO audit_log (tenant_id, user_id, action, entity, entity_id)
    VALUES (?, ?, 'logout', 'user', ?)
  `).run(req.user.tenantId, req.user.userId, req.user.userId);
  res.json({ success: true });
});

export default router;
