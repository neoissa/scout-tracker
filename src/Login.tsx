import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';
import { findLeaderProfile } from './config/leaderRoles';
import { getTaliahForGrade } from './config/taliahConfig';
import { verifyUserPassword } from './config/authConfig';

interface LoginProps {
  onLocalLogin?: (usernameOrEmail: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLocalLogin }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanInput = identifier.trim().toLowerCase().split('@')[0];
    if (!cleanInput) {
      setErrorMsg('Please enter your username or ID.');
      return;
    }

    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setLoading(true);

    const isLocalPasswordValid = verifyUserPassword(cleanInput, password);

    if (!isFirebaseConfigured || !auth) {
      // Local / Offline authentication mode
      if (!isLocalPasswordValid) {
        setErrorMsg(`Incorrect password for @${cleanInput}. Please enter your valid password.`);
        setLoading(false);
        return;
      }
      if (onLocalLogin) {
        onLocalLogin(cleanInput);
      }
      setLoading(false);
      return;
    }

    try {
      const authEmail = cleanInput.includes('@')
        ? cleanInput
        : `${cleanInput}@dhulfiqarscouts.org`;

      await signInWithEmailAndPassword(auth, authEmail, password);
      if (onLocalLogin) {
        onLocalLogin(cleanInput);
      }
    } catch (err: any) {
      console.warn('Firebase login check, checking local credential store:', err);
      if (isLocalPasswordValid && onLocalLogin) {
        onLocalLogin(cleanInput);
        setLoading(false);
        return;
      }
      setErrorMsg('Invalid username or password. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const currentProfile = identifier.trim() ? findLeaderProfile(identifier.trim().toLowerCase()) : null;
  const taliahInfo = currentProfile && currentProfile.assignedGrade !== 'ALL' 
    ? getTaliahForGrade(currentProfile.assignedGrade) 
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center p-3" style={{ backgroundColor: 'var(--body-bg)' }}>
      <div className="phone-container w-full max-w-[440px] shadow-xl">
        {/* Header with Forest Green & Gold Brand */}
        <header className="scout-header">
          <div className="flex items-center gap-3">
            <img
              src="/scouts_logo.png"
              alt="Dhulfiqār Scouts Official Emblem"
              className="w-13 h-13 rounded-full object-cover shadow-md border-2 border-[#e6d7a8] flex-shrink-0"
            />
            <div>
              <div className="scout-brand">Dhulfiqār Scout Tracker</div>
              <h1 className="scout-title text-2xl font-extrabold text-white">Leader Sign In</h1>
            </div>
          </div>
          <p className="scout-sub mt-2">Enter your credentials to access your ṭalīʿah portal</p>
        </header>

        <main className="p-4 sm:p-5 space-y-4">
          {errorMsg && (
            <div className="scout-card bg-[#fff5f5] border-[#fecaca] p-3 text-xs text-[#991b1b] flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          {/* Secure Login Form */}
          <form onSubmit={handleLogin} className="scout-card space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-[#17201c] mb-1">
                Leader Username / ID <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                autoCapitalize="none"
                autoCorrect="off"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full px-3 py-2.5 border border-[#ccc] rounded-xl text-xs sm:text-sm bg-white focus:outline-none focus:border-[#123c2d] focus:ring-1 focus:ring-[#123c2d]"
                placeholder="e.g. bdabaja, msoueidan, mjalloul, admin"
              />

              {currentProfile && (
                <div className="mt-2 p-2.5 bg-[#f4f1e8] rounded-xl border border-[#ded9cc] text-[11px] text-[#66736c] space-y-1">
                  <div className="flex items-center justify-between">
                    <span>
                      Leader: <strong className="text-[#123c2d]">{currentProfile.name}</strong>
                    </span>
                    <span className="scout-pill text-[10px]">
                      {currentProfile.assignedGrade === 'ALL' ? '👑 All Units' : currentProfile.assignedGrade}
                    </span>
                  </div>
                  {taliahInfo && (
                    <div className="flex items-center justify-between text-[#123c2d] font-semibold border-t border-[#e8e4d8] pt-1">
                      <span>⚜️ {taliahInfo.taliahRank}:</span>
                      <span className={taliahInfo.isTBD ? 'text-amber-800 font-bold' : 'text-[#123c2d]'}>
                        {taliahInfo.taliahName}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#17201c] mb-1">
                Password <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 border border-[#ccc] rounded-xl text-xs sm:text-sm bg-white focus:outline-none focus:border-[#123c2d] focus:ring-1 focus:ring-[#123c2d]"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 text-xs font-bold px-1"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full scout-btn-primary text-sm shadow-md mt-3 py-3 flex items-center justify-center gap-2 cursor-pointer font-bold"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <span>Sign In to Scout Tracker →</span>
              )}
            </button>
          </form>

          {/* Security Notice Card */}
          <div className="scout-card bg-[#faf8f2] border-[#ded9cc] p-3 text-xs space-y-1.5 text-[#66736c]">
            <div className="flex items-center gap-1.5 font-bold text-[#123c2d]">
              <span>🔒</span> Protected Leader Access
            </div>
            <p className="text-[11px] leading-relaxed">
              Each patrol leader and assistant has an individual account with scoped access to their assigned ṭalīʿah. To switch accounts, log out from the <strong>Portal</strong> tab.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
};