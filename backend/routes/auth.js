/**
 * auth.js
 * - Register / Login via EMAIL (OTP verification)
 * - Phone stored as optional profile field, login always via email
 * - Forgot password (OTP → reset token → new password)
 * - Change password (logged-in users)
 * - Admin: no OTP (direct login)
 */
const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const User    = require('../models/User');
const OTP     = require('../models/OTP');
const { protect } = require('../middleware/auth');
const { generateOTP, sendOTPEmail } = require('../config/email');

const genToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

const OTP_MS = () => (parseInt(process.env.OTP_EXPIRE_MINUTES) || 10) * 60 * 1000;

/* ── shared helpers ──────────────────────────────────────── */
async function issueOTP(email, purpose, userData, userName) {
  await OTP.deleteMany({ email, purpose });
  const otp = generateOTP();
  const result = await sendOTPEmail(email, otp, purpose, userName);
  await OTP.create({
    email, otp, purpose, userData,
    expiresAt: new Date(Date.now() + OTP_MS())
  });
  return result; // { sent, devOTP? }
}

async function consumeOTP(email, purpose, inputOTP) {
  const rec = await OTP.findOne({ email, purpose });
  if (!rec)                     return { ok: false, msg: 'OTP not found or already used. Please request a new one.' };
  if (new Date() > rec.expiresAt) {
    await OTP.deleteOne({ _id: rec._id });
    return { ok: false, msg: 'OTP has expired. Please request a new one.' };
  }
  if (rec.otp !== String(inputOTP).trim()) {
    rec.attempts += 1;
    if (rec.attempts >= 5) {
      await OTP.deleteOne({ _id: rec._id });
      return { ok: false, msg: 'Too many wrong attempts. Please request a new OTP.' };
    }
    await rec.save();
    return { ok: false, msg: `Incorrect OTP. ${5 - rec.attempts} attempt(s) left.` };
  }
  await OTP.deleteOne({ _id: rec._id });
  return { ok: true, record: rec };
}

/* ════════════════════════════════════════════════════════════
   POST /api/auth/register   Step 1: send OTP
════════════════════════════════════════════════════════════ */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name?.trim())      return res.status(400).json({ success: false, message: 'Name is required.' });
    if (!email?.trim())     return res.status(400).json({ success: false, message: 'Email is required.' });
    if (!password)          return res.status(400).json({ success: false, message: 'Password is required.' });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });

    const cleanEmail = email.toLowerCase().trim();
    if (await User.findOne({ email: cleanEmail }))
      return res.status(400).json({ success: false, message: 'Email already registered. Please login.' });

    const hashedPw = await bcrypt.hash(password, 10);
    const result = await issueOTP(cleanEmail, 'register',
      { name: name.trim(), password: hashedPw, phone: phone?.trim() || '' },
      name.trim()
    );

    return res.json({
      success: true,
      message: `Verification code sent to ${cleanEmail}.`,
      ...(result.devOTP ? { devOTP: result.devOTP } : {})
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.' });
  }
});

/* ════════════════════════════════════════════════════════════
   POST /api/auth/verify-register   Step 2: verify OTP
════════════════════════════════════════════════════════════ */
router.post('/verify-register', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP required.' });

    const cleanEmail = email.toLowerCase().trim();
    const check = await consumeOTP(cleanEmail, 'register', otp);
    if (!check.ok) return res.status(400).json({ success: false, message: check.msg });

    if (await User.findOne({ email: cleanEmail }))
      return res.status(400).json({ success: false, message: 'Email already registered. Please login.' });

    const { name, password, phone } = check.record.userData;
    const user = await User.create({ name, email: cleanEmail, password, phone, role: 'customer', isVerified: true });
    const token = genToken(user._id);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role }
    });
  } catch (err) {
    console.error('Verify register error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ════════════════════════════════════════════════════════════
   POST /api/auth/login   Step 1: verify password, send OTP
════════════════════════════════════════════════════════════ */
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password)
      return res.status(400).json({ success: false, message: 'Email/phone and password are required.' });

    // Find by email OR phone
    const cleanId = identifier.trim().toLowerCase();
    const user = await User.findOne({ $or: [{ email: cleanId }, { phone: cleanId }, { phone: identifier.trim() }] });

    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid credentials. Please try again.' });

    // Admin: skip OTP
    if (user.role === 'admin') {
      return res.json({
        success: true,
        message: 'Login successful!',
        token: genToken(user._id),
        user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role }
      });
    }

    // Send OTP to their email (even if they logged in with phone)
    const result = await issueOTP(user.email, 'login', null, user.name);

    return res.json({
      success: true,
      email: user.email,   // tell frontend which email OTP was sent to
      message: `Verification code sent to ${user.email}.`,
      ...(result.devOTP ? { devOTP: result.devOTP } : {})
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.' });
  }
});

