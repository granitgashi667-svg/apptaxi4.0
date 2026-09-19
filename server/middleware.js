import jwt from 'jsonwebtoken';
import db from './database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-ndryshoje';

// Lexon JWT → req.user = { userId, username, role, tenantId, tenantSlug }
export function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return res.status(401).json({ success: false, error: 'Pa token' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Token i pavlefshëm ose i skaduar' });
  }
}

// RREGULL ABSOLUT: Admin kalon GJITHMONË kudo
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Pa autorizim' });
    if (req.user.role === 'admin') return next();
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Nuk ke leje për këtë veprim' });
    }
    next();
  };
}

// Shton audit log
export function audit(action, entity, entityId = null, details = null) {
  return (req, _res, next) => {
    try {
      db.prepare(`
        INSERT INTO audit_log (tenant_id, user_id, action, entity, entity_id, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(req.user?.tenantId, req.user?.userId, action, entity, entityId, details);
    } catch {}
    next();
  };
}

export { JWT_SECRET };
