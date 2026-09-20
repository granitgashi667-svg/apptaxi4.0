// ═══════════════════════════════════════════════════════════════
// js/app.js — Call Center (faqja kryesore e operatorit)
// ═══════════════════════════════════════════════════════════════

import { TaxiAPI, getUser, getToken, clearSession } from './api.js';
import { login as doLogin } from './auth.js';

// ─── DOM shortcuts ─────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

// ─── STATE ─────────────────────────────────────────────────────
const state = {
  user: null,
  socket: null,
  currentTab: 'waiting',
  calls: [],
  selectedCall: null,
  orders: { waiting: [], active: [], preorders: [] },
  clients: [],
  drivers: [],
};

// ═══════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  startClock();

  if (getToken() && getUser()) {
    bootApp();
  } else {
    showLogin();
  }

  bindLoginForm();
});

// ─── CLOCK ─────────────────────────────────────────────────────
function startClock() {
  const el = $('clock');
  const tick = () => {
    const d = new Date();
    el.textContent = d.toLocaleTimeString('sq-AL', { hour12: false });
  };
  tick();
  setInterval(tick, 1000);
}

// ═══════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════
function showLogin() {
  $('login-screen').hidden = false;
  $('app').hidden = true;
}

function hideLogin() {
  $('login-screen').hidden = true;
  $('app').hidden = false;
}

