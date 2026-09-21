# Clinic Management

> Medical clinic management software designed for an aesthetic surgery and medical clinic.

A modern, secure and minimalist management platform for organizing patients, appointments, medical consultations, interventions, nursing care, prescriptions, medical photography and billing.

---

## 📋 Project Overview

**Clinic Management** is a web-based application designed for an aesthetic medical/surgical clinic.

The platform provides dedicated interfaces and permissions for:

- 👨‍⚕️ Doctor / Surgeon
- 👩‍⚕️ Nurse
- 👩‍💼 Secretary

The application is designed around a **minimalist, professional medical interface** with a focus on simplicity, efficiency and patient management.

---

## 🎯 V1 Objectives

### Doctor

- Dashboard
- Patient management
- Patient medical records
- Appointments / Agenda
- Consultations
- Interventions
- Nursing care management
- Prescriptions
- Medical photography
- Billing

### Nurse

- Dashboard
- Patient access
- Agenda
- Nursing care
- Treatment sessions
- Laser / aesthetic treatment sessions
- Session tracking
- Medical photography

### Secretary

- Dashboard
- Patient management
- Appointment management
- Agenda
- Billing
- Payment tracking

---

# 🏥 Main Modules

## 👥 Patients

Patient management includes:

- Patient registration
- Personal information
- Contact information
- Medical information
- Medical history
- Appointments
- Consultations
- Interventions
- Treatments
- Prescriptions
- Medical photographs
- Invoices
- Payment history

---

## 📅 Agenda

The agenda allows the clinic to manage:

- Appointments
- Doctor appointments
- Nursing appointments
- Treatment sessions
- Interventions
- Appointment status
- Patient information
- Daily / weekly scheduling

Appointment statuses may include:

- Scheduled
- Confirmed
- Arrived
- In progress
- Completed
- Cancelled
- No-show

---

## 🩺 Consultations

The doctor can create and manage consultations including:

- Consultation date
- Reason for consultation
- Clinical observations
- Diagnosis
- Medical notes
- Recommendations
- Follow-up
- Prescription

---

## 🏥 Interventions

Management of surgical and aesthetic interventions:

- Intervention type
- Patient
- Date
- Doctor
- Pre-operative information
- Procedure notes
- Post-operative notes
- Follow-up
- Associated billing

---

## 💉 Nursing Care

Nursing care is managed primarily by the nurse.

The doctor can define the available care categories.

Examples:

- Laser treatments
- Hair removal
- Skin treatments
- Aesthetic treatments
- Post-operative care
- Dressings
- Other nursing procedures

A treatment category may contain:

- Treatment name
- Number of planned sessions
- Session price
- Duration
- Description

Each patient can have individual treatment sessions.

Example:

```text
Laser Hair Removal
------------------
Planned sessions: 8

Session 1 → Completed
Session 2 → Completed
Session 3 → Completed
Session 4 → Scheduled
Session 5 → Scheduled
...
```

Each session can contain:

- Date
- Nurse
- Treatment performed
- Notes
- Session status
- Price
- Payment status

### Important

A patient receiving nursing/aesthetic care **does not necessarily need to go through a medical consultation first**.

A patient can therefore enter the system directly through:

```text
Patient
   ↓
Treatment
   ↓
Care Sessions
   ↓
Billing
```

---

## 📷 Medical Photography

The platform provides a dedicated photo library for patient follow-up.

Photos can be associated with:

- Patient
- Consultation
- Intervention
- Treatment
- Session
- Date

Typical use cases:

- Before / after
- Pre-operative
- Post-operative
- Treatment progress
- Laser treatment progress

Photos must be protected and accessible only according to the user's permissions.

---

## 💊 Prescriptions

Doctors can create prescriptions containing:

- Patient
- Date
- Medication
- Dosage
- Frequency
- Duration
- Instructions
- Medical notes

The prescription can be generated as a printable document.

---

## 💰 Billing

Billing supports:

