import { Router } from 'express';
import authRoutes from './auth.js';
import workerRoutes from './workers.js';
import orderRoutes from './orders.js';
import driverRoutes from './drivers.js';
import vehicleRoutes from './vehicles.js';
import clientRoutes from './clients.js';
import zoneRoutes from './zones.js';
import standRoutes from './stands.js';
import locationRoutes from './locations.js';
import tariffRoutes from './tariffs.js';
import messageRoutes from './messages.js';
import otpRoutes from './otp.js';
import statsRoutes from './stats.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/workers', workerRoutes);
router.use('/orders', orderRoutes);
router.use('/drivers', driverRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/clients', clientRoutes);
router.use('/zones', zoneRoutes);
router.use('/stands', standRoutes);
router.use('/locations', locationRoutes);
router.use('/tariffs', tariffRoutes);
router.use('/messages', messageRoutes);
router.use('/otp', otpRoutes);
router.use('/stats', statsRoutes);

export default router;
