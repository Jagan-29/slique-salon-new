/* ============================================================
   SLIQUE UNISEX SALON — script.js v4
   Features: Email OTP auth, phone-as-login (OTP to email),
   forgot/reset/change password, full admin dashboard
   ============================================================ */

/* ── Config ─────────────────────────────────────────────── */
// On Vercel: update this to your Render backend URL
const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000/api'
  : 'https://slique-salon-backend.onrender.com/api'; // ← update after Render deploy

/* ── State ─────────────────────────────────────────────── */
let currentUser = null;
let allServices = [];
let pendingEmail = { login: '', register: '', forgot: '' };
let resetToken   = null;
const resendTimers = {};

/* ── Boot ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initSession();
  loadServices();
  setMinDate();
  initScroll();
  setupCatTabs();
  setupOutsideClick();
});

/* ============================================================
   SESSION
============================================================ */
function initSession() {
  try {
    const token = localStorage.getItem('sliqueToken');
    const u     = localStorage.getItem('sliqueUser');
    if (token && u) {
      currentUser = JSON.parse(u);
      syncUI();
    }
  } catch { doLogout(); }
}

function saveSession(data) {
  localStorage.setItem('sliqueToken', data.token);
  localStorage.setItem('sliqueUser',  JSON.stringify(data.user));
  currentUser = data.user;
  syncUI();
}

function doLogout() {
  localStorage.removeItem('sliqueToken');
  localStorage.removeItem('sliqueUser');
  currentUser = null;
  syncUI();
}

function logout() {
  doLogout();
  closeUserMenu();
  toast('Logged out.', 'info');
}

function syncUI() {
  const auth = document.getElementById('navAuth');
  const user = document.getElementById('navUser');
  if (currentUser) {
    auth.classList.add('hidden');
    user.classList.remove('hidden');
    document.getElementById('userGreeting').textContent = `Hi, ${currentUser.name.split(' ')[0]}`;
    document.getElementById('dashboardBtn').textContent = currentUser.role === 'admin' ? '⚙️ Admin' : 'My Bookings';
  } else {
    auth.classList.remove('hidden');
    user.classList.add('hidden');
  }
  updateBookingUI();
}

function updateBookingUI() {
  const prompt = document.getElementById('bookingPrompt');
  const form   = document.getElementById('bookingForm');
  if (currentUser) {
    prompt.classList.add('hidden');
    form.classList.remove('hidden');
    fillServiceSelect();
  } else {
    prompt.classList.remove('hidden');
    form.classList.add('hidden');
  }
}

/* ============================================================
   LOGIN
============================================================ */
async function handleLogin(e) {
  e.preventDefault();
  const btn = ge('loginBtn');
  hideEl('loginErr');
  setBtnLoad(btn, true, 'Sending code…');

  const identifier = ge('loginId').value.trim();
  const password   = ge('loginPw').value;

  try {
    const data = await apiPost('/auth/login', { identifier, password });

    // Admin: no OTP — token returned directly
    if (data.token) {
      saveSession(data);
      closeModal('loginModal');
      resetLoginModal();
      toast(`Welcome back, ${data.user.name}! 👋`, 'success');
      return;
    }

    // Customer: OTP sent to their email
    pendingEmail.login = data.email;
    showOTPStep('loginS1', 'loginS2', 'loginOtpInfo', 'loginDevBox',
      data.email, data.devOTP, 'login', 'loginResendBtn', 'loginTimerTxt');
    toast('Verification code sent to your email 📧', 'success');
  } catch (err) {
    showErr('loginErr', err.message);
  } finally {
    setBtnLoad(btn, false, 'Continue →');
  }
}

async function handleVerifyLogin(e) {
  e.preventDefault();
  const btn = ge('loginOtpBtn');
  hideEl('loginOtpErr');
  setBtnLoad(btn, true, 'Verifying…');

  try {
    const data = await apiPost('/auth/verify-login', {
      email: pendingEmail.login,
      otp:   ge('loginOTP').value.trim()
    });
    saveSession(data);
    closeModal('loginModal');
    resetLoginModal();
    toast(`Welcome back, ${data.user.name}! 👋`, 'success');
  } catch (err) {
    showErr('loginOtpErr', err.message);
  } finally {
    setBtnLoad(btn, false, 'Verify & Login');
  }
}

