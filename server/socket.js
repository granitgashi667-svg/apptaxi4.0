export function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log('🔌 Socket lidh:', socket.id);

    // Klienti bashkohet në dhomën e tenant-it + user-it
    socket.on('join', ({ tenantId, userId }) => {
      if (tenantId) socket.join(`tenant:${tenantId}`);
      if (userId) socket.join(`user:${userId}`);
      console.log(`   → join tenant:${tenantId} user:${userId}`);
    });

    // GPS i shoferit → shpërndahet vetëm brenda tenant-it
    socket.on('driver_location', (data) => {
      if (data?.tenantId) {
        socket.to(`tenant:${data.tenantId}`).emit('driver_location_update', data);
      }
    });

    socket.on('disconnect', () => console.log('❌ Socket shkëput:', socket.id));
  });
}
