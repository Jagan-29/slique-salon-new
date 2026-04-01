/**
 * admin.js — All admin-only routes
 * Includes: appointments CRUD, services, users, role management
 */
const express     = require('express');
const router      = express.Router();
const Appointment = require('../models/Appointment');
const User        = require('../models/User');
const Service     = require('../models/Service');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect, adminOnly);

/* ── Stats ───────────────────────────────────────────────── */
router.get('/stats', async (req, res) => {
  try {
    const [total, pending, confirmed, completed, cancelled, totalUsers, totalServices] = await Promise.all([
      Appointment.countDocuments(),
      Appointment.countDocuments({ status: 'pending' }),
      Appointment.countDocuments({ status: 'confirmed' }),
      Appointment.countDocuments({ status: 'completed' }),
      Appointment.countDocuments({ status: 'cancelled' }),
      User.countDocuments({ role: 'customer' }),
      Service.countDocuments({ isActive: true })
    ]);
    res.json({ success: true, data: { total, pending, confirmed, completed, cancelled, totalUsers, totalServices } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── All Appointments ─────────────────────────────────────── */
router.get('/appointments', async (req, res) => {
  try {
    const { status, date } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (date) filter.date = date;

    const appointments = await Appointment.find(filter)
      .populate('userId', 'name email phone')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: appointments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── Update appointment status ────────────────────────────── */
router.patch('/appointments/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!valid.includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status value.' });

    const appt = await Appointment.findByIdAndUpdate(
      req.params.id, { status }, { new: true }
    ).populate('userId', 'name email');

    if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    res.json({ success: true, message: 'Status updated.', data: appt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── Delete appointment ───────────────────────────────────── */
router.delete('/appointments/:id', async (req, res) => {
  try {
    const appt = await Appointment.findByIdAndDelete(req.params.id);
    if (!appt) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    res.json({ success: true, message: 'Appointment deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── All users ────────────────────────────────────────────── */
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── Make / remove admin ──────────────────────────────────── */
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'customer'].includes(role))
      return res.status(400).json({ success: false, message: 'Role must be admin or customer.' });

    // Prevent self-demotion
    if (String(req.params.id) === String(req.user._id) && role === 'customer')
      return res.status(400).json({ success: false, message: 'You cannot remove your own admin role.' });

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, message: `${user.name} is now a ${role}.`, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ── Delete user ──────────────────────────────────────────── */
router.delete('/users/:id', async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user._id))
      return res.status(400).json({ success: false, message: 'Cannot delete your own account.' });

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, message: 'User deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