/* ============================================================
   REGISTER
============================================================ */
async function handleRegister(e) {
  e.preventDefault();
  const btn = ge('regBtn');
  hideEl('regErr');
  setBtnLoad(btn, true, 'Sending code…');

  const name     = ge('regName').value.trim();
  const email    = ge('regEmail').value.trim();
  const rawPhone = ge('regPhone').value.trim();
  const password = ge('regPw').value;
  const phone    = rawPhone ? '+91' + rawPhone : '';

  try {
    const data = await apiPost('/auth/register', { name, email, password, phone });
    pendingEmail.register = email;
    showOTPStep('regS1', 'regS2', 'regOtpInfo', 'regDevBox',
      email, data.devOTP, 'register', 'regResendBtn', 'regTimerTxt');
    toast('Verification code sent to your email 📧', 'success');
  } catch (err) {
    showErr('regErr', err.message);
  } finally {
    setBtnLoad(btn, false, 'Send Verification Code →');
  }
}

async function handleVerifyRegister(e) {
  e.preventDefault();
  const btn = ge('regOtpBtn');
  hideEl('regOtpErr');
  setBtnLoad(btn, true, 'Verifying…');

  try {
    const data = await apiPost('/auth/verify-register', {
      email: pendingEmail.register,
      otp:   ge('regOTP').value.trim()
    });
    saveSession(data);
    closeModal('registerModal');
    resetRegisterModal();
    toast(`Welcome to Slique, ${data.user.name}! 🎉`, 'success');
  } catch (err) {
    showErr('regOtpErr', err.message);
  } finally {
    setBtnLoad(btn, false, 'Verify & Create Account');
  }
}

/* ============================================================
   FORGOT PASSWORD
============================================================ */
async function handleForgot(e) {
  e.preventDefault();
  const btn = ge('forgotBtn');
  hideEl('forgotErr');
  setBtnLoad(btn, true, 'Sending code…');

  try {
    const data = await apiPost('/auth/forgot-password', { identifier: ge('forgotId').value.trim() });
    if (data.email) {
      pendingEmail.forgot = data.email;
      showOTPStep('forgotS1', 'forgotS2', 'forgotOtpInfo', 'forgotDevBox',
        data.email, data.devOTP, 'forgot-password', 'forgotResendBtn', 'forgotTimerTxt');
    } else {
      toast(data.message, 'info');
    }
  } catch (err) {
    showErr('forgotErr', err.message);
  } finally {
    setBtnLoad(btn, false, 'Send Reset Code →');
  }
}

async function handleVerifyForgot(e) {
  e.preventDefault();
  const btn = ge('forgotOtpBtn');
  hideEl('forgotOtpErr');
  setBtnLoad(btn, true, 'Verifying…');

  try {
    const data = await apiPost('/auth/verify-forgot-otp', {
      email: pendingEmail.forgot,
      otp:   ge('forgotOTP').value.trim()
    });
    resetToken = data.resetToken;
    hideEl('forgotS2');
    showEl('forgotS3');
  } catch (err) {
    showErr('forgotOtpErr', err.message);
  } finally {
    setBtnLoad(btn, false, 'Verify Code →');
  }
}

async function handleResetPw(e) {
  e.preventDefault();
  const btn  = ge('resetBtn');
  const pw1  = ge('newPw1').value;
  const pw2  = ge('newPw2').value;
  hideEl('resetErr');

  if (pw1 !== pw2) { showErr('resetErr', 'Passwords do not match.'); return; }

  setBtnLoad(btn, true, 'Resetting…');
  try {
    await apiPost('/auth/reset-password', { resetToken, newPassword: pw1 });
    closeModal('forgotModal');
    resetForgotModal();
    resetToken = null;
    toast('Password reset! Please login with your new password.', 'success');
    setTimeout(() => openModal('loginModal'), 600);
  } catch (err) {
    showErr('resetErr', err.message);
  } finally {
    setBtnLoad(btn, false, 'Reset Password');
  }
}

