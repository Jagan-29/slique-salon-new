# 💇 Slique Unisex Salon — Full-Stack Web App

A complete full-stack salon booking system built with **Node.js + Express + MongoDB**.

---

## 📋 Tech Stack

| Layer      | Technology                         |
|------------|------------------------------------|
| Frontend   | HTML5, CSS3, Vanilla JavaScript    |
| Backend    | Node.js + Express.js               |
| Database   | MongoDB + Mongoose                 |
| Auth       | JWT (JSON Web Tokens)              |
| Password   | bcryptjs                           |

---

## 🚀 Setup Instructions (Step by Step)

### Step 1 — Install Node.js
Download and install from: https://nodejs.org  
(Choose the LTS version)

Verify installation:
```bash
node --version    # should show v18 or higher
npm --version
```

---

### Step 2 — Install MongoDB (Community Edition)

**Windows:**
1. Download from: https://www.mongodb.com/try/download/community
2. Install with default settings
3. MongoDB will auto-start as a Windows Service

**macOS (with Homebrew):**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Ubuntu/Linux:**
```bash
sudo apt install mongodb
sudo systemctl start mongodb
```

Verify MongoDB is running:
```bash
mongosh
# Should open MongoDB shell. Type "exit" to quit.
```

---

### Step 3 — Install Dependencies

Navigate to the backend folder:
```bash
cd slique-salon/backend
npm install
```

---

### Step 4 — Start the Backend Server

```bash
node server.js
```

You should see:
```
✅  MongoDB connected successfully
🌱  Admin user seeded → admin@slique.com / admin123
🌱  12 services seeded
🚀  Server running at http://localhost:5000
```

---

### Step 5 — Open the Frontend

Open `slique-salon/frontend/index.html` directly in your browser.

**Or use VS Code Live Server (recommended):**
1. Install "Live Server" extension in VS Code
2. Right-click `index.html` → "Open with Live Server"

---

## 🔑 Default Login Credentials

| Role    | Email              | Password  |
|---------|--------------------|-----------|
| Admin   | admin@slique.com   | admin123  |
| Customer| Register yourself  | —         |

---

## 📁 Project Structure

```
slique-salon/
├── backend/
│   ├── server.js              ← Express server entry point
│   ├── package.json           ← Node dependencies
│   ├── .env                   ← Environment variables
│   ├── models/
│   │   ├── User.js            ← User schema (customer/admin)
│   │   ├── Service.js         ← Salon service schema
│   │   └── Appointment.js     ← Booking schema
│   ├── routes/
│   │   ├── auth.js            ← Register/Login endpoints
│   │   ├── services.js        ← Service CRUD endpoints
│   │   ├── appointments.js    ← Booking endpoints
│   │   └── admin.js           ← Admin-only endpoints
│   ├── middleware/
│   │   └── auth.js            ← JWT verification middleware
│   └── config/
│       └── seed.js            ← Auto-seeds admin + services
│
└── frontend/
    ├── index.html             ← Single-page frontend
    ├── style.css              ← All styles (luxury beige theme)
    └── script.js              ← All JavaScript logic
```

---

## 🌐 API Endpoints

### Auth
| Method | Endpoint              | Description        |
|--------|-----------------------|--------------------|
| POST   | /api/auth/register    | Register new user  |
| POST   | /api/auth/login       | Login              |
| GET    | /api/auth/me          | Get current user   |

### Services (public)
| Method | Endpoint              | Description         |
|--------|-----------------------|---------------------|
| GET    | /api/services         | Get all services    |
| POST   | /api/services         | Add service (admin) |
| PUT    | /api/services/:id     | Edit service (admin)|
| DELETE | /api/services/:id     | Remove (admin)      |

### Appointments
| Method | Endpoint                    | Description              |
|--------|-----------------------------|--------------------------|
| POST   | /api/appointments           | Book appointment         |
| GET    | /api/appointments/my        | My bookings              |
| DELETE | /api/appointments/:id       | Cancel appointment       |

### Admin
| Method | Endpoint                           | Description           |
|--------|------------------------------------|-----------------------|
| GET    | /api/admin/appointments            | All appointments      |
| PATCH  | /api/admin/appointments/:id/status | Update status         |
| GET    | /api/admin/stats                   | Dashboard stats       |
| GET    | /api/admin/users                   | All customers         |

---

## 🎨 Features

### Customer
- ✅ Register & Login with JWT auth
- ✅ Browse all salon services by category
- ✅ Book appointments with date & time selection
- ✅ View booking history
- ✅ Cancel pending appointments

### Admin
- ✅ Login as admin
- ✅ View dashboard stats (total bookings, pending, users)
- ✅ View all customer appointments
- ✅ Update appointment status (pending → confirmed → completed)
- ✅ Add / remove services

---

## 🛠️ Troubleshooting

**"MongoDB connection failed"**
→ Make sure MongoDB is running: `mongod` or check system services.

**"Cannot GET /api/..."**
→ Make sure backend is running on port 5000: `node server.js`

**Frontend shows "Could not load services"**
→ Backend is not running. Start it first.

**Port 5000 already in use**
→ Change `PORT=5001` in `.env` and update `API` in `script.js`.

---

## 📞 Salon Contact

**Slique Unisex Salon**  
Shop No 4, Next KNS Institution,  
opp. Haj Bhavan, Agrahara Badavane,  
Thirumenahalli, Bengaluru – 560064  
📞 080505 46677
