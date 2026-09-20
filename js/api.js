
---

## 📦 24. `js/api.js` — Klient HTTP

```js
// ═══════════════════════════════════════════════════════════════
// js/api.js — Klient HTTP për TaxiApp (zëvendëson Firebase)
// ═══════════════════════════════════════════════════════════════

const API_BASE = '/api';

// ─── Token storage ─────────────────────────────────────────────
export const getToken = () => localStorage.getItem('taxi_token');
export const getUser = () => {
  try { return JSON.parse(localStorage.getItem('taxi_user')); } catch { return null; }
};
export const setSession = (token, user) => {
  localStorage.setItem('taxi_token', token);
  localStorage.setItem('taxi_user', JSON.stringify(user));
};
export const clearSession = () => {
  localStorage.removeItem('taxi_token');
  localStorage.removeItem('taxi_user');
};

// ─── Fetch wrapper ─────────────────────────────────────────────
async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Gabim rrjeti');
    err.status = res.status;
    throw err;
  }
  return data;
}

// ─── API ───────────────────────────────────────────────────────
export const TaxiAPI = {
  // AUTH
  auth: {
    login: (username, password, tenant) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password, tenant }) }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: () => request('/auth/me'),
    changePassword: (currentPassword, newPassword) =>
      request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  },

  // WORKERS
  workers: {
    list: () => request('/workers'),
    status: () => request('/workers/status'),
    create: (data) => request('/workers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/workers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    resetPassword: (id, newPassword) =>
      request(`/workers/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),
    remove: (id) => request(`/workers/${id}`, { method: 'DELETE' }),
  },

  // ORDERS
  orders: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request('/orders' + (q ? `?${q}` : ''));
    },
    waiting: () => request('/orders/waiting'),
    preorders: () => request('/orders/preorders'),
    get: (id) => request(`/orders/${id}`),
    create: (data) => request('/orders', { method: 'POST', body: JSON.stringify(data) }),
    assign: (id, driverId) =>
      request(`/orders/${id}/assign`, { method: 'POST', body: JSON.stringify({ driver_id: driverId }) }),
    update: (id, data) => request(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    cancel: (id, reason) =>
      request(`/orders/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
    remove: (id) => request(`/orders/${id}`, { method: 'DELETE' }),
  },

  // DRIVERS
  drivers: {
    list: () => request('/drivers'),
    me: () => request('/drivers/me'),
    setStatus: (id, status) =>
      request(`/drivers/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    updateLocation: (id, lat, lng) =>
      request(`/drivers/${id}/location`, { method: 'POST', body: JSON.stringify({ lat, lng }) }),
  },

  // VEHICLES
  vehicles: {
    list: () => request('/vehicles'),
    create: (data) => request('/vehicles', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`/vehicles/${id}`, { method: 'DELETE' }),
  },

  // CLIENTS
  clients: {
    list: (search) => request('/clients' + (search ? `?search=${encodeURIComponent(search)}` : '')),
    byPhone: (phone) => request(`/clients/by-phone/${encodeURIComponent(phone)}`),
    create: (data) => request('/clients', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`/clients/${id}`, { method: 'DELETE' }),
  },

  // ZONES
  zones: {
    list: () => request('/zones'),
    create: (data) => request('/zones', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/zones/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`/zones/${id}`, { method: 'DELETE' }),
  },

  // STANDS
  stands: {
    list: () => request('/stands'),
    create: (data) => request('/stands', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/stands/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`/stands/${id}`, { method: 'DELETE' }),
  },

  // LOCATIONS
  locations: {
    list: () => request('/locations'),
    create: (data) => request('/locations', { method: 'POST', body: JSON.stringify(data) }),
    remove: (id) => request(`/locations/${id}`, { method: 'DELETE' }),
  },

  // TARIFFS
  tariffs: {
    list: () => request('/tariffs'),
    create: (data) => request('/tariffs', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/tariffs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => request(`/tariffs/${id}`, { method: 'DELETE' }),
  },

  // MESSAGES
  messages: {
    threads: () => request('/messages/threads'),
    thread: (id) => request(`/messages/threads/${id}`),
    send: (threadId, text, toId) =>
      request(`/messages/threads/${threadId}/send`, {
        method: 'POST',
        body: JSON.stringify({ text, to_id: toId }),
      }),
  },

  // OTP
  otp: {
    send: (identifier) => request('/otp/send', { method: 'POST', body: JSON.stringify({ identifier }) }),
    verify: (identifier, code) =>
      request('/otp/verify', { method: 'POST', body: JSON.stringify({ identifier, code }) }),
  },

  // STATS
  stats: {
    overview: () => request('/stats/overview'),
    daily: (date) => request('/stats/daily' + (date ? `?date=${date}` : '')),
    revenue: (from, to) => {
      const p = new URLSearchParams();
      if (from) p.set('from', from);
      if (to) p.set('to', to);
      return request('/stats/revenue' + (p.toString() ? `?${p}` : ''));
    },
    hoursSummary: (from, to) => {
      const p = new URLSearchParams();
      if (from) p.set('from', from);
      if (to) p.set('to', to);
      return request('/stats/hours-summary' + (p.toString() ? `?${p}` : ''));
    },
  },
};

// Global për browser
if (typeof window !== 'undefined') window.TaxiAPI = TaxiAPI;
