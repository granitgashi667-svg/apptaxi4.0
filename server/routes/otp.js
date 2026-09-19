import { Router } from 'express';
import db from '../database.js';

const router = Router();

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post('/send', (req, res) => {
  const { identifier } = req.body;
  if (!identifier) return res.status(400).json({ success: false, error: 'Email/telefon mungon' });

  const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?')
    .get(process.env.DEFAULT_TENANT || 'default');
  if (!tenant) return res.status(500).json({ success: false, error: 'Tenant mungon' });

  const code = genCode();
  const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO otp_codes (tenant_id, identifier, code, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(tenant.id, identifier, code, expires);

  // TODO: dërgim me email/SMS — shtojmë më vonë
  console.log(`📧 OTP për ${identifier}: ${code}`);

  res.json({ success: true, message: 'Kodi u dërgua (shiko terminalin për demo)' });
});

router.post('/verify', (req, res) => {
  const { identifier, code } = req.body;
  if (!identifier || !code)
    return res.status(400).json({ success: false, error: 'Plotëso identifier dhe code' });

  const row = db.prepare(`
    SELECT * FROM otp_codes
    WHERE identifier = ? AND code = ? AND used = 0 AND expires_at > CURRENT_TIMESTAMP
    ORDER BY id DESC LIMIT 1
  `).get(identifier, code);

  if (!row) return res.status(401).json({ success: false, error: 'Kod i pavlefshëm ose i skaduar' });

  db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').run(row.id);
  res.json({ success: true });
});

export default router;
