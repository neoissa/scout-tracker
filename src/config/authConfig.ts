// src/config/authConfig.ts
import { updatePassword, type User } from 'firebase/auth';

const STORAGE_KEY_PASSWORDS = 'dhulfiqar_custom_passwords';
export const DEFAULT_APP_PASSWORD = 'scouts2026';

// Get all saved custom passwords
export function getSavedPasswords(): Record<string, string> {
  try {
    const data = localStorage.getItem(STORAGE_KEY_PASSWORDS);
    if (data) {
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to parse saved passwords:', err);
  }
  return {};
}

// Get effective password for a user
export function getUserPassword(username: string): string {
  const clean = username.trim().toLowerCase().split('@')[0];
  const saved = getSavedPasswords();
  return saved[clean] || DEFAULT_APP_PASSWORD;
}

// Check if user has customized their password
export function hasCustomPassword(username: string): boolean {
  const clean = username.trim().toLowerCase().split('@')[0];
  const saved = getSavedPasswords();
  return Boolean(saved[clean] && saved[clean] !== DEFAULT_APP_PASSWORD);
}

// Set / Change password for a user
export async function setUserPassword(
  username: string, 
  newPassword: string,
  firebaseUser?: User | null
): Promise<{ success: boolean; message: string }> {
  const clean = username.trim().toLowerCase().split('@')[0];
  const trimmedPass = newPassword.trim();

  if (trimmedPass.length < 4) {
    return { success: false, message: 'Password must be at least 4 characters long.' };
  }

  // 1. Save to Local Storage
  const saved = getSavedPasswords();
  saved[clean] = trimmedPass;
  try {
    localStorage.setItem(STORAGE_KEY_PASSWORDS, JSON.stringify(saved));
  } catch (err) {
    console.error('Failed to save password to localStorage:', err);
    return { success: false, message: 'Failed to write password to browser storage.' };
  }

  // 2. If Firebase user is active and matches, attempt Firebase Auth update
  if (firebaseUser) {
    try {
      await updatePassword(firebaseUser, trimmedPass);
    } catch (fbErr: any) {
      console.warn('Firebase Auth password update note:', fbErr?.message || fbErr);
      // Even if Firebase requires recent login, local password is saved
    }
  }

  return { success: true, message: `Password for @${clean} updated successfully!` };
}

// Reset password for a user back to default 'scouts2026'
export function resetUserPassword(username: string): { success: boolean; message: string } {
  const clean = username.trim().toLowerCase().split('@')[0];
  const saved = getSavedPasswords();
  delete saved[clean];
  try {
    localStorage.setItem(STORAGE_KEY_PASSWORDS, JSON.stringify(saved));
  } catch (err) {
    console.error(err);
  }
  return { success: true, message: `Password for @${clean} reset to default (scouts2026).` };
}

// Verify entered password
export function verifyUserPassword(username: string, inputPassword: string): boolean {
  const clean = username.trim().toLowerCase().split('@')[0];
  const expected = getUserPassword(clean);
  return inputPassword.trim() === expected;
}
