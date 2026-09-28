# ⚜️ Dhulfiqār Scout Tracker — Comprehensive System Manual & Mobile Setup Guide

**Application Version:** 2.0 (Mobile-Ready PWA)  
**Target Platform:** All Smartphones (iOS / Android), Tablets, and Desktop Browsers  
**Database Architecture:** Browser-Local & Cloud-Synced Persistence (Zero Data Loss)  

---

## 📑 Table of Contents
1. [Executive Overview & Purpose](#1-executive-overview--purpose)
2. [Mobile Installation Guide (How to Add to Phone)](#2-mobile-installation-guide)
   - [iPhone / iPad (iOS Safari)](#iphone--ipad-ios-safari)
   - [Android (Google Chrome / Samsung Internet)](#android-google-chrome--samsung-internet)
3. [Troop Structure & Ṭalīʿah Roster (All 10 Groups)](#3-troop-structure--ṭalīʿah-roster)
4. [User Roles & Security Permissions](#4-user-roles--security-permissions)
5. [The 6-Stage Accountability & Point System](#5-the-6-stage-accountability--point-system)
6. [Tab-by-Tab User Guide](#6-tab-by-tab-user-guide)
   - [📋 Tab 1: Check-In (Attendance & Fast Points)](#-tab-1-check-in-attendance--fast-points)
   - [🎖️ Tab 2: Duties (Weekly Duty Scoring)](#-tab-2-duties-weekly-duty-scoring)
   - [⚖️ Tab 3: Guide (Standalone Point System Reference)](#-tab-3-guide-standalone-point-system-reference)
   - [👥 Tab 4: Roster (Scout Profiles & Admin Controls)](#-tab-4-roster-scout-profiles--admin-controls)
   - [📅 Tab 5: Fridays (Schedule & Calendar)](#-tab-5-fridays-schedule--calendar)
   - [⚙️ Tab 6: Portal (Security & Password Self-Service)](#-tab-6-portal-security--password-self-service)
7. [Live Multi-Sheet Excel & CSV Export Engine](#7-live-multi-sheet-excel--csv-export-engine)
8. [Frequently Asked Questions (FAQ) & Troubleshooting](#8-frequently-asked-questions-faq--troubleshooting)

---

## 1. Executive Overview & Purpose

**Dhulfiqār Scout Tracker** is a purpose-built mobile web application developed for Islamic Scouting units. It replaces manual paper attendance sheets and disjointed notes with a unified, real-time platform accessible by Troop Leaders and Patrol Leaders directly from their smartphones.

### Core Objectives:
* **Frictionless Field Check-In:** Take individual or whole-patrol attendance in under 10 seconds.
* **Objective Scout Accountability:** Track demerit points across 17 standardized infraction presets with automatic progressive warning tiers.
* **Future Attendance Protection:** Prevent accidental or premature attendance marking for future dates.
* **Practice Sandboxes:** Two permanent test sessions (`2026-09-25` and `2026-09-28`) for leader onboarding and drill simulations.
* **One-Click Multi-Sheet Excel Exports:** Instantly generate complete patrol reports formatted for leadership reviews and parent meetings.

---

## 2. Mobile Installation Guide

The app is built as a **Progressive Web App (PWA)**. Leaders do **not** need to go to the App Store or Google Play Store. It can be installed directly from any mobile browser in 30 seconds.

```
+-------------------------------------------------------------------------+
|                       HOW TO INSTALL ON YOUR PHONE                      |
|                                                                         |
|   [ iOS (iPhone / iPad) ]                  [ Android (Samsung / Pixel) ]|
|   1. Open link in Safari                   1. Open link in Chrome       |
|   2. Tap Share Icon (box with arrow)       2. Tap Menu (three dots ⋮)   |
|   3. Tap "Add to Home Screen"              3. Tap "Install App" /       |
|   4. Tap "Add" (top-right)                    "Add to Home screen"      |
|   5. Launch from Home Screen Icon          4. Launch from Home Screen   |
+-------------------------------------------------------------------------+
```

### iPhone & iPad (iOS Safari)
1. Open the provided web link in **Apple Safari** (do not use in-app social media browsers).
2. Tap the **Share button** at the bottom center of the screen (the square icon with an arrow pointing up).
3. Scroll down the action menu and tap **Add to Home Screen** (`+`).
4. In the top right corner, tap **Add**.
5. The **Dhulfiqār Scout Tracker** green badge icon is now installed on your home screen. It will launch in full-screen mode with native mobile gestures and safe-area notch support.

### Android (Google Chrome / Samsung Internet)
1. Open the provided web link in **Google Chrome**.
2. Tap the **three vertical dots (⋮)** in the top right corner.
3. Tap **Install app** or **Add to Home screen**.
4. When prompted, tap **Install** to confirm.
5. The application will be added to your phone's app drawer and home screen for one-tap access.

---

## 3. Troop Structure & Ṭalīʿah Roster

Every scout is organized into their corresponding age and grade division with traditional Arabic patrol titles:

| Grade Level | Scouting Rank | Official Ṭalīʿah Name (Arabic) | Assigned Leader |
| :--- | :--- | :--- | :--- |
| **Kindergarten** | Lions | **Ṭalīʿat al-Mahdi (ʿaj)** | Bilal Dabaja |
| **1st Grade** | Tigers | **Ṭalīʿat al-Muṣṭafā (ṣ)** | Mohamed Bazzi |
| **2nd Grade** | Wolf | **Ṭalīʿat aṣ-Ṣādiq (ʿa)** | Zein Bazzi |
| **3rd Grade** | Bear | **Ṭalīʿat ar-Riḍā (ʿa)** | Houssein Mroue |
| **4th Grade** | Webelos | **Ṭalīʿat TBD** *(Customizable by Leader)* | Houssein Mroue |
| **5th Grade** | Arrow of Light | **Ṭalīʿat Amīr al-Muʾminīn (ʿa)** | Hadi Mcheik |
| **6th Grade** | Patrol 1 | **Ṭalīʿat ʿIshāq al-Ḥusayn (ʿa)** | Hadi Mcheik |
| **6th / 7th Grade**| Patrol 2 | **Ṭalīʿat Abū al-Faḍl al-ʿAbbās** | Hadi Mcheik |
| **8th Grade** | Patrol 3 | **Ṭalīʿat al-Bāqir (ʿa)** | Mohamed Saleh |
| **9th Grade** | Patrol 4 | **Ṭalīʿat Asadullāh (ʿa)** | Bilal Dabaja |
| **10th / 11th Grade**| Patrol 5 | **Ṭalīʿat Abā ʿAbdillāh (ʿa)** | Troop Leadership |

> *Note: Leaders can customize or update the Arabic Ṭalīʿah name for their group directly from their Leader Profile.*

---

## 4. User Roles & Security Permissions

The app implements strict role-based access control (RBAC):

```
                                [ SYSTEM ROLES ]
                                        │
             ┌──────────────────────────┴──────────────────────────┐
             ▼                                                     ▼
   🛡️ ADMIN / TROOP LEADER                               🎖️ PATROL LEADER
   • All 10 Ṭalīʿāt accessible                           • Scoped strictly to assigned Ṭalīʿah
   • Add / Edit / Remove Scouts                          • Fast Check-In & Duty Scoring
   • Move Scouts between Patrols                         • Point Demerit & Commendation Logging
   • Point Overrides & Master Config                     • Change Personal Password
   • Troop-Wide Master Reports                           • Download Patrol Progress Report
```

### 🔒 Secure Leader Authentication & Account Isolation
* **Individual Profiles:** Every leader has their own isolated profile and credentials.
* **No In-App Quick Switching:** Unauthorized profile switching inside the app is strictly prohibited and disabled.
* **Switching Accounts:** To switch to a different leader or unit, the leader must tap **`🚪 Logout`** (located in the top header or in the **⚙️ Portal** tab). This redirects to the secure Login screen where the leader's specific username and password must be entered.
* **Password Self-Management:** Leaders can change their personal password at any time in the **⚙️ Portal** tab.

---

## 5. The 6-Stage Accountability & Point System

The system ensures fair, objective, and consistent discipline across all patrols.

### ⚠️ The 6 Warning Tiers

| Warning Tier | Point Threshold | Visual Badge | Required Action / Protocol |
| :---: | :---: | :---: | :--- |
| **Stage 0** | `0–1 pt` | 🟢 *Normal* | Informal observation, private coaching, and positive encouragement. |
| **Stage 1** | `2 pts` | 🟡 *Level 1* | **Leader 1-on-1 Conference:** Leader conducts a private discussion to address behavior. |
| **Stage 2** | `3 pts` | 🟠 *Level 2* | **Parent Contact & Uniform Audit:** Official notification to parents regarding infractions. |
| **Stage 3** | `4 pts` | 🔴 *Level 3* | **Senior Leader Hearing:** Scout meets with Troop Master; review of scout oath. |
| **Stage 4** | `5 pts` | 🚨 *Probation* | **Committee Review & Probation:** Official letter from Troop Leadership committee. |
| **Stage 5** | `6+ pts` | ⛔ *Suspension* | **Suspension & Re-entry Contract:** Scout is temporarily suspended until behavioral contract is signed. |

### 📐 Core Accountability Rules:
1. **Automatic Absence Penalty:** Marking a scout `Absent (A)` automatically adds **+1 demerit point** to their record.
2. **Improvement Reward:** Scouts who maintain **2 consecutive weeks** of perfect attendance and exemplary conduct receive **-1 point reduction**.
3. **Severe Misconduct Override:** Acts of gross disrespect, physical altercation, or safety violations immediately bypass lower tiers and trigger a **Stage 3/4 Senior Leader Hearing**.

---

## 6. Tab-by-Tab User Guide

The bottom navigation bar provides 6 dedicated modules:

### 📋 Tab 1: Check-In (Attendance & Fast Points)
* **Select Session Date:** Choose between current Friday programs or the 2 unlocked test sessions.
* **Mark Status:** Tap **`P`** (Present - Green), **`A`** (Absent - Red, +1 pt), or **`E`** (Excused - Amber).
* **Batch Buttons:** Tap `Mark All Present`, `Mark All Absent`, or `Mark All Excused` for whole-patrol actions.
* **🔒 Future Lock:** If a date is after today, buttons are disabled and the submit button displays:
  > `🔒 Attendance Locked (Future Date: YYYY-MM-DD)`
* **Submit:** Click `Save & Submit Attendance` to record the data.

### 🎖️ Tab 2: Duties (Weekly Duty Scoring)
Evaluate weekly scout assignments across 5 foundational areas:
1. 🚩 **Flag Ceremony (*Tahiyyat al-ʿAlam*)**
2. 📖 **Quran / Dua Recitation**
3. 🧹 **Cleanliness & Order (*Tartīb*)**
4. ⚔️ **Patrol Leadership & Discipline**
5. 🕌 **Azan & Salah Preparation**
* Rate performance using the 1–5 star rating system and record private notes.

### ⚖️ Tab 3: Guide (Standalone Point System Reference)
* Quick-reference chart of all 6 warning tiers.
* Explanation of absence penalties and improvement bonuses.
* Interactive **Point Simulator**: Enter any point value to test and preview the resulting warning tier and required protocol.

### 👥 Tab 4: Roster (Scout Profiles & Admin Controls)
* **View Scout Profile:** Tap on any scout card to see their complete history, attendance rate, total points, and incident log.
* **Add / Deduct Points:** Manually adjust points using preset infraction reasons or custom leader notes.
* **Admin Controls (Admin Only):**
  * `➕ Add Scout`: Register a new scout to any patrol.
  * `🔄 Edit / Transfer`: Move a scout to a different Ṭalīʿah or grade.
  * `🗑️ Remove Scout`: Permanently remove a scout with confirmation.

### 📅 Tab 5: Fridays (Schedule & Calendar)
* View the entire annual schedule of Friday sessions, themes, and activities.
* Badges indicate session state:
  * `🧪 Test Sandbox` — Unlocked for testing (`2026-09-25` and `2026-09-28`).
  * `🟢 Active Program` — Current active sessions.
  * `🔒 Future (Locked)` — Upcoming sessions (view roster only).

### ⚙️ Tab 6: Portal (Security & Password Self-Service)
* **Change Password:** Enter current password, new password, and confirm to update login credentials instantly.
* **Patrol Name Customization:** Edit the custom title for your patrol.
* **Data Backup:** Export full database backup or download the master login credentials sheet.

---

## 7. Live Multi-Sheet Excel & CSV Export Engine

Leaders and Admins can click **`📥 Download Report (Excel)`** or **`📄 CSV`** from the Check-In, Duties, or Roster tabs.

### Exported Excel Workbook Structure:
```
Dhulfiqar_Scouts_Report_[Patrol]_[Date].xlsx
│
├── 📑 Sheet 1: Patrol Overview
│   └── Total Scouts, Average Attendance %, Active Warnings, Total Points, Leader in Charge
│
├── 📑 Sheet 2: Attendance Matrix
│   └── Full Date-by-Date Grid (P / A / E) for every session up to the download timestamp
│
└── 📑 Sheet 3: Incident & Demerit Log
    └── Timestamped log of every point added/deducted, reason category, and leader notes
```

---

## 8. Frequently Asked Questions (FAQ) & Troubleshooting

#### Q1: Can leaders take attendance for future Fridays in advance?
**No.** The app strictly locks future dates. Leaders can view the roster for future dates, but status toggles and submission buttons are disabled until the session date arrives.

#### Q2: What should we use to test the app right now?
Use the **2 unlocked Test Sessions**:
* `2026-09-25` — *App Test Day 1: Point Counter & Check-In Trial*
* `2026-09-28` — *App Test Day 2: Live Duty & Evaluation Simulation*  
You can freely mark attendance, test absence points, and download test reports without affecting actual scout records.

#### Q3: Where is the data stored and will it sync across all leaders' phones?
**In Google Cloud Firebase Firestore.** All scout records, attendance matrices, points, and incident logs are stored directly in your Firebase cloud database. Using Firestore real-time listeners (`onSnapshot`), updates made on one leader's phone instantly stream live to all other leaders and the admin dashboard without manual refreshing.

#### Q4: How does a leader reset or change their password?
Navigate to the **⚙️ Portal** tab, scroll to **Security & Password Management**, enter the current password, type the new password twice, and tap **Update Password**. The updated password syncs to Firebase immediately.

---

*Generated for Dhulfiqār Scouting Leadership — All Rights Reserved.*
