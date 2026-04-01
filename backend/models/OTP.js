const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type:     String,
    required: true,
    lowercase: true,
    trim:     true
  },
  otp: {
    type:     String,
    required: true
  },
  // stored only during registration (pre-verified user data)
  userData: {
    name:     String,
    password: String,   // bcrypt hash
    phone:    String
  },
  purpose: {
    type:     String,
    enum:     ['register', 'login', 'forgot-password'],
    required: true
  },
  expiresAt: {
    type:     Date,
    required: true
  },
  attempts: {
    type:    Number,
    default: 0
  }
}, { timestamps: true });

// MongoDB auto-deletes expired docs
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OTP', otpSchema);