- Consultation billing
- Intervention billing
- Treatment billing
- Nursing care billing
- Laser sessions
- Products/services
- Payments
- Outstanding amounts
- Invoice history

Example:

```text
Patient
│
├── Consultation       5,000 DA
├── Laser Session      8,000 DA
├── Laser Session      8,000 DA
└── Treatment          10,000 DA
                       --------
Total                  31,000 DA
```

---

# 👤 User Roles

## Doctor

Full medical access.

Can:

- Manage patients
- Manage consultations
- Manage interventions
- Create prescriptions
- Define treatment categories
- View medical photography
- Manage billing
- View nursing activity
- Manage appointments

---

## Nurse

Limited medical access focused on nursing care.

Can:

- View assigned patients
- View appointments
- Perform care sessions
- Record treatment information
- Update session status
- Add treatment notes
- Access authorized patient photographs

Cannot:

- Create medical prescriptions
- Modify medical diagnoses
- Manage system users

---

## Secretary

Administrative access.

Can:

- Register patients
- Manage appointments
- Manage agenda
- Manage billing
- Record payments
- View administrative patient information

Cannot:

- Create prescriptions
- Modify medical diagnoses
- Modify clinical notes

---

# 🔐 Authentication & Security

The application uses role-based authentication.

There is **no public registration page**.

Accounts are created by an authorized administrator.

Example:

```text
Administrator
     ↓
Creates account
     ↓
Username + Password
     ↓
Doctor / Nurse / Secretary
```

Each user has permissions according to their role.

---

# 🏗️ Architecture

The project follows a client-server architecture.

```text
                    ┌──────────────┐
                    │    Figma     │
                    │  Design UI   │
                    └──────┬───────┘
                           │
                       Figma MCP
                           │
                           ▼
                    ┌──────────────┐
                    │    Codex     │
                    └──────┬───────┘
                           │
                           ▼
┌─────────────────────────────────────────────┐
│                  FRONTEND                   │
│                                             │
│              Next.js / React                │
│              TypeScript                    │
│              Tailwind CSS                  │
│                                             │
└──────────────────────┬──────────────────────┘
                       │
                   REST API
                       │
                       ▼
┌─────────────────────────────────────────────┐
│                  BACKEND                    │
│                                             │
│                 Django                      │
│           Django REST Framework             │
│                                             │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
                 ┌───────────┐
                 │ PostgreSQL│
                 └───────────┘
```

---

# 📁 Project Structure

```text
clinic-management/
│
├── client/
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── hooks/
│   ├── lib/
│   ├── public/
│   ├── package.json
│   └── ...
│
├── server/
│   ├── manage.py
│   ├── config/
│   ├── apps/
│   ├── requirements.txt
│   └── ...
│
├── .gitignore
├── README.md
└── ...
```

---

# 🛠️ Technology Stack

## Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

## Backend

- Python
- Django
- Django REST Framework

## Database

- PostgreSQL

## Design

- Figma
- Figma MCP
- Figma Design System

## Development

- Git
- GitHub
- Codex
- VS Code

---

# 🎨 Design Principles

The application follows a professional medical design system.

### Principles

- Minimalist
- Clean
- Professional
- Fast to use
- Clear hierarchy
- Low visual complexity
- Consistent components
- Responsive
- Accessible

The interface should avoid:

- Excessive cards
- Excessive colors
- Unnecessary animations
- Visual clutter
- Redundant information

---

# 🔄 Development Workflow

The project uses the following workflow:

```text
Figma
  ↓
Design System
  ↓
Figma MCP
  ↓
Codex
  ↓
Next.js
  ↓
Django API
  ↓
PostgreSQL
  ↓
GitHub
```

Development should be done **feature by feature**.

Example:

```text
Login
   ↓
App Shell
   ↓
Dashboard
   ↓
Patients
   ↓
Patient Detail
   ↓
Agenda
   ↓
Interventions
   ↓
Care
   ↓
Prescriptions
   ↓
Photothèque
   ↓
Billing
```

---

# 🚀 Installation

