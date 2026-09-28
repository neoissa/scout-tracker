import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';
import { LEADER_PROFILES, findLeaderProfile } from './config/leaderRoles';

interface LoginProps {
  onLocalLogin?: (usernameOrEmail: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLocalLogin }) => {
  const [identifier, setIdentifier] = useState('leader');
  const [password, setPassword] = useState('scouts2026');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const cleanInput = identifier.trim().toLowerCase();

    if (!isFirebaseConfigured || !auth) {
      // Local / Offline mode
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
    } catch (err: any) {
      console.warn('Firebase login error, offering local fallback:', err);
      setErrorMsg(
        err?.message?.includes('invalid-credential')
          ? 'Invalid username or password.'
          : 'Authentication failed. Firebase backend not configured or invalid credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (selectedUsername?: string) => {
    const target = (selectedUsername || identifier).trim().toLowerCase();
    if (onLocalLogin) {
      onLocalLogin(target);
    }
  };

  const currentProfile = findLeaderProfile(identifier);

  return (
    <div className="min-h-screen flex items-center justify-center p-3" style={{ backgroundColor: 'var(--body-bg)' }}>
      <div className="phone-container w-full max-w-[440px] shadow-xl">
        {/* Header with Forest Green & Gold Brand */}
        <header className="scout-header">
          <div className="flex items-center gap-3">
            <img
              src="/scouts_logo.png"
              alt="Dhulfiqār Scouts Logo"
              className="w-11 h-11 rounded-xl object-contain bg-white/10 p-1 shadow-sm border border-white/20"
              onError={(e) => {
                // fallback if image not loaded
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div>
              <div className="scout-brand">Dhulfiqār Scouting Program</div>
              <h1 className="scout-title text-2xl font-extrabold text-white">Leader Portal</h1>
            </div>
          </div>
          <p className="scout-sub mt-2">Sign in to take unit attendance & manage scouts</p>
        </header>

        <main className="p-4 sm:p-5 space-y-4">
          {/* Quick Switcher Card */}
          <div className="scout-card bg-[#fcfbf7] border-[#d8d3c5] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#66736c]">
                ⚡ Quick Select Account
              </label>
              <span className="text-[10px] font-bold scout-pill-gold px-2 py-0.5 rounded-full">
                {LEADER_PROFILES.length} Profiles
              </span>
            </div>
            <select
              value={currentProfile?.username || identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full text-xs font-semibold text-[#17201c] bg-white border border-[#ccc5b6] rounded-xl p-2.5 focus:ring-2 focus:ring-[#123c2d] outline-none shadow-xs cursor-pointer"
            >
              <optgroup label="👑 Administration">
                <option value="leader">👑 Troop Leader (@leader) — All Grades</option>
                <option value="admin">👑 Troop Admin (@admin) — All Grades</option>
              </optgroup>
              <optgroup label="⭐ Kindergarten">
                <option value="bdabaja">⭐ Bilal Dabaja (@bdabaja) — Kindergarten</option>
              </optgroup>
              <optgroup label="⭐ 1st Grade">
                <option value="nchamseddine">⭐ Nader Chamseddine (@nchamseddine) — 1st Grade</option>
                <option value="msoueidan">🤝 Mohamad Ali Soueidan (@msoueidan) [Asst] — 1st Grade</option>
              </optgroup>
              <optgroup label="⭐ 2nd Grade">
                <option value="jhazime">⭐ Jawad Hazime (@jhazime) — 2nd Grade</option>
                <option value="amohsen">🤝 Ahmad Mohsen (@amohsen) [Asst] — 2nd Grade</option>
              </optgroup>
              <optgroup label="⭐ 3rd Grade">
                <option value="hyahfoufi">⭐ Hussein Yahfoufi (@hyahfoufi) — 3rd Grade</option>
                <option value="bsaleh">🤝 Basel Saleh (@bsaleh) [Asst] — 3rd Grade</option>
              </optgroup>
              <optgroup label="⭐ 4th Grade">
                <option value="aayash">⭐ Ayman Ayash (@aayash) — 4th Grade</option>
                <option value="mhammoud">🤝 Mahdi Hammoud (@mhammoud) [Asst] — 4th Grade</option>
                <option value="afardous">🤝 Abbas Fardous (@afardous) [Asst] — 4th Grade</option>
              </optgroup>
              <optgroup label="⭐ 5th Grade">
                <option value="tsafwan">⭐ Tamer Safwan (@tsafwan) — 5th Grade</option>
                <option value="mmussa">🤝 Mohamed Hussein Mussa (@mmussa) [Asst] — 5th Grade</option>
                <option value="mhaidarahmad">🤝 Mohammad Haidar-Ahmad (@mhaidarahmad) [Asst] — 5th Grade</option>
              </optgroup>
              <optgroup label="⭐ 6th Grade">
                <option value="mjalloul">⭐ Mohamad Jalloul (@mjalloul) — 6th Grade</option>
                <option value="hberro">🤝 Hamze Berro (@hberro) [Asst] — 6th Grade</option>
              </optgroup>
              <optgroup label="⭐ 7th Grade">
                <option value="hissa">⭐ Hassan Issa (@hissa) — 7th Grade</option>
                <option value="ialwishah">🤝 Ibrahim Alwishah (@ialwishah) [Asst] — 7th Grade</option>
              </optgroup>
              <optgroup label="⭐ 8th Grade">
                <option value="hyahfoufi8">⭐ Hasan Yahfoufi (@hyahfoufi8) — 8th Grade</option>
                <option value="ihassan">🤝 Ibrahim Hassan (@ihassan) [Asst] — 8th Grade</option>
              </optgroup>
              <optgroup label="⭐ 9th Grade">
                <option value="mmourtada">⭐ Mustapha Mourtada (@mmourtada) — 9th Grade</option>
              </optgroup>
              <optgroup label="⭐ 10th / 11th Grade (Combined)">
                <option value="mchoucair">⭐ Mustapha Choucair (@mchoucair) — 10th / 11th Grade</option>
                <option value="aharajli">⭐ Ali Harajli (@aharajli) — 10th / 11th Grade</option>
              </optgroup>
            </select>
          </div>

          {!isFirebaseConfigured && (
            <div className="scout-card bg-[#fffcf2] border-[#f1e6b8] p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-[#8a6514]">
                <span>🏕️</span> Local Preview Mode Active
              </div>
              <p className="text-[11px] text-[#735410]">
                Select any leader profile above to sign in and take attendance.
              </p>
            </div>
          )}

          {errorMsg && (
            <div className="scout-card bg-[#fff5f5] border-[#fecaca] p-3 text-xs text-[#991b1b] space-y-2">
              <div>{errorMsg}</div>
              <button
                type="button"
                onClick={() => handleQuickDemo()}
                className="px-3 py-1.5 bg-[#991b1b] text-white rounded-lg text-xs font-semibold hover:bg-[#7f1d1d] transition cursor-pointer"
              >
                Continue in Local Demo Mode →
              </button>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="scout-card space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-[#17201c] mb-1">Username / ID</label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full px-3 py-2.5 border border-[#ccc] rounded-xl text-xs sm:text-sm bg-white focus:outline-none focus:border-[#123c2d] focus:ring-1 focus:ring-[#123c2d]"
                placeholder="e.g. bdabaja, msoueidan, leader"
              />
              {currentProfile && (
                <div className="mt-1.5 text-[11px] text-[#66736c] flex items-center justify-between">
                  <span>
                    Logged in as: <strong className="text-[#123c2d]">{currentProfile.name}</strong>
                  </span>
                  <span className="scout-pill text-[10px]">
                    {currentProfile.assignedGrade === 'ALL' ? 'All Units' : currentProfile.assignedGrade}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#17201c] mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 border border-[#ccc] rounded-xl text-xs sm:text-sm bg-white focus:outline-none focus:border-[#123c2d] focus:ring-1 focus:ring-[#123c2d]"
                placeholder="••••••••"
              />
              <p className="text-[10px] text-[#8a8f8c] mt-1">Default Password: <strong>scouts2026</strong></p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full scout-btn-primary text-sm shadow-md mt-2 flex items-center justify-center gap-2"
            >
              {loading ? 'Authenticating...' : `Sign In as @${currentProfile?.username || identifier}`}
            </button>
          </form>

          {isFirebaseConfigured && (
            <button
              type="button"
              onClick={() => handleQuickDemo()}
              className="w-full scout-btn-outline text-xs text-center"
            >
              Skip & Enter Demo Mode
            </button>
          )}
        </main>
      </div>
    </div>
  );
};