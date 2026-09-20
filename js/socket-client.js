// ═══════════════════════════════════════════════════════════════
// js/socket-client.js — Socket.io client për TaxiApp
// ═══════════════════════════════════════════════════════════════

import { getUser } from './api.js';

let socket = null;

export function connectSocket() {
  if (socket?.connected) return socket;

  // socket.io client ngarkohet nga /socket.io/socket.io.js
  socket = window.io('/', { transports: ['websocket', 'polling'] });

  const user = getUser();
  if (user) {
    socket.emit('join', { tenantId: user.tenantId, userId: user.id });
  }

  socket.on('connect', () => {
    console.log('🟢 Socket lidhur');
    const u = getUser();
    if (u) socket.emit('join', { tenantId: u.tenantId, userId: u.id });
  });

  socket.on('disconnect', () => console.log('🔴 Socket shkëput'));

  return socket;
}

export function getSocket() {
  if (!socket) connectSocket();
  return socket;
}

export function on(event, handler) {
  getSocket().on(event, handler);
}

export function off(event, handler) {
  if (socket) socket.off(event, handler);
}

export function emit(event, data) {
  getSocket().emit(event, data);
}

// GPS helper
export function sendDriverLocation(driverId, lat, lng) {
  const u = getUser();
  emit('driver_location', {
    tenantId: u?.tenantId,
    driverId,
    lat,
    lng,
    at: new Date().toISOString(),
  });
}