## Requirements

Make sure the following are installed:

- Node.js
- npm
- Python
- Git
- PostgreSQL

---

## Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/clinic-management.git
```

```bash
cd clinic-management
```

---

# 💻 Frontend Setup

```bash
cd client
```

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Frontend:

```text
http://localhost:3000
```

---

# 🐍 Backend Setup

```bash
cd server
```

Create virtual environment:

```bash
python -m venv .venv
```

Activate on Windows:

```powershell
.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run migrations:

```bash
python manage.py migrate
```

Start Django:

```bash
python manage.py runserver
```

Backend:

```text
http://127.0.0.1:8000
```

---

# 🔑 Environment Variables

Never commit real environment variables to GitHub.

Create a local `.env` file for development.

Use `.env.example` to document required variables.

Example:

```env
DATABASE_URL=
DJANGO_SECRET_KEY=
NEXT_PUBLIC_API_URL=
```

---

# 🧪 Development

Before creating a commit:

```bash
git status
```

Check the application:

```bash
npm run dev
```

Check TypeScript:

```bash
npm run build
```

Then commit:

```bash
git add .
git commit -m "Describe your changes"
git push
```

---

# 🌿 Git Workflow

Main branch:

```text
main
```

Feature branches:

```text
feature/login
feature/doctor-dashboard
feature/patients
feature/agenda
feature/interventions
feature/care
feature/prescriptions
feature/phototheque
feature/billing
```

Recommended workflow:

```text
main
 │
 ├── feature/login
 ├── feature/doctor-dashboard
 ├── feature/agenda
 └── feature/billing
```

Each feature should be tested before merging into `main`.

---

# 🔒 Data Protection

This application handles potentially sensitive medical information.

Development environments must use **fake/demo patient data**.

Never commit:

- Real patient information
- Medical records
- Patient photographs
- Prescriptions
- Passwords
- API keys
- Database credentials
- Production secrets

Production deployment must implement appropriate security, access control, backups, encryption and applicable healthcare/data-protection requirements.

---

# 📌 V1 Roadmap

## Phase 1 — Foundation

- [x] Figma organization
- [x] Design System
- [x] Reusable Figma components
- [ ] Figma MCP
- [ ] Frontend architecture
- [ ] Backend architecture

## Phase 2 — Authentication

- [ ] Login
- [ ] Role-based access
- [ ] Session management
- [ ] User management

## Phase 3 — Doctor

- [ ] Dashboard
- [ ] Patients
- [ ] Patient details
- [ ] Agenda
- [ ] Consultations
- [ ] Interventions
- [ ] Treatments
- [ ] Prescriptions
- [ ] Photothèque
- [ ] Billing

## Phase 4 — Nurse

- [ ] Dashboard
- [ ] Patients
- [ ] Agenda
- [ ] Care categories
- [ ] Treatment sessions
- [ ] Laser sessions
- [ ] Photothèque

## Phase 5 — Secretary

- [ ] Dashboard
- [ ] Patients
- [ ] Agenda
- [ ] Billing
- [ ] Payments

## Phase 6 — Backend Integration

- [ ] Django API
- [ ] PostgreSQL
- [ ] Authentication
- [ ] Permissions
- [ ] Patient API
- [ ] Appointment API
- [ ] Treatment API
- [ ] Prescription API
- [ ] Billing API

---

# 📈 Future Versions

Potential future features:

- Online appointment booking
- SMS notifications
- WhatsApp notifications
- Email notifications
- Automated reminders
- Advanced reports
- Financial analytics
- Inventory management
- Medical document generation
- Electronic consent forms
- Advanced audit logs
- Multi-clinic support
- Mobile application

---

# 👨‍💻 Development Status

**Version:** V1 — In Development

**Status:** 🚧 Active Development

The current priority is to build the frontend from the approved Figma design and establish the Django backend architecture.

---

# 📄 License

This project is proprietary software developed for the clinic.

Unauthorized copying, distribution or commercial use is prohibited.
