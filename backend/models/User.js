const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type:     String,
    required: [true, 'Name is required'],
    trim:     true,
    minlength: 2,
    maxlength: 50
  },
  email: {
    type:     String,
    required: [true, 'Email is required'],
    unique:   true,
    lowercase: true,
    trim:     true,
    match:    [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  phone: {
    type:   String,
    trim:   true,
    default: ''
  },
  password: {
    type:     String,
    required: [true, 'Password is required'],
    minlength: 6
  },
  role: {
    type:    String,
    enum:    ['customer', 'admin'],
    default: 'customer'
  },
  isVerified: {
    type:    Boolean,
    default: false
  }
}, { timestamps: true });

// Hash password — skip if already bcrypt hashed
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  if (this.password && this.password.startsWith('$2')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('User', userSchema);
