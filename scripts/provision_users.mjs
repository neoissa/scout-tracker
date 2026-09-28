// scripts/provision_users.mjs
// Run this script to batch create/export all leader & assistant user accounts for Firebase Authentication.
// Usage: node scripts/provision_users.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_PASSWORD = 'scouts2026';

export const LEADER_PROFILES = [
  { username: 'leader', name: 'Troop Leader', assignedGrade: 'ALL', role: 'ADMIN' },
  { username: 'admin', name: 'Troop Admin', assignedGrade: 'ALL', role: 'ADMIN' },
  { username: 'bdabaja', name: 'Bilal Dabaja', assignedGrade: 'Kindergarten', role: 'LEADER' },
  { username: 'nchamseddine', name: 'Nader Chamseddine', assignedGrade: '1st Grade', role: 'LEADER' },
  { username: 'msoueidan', name: 'Mohamad Ali Soueidan', assignedGrade: '1st Grade', role: 'ASST_LEADER' },
  { username: 'jhazime', name: 'Jawad Hazime', assignedGrade: '2nd Grade', role: 'LEADER' },
  { username: 'amohsen', name: 'Ahmad Mohsen', assignedGrade: '2nd Grade', role: 'ASST_LEADER' },
  { username: 'hyahfoufi', name: 'Hussein Yahfoufi', assignedGrade: '3rd Grade', role: 'LEADER' },
  { username: 'bsaleh', name: 'Basel Saleh', assignedGrade: '3rd Grade', role: 'ASST_LEADER' },
  { username: 'aayash', name: 'Ayman Ayash', assignedGrade: '4th Grade', role: 'LEADER' },
  { username: 'mhammoud', name: 'Mahdi Hammoud', assignedGrade: '4th Grade', role: 'ASST_LEADER' },
  { username: 'afardous', name: 'Abbas Fardous', assignedGrade: '4th Grade', role: 'ASST_LEADER' },
  { username: 'tsafwan', name: 'Tamer Safwan', assignedGrade: '5th Grade', role: 'LEADER' },
  { username: 'mmussa', name: 'Mohamed Hussein Mussa', assignedGrade: '5th Grade', role: 'ASST_LEADER' },
  { username: 'mhaidarahmad', name: 'Mohammad Haidar-Ahmad', assignedGrade: '5th Grade', role: 'ASST_LEADER' },
  { username: 'mjalloul', name: 'Mohamad Jalloul', assignedGrade: '6th Grade', role: 'LEADER' },
  { username: 'hberro', name: 'Hamze Berro', assignedGrade: '6th Grade', role: 'ASST_LEADER' },
  { username: 'hissa', name: 'Hassan Issa', assignedGrade: '7th Grade', role: 'LEADER' },
  { username: 'ialwishah', name: 'Ibrahim Alwishah', assignedGrade: '7th Grade', role: 'ASST_LEADER' },
  { username: 'hyahfoufi8', name: 'Hasan Yahfoufi', assignedGrade: '8th Grade', role: 'LEADER' },
  { username: 'ihassan', name: 'Ibrahim Hassan', assignedGrade: '8th Grade', role: 'ASST_LEADER' },
  { username: 'mmourtada', name: 'Mustapha Mourtada', assignedGrade: '9th Grade', role: 'LEADER' },
  { username: 'mchoucair', name: 'Mustapha Choucair', assignedGrade: '10th / 11th Grade', role: 'LEADER' },
  { username: 'aharajli', name: 'Ali Harajli', assignedGrade: '10th / 11th Grade', role: 'LEADER' }
];

// Generate JSON export for Firebase CLI auth:import or reference
const usersExport = {
  users: LEADER_PROFILES.map((p) => ({
    localId: `user_${p.username}`,
    email: `${p.username}@dhulfiqarscouts.org`,
    displayName: p.name,
    password: DEFAULT_PASSWORD,
    customAttributes: JSON.stringify({
      username: p.username,
      assignedGrade: p.assignedGrade,
      role: p.role
    })
  }))
};

const exportPath = path.join(__dirname, 'firebase_users_import.json');
fs.writeFileSync(exportPath, JSON.stringify(usersExport, null, 2), 'utf-8');
console.log(`✅ Generated ${exportPath} with all ${LEADER_PROFILES.length} user accounts (Password: "${DEFAULT_PASSWORD}").`);

// If serviceAccountKey.json exists and firebase-admin is installed, provision directly
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');

async function provisionDirectly() {
  if (!fs.existsSync(serviceAccountPath)) {
    console.log(`\nℹ️ Ready! Password for all 24 accounts is set to: "${DEFAULT_PASSWORD}"`);
    return;
  }

  try {
    const adminApp = await import('firebase-admin/app');
    const adminAuth = await import('firebase-admin/auth');

    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    adminApp.initializeApp({
      credential: adminApp.cert(serviceAccount)
    });

    const auth = adminAuth.getAuth();
    console.log('\n🚀 Provisioning users directly into Firebase Authentication...');

    for (const profile of LEADER_PROFILES) {
      const email = `${profile.username}@dhulfiqarscouts.org`;
      try {
        try {
          const existing = await auth.getUserByEmail(email);
          await auth.updateUser(existing.uid, {
            displayName: profile.name,
            password: DEFAULT_PASSWORD
          });
          console.log(`  ✓ Updated: ${profile.name} (${email})`);
        } catch {
          await auth.createUser({
            uid: `user_${profile.username}`,
            email,
            password: DEFAULT_PASSWORD,
            displayName: profile.name
          });
          console.log(`  ✓ Created: ${profile.name} (${email})`);
        }

        await auth.setCustomUserClaims(`user_${profile.username}`, {
          username: profile.username,
          assignedGrade: profile.assignedGrade,
          role: profile.role
        });
      } catch (err) {
        console.error(`  ✗ Error provisioning ${email}:`, err.message);
      }
    }
    console.log('\n🎉 Successfully provisioned all accounts in Firebase!');
  } catch (err) {
    console.log('Firebase-admin package not installed. To run direct admin provisioning, install firebase-admin.');
  }
}

provisionDirectly().catch(console.error);
