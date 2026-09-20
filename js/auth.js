// ═══════════════════════════════════════════════════════════════
// js/auth.js — Helper për login/logout (zëvendëson Firebase Auth)
// ═══════════════════════════════════════════════════════════════

import { TaxiAPI, setSession, clearSession, getUser, getToken } from './api.js';

export async function login(username, password, tenant) {
  const res = await TaxiAPI.auth.login(username, password, tenant);
  if (res.success) {
    setSession(res.token, res.user);
    return res.user;
  }
  throw new Error(res.error || 'Login dështoi');
}

export async function logout() {
  try { await TaxiAPI.auth.logout(); } catch {}
  clearSession();
  window.location.href = '/index.html';
}

export function currentUser() {
  return getUser();
}

export function isLoggedIn() {
  return !!getToken();
}

// Ridrejto sipas rolit
export function redirectByRole(user) {
  const r = user?.role;
  if (r === 'admin' || r === 'director' || r === 'manager'
      || r === 'supervisor' || r === 'operator' || r === 'dispatcher') {
    window.location.href = '/index.html';
  } else if (r === 'driver') {
    window.location.href = '/driver.html';
  } else if (r === 'client') {
    window.location.href = '/client.html';
  } else {
    window.location.href = '/index.html';
  }
}

// Guard: kërkon login + role
export function requireRole(...roles) {
  const u = getUser();
  if (!u || !getToken()) { window.location.href = '/index.html'; return null; }
  if (u.role === 'admin') return u; // admin kalon kudo
  if (roles.length && !roles.includes(u.role)) {
    window.location.href = '/index.html';
    return null;
  }
  return u;
}