function bindLoginForm() {
  const form = $('login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('login-error');
    const btn = form.querySelector('button[type="submit"]');
    err.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Duke u kyçur...';

    try {
      const user = await doLogin(
        $('login-username').value.trim(),
        $('login-password').value
      );
      bootApp(user);
    } catch (ex) {
      err.textContent = ex.message || 'Gabim';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Kyçu';
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// BOOT APP (pas login)
// ═══════════════════════════════════════════════════════════════
async function bootApp() {
  hideLogin();

  // Verifiko token
  try {
    const res = await TaxiAPI.auth.me();
    state.user = res.user;
  } catch {
    clearSession();
    showLogin();
    return;
  }

  // User info
  $('user-name').textContent = state.user.name || state.user.username;
  $('user-role').textContent = state.user.role;

  // Admin/director/manager → shfaq admin button
  if (['admin', 'director'].includes(state.user.role)) {
    $('nav-admin').hidden = false;
  }
  if (['admin', 'director', 'manager'].includes(state.user.role)) {
    $('nav-settings').hidden = false;
  }

  // Button handlers
  $('btn-logout').onclick = async () => {
    try { await TaxiAPI.auth.logout(); } catch {}
    clearSession();
    location.reload();
  };

  // Sidebar nav
  $$('.nav-btn[data-view]').forEach(btn => {
    btn.onclick = () => switchView(btn.dataset.view);
  });

  // Admin button → hap admin.html
  $('nav-admin').onclick = () => location.href = '/admin.html';

  // Tabs
  $$('.tab[data-tab]').forEach(tab => {
    tab.onclick = () => {
      $$('.tab[data-tab]').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.currentTab = tab.dataset.tab;
      renderOrders();
    };
  });

  // Hotkeys F1-F4
  document.addEventListener('keydown', handleHotkey);

  // Order form
  bindOrderForm();

  // Socket
  connectSocket();

  // Load data
  await loadAll();
  setInterval(loadStats, 8000);   // refresh KPIs çdo 8s
  setInterval(loadCalls, 4000);   // refresh thirrjet
  setInterval(loadOrders, 5000);  // refresh porositë
}

// ─── View switch ───────────────────────────────────────────────
function switchView(view) {
  $$('.nav-btn[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $$('.view').forEach(v => v.hidden = true);
  const target = $('view-' + view);
  if (target) target.hidden = false;

  if (view === 'clients') loadClients();
  if (view === 'drivers') loadDrivers();
  if (view === 'stats')   loadStatsFull();
}

// ═══════════════════════════════════════════════════════════════
// DATA LOADERS
// ═══════════════════════════════════════════════════════════════
async function loadAll() {
  await Promise.all([
    loadStats(),
    loadCalls(),
    loadOrders(),
    loadTariffs(),
    loadZones(),
    loadRemarks(),
  ]);
}

async function loadStats() {
  try {
    const res = await TaxiAPI.stats.overview();
    const s = res.stats;
    $('kpi-online').textContent  = s.driversActive;
    $('kpi-waiting').textContent = s.ordersWaiting;
    $('kpi-active').textContent  = s.ordersActive;
    $('kpi-revenue').textContent = fmtMoney(s.revenueToday);
  } catch (e) {
    console.warn('stats error', e);
  }
}

async function loadCalls() {
  try {
    const [waiting, active, held] = await Promise.all([
      TaxiAPI.orders.waiting().catch(() => ({ orders: [] })),
      TaxiAPI.orders.list({ status: 'assigned', limit: 20 }).catch(() => ({ orders: [] })),
      Promise.resolve({ orders: [] }),
    ]);

    // Për momentin "thirrjet" janë porositë në pritje pa driver
    state.calls = waiting.orders.map(o => ({
      id: o.id,
      phone: o.phone,
      client_name: o.client_name,
      status: 'waiting',
      created_at: o.created_at,
      _order: o,
    }));

    renderCalls();
  } catch (e) {
    console.warn('calls error', e);
  }
}

async function loadOrders() {
  try {
    const [w, a, p] = await Promise.all([
      TaxiAPI.orders.waiting(),
      TaxiAPI.orders.list({ status: 'assigned', limit: 50 }),
      TaxiAPI.orders.preorders(),
    ]);
    state.orders.waiting   = w.orders;
    state.orders.active    = a.orders;
    state.orders.preorders = p.orders;
    renderOrders();
  } catch (e) {
    console.warn('orders error', e);
  }
}

async function loadTariffs() {
  try {
    const res = await TaxiAPI.tariffs.list();
    const sel = $('ord-tariff');
    sel.innerHTML = '<option value="">— Zgjidh —</option>' +
      res.tariffs.map(t => `<option value="${t.id}">${esc(t.name)}${t.base_price ? ' — ' + t.base_price + '€' : ''}</option>`).join('');
  } catch {}
}

async function loadZones() {
  try {
    const res = await TaxiAPI.zones.list();
    $('zone-list').innerHTML = res.zones.map(z => `<option value="${esc(z.name)}">`).join('');
  } catch {}
}

async function loadRemarks() {
  try {
    // Falls back gracefully — no endpoint yet
    $('remark-list').innerHTML = '';
  } catch {}
}

async function loadClients() {
  const search = $('clients-search')?.value || '';
  try {
    const res = await TaxiAPI.clients.list(search);
    const el = $('clients-list');
    if (!res.clients.length) {
      el.innerHTML = '<div class="empty">Nuk ka klientë</div>';
      return;
    }
    el.innerHTML = `
      <table class="data-table">
        <thead><tr>
          <th>ID</th><th>Emri</th><th>Telefoni</th><th>Email</th><th>Pikët</th><th>Wallet</th>
        </tr></thead>
        <tbody>
          ${res.clients.map(c => `
            <tr>
              <td>${c.id}</td>
              <td>${esc(c.name || '—')}</td>
              <td>${esc(c.phone)}</td>
              <td>${esc(c.email || '—')}</td>
              <td>${c.loyalty_points}</td>
              <td>${fmtMoney(c.wallet)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    $('clients-list').innerHTML = `<div class="empty">Gabim: ${esc(e.message)}</div>`;
  }
}

async function loadDrivers() {
  try {
    const res = await TaxiAPI.drivers.list();
    const el = $('drivers-list');
    if (!res.drivers.length) {
      el.innerHTML = '<div class="empty">Nuk ka shoferë</div>';
      return;
    }
    el.innerHTML = `
      <table class="data-table">
        <thead><tr>
          <th>ID</th><th>Emri</th><th>Telefoni</th><th>Kodi</th><th>Targa</th><th>Statusi</th>
        </tr></thead>
        <tbody>
          ${res.drivers.map(d => `
            <tr>
              <td>${d.id}</td>
              <td>${esc(d.name)}</td>
              <td>${esc(d.phone || '—')}</td>
              <td><code>${esc(d.driver_code || '—')}</code></td>
              <td>${esc(d.plate || '—')}</td>
              <td>${d.active ? '✅' : '⭕'} ${esc(d.last_event || 'offline')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    $('drivers-list').innerHTML = `<div class="empty">Gabim: ${esc(e.message)}</div>`;
  }
}

async function loadStatsFull() {
  try {
    const [ov, daily] = await Promise.all([
      TaxiAPI.stats.overview(),
      TaxiAPI.stats.daily(),
    ]);
    const s = ov.stats;
    $('stats-body').innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="num">${s.ordersToday}</div><div class="lbl">Porosi Sot</div></div>
        <div class="stat-card"><div class="num">${s.ordersWaiting}</div><div class="lbl">Në Pritje</div></div>
        <div class="stat-card"><div class="num">${s.ordersActive}</div><div class="lbl">Aktive</div></div>
        <div class="stat-card"><div class="num">${s.ordersCompleted}</div><div class="lbl">Përfunduara</div></div>
        <div class="stat-card"><div class="num">${fmtMoney(s.revenueToday)}</div><div class="lbl">Të Ardhura Sot</div></div>
        <div class="stat-card"><div class="num">${s.driversActive}</div><div class="lbl">Shoferë Aktiv</div></div>
      </div>
      <h3 style="margin-top:24px;font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Ndarja Orë për Orë</h3>
      <table class="data-table" style="margin-top:8px">
        <thead><tr><th>Ora</th><th>Porosi</th><th>Të Ardhura</th></tr></thead>
        <tbody>
          ${daily.daily.length ? daily.daily.map(r => `
            <tr><td>${r.hour}:00</td><td>${r.orders}</td><td>${fmtMoney(r.revenue)}</td></tr>
          `).join('') : '<tr><td colspan="3" style="text-align:center;color:var(--muted)">Nuk ka të dhëna</td></tr>'}
        </tbody>
      </table>
    `;
  } catch (e) {
    $('stats-body').innerHTML = `<div class="empty">Gabim: ${esc(e.message)}</div>`;
  }
}

// ═══════════════════════════════════════════════════════════════
// RENDER: CALLS
// ═══════════════════════════════════════════════════════════════
function renderCalls() {
  const el = $('calls-list');
  $('badge-calls').textContent = state.calls.length;

  if (!state.calls.length) {
    el.innerHTML = '<div class="empty">Nuk ka thirrje në pritje</div>';
    return;
  }

  el.innerHTML = state.calls.map(c => `
    <div class="call-item ${state.selectedCall === c.id ? 'selected' : ''} ringing" data-id="${c.id}">
      <div class="call-phone">${esc(c.phone)}</div>
      <div class="call-meta">
        <span class="call-name">${esc(c.client_name || 'I panjohur')}</span>
        <span>${timeAgo(c.created_at)}</span>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('.call-item').forEach(item => {
    item.onclick = () => {
      const id = +item.dataset.id;
      state.selectedCall = state.selectedCall === id ? null : id;
      renderCalls();
    };
    item.ondblclick = () => {
      const id = +item.dataset.id;
      state.selectedCall = id;
      acceptCall();
    };
  });
}

// ═══════════════════════════════════════════════════════════════
// RENDER: ORDERS
// ═══════════════════════════════════════════════════════════════
function renderOrders() {
  const el = $('orders-list');
  const list = state.orders[state.currentTab] || [];
  $('badge-orders').textContent = list.length;

  if (!list.length) {
    el.innerHTML = '<div class="empty">Nuk ka porosi</div>';
    return;
  }

  el.innerHTML = list.map(o => `
    <div class="order-item status-${o.status}" data-id="${o.id}">
      <div class="order-row">
        <span class="order-code">${esc(o.order_code || '#' + o.id)}</span>
        <span class="order-price">${o.price ? fmtMoney(o.price) : '—'}</span>
      </div>
      <div class="order-addr">
        ${esc(o.pickup)}<span class="arrow">→</span>${esc(o.destination || '—')}
      </div>
      <div class="order-meta">
        <span>${esc(o.client_name || o.phone)}</span>
        <span>${timeAgo(o.created_at)}</span>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('.order-item').forEach(item => {
    item.onclick = () => openOrderModal(+item.dataset.id);
  });
}

// ═══════════════════════════════════════════════════════════════
// ORDER FORM
// ═══════════════════════════════════════════════════════════════
function bindOrderForm() {
  const form = $('order-form');

  // Client hint
  let hintTimeout;
  $('ord-phone').addEventListener('input', (e) => {
    clearTimeout(hintTimeout);
    hintTimeout = setTimeout(() => lookupClient(e.target.value.trim()), 400);
  });

  $('btn-clear').onclick = () => { form.reset(); $('client-hint').textContent = ''; };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Duke dërguar...';

    try {
      const phone = $('ord-phone').value.trim();
      const pickup = $('ord-pickup').value.trim();
      if (!phone || !pickup) throw new Error('Telefoni dhe Pickup janë të detyrueshme');

      const isPreorder = !!$('ord-preorder').value;

      const data = {
        phone,
        client_name: $('ord-client').value.trim() || null,
        pickup,
        destination: $('ord-dest').value.trim() || null,
        zone: $('ord-zone').value.trim() || null,
        tariff_id: $('ord-tariff').value ? +$('ord-tariff').value : null,
        remark: $('ord-remark').value.trim() || null,
        price: $('ord-price').value ? +$('ord-price').value : null,
        is_preorder: isPreorder,
        preorder_date: isPreorder ? $('ord-preorder').value : null,
      };

      const res = await TaxiAPI.orders.create(data);
      toast('Porosia u krijua: ' + (res.order.order_code || '#' + res.order.id), 'success');

      form.reset();
      $('client-hint').textContent = '';
      loadOrders();
      loadStats();
    } catch (ex) {
      toast(ex.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Dërgo Porosinë';
    }
  });
}

async function lookupClient(phone) {
  const hint = $('client-hint');
  if (!phone || phone.length < 4) { hint.textContent = ''; return; }
  try {
    const res = await TaxiAPI.clients.byPhone(phone);
    if (res.client) {
      hint.textContent = `✅ Klient ekzistues: ${res.client.name || '(pa emër)'} — ${res.client.loyalty_points} pikë`;
      if (!($('ord-client').value) && res.client.name) $('ord-client').value = res.client.name;
    } else {
      hint.textContent = '🆕 Klient i re';
    }
  } catch {
    hint.textContent = '';
  }
}

// ═══════════════════════════════════════════════════════════════
// HOTKEYS F1-F4
// ═══════════════════════════════════════════════════════════════
function handleHotkey(e) {
  if (!['F1', 'F2', 'F3', 'F4'].includes(e.key)) return;
  if (!state.selectedCall) {
    toast('Zgjidh një thirrje fillimisht', 'warn');
    return;
  }
  e.preventDefault();
  const action = { F1: 'accept', F2: 'close', F3: 'hold', F4: 'transfer' }[e.key];
  handleCallAction(action);
}

function acceptCall() { handleCallAction('accept'); }

async function handleCallAction(action) {
  const id = state.selectedCall;
  if (!id) return;

  try {
    if (action === 'accept') {
      // Kalo porosinë në modalitet assign — hap modal për të zgjedhur shofer
      openAssignModal(id);
    } else if (action === 'close') {
      await TaxiAPI.orders.cancel(id, 'Operator closed');
      toast('Porosia u anulua', 'warn');
      state.selectedCall = null;
      loadCalls(); loadOrders(); loadStats();
    } else if (action === 'hold') {
      toast('Thirrja u mbajt në pritje', 'warn');
    } else if (action === 'transfer') {
      toast('Transfer në zhvillim', 'warn');
    }
  } catch (ex) {
    toast(ex.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// MODAL: ORDER DETAILS
// ═══════════════════════════════════════════════════════════════
async function openOrderModal(id) {
  try {
    const res = await TaxiAPI.orders.get(id);
    const o = res.order;

    $('modal-order-title').textContent = o.order_code || '#' + o.id;
    $('modal-order-body').innerHTML = `
      <table class="data-table">
        <tr><th>Statusi</th><td>${esc(o.status)}</td></tr>
        <tr><th>Klient</th><td>${esc(o.client_name || '—')}</td></tr>
        <tr><th>Telefon</th><td>${esc(o.phone)}</td></tr>
        <tr><th>Nga</th><td>${esc(o.pickup)}</td></tr>
        <tr><th>Ku</th><td>${esc(o.destination || '—')}</td></tr>
        <tr><th>Zona</th><td>${esc(o.zone || '—')}</td></tr>
        <tr><th>Shënim</th><td>${esc(o.remark || '—')}</td></tr>
        <tr><th>Çmim</th><td>${o.price ? fmtMoney(o.price) : '—'}</td></tr>
        <tr><th>Krijuar</th><td>${new Date(o.created_at).toLocaleString('sq-AL')}</td></tr>
      </table>
    `;

    const foot = $('modal-order-foot');
    foot.innerHTML = '';

    if (o.status === 'waiting') {
      foot.innerHTML = `
        <button class="btn-ghost" data-act="cancel">Anulo</button>
        <button class="btn-primary" data-act="assign">Cakto Shofer</button>
      `;
    } else if (o.status === 'assigned') {
      foot.innerHTML = `
        <button class="btn-ghost" data-act="cancel">Anulo</button>
        <button class="btn-primary" data-act="complete">Përfundo</button>
      `;
    }

    foot.querySelectorAll('[data-act]').forEach(btn => {
      btn.onclick = () => {
        const act = btn.dataset.act;
        if (act === 'assign') { closeOrderModal(); openAssignModal(o.id); }
        else if (act === 'cancel') cancelOrder(o.id);
        else if (act === 'complete') completeOrder(o.id);
      };
    });

    $('modal-order').hidden = false;
  } catch (e) {
    toast(e.message, 'error');
  }
}

function closeOrderModal() { $('modal-order').hidden = true; }
$('modal-order-close').onclick = closeOrderModal;
$('modal-order').onclick = (e) => { if (e.target.id === 'modal-order') closeOrderModal(); };

async function cancelOrder(id) {
  if (!confirm('Anulo këtë porosi?')) return;
  try {
    await TaxiAPI.orders.cancel(id, 'Cancelled by operator');
    toast('Porosia u anulua', 'warn');
    closeOrderModal();
    loadOrders(); loadCalls(); loadStats();
  } catch (e) { toast(e.message, 'error'); }
}

async function completeOrder(id) {
  try {
    await TaxiAPI.orders.update(id, { status: 'completed' });
    toast('Porosia u përfundua', 'success');
    closeOrderModal();
    loadOrders(); loadStats();
  } catch (e) { toast(e.message, 'error'); }
}

// ═══════════════════════════════════════════════════════════════
// MODAL: ASSIGN DRIVER
// ═══════════════════════════════════════════════════════════════
async function openAssignModal(orderId) {
  try {
    const res = await TaxiAPI.drivers.list();
    const drivers = res.drivers.filter(d => d.active);

    $('modal-assign-body').innerHTML = drivers.length ? `
      <div style="display:grid;gap:8px">
        ${drivers.map(d => `
          <button class="call-item" data-driver="${d.id}" style="text-align:left">
            <div class="call-phone">${esc(d.name)} ${d.plate ? '· ' + esc(d.plate) : ''}</div>
            <div class="call-meta">
              <span class="call-name">${esc(d.phone || '—')}</span>
              <span>${esc(d.last_event || 'offline')}</span>
            </div>
          </button>
        `).join('')}
      </div>
    ` : '<div class="empty">Nuk ka shoferë aktiv</div>';

    $('modal-assign-body').querySelectorAll('[data-driver]').forEach(btn => {
      btn.onclick = () => assignDriver(orderId, +btn.dataset.driver);
    });

    $('modal-assign').hidden = false;
  } catch (e) {
    toast(e.message, 'error');
  }
}

function closeAssignModal() { $('modal-assign').hidden = true; }
$('modal-assign-close').onclick = closeAssignModal;
$('modal-assign').onclick = (e) => { if (e.target.id === 'modal-assign') closeAssignModal(); };

async function assignDriver(orderId, driverId) {
  try {
    await TaxiAPI.orders.assign(orderId, driverId);
    toast('Shoferi u caktua', 'success');
    closeAssignModal();
    state.selectedCall = null;
    loadCalls(); loadOrders(); loadStats();
  } catch (e) { toast(e.message, 'error'); }
}

// ═══════════════════════════════════════════════════════════════
// SOCKET.IO
// ═══════════════════════════════════════════════════════════════
function connectSocket() {
  const socket = window.io('/', { transports: ['websocket', 'polling'] });
  state.socket = socket;

  socket.on('connect', () => {
    $('status-socket').className = 'socket-badge online';
    $('status-socket').textContent = '● Socket';
    socket.emit('join', { tenantId: state.user.tenantId, userId: state.user.id });
  });

  socket.on('disconnect', () => {
    $('status-socket').className = 'socket-badge offline';
    $('status-socket').textContent = '○ Socket';
  });

  socket.on('order_created', (order) => {
    toast('Porosi e re: ' + (order.order_code || '#' + order.id), 'success');
    loadCalls(); loadOrders(); loadStats();
  });

  socket.on('order_updated', () => { loadOrders(); loadStats(); });
  socket.on('order_assigned', () => { loadOrders(); loadCalls(); });
  socket.on('driver_status', () => { loadDrivers(); });
  socket.on('driver_location_update', () => {});
}

// ═══════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function fmtMoney(n) {
  const v = Number(n) || 0;
  return v.toFixed(2) + ' €';
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return Math.floor(diff) + 's';
  if (diff < 3600) return Math.floor(diff / 60) + 'm';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h';
  return Math.floor(diff / 86400) + 'd';
}

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  $('toasts').appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .3s';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}
