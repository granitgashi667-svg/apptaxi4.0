import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, process.env.DB_PATH || './data/taxiapp.db');
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ═══════════════════════════════════════════════════════════════
// 18 TABELA
// ═══════════════════════════════════════════════════════════════
db.exec(`
CREATE TABLE IF NOT EXISTS tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  email TEXT,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator',
  phone TEXT,
  driver_code TEXT,
  active INTEGER DEFAULT 1,
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, username),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(tenant_id, role);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  plate TEXT NOT NULL,
  model TEXT,
  year INTEGER,
  color TEXT,
  driver_id INTEGER,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (driver_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  name TEXT,
  email TEXT,
  address TEXT,
  loyalty_points INTEGER DEFAULT 0,
  wallet REAL DEFAULT 0,
  blocked INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(tenant_id, phone);

CREATE TABLE IF NOT EXISTS zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  lat REAL, lng REAL, radius INTEGER DEFAULT 500,
  backup_1 INTEGER, backup_2 INTEGER, backup_3 INTEGER,
  backup_4 INTEGER, backup_5 INTEGER,
  active INTEGER DEFAULT 1,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS stands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  lat REAL, lng REAL, radius INTEGER DEFAULT 15,
  zone_id INTEGER,
  active INTEGER DEFAULT 1,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (zone_id) REFERENCES zones(id)
);

CREATE TABLE IF NOT EXISTS custom_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  address TEXT,
  lat REAL, lng REAL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS tariffs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  base_price REAL DEFAULT 0,
  price_per_km REAL DEFAULT 0,
  active INTEGER DEFAULT 1,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS remarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS predefined_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  order_code TEXT,
  client_id INTEGER,
  driver_id INTEGER,
  vehicle_id INTEGER,
  phone TEXT NOT NULL,
  client_name TEXT,
  pickup TEXT NOT NULL,
  pickup_lat REAL, pickup_lng REAL,
  destination TEXT,
  dest_lat REAL, dest_lng REAL,
  zone TEXT,
  tariff_id INTEGER,
  remark TEXT,
  price REAL,
  status TEXT DEFAULT 'waiting',
  is_preorder INTEGER DEFAULT 0,
  preorder_date DATETIME,
  assigned_at DATETIME,
  arrived_at DATETIME,
  completed_at DATETIME,
  cancelled_at DATETIME,
  cancel_reason TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (driver_id) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

CREATE TABLE IF NOT EXISTS driver_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  driver_id INTEGER NOT NULL,
  stand_id INTEGER,
  entered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  left_at DATETIME,
  active INTEGER DEFAULT 1,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (driver_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS hours_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  event TEXT NOT NULL,
  at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  thread_id INTEGER NOT NULL,
  from_id INTEGER NOT NULL,
  to_id INTEGER,
  text TEXT NOT NULL,
  seen INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (from_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sms_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  text TEXT,
  status TEXT DEFAULT 'sent',
  at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  identifier TEXT NOT NULL,
  code TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id INTEGER,
  details TEXT,
  at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  UNIQUE(tenant_id, key),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
`);

// ═══════════════════════════════════════════════════════════════
// BOOTSTRAP — tenant + admin G/1
// ═══════════════════════════════════════════════════════════════
function bootstrap() {
  const slug = process.env.DEFAULT_TENANT || 'default';

  let tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get(slug);
  if (!tenant) {
    const info = db.prepare('INSERT INTO tenants (slug, name) VALUES (?, ?)')
      .run(slug, 'Kompania Kryesore');
    tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(info.lastInsertRowid);
    console.log(`✅ Tenant u krijua: ${tenant.name} (id=${tenant.id})`);
  } else {
    console.log(`✅ Tenant ekziston: ${tenant.name} (id=${tenant.id})`);
  }

  const username = process.env.FIRST_ADMIN_USERNAME || 'G';
  const password = process.env.FIRST_ADMIN_PASSWORD || '1';
  const name = process.env.FIRST_ADMIN_NAME || 'Admin';

  const exists = db.prepare(
    'SELECT * FROM users WHERE tenant_id = ? AND username = ?'
  ).get(tenant.id, username);

  if (!exists) {
    const hash = bcrypt.hashSync(password, 10);
    const email = `${username.toLowerCase()}@taxiapp.local`;
    const info = db.prepare(`
      INSERT INTO users (tenant_id, username, password_hash, email, name, role)
      VALUES (?, ?, ?, ?, ?, 'admin')
    `).run(tenant.id, username, hash, email, name);
    console.log(`✅ Admin u krijua: ${username} / ${password} (id=${info.lastInsertRowid})`);
  } else {
    console.log(`✅ Admin ekziston: ${username}`);
  }

  const defaults = {
    company_name: 'Kompania Kryesore',
    currency: 'EUR',
    language: 'sq',
    phone: '',
    address: '',
  };
  const ins = db.prepare(
    'INSERT OR IGNORE INTO settings (tenant_id, key, value) VALUES (?, ?, ?)'
  );
  for (const [k, v] of Object.entries(defaults)) ins.run(tenant.id, k, v);

  console.log(`✅ 18 tabela u inicializuan`);
  console.log(`✅ Baza e dhënave: ${DB_PATH}`);
}

bootstrap();

export default db;