/* ============================================================
   CHANGE PASSWORD (logged in)
============================================================ */
async function handleChangePw(e) {
  e.preventDefault();
  const btn  = ge('chgPwBtn');
  const newP = ge('chgPw1').value;
  const conP = ge('chgPw2').value;
  hideEl('chgPwErr');

  if (newP !== conP) { showErr('chgPwErr', 'Passwords do not match.'); return; }

  setBtnLoad(btn, true, 'Updating…');
  try {
    await authPost('/auth/change-password', { currentPassword: ge('curPw').value, newPassword: newP });
    closeModal('changePwModal');
    ['curPw','chgPw1','chgPw2'].forEach(id => ge(id).value = '');
    toast('Password updated successfully! 🔐', 'success');
  } catch (err) {
    showErr('chgPwErr', err.message);
  } finally {
    setBtnLoad(btn, false, 'Update Password');
  }
}

/* ============================================================
   RESEND OTP
============================================================ */
async function resendOTP(purpose, btnId, timerId, e) {
  if (e) e.preventDefault();
  const emailMap = { login: pendingEmail.login, register: pendingEmail.register, 'forgot-password': pendingEmail.forgot };
  const email = emailMap[purpose];
  if (!email) { toast('Session expired. Please start again.', 'error'); return; }

  const btn = ge(btnId);
  if (btn && btn.classList.contains('disabled')) return;

  try {
    const data = await apiPost('/auth/resend-otp', { email, purpose });
    if (data.devOTP) {
      const boxMap = { login: 'loginDevBox', register: 'regDevBox', 'forgot-password': 'forgotDevBox' };
      updateDevBox(boxMap[purpose], data.devOTP);
    }
    startResendCooldown(btnId, timerId);
    toast('New code sent!', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ============================================================
   OTP UI HELPERS
============================================================ */
function showOTPStep(step1Id, step2Id, infoId, devBoxId, email, devOTP, purpose, resendBtnId, timerTxtId) {
  hideEl(step1Id);
  showEl(step2Id);

  const purposeLabels = {
    login:            'login verification',
    register:         'email verification',
    'forgot-password': 'password reset'
  };

  ge(infoId).innerHTML =
    `A 6-digit code for <strong>${purposeLabels[purpose] || 'verification'}</strong> was sent to:<br>
    <strong>${email}</strong><br>
    <span style="font-size:.8rem">Check your inbox and spam folder.</span>`;

  if (devOTP) updateDevBox(devBoxId, devOTP);
  startResendCooldown(resendBtnId, timerTxtId);
}

function updateDevBox(boxId, otp) {
  const box = ge(boxId);
  if (!box) return;
  box.innerHTML = `⚠️ <strong>Dev mode</strong> — Gmail not configured, OTP shown here:<br>
    <span class="dev-code">${otp}</span>`;
  box.classList.remove('hidden');
}

function startResendCooldown(btnId, timerTxtId) {
  const btn = ge(btnId);
  const tim = ge(timerTxtId);
  if (!btn) return;

  btn.classList.add('disabled');
  clearInterval(resendTimers[btnId]);

  let sec = 60;
  if (tim) tim.textContent = `Wait ${sec}s`;

  resendTimers[btnId] = setInterval(() => {
    sec--;
    if (sec <= 0) {
      clearInterval(resendTimers[btnId]);
      btn.classList.remove('disabled');
      if (tim) tim.textContent = '';
    } else {
      if (tim) tim.textContent = `Wait ${sec}s`;
    }
  }, 1000);
}

function backToStep(showId, hideId) {
  showEl(showId);
  hideEl(hideId);
}

/* ============================================================
   MODAL RESETS
============================================================ */
function resetLoginModal() {
  showEl('loginS1'); hideEl('loginS2');
  ['loginId','loginPw','loginOTP'].forEach(id => { const el = ge(id); if(el) el.value=''; });
  ['loginErr','loginOtpErr','loginDevBox'].forEach(hideEl);
  ge('loginTimerTxt').textContent = '';
}

function resetRegisterModal() {
  showEl('regS1'); hideEl('regS2');
  ['regName','regEmail','regPhone','regPw','regOTP'].forEach(id => { const el = ge(id); if(el) el.value=''; });
  ['regErr','regOtpErr','regDevBox'].forEach(hideEl);
  ge('regTimerTxt').textContent = '';
}

function resetForgotModal() {
  showEl('forgotS1'); hideEl('forgotS2'); hideEl('forgotS3');
  ['forgotId','forgotOTP','newPw1','newPw2'].forEach(id => { const el = ge(id); if(el) el.value=''; });
  ['forgotErr','forgotOtpErr','resetErr','forgotDevBox'].forEach(hideEl);
  ge('forgotTimerTxt').textContent = '';
}

/* ============================================================
   SERVICES
============================================================ */
async function loadServices() {
  const grid = ge('servicesGrid');
  grid.innerHTML = '<div class="loader-inline">Loading services…</div>';
  try {
    const data = await apiFetch('/services');
    allServices = data.data || [];
    renderServices('all');
    fillServiceSelect();
  } catch {
    grid.innerHTML = '<p class="no-data">⚠️ Could not load services. Is the backend running?</p>';
  }
}

function renderServices(cat) {
  const grid = ge('servicesGrid');
  const list = cat === 'all' ? allServices : allServices.filter(s => s.category === cat);
  if (!list.length) { grid.innerHTML = '<p class="no-data">No services in this category.</p>'; return; }
  grid.innerHTML = list.map(s => `
    <div class="service-card" onclick="quickBook('${s._id}')">
      <span class="svc-cat">${cap(s.category)}</span>
      <h3 class="svc-name">${esc(s.name)}</h3>
      <p class="svc-desc">${esc(s.description)}</p>
      <div class="svc-footer">
        <span class="svc-price">₹${s.price.toLocaleString('en-IN')}</span>
        <span class="svc-dur">${s.duration} min</span>
      </div>
    </div>`).join('');
}

function setupCatTabs() {
  const tabs = ge('categoryTabs');
  if (!tabs) return;
  tabs.addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    tabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderServices(btn.dataset.cat);
  });
}

function fillServiceSelect() {
  const sel = ge('bookService');
  if (!sel || !allServices.length) return;
  sel.innerHTML = '<option value="">— Choose service —</option>' +
    allServices.map(s => `<option value="${s._id}" data-name="${esc(s.name)}">
      ${esc(s.name)} — ₹${s.price.toLocaleString('en-IN')}</option>`).join('');
}

function quickBook(serviceId) {
  if (!currentUser) { openModal('loginModal'); toast('Please login to book.', 'info'); return; }
  scrollToSection('#booking');
  setTimeout(() => {
    const sel = ge('bookService');
    if (sel) sel.value = serviceId;
  }, 700);
}

/* ============================================================
   BOOKING
============================================================ */
function setMinDate() {
  const inp = ge('bookDate');
  if (!inp) return;
  const d = new Date();
  d.setDate(d.getDate() + 1);
  inp.min = d.toISOString().split('T')[0];
}

async function submitBooking(e) {
  e.preventDefault();
  if (!currentUser) { openModal('loginModal'); return; }

  const sel     = ge('bookService');
  const svcId   = sel.value;
  const svcName = sel.options[sel.selectedIndex]?.dataset?.name || '';
  const date    = ge('bookDate').value;
  const time    = ge('bookTime').value;
  const notes   = ge('bookNotes').value;
  const btn     = ge('bookBtn');

  if (!svcId || !date || !time) { toast('Please select service, date and time.', 'error'); return; }

  setBtnLoad(btn, true, 'Booking…');
  try {
    await authPost('/appointments', { service: svcName, serviceId: svcId, date, time, notes });
    toast('Appointment booked! See you at Slique 🎉', 'success');
    e.target.reset();
    setMinDate();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setBtnLoad(btn, false, 'Confirm Booking');
  }
}

/* ============================================================
   DASHBOARD
============================================================ */
function openDashboard() {
  if (!currentUser) return;
  currentUser.role === 'admin' ? openAdminDash() : openCustomerDash();
}

async function openCustomerDash() {
  openModal('dashModal');
  const c = ge('myAppts');
  c.innerHTML = '<div class="loader-inline">Loading…</div>';
  try {
    const data = await authFetch('/appointments/my');
    if (!data.data.length) { c.innerHTML = '<p class="no-data">No appointments yet. Book your first session! ✂️</p>'; return; }
    c.innerHTML = data.data.map(a => `
      <div class="appt-card">
        <div class="appt-info">
          <h4>${esc(a.service)}</h4>
          <p>📅 ${fmtDate(a.date)}  &nbsp;  🕐 ${a.time}${a.price ? `  &nbsp;  💰 ₹${a.price.toLocaleString('en-IN')}` : ''}</p>
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span class="badge badge-${a.status}">${cap(a.status)}</span>
          ${a.status === 'pending' ? `<button class="btn-cancel" onclick="cancelAppt('${a._id}')">Cancel</button>` : ''}
        </div>
      </div>`).join('');
  } catch (err) {
    c.innerHTML = `<p class="no-data">${esc(err.message)}</p>`;
  }
}

async function cancelAppt(id) {
  if (!confirm('Cancel this appointment?')) return;
  try {
    await authFetch('/appointments/' + id, { method: 'DELETE' });
    toast('Appointment cancelled.', 'info');
    openCustomerDash();
  } catch (err) { toast(err.message, 'error'); }
}

/* ============================================================
   ADMIN DASHBOARD
============================================================ */
async function openAdminDash() {
  openModal('adminModal');
  loadAdminStats();
  loadAdminAppts();
}

/* ── Stats ── */
async function loadAdminStats() {
  try {
    const data = await authFetch('/admin/stats');
    const s = data.data;
    ge('adminStats').innerHTML = [
      ['Total',     s.total],
      ['Pending',   s.pending],
      ['Confirmed', s.confirmed],
      ['Completed', s.completed],
      ['Cancelled', s.cancelled],
      ['Customers', s.totalUsers],
      ['Services',  s.totalServices]
    ].map(([l, n]) => `
      <div class="astat">
        <div class="astat-num">${n}</div>
        <div class="astat-lbl">${l}</div>
      </div>`).join('');
  } catch {}
}

/* ── Appointments ── */
async function loadAdminAppts() {
  const wrap   = ge('apptTableWrap');
  const status = ge('apptFilter').value;
  const date   = ge('apptDateFilter').value;
  wrap.innerHTML = '<div class="loader-inline">Loading…</div>';
  try {
    let url = '/admin/appointments?status=' + status;
    if (date) url += '&date=' + date;
    const data = await authFetch(url);
    if (!data.data.length) { wrap.innerHTML = '<p class="no-data">No appointments found.</p>'; return; }
    wrap.innerHTML = `
      <table>
        <thead><tr>
          <th>Customer</th><th>Service</th><th>Date</th><th>Time</th><th>Price</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${data.data.map(a => `
            <tr id="arow-${a._id}">
              <td>
                <span class="td-name">${esc(a.userId?.name || '–')}</span>
                <span class="td-sub">${esc(a.userId?.email || '')}</span>
              </td>
              <td>${esc(a.service)}</td>
              <td>${fmtDate(a.date)}</td>
              <td>${a.time}</td>
              <td>${a.price ? '₹' + a.price.toLocaleString('en-IN') : '–'}</td>
              <td>
                <select class="status-sel s-${a.status}"
                  onchange="updateApptStatus('${a._id}', this)">
                  <option value="pending"   ${a.status==='pending'   ?'selected':''}>Pending</option>
                  <option value="confirmed" ${a.status==='confirmed' ?'selected':''}>Confirmed</option>
                  <option value="completed" ${a.status==='completed' ?'selected':''}>Completed</option>
                  <option value="cancelled" ${a.status==='cancelled' ?'selected':''}>Cancelled</option>
                </select>
              </td>
              <td>
                <button class="tbl-btn tbl-btn-del" onclick="deleteAppt('${a._id}')">Delete</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    wrap.innerHTML = `<p class="no-data">${esc(err.message)}</p>`;
  }
}

async function updateApptStatus(id, selectEl) {
  const status = selectEl.value;
  selectEl.className = `status-sel s-${status}`;
  try {
    await authFetch('/admin/appointments/' + id + '/status', {
      method: 'PATCH',
      body:   JSON.stringify({ status })
    });
    toast(`Status → ${status}`, 'success');
    loadAdminStats();
  } catch (err) {
    toast(err.message, 'error');
    loadAdminAppts(); // revert
  }
}

async function deleteAppt(id) {
  if (!confirm('Delete this appointment permanently?')) return;
  try {
    await authFetch('/admin/appointments/' + id, { method: 'DELETE' });
    ge('arow-' + id)?.remove();
    toast('Appointment deleted.', 'info');
    loadAdminStats();
  } catch (err) { toast(err.message, 'error'); }
}

function clearDateFilter() {
  ge('apptDateFilter').value = '';
  loadAdminAppts();
}

/* ── Services ── */
async function loadAdminServices() {
  const wrap = ge('svcTableWrap');
  wrap.innerHTML = '<div class="loader-inline">Loading…</div>';
  try {
    const data = await apiFetch('/services');
    if (!data.data.length) { wrap.innerHTML = '<p class="no-data">No services found.</p>'; return; }
    wrap.innerHTML = `
      <table>
        <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Duration</th><th>Action</th></tr></thead>
        <tbody>
          ${data.data.map(s => `
            <tr id="srow-${s._id}">
              <td><span class="td-name">${esc(s.name)}</span></td>
              <td>${cap(s.category)}</td>
              <td>₹${s.price.toLocaleString('en-IN')}</td>
              <td>${s.duration} min</td>
              <td><button class="tbl-btn tbl-btn-del" onclick="deleteService('${s._id}')">Remove</button></td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (err) { wrap.innerHTML = `<p class="no-data">${esc(err.message)}</p>`; }
}

async function addService() {
  const name  = ge('svcName').value.trim();
  const price = ge('svcPrice').value;
  const dur   = ge('svcDur').value || 60;
  const cat   = ge('svcCat').value;
  const desc  = ge('svcDesc').value.trim();
  if (!name || !price || !desc) { toast('Fill in all service fields.', 'error'); return; }
  try {
    await authFetch('/services', {
      method: 'POST',
      body:   JSON.stringify({ name, price: Number(price), duration: Number(dur), category: cat, description: desc })
    });
    ['svcName','svcPrice','svcDesc'].forEach(id => ge(id).value = '');
    ge('svcDur').value = '60';
    toast('Service added!', 'success');
    loadAdminServices();
    loadServices();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteService(id) {
  if (!confirm('Remove this service?')) return;
  try {
    await authFetch('/services/' + id, { method: 'DELETE' });
    ge('srow-' + id)?.remove();
    toast('Service removed.', 'info');
    loadServices();
  } catch (err) { toast(err.message, 'error'); }
}

/* ── Users ── */
async function loadAdminUsers() {
  const wrap = ge('usersTableWrap');
  wrap.innerHTML = '<div class="loader-inline">Loading…</div>';
  try {
    const data = await authFetch('/admin/users');
    if (!data.data.length) { wrap.innerHTML = '<p class="no-data">No users found.</p>'; return; }
    wrap.innerHTML = `
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead>
        <tbody>
          ${data.data.map(u => `
            <tr id="urow-${u._id}">
              <td><span class="td-name">${esc(u.name)}</span></td>
              <td>${esc(u.email || '–')}</td>
              <td>${esc(u.phone || '–')}</td>
              <td><span class="badge ${u.role === 'admin' ? 'badge-confirmed' : 'badge-pending'}">${u.role}</span></td>
              <td>${fmtDate(u.createdAt?.split('T')[0])}</td>
              <td style="display:flex;gap:6px;flex-wrap:wrap">
                ${u.role === 'customer'
                  ? `<button class="tbl-btn tbl-btn-admin" onclick="changeRole('${u._id}','admin')">Make Admin</button>`
                  : `<button class="tbl-btn tbl-btn-demote" onclick="changeRole('${u._id}','customer')">Remove Admin</button>`}
                <button class="tbl-btn tbl-btn-del" onclick="deleteUser('${u._id}','${esc(u.name)}')">Delete</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (err) { wrap.innerHTML = `<p class="no-data">${esc(err.message)}</p>`; }
}

async function changeRole(id, role) {
  const action = role === 'admin' ? 'Make this user an admin?' : 'Remove admin role from this user?';
  if (!confirm(action)) return;
  try {
    const data = await authFetch('/admin/users/' + id + '/role', {
      method: 'PATCH', body: JSON.stringify({ role })
    });
    toast(data.message, 'success');
    loadAdminUsers();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteUser(id, name) {
  if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
  try {
    await authFetch('/admin/users/' + id, { method: 'DELETE' });
    ge('urow-' + id)?.remove();
    toast('User deleted.', 'info');
    loadAdminStats();
  } catch (err) { toast(err.message, 'error'); }
}

/* ── Tab switching ── */
function switchAdminTab(btn) {
  document.querySelectorAll('.atab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.add('hidden'));
  btn.classList.add('active');
  const tab = btn.dataset.tab;
  const panelMap = { appts: 'tabAppts', services: 'tabServices', users: 'tabUsers' };
  const panel = ge(panelMap[tab]);
  if (panel) panel.classList.remove('hidden');
  if (tab === 'appts')    loadAdminAppts();
  if (tab === 'services') loadAdminServices();
  if (tab === 'users')    loadAdminUsers();
}

/* ============================================================
   API HELPERS
============================================================ */
function getToken() { return localStorage.getItem('sliqueToken') || ''; }

async function apiPost(path, body) {
  const res  = await fetch(API + path, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed.');
  return data;
}

async function apiFetch(path, opts = {}) {
  const res  = await fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed.');
  return data;
}

async function authFetch(path, opts = {}) {
  const res  = await fetch(API + path, {
    ...opts,
    headers: {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + getToken(),
      ...(opts.headers || {})
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed.');
  return data;
}

async function authPost(path, body) {
  return authFetch(path, { method: 'POST', body: JSON.stringify(body) });
}

/* ============================================================
   MODAL CONTROL
============================================================ */
function openModal(id) {
  document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
  const el = ge(id);
  if (!el) return;
  el.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const el = ge(id);
  if (!el) return;
  el.classList.remove('active');
  document.body.style.overflow = '';
  // Reset on close
  if (id === 'loginModal')    resetLoginModal();
  if (id === 'registerModal') resetRegisterModal();
  if (id === 'forgotModal')   resetForgotModal();
  if (id === 'changePwModal') ['curPw','chgPw1','chgPw2','chgPwErr'].forEach(hideEl);
}

function switchModal(fromId, toId) {
  closeModal(fromId);
  setTimeout(() => openModal(toId), 200);
}

function setupOutsideClick() {
  document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) closeModal(e.target.id);
    if (!e.target.closest('#navMenuWrap')) closeUserMenu();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => closeModal(m.id));
      closeUserMenu();
    }
  });
}

/* ============================================================
   USER DROPDOWN MENU
============================================================ */
function toggleUserMenu() {
  ge('userDropdown').classList.toggle('hidden');
}
function closeUserMenu() {
  ge('userDropdown')?.classList.add('hidden');
}

/* ============================================================
   TOAST
============================================================ */
let toastTimer;
function toast(msg, type = 'info') {
  const el = ge('toast');
  el.textContent = msg;
  el.className   = `toast t-${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4000);
}

/* ============================================================
   SCROLL & NAV
============================================================ */
function initScroll() {
  window.addEventListener('scroll', () => {
    ge('navbar').classList.toggle('scrolled', window.scrollY > 50);
    updateActiveLink();
  }, { passive: true });
}

function updateActiveLink() {
  const sections = ['home','services','booking','about','contact'];
  const y = window.scrollY + 100;
  sections.forEach(id => {
    const sec  = ge(id);
    const link = document.querySelector(`.nav-link[href="#${id}"]`);
    if (!sec || !link) return;
    link.classList.toggle('active', y >= sec.offsetTop && y < sec.offsetTop + sec.offsetHeight);
  });
}

function navClick(e, sel) {
  e.preventDefault();
  scrollToSection(sel);
  ge('navLinks').classList.remove('open');
}

function scrollToSection(sel) {
  const el = document.querySelector(sel);
  if (!el) return;
  const navH = ge('navbar').offsetHeight || 72;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - navH, behavior: 'smooth' });
}

function toggleMenu() {
  ge('navLinks').classList.toggle('open');
}

/* ============================================================
   TINY UTILS
============================================================ */
const ge = id => document.getElementById(id);
function showEl(id) { ge(id)?.classList.remove('hidden'); }
function hideEl(id) { ge(id)?.classList.add('hidden'); }
function showErr(id, msg) { const el = ge(id); if (el) { el.textContent = msg; el.classList.remove('hidden'); } }
function setBtnLoad(btn, on, txt) { if (!btn) return; btn.disabled = on; btn.textContent = txt; }
function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
function esc(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(d) {
  if (!d) return '–';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }); }
  catch { return d; }
}
function togglePw(id, btn) {
  const inp = ge(id);
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁' : '🙈';
}
