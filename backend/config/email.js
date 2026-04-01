/**
 * email.js — Real Gmail OTP delivery via Nodemailer
 * Throws clearly if credentials missing (no silent dev fallback on production)
 */
const nodemailer = require('nodemailer');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass || user.includes('your_salon') || pass.startsWith('xxx')) {
    return null; // not configured
  }

  _transporter = nodemailer.createTransport({
    host:   'smtp.gmail.com',
    port:   465,
    secure: true,
    auth:   { user, pass },
    tls:    { rejectUnauthorized: false }
  });

  return _transporter;
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function makeEmailHTML(otp, purpose, userName) {
  const purposeText = {
    'register':        { title: 'Verify Your Account',   body: 'Thank you for registering at Slique Unisex Salon! Use the code below to verify your email.' },
    'login':           { title: 'Login Verification',    body: 'Use this code to complete your login to Slique Unisex Salon.' },
    'forgot-password': { title: 'Password Reset Code',   body: 'You requested a password reset. Use the code below to set a new password.' }
  };
  const { title, body } = purposeText[purpose] || purposeText['login'];

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body{margin:0;padding:0;font-family:Georgia,serif;background:#f5f0e8}
  .outer{padding:40px 20px}
  .card{max-width:500px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(44,26,14,.15)}
  .hdr{background:#2C1A0E;padding:28px 32px;text-align:center}
  .brand{font-size:1.9rem;color:#C9A96E;font-style:italic;letter-spacing:1px}
  .brand b{color:#FAF7F2;font-style:normal}
  .tagline{color:#a07840;font-size:.68rem;letter-spacing:.22em;margin-top:6px;text-transform:uppercase}
  .body{padding:36px 32px}
  .greeting{font-size:1rem;color:#3A2010;margin-bottom:16px}
  .desc{font-size:.92rem;color:#5a3d28;line-height:1.7;margin-bottom:24px}
  .otp-box{background:#FAF7F2;border:2px dashed #B08D57;border-radius:12px;text-align:center;padding:28px 20px}
  .otp-label{font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;color:#a07840;margin-bottom:10px}
  .otp-code{font-size:2.8rem;font-weight:700;color:#2C1A0E;letter-spacing:14px;font-family:Courier New,monospace}
  .otp-exp{font-size:.78rem;color:#9a7a60;margin-top:10px}
  .warn{margin-top:24px;background:#fefce8;border-left:3px solid #d97706;padding:12px 16px;border-radius:0 8px 8px 0;font-size:.82rem;color:#854d0e;line-height:1.6}
  .ftr{background:#F0EAE0;padding:18px 32px;text-align:center;font-size:.74rem;color:#9a7a60;line-height:1.8}
  .ftr a{color:#B08D57;text-decoration:none}
</style></head>
<body><div class="outer"><div class="card">
  <div class="hdr">
    <div class="brand"><em>Sl</em><b>ique</b></div>
    <div class="tagline">Unisex Salon · Bengaluru</div>
  </div>
  <div class="body">
    <p class="greeting">Hi ${userName || 'there'} 👋</p>
    <p class="desc">${body}</p>
    <div class="otp-box">
      <div class="otp-label">Your Verification Code</div>
      <div class="otp-code">${otp}</div>
      <div class="otp-exp">⏱ Valid for <strong>10 minutes</strong></div>
    </div>
    <div class="warn">
      🔒 <strong>Keep this code private.</strong> Slique Salon staff will <em>never</em> ask for your OTP via call or message.
    </div>
  </div>
  <div class="ftr">
    © ${new Date().getFullYear()} Slique Unisex Salon<br>
    Shop No 4, opp. Haj Bhavan, Thirumenahalli, Bengaluru – 560064<br>
    📞 <a href="tel:08050546677">080505 46677</a>
  </div>
</div></div></body></html>`;
}

/**
 * Send OTP email.
 * Returns { sent: true } on success.
 * Returns { sent: false, devOTP: otp } if Gmail not configured (local dev only).
 * THROWS on Gmail send error in production so the caller can return 500.
 */
async function sendOTPEmail(toEmail, otp, purpose, userName = '') {
  const t = getTransporter();

  const subjects = {
    'register':        '✅ Verify your Slique Salon account',
    'login':           '🔐 Your Slique Salon login code',
    'forgot-password': '🔑 Reset your Slique Salon password'
  };

  if (!t) {
    // LOCAL DEV ONLY — credentials not set
    console.log('\n' + '═'.repeat(56));
    console.log('📧  OTP (Gmail not configured — DEV mode)');
    console.log(`    To:      ${toEmail}`);
    console.log(`    Purpose: ${purpose}`);
    console.log(`    OTP:     ${otp}   [10 min]`);
    console.log('═'.repeat(56) + '\n');
    return { sent: false, devOTP: otp };
  }

  // Real send
  await t.sendMail({
    from:    `"Slique Salon" <${process.env.GMAIL_USER}>`,
    to:      toEmail,
    subject: subjects[purpose] || '🔐 Your Slique Salon OTP',
    html:    makeEmailHTML(otp, purpose, userName)
  });

  console.log(`📧  OTP email sent → ${toEmail} (purpose: ${purpose})`);
  return { sent: true };
}

module.exports = { generateOTP, sendOTPEmail };
