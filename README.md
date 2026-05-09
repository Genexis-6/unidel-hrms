# UNIDEL StaffOS — AI-Powered HRMS
### University of Delta (UNIDEL), Agbor

> A full-stack, AI-driven Human Resource Management System built on the **MERN Stack** (MongoDB, Express, React, Node.js), designed for automated staff administration including attendance tracking, leave management, promotion vetting, and payroll anomaly detection.

---

## 📋 Table of Contents
- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Features](#features)
- [AI Engine](#ai-engine)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the Application](#running-the-application)
- [Database Seeding](#database-seeding)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [User Roles](#user-roles)

---

## Overview

UNIDEL StaffOS was developed in response to persistent challenges in manual staff administration at the University of Delta, Agbor — including administrative bottlenecks, phantom worker fraud, data integrity issues, and lack of centralization between the Registry and Bursary departments.

The system implements an AI-powered vetting engine that automates promotion eligibility checks, leave validation, and payroll anomaly detection — aligned with Nigerian Public Service Rules (PSR) and Federal University Staff Conditions of Service.

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                    React Frontend                    │
│   Dashboard │ Staff │ Attendance │ Leave │ Payroll   │
│        Promotion │ Reports │ Settings                │
└────────────────────┬────────────────────────────────┘
                     │ HTTP / REST API
┌────────────────────▼────────────────────────────────┐
│              Express.js REST API (Node.js)           │
│  Auth │ Staff │ Attendance │ Leave │ Promotion        │
│  Payroll │ Reports │ AI Engine │ Dashboard           │
└────────────────────┬────────────────────────────────┘
                     │ Mongoose ODM
┌────────────────────▼────────────────────────────────┐
│                  MongoDB Database                    │
│  users │ staff │ attendance │ leaves │ promotions    │
│  payrolls                                            │
└─────────────────────────────────────────────────────┘
```

---

## Features

### 1. Staff Directory (CRUD)
- Centralized MongoDB staff database
- Full-text search by name, ID, department
- Filter by category (Academic / Administrative / Technical)
- Grade level, rank, qualification tracking
- Auto-generated Staff IDs (e.g. `UNIDEL/CS/2026/001`)
- Soft delete to preserve audit trail

### 2. Digital Attendance Module
- Daily attendance marking with Present / Absent / Half-Day / On-Leave
- Bulk marking for department-level management
- Automated end-of-day attendance close (cron job at 23:55)
- Anomaly flagging for duplicate marks and unmarked staff
- Weekly and monthly attendance reports

### 3. AI-Powered Promotion Vetting Engine
- Multi-criteria weighted scoring (0–100):
  - Years of Service (25%)
  - Peer-reviewed Publications (25%)
  - Teaching Evaluation Score (20%)
  - Attendance Record (15%)
  - PSC Compliance (10%)
  - Committee Work (5%)
- Configurable pass threshold (default: 75/100)
- Decisions: **Approved** / **Review** / **Rejected**
- Weekly automated re-vetting of pending applications
- Full audit trail of all AI decisions

### 4. Leave Management
- 7 leave types: Annual, Sick, Maternity, Paternity, Study, Emergency, Unpaid
- AI eligibility check on every submission:
  - Balance verification
  - Overlap detection
  - Sick leave pattern detection
  - Probation period guard
- HOD → Registrar two-tier approval workflow
- Automatic leave balance deduction on approval

### 5. Payroll & Anomaly Detection
- Auto-generation based on CONUASS/CONTISS salary structure
- Allowances: Housing (25%), Transport (15%), Medical (5%), Research (10% Academic)
- Deductions: PAYE tax, Pension (8%), NHF (2.5%)
- AI anomaly detection:
  - Salary-grade mismatch
  - Duplicate bank account (phantom worker detection)
  - Inactive staff on active payroll
  - Zero deductions on high salary
- Monthly audit report generation

### 6. Reports & Analytics
- Attendance summary with daily trends and department breakdown
- Monthly payroll register with department distribution
- Promotion status distribution and AI score statistics
- All reports exportable (PDF / Excel / CSV in production)

### 7. Role-Based Access Control
| Role        | Access                                      |
|-------------|---------------------------------------------|
| superadmin  | Full system access                          |
| registrar   | Staff, Attendance, Leave, Promotions, Reports |
| bursary     | Payroll & Finance                           |
| hod         | Department staff + leave approval           |
| viewer      | Dashboard read-only                         |

---

## AI Engine

The AI Vetting Engine (`server/utils/aiEngine.js`) is a **rule-based weighted scoring system** designed to align with Nigerian Federal University regulations.

### Promotion Scoring Algorithm

```
Total Score = Σ (criterion_score × weight)

Where:
  yearsOfService     × 0.25
  publications       × 0.25
  teachingEvaluation × 0.20
  attendanceRecord   × 0.15
  pscCompliance      × 0.10
  committeeWork      × 0.05

Decision:
  score ≥ 75  → Approved
  score ≥ 60  → Review
  score < 60  → Rejected
```

### Leave Eligibility Check
- Checks leave balance, overlap, sick leave frequency, probation status
- Returns eligibility score (0–100) with human-readable reasons

### Payroll Anomaly Detection
- Flags salary-grade mismatches, duplicate BVNs, inactive staff, zero deductions
- Can be triggered on-demand or runs automatically on 1st of each month

---

## Prerequisites

- **Node.js** v18+ 
- **MongoDB** v6+ (local or MongoDB Atlas)
- **npm** v9+

---

## Installation

```bash
# 1. Clone the repository
git clone <repo-url>
cd unidel-hrms

# 2. Install all dependencies (root, server, client)
npm run install:all

# 3. Configure environment variables
cp server/.env.example server/.env
# Edit server/.env with your MongoDB URI and JWT secret
```

---

## Running the Application

```bash
# Development (runs both server and client concurrently)
npm run dev

# Server only (port 5000)
npm run server

# Client only (port 3000)
npm run client

# Production build
npm run build
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **API**: http://localhost:5000/api
- **Health check**: http://localhost:5000/api/health

---

## Database Seeding

```bash
# Seed with sample data (15 staff, attendance, leave, promotions, payroll)
node server/utils/seeder.js

# Clear all data
node server/utils/seeder.js --clear
```

**Demo Credentials after seeding:**
| Role       | Email                        | Password    |
|------------|------------------------------|-------------|
| Super Admin| admin@unidel.edu.ng          | password123 |
| Registrar  | registry@unidel.edu.ng       | password123 |
| Bursary    | bursary@unidel.edu.ng        | password123 |
| HOD (CS)   | hod.cs@unidel.edu.ng         | password123 |

---

## API Reference

### Auth
| Method | Endpoint             | Description         |
|--------|----------------------|---------------------|
| POST   | /api/auth/login      | Login               |
| POST   | /api/auth/register   | Create user account |
| GET    | /api/auth/me         | Get current user    |
| PUT    | /api/auth/password   | Change password     |

### Staff
| Method | Endpoint         | Description            |
|--------|------------------|------------------------|
| GET    | /api/staff       | List staff (paginated) |
| POST   | /api/staff       | Create staff record    |
| GET    | /api/staff/:id   | Get staff by ID        |
| PUT    | /api/staff/:id   | Update staff record    |
| DELETE | /api/staff/:id   | Soft-delete staff      |
| GET    | /api/staff/stats | Department statistics  |

### Attendance
| Method | Endpoint                      | Description              |
|--------|-------------------------------|--------------------------|
| GET    | /api/attendance               | List records             |
| POST   | /api/attendance               | Mark attendance (bulk)   |
| GET    | /api/attendance/summary       | Daily summary            |
| GET    | /api/attendance/staff/:id     | Staff attendance history |
| GET    | /api/attendance/anomalies     | Flagged records          |

### Leave
| Method | Endpoint                  | Description            |
|--------|---------------------------|------------------------|
| GET    | /api/leave                | List requests          |
| POST   | /api/leave                | Submit request (AI-checked) |
| GET    | /api/leave/:id            | Get request details    |
| PUT    | /api/leave/:id/approve    | Approve or reject      |

### Promotion
| Method | Endpoint                      | Description            |
|--------|-------------------------------|------------------------|
| GET    | /api/promotion                | List applications      |
| POST   | /api/promotion                | Submit + AI vet        |
| POST   | /api/promotion/:id/revet      | Re-run AI vetting      |
| PUT    | /api/promotion/:id/finalize   | Final human decision   |
| GET    | /api/promotion/stats          | Status statistics      |

### Payroll
| Method | Endpoint                      | Description              |
|--------|-------------------------------|--------------------------|
| GET    | /api/payroll                  | List payroll records     |
| POST   | /api/payroll/generate         | Auto-generate payroll    |
| POST   | /api/payroll/audit            | Run AI anomaly detection |
| GET    | /api/payroll/flags            | Get flagged records      |
| PUT    | /api/payroll/:id/resolve-flag | Resolve anomaly flag     |

### AI Engine
| Method | Endpoint                | Description              |
|--------|-------------------------|--------------------------|
| POST   | /api/ai/vet-promotion   | Standalone vetting       |
| POST   | /api/ai/check-leave     | Leave eligibility check  |
| POST   | /api/ai/payroll-audit   | Batch payroll audit      |

---

## Project Structure

```
unidel-hrms/
├── package.json               ← Root: concurrently script
├── server/
│   ├── index.js               ← Express app entry point
│   ├── .env.example           ← Environment template
│   ├── config/
│   │   └── db.js              ← MongoDB connection
│   ├── models/
│   │   ├── User.js            ← Auth user model
│   │   ├── Staff.js           ← Staff record model
│   │   ├── Attendance.js      ← Daily attendance
│   │   ├── Leave.js           ← Leave requests
│   │   ├── Promotion.js       ← Promotion applications
│   │   └── Payroll.js         ← Monthly payroll
│   ├── routes/
│   │   ├── auth.js            ← Auth endpoints
│   │   ├── staff.js           ← Staff CRUD
│   │   ├── attendance.js      ← Attendance marking
│   │   ├── leave.js           ← Leave workflow
│   │   ├── promotion.js       ← Promotion vetting
│   │   ├── payroll.js         ← Payroll generation
│   │   ├── reports.js         ← Analytics aggregations
│   │   ├── ai.js              ← AI engine endpoints
│   │   └── dashboard.js       ← Dashboard KPIs
│   ├── middleware/
│   │   ├── auth.js            ← JWT protect + RBAC
│   │   └── errorHandler.js    ← Global error handler
│   └── utils/
│       ├── aiEngine.js        ← AI vetting algorithms
│       ├── scheduledJobs.js   ← Cron jobs
│       ├── logger.js          ← Winston logging
│       └── seeder.js          ← Database seeder
└── client/
    ├── public/index.html
    └── src/
        ├── App.jsx            ← Router + layout
        ├── index.js           ← React entry point
        ├── index.css          ← Global design system
        ├── context/
        │   └── AuthContext.jsx ← JWT auth state
        ├── services/
        │   └── api.js         ← Axios API layer
        ├── components/
        │   ├── layout/
        │   │   ├── Sidebar.jsx
        │   │   └── Topbar.jsx
        │   └── ui/
        │       └── index.jsx  ← Reusable UI components
        └── pages/
            ├── LoginPage.jsx
            ├── DashboardPage.jsx
            ├── StaffPage.jsx
            ├── AttendancePage.jsx
            ├── LeavePage.jsx
            ├── PromotionPage.jsx
            ├── PayrollPage.jsx
            ├── ReportsPage.jsx
            └── SettingsPage.jsx
```

---

## Environment Variables

```env
MONGO_URI=mongodb://localhost:27017/unidel_hrms
JWT_SECRET=your_very_secret_key_here
JWT_EXPIRE=7d
PORT=5000
CLIENT_URL=http://localhost:3000
NODE_ENV=development
AI_PROMOTION_PASS_SCORE=75
LOG_LEVEL=info
```

---

## Technology Stack

| Layer       | Technology                      |
|-------------|----------------------------------|
| Frontend    | React 18, React Router, React Query, Chart.js |
| Styling     | Custom CSS with design tokens (no framework) |
| Backend     | Node.js, Express.js             |
| Database    | MongoDB with Mongoose ODM       |
| Auth        | JWT (jsonwebtoken) + bcryptjs   |
| AI Engine   | Custom rule-based + weighted scoring |
| Scheduling  | node-cron                       |
| Validation  | express-validator               |
| Security    | helmet, cors, express-rate-limit |
| Logging     | Winston                         |

---

## Research Context

This system was developed as part of a final-year research project at the University of Delta, Agbor, addressing the following identified problems:
1. **Administrative Bottlenecks** — Manual processing delays resolved through digital workflows
2. **Phantom Worker Leakages** — AI-powered duplicate detection in payroll
3. **Data Integrity** — Centralized MongoDB replacing paper records
4. **Centralization Gaps** — Registry and Bursary data now share a unified system

**Theoretical Framework:** Technology Acceptance Model (TAM), Principal-Agent Theory, General Systems Theory.

---

*UNIDEL StaffOS v1.0 — Built with MERN Stack + Custom AI Engine*


<!--  sudo systemctl start mongod -->