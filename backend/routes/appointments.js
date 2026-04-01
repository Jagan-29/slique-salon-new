const express     = require('express');
const router      = express.Router();
const Appointment = require('../models/Appointment');
const Service     = require('../models/Service');
const { protect } = require('../middleware/auth');

// ─── POST /api/appointments ──────────────────────────────────
router.post('/', protect, async (req, res) => {
  try {
    const { service, serviceId, date, time, notes } = req.body;

    if (!service || !date || !time) {
      return res.status(400).json({ success: false, message: 'Service, date and time are required.' });
    }

    // Get price from service if serviceId provided
    let price = 0;
    if (serviceId) {
      const svc = await Service.findById(serviceId);
      if (svc) price = svc.price;
    }

    const appointment = await Appointment.create({
      userId: req.user._id,
      service,
      serviceId,
      date,
      time,
      notes,
      price,
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully!',
      data: appointment
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/appointments/my ────────────────────────────────
router.get('/my', protect, async (req, res) => {
  try {
    const appointments = await Appointment.find({ userId: req.user._id })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: appointments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE /api/appointments/:id ───────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    const appointment = await Appointment.findOne({ _id: req.params.id, userId: req.user._id });
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' });

    if (appointment.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending appointments can be cancelled.' });
    }

    appointment.status = 'cancelled';
    await appointment.save();
    res.json({ success: true, message: 'Appointment cancelled.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