/* ════════════════════════════════════════════════════════════
   POST /api/auth/verify-login   Step 2: verify OTP
════════════════════════════════════════════════════════════ */
router.post('/verify-login', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP required.' });

    const cleanEmail = email.toLowerCase().trim();
    const check = await consumeOTP(cleanEmail, 'login', otp);
    if (!check.ok) return res.status(400).json({ success: false, message: check.msg });

    const user = await User.findOne({ email: cleanEmail });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    return res.json({
      success: true,
      message: 'Login successful!',
      token: genToken(user._id),
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role }
    });
  } catch (err) {
    console.error('Verify login error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ════════════════════════════════════════════════════════════
   POST /api/auth/resend-otp
════════════════════════════════════════════════════════════ */
router.post('/resend-otp', async (req, res) => {
  try {
    const { email, purpose } = req.body;
    if (!email || !purpose)
      return res.status(400).json({ success: false, message: 'Email and purpose required.' });

    const cleanEmail = email.toLowerCase().trim();
    const existing = await OTP.findOne({ email: cleanEmail, purpose });
    if (!existing)
      return res.status(400).json({ success: false, message: 'No active session. Please start over.' });

    // Rate limit: 60s
    const age = Date.now() - new Date(existing.createdAt).getTime();
    if (age < 60000)
      return res.status(429).json({ success: false, message: `Please wait ${Math.ceil((60000 - age) / 1000)} seconds.` });

    const userData = existing.userData;
    const userName = userData?.name || '';
    await OTP.deleteMany({ email: cleanEmail, purpose });

    const newOtp = generateOTP();
    const result = await sendOTPEmail(cleanEmail, newOtp, purpose, userName);
    await OTP.create({
      email: cleanEmail, otp: newOtp, purpose, userData,
      expiresAt: new Date(Date.now() + OTP_MS())
    });

    return res.json({
      success: true,
      message: `New OTP sent to ${cleanEmail}.`,
      ...(result.devOTP ? { devOTP: result.devOTP } : {})
    });
  } catch (err) {
    console.error('Resend OTP error:', err);
    return res.status(500).json({ success: false, message: 'Failed to resend OTP.' });
  }
});

/* ════════════════════════════════════════════════════════════
   POST /api/auth/forgot-password   Step 1: send OTP
════════════════════════════════════════════════════════════ */
router.post('/forgot-password', async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ success: false, message: 'Email or phone is required.' });

    const cleanId = identifier.trim().toLowerCase();
    const user = await User.findOne({ $or: [{ email: cleanId }, { phone: identifier.trim() }] });

    // Always say OK — don't reveal if account exists
    if (!user) {
      return res.json({ success: true, message: 'If this account exists, a reset code has been sent.' });
    }

    const result = await issueOTP(user.email, 'forgot-password', null, user.name);

    return res.json({
      success: true,
      email: user.email,
      message: `Reset code sent to ${user.email}.`,
      ...(result.devOTP ? { devOTP: result.devOTP } : {})
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send reset code.' });
  }
});

/* ════════════════════════════════════════════════════════════
   POST /api/auth/verify-forgot-otp   Step 2: verify OTP → resetToken
════════════════════════════════════════════════════════════ */
router.post('/verify-forgot-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP required.' });

    const cleanEmail = email.toLowerCase().trim();
    const check = await consumeOTP(cleanEmail, 'forgot-password', otp);
    if (!check.ok) return res.status(400).json({ success: false, message: check.msg });

    const user = await User.findOne({ email: cleanEmail });
    if (!user) return res.status(404).json({ success: false, message: 'Account not found.' });

    // Issue a 5-min reset token
    const resetToken = jwt.sign(
      { id: user._id, purpose: 'reset' },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    return res.json({ success: true, message: 'OTP verified.', resetToken });
  } catch (err) {
    console.error('Verify forgot OTP error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ════════════════════════════════════════════════════════════
   POST /api/auth/reset-password   Step 3: set new password
════════════════════════════════════════════════════════════ */
router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword)
      return res.status(400).json({ success: false, message: 'Reset token and new password required.' });
    if (newPassword.length < 6)
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });

    let payload;
    try { payload = jwt.verify(resetToken, process.env.JWT_SECRET); }
    catch { return res.status(400).json({ success: false, message: 'Reset link expired. Please start over.' }); }

    if (payload.purpose !== 'reset')
      return res.status(400).json({ success: false, message: 'Invalid reset token.' });

    const user = await User.findById(payload.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    user.password = newPassword; // pre-save hook hashes it
    await user.save();

    return res.json({ success: true, message: 'Password reset! You can now login.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* ════════════════════════════════════════════════════════════
   POST /api/auth/change-password   (logged in)
════════════════════════════════════════════════════════════ */
router.post('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, message: 'Current and new password required.' });
    if (newPassword.length < 6)
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });

    const user = await User.findById(req.user._id);
    if (!(await user.matchPassword(currentPassword)))
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    if (currentPassword === newPassword)
      return res.status(400).json({ success: false, message: 'New password must differ from current.' });

    user.password = newPassword;
    await user.save();

    return res.json({ success: true, message: 'Password changed successfully!' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* GET /api/auth/me */
router.get('/me', protect, (req, res) =>
  res.json({ success: true, user: req.user })
);

module.exports = router;
