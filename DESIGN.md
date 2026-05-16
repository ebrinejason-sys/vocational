# Vocational Training Management System - Design Document

## 1. Overview
A modular system for church-based NGOs to manage vocational training for vulnerable youth. Focuses on trauma-informed care, CBET principles, and offline functionality.

## 2. Technical Stack
- **Frontend**: React (with Vite) - Progressive Web App (PWA)
- **Backend**: Supabase (Auth, Postgres, Edge Functions) or Node.js/Express
- **Database**: PostgreSQL (via Neon or Supabase)
- **Styling**: Tailwind CSS (for simplicity and speed)
- **Offline**: Service Workers, IndexedDB (via Dexie.js or Workbox)

## 3. Data Model (Core Entities)
- **Users**: Staff, Trainers, Admins (RBAC)
- **Batches**: The central unit of organization.
- **Trainees**: Profile, Vulnerability score, Case notes.
- **Competencies**: CBET modules and assessment levels (Beginner to Independent).
- **Attendance**: Daily tracking.
- **Case Management**: Trauma healing sessions, mentorship logs.
- **Inventory**: Tools, materials, procurement logs.
- **Financials**: Budget vs Actual, Donor tracking.
- **Outcomes**: Graduation status, job placement, alumni follow-up.

## 4. Security & Safeguarding
- Encryption for sensitive case notes.
- Role-based access: Case workers see trauma data; trainers see only competency/attendance.

## 5. UI/UX Principles
- Mobile-first.
- High contrast, large touch targets.
- Minimalistic data entry for field staff.
