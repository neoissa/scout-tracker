# ⚜️ Dhulfiqār Scout Tracker

Official Attendance & Accountability Mobile Web App for the **Dhulfiqār Scouting Program**.

---

## 🌟 Key Features

* **Universal Mobile Compatibility (PWA)**: Works natively on any iPhone (Safari) and Android (Chrome) with "Add to Home Screen" support.
* **11 Ṭalāʾiʿ (Patrol Groups)**:
  * Lions - KG: *Ṭalīʿat al-Mahdi (ʿaj)*
  * Tigers - 1st: *Ṭalīʿat al-Muṣṭafā (ṣ)*
  * Wolf - 2nd: *Ṭalīʿat aṣ-Ṣādiq (ʿa)*
  * Bear - 3rd: *Ṭalīʿat ar-Riḍā (ʿa)*
  * Webelos - 4th: *Ṭalīʿat TBD* (Customizable)
  * Arrow of Light - 5th: *Ṭalīʿat Amīr al-Muʾminīn (ʿa)*
  * Patrol 1 - 6th: *Ṭalīʿat ʿIshāq al-Ḥusayn (ʿa)*
  * Patrol 2 - 6th/7th: *Ṭalīʿat Abū al-Faḍl al-ʿAbbās*
  * Patrol 3 - 8th: *Ṭalīʿat al-Bāqir (ʿa)*
  * Patrol 4 - 9th: *Ṭalīʿat Asadullāh (ʿa)*
  * Patrol 5 - 10th/11th: *Ṭalīʿat Abā ʿAbdillāh (ʿa)*
* **Admin & Troop Leader Exclusive Controls**:
  * Only `@leader` and `@admin` can **Add**, **Remove**, or **Reassign** scouts across units.
* **Personalized Leader Passwords**:
  * Every leader can change their password from the Leader Portal with persistent storage. Default: `scouts2026`.
* **Accountability & Honor System**:
  * Uniform checks ($\pm 5$ pts), Punctuality at 6:30 PM ($\pm 5$ pts), Quran/Dua recital ($+10$ pts), Patrol Duty ($+5$ pts), and audit history.
* **1-Click Database Persistence & JSON Backup/Restore**:
  * Complete roster and session data saved locally and live-synced to Firebase Firestore.
  * Download/Upload full database JSON snapshots at any time.

---

## 🚀 Running the App

```bash
# Install dependencies
npm install

# Start Vite local development server
npm run dev

# Build for production
npm run build
```
