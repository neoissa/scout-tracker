import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';
import { LEADER_PROFILES, findLeaderProfile } from './config/leaderRoles';
import { getTaliahForGrade } from './config/taliahConfig';

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
              <div className="scout-brand">Dhulfiqār Scouting Program</div>
              <h1 className="scout-title text-2xl font-extrabold text-white">Leader Portal</h1>
            </div>
          </div>
          <p className="scout-sub mt-2">Sign in to take unit attendance & manage ṭalīʿah</p>
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
                <option value="leader">👑 Troop Leader (@leader) — All Units</option>
                <option value="admin">👑 Troop Admin (@admin) — All Units</option>
              </optgroup>
              <optgroup label="⭐ Kindergarten (Lions - KG)">
                <option value="bdabaja">⭐ Bilal Dabaja (@bdabaja) — Ṭalīʿat al-Mahdi (ʿaj)</option>
              </optgroup>
              <optgroup label="⭐ 1st Grade (Tigers - 1st)">
                <option value="nchamseddine">⭐ Nader Chamseddine (@nchamseddine) — Ṭalīʿat al-Muṣṭafā (ṣ)</option>
                <option value="msoueidan">🤝 Mohamad Ali Soueidan (@msoueidan) [Asst]</option>
              </optgroup>
              <optgroup label="⭐ 2nd Grade (Wolf - 2nd)">
                <option value="jhazime">⭐ Jawad Hazime (@jhazime) — Ṭalīʿat aṣ-Ṣādiq (ʿa)</option>
                <option value="amohsen">🤝 Ahmad Mohsen (@amohsen) [Asst]</option>
              </optgroup>
              <optgroup label="⭐ 3rd Grade (Bear - 3rd)">
                <option value="hyahfoufi">⭐ Hussein Yahfoufi (@hyahfoufi) — Ṭalīʿat ar-Riḍā (ʿa)</option>
                <option value="bsaleh">🤝 Basel Saleh (@bsaleh) [Asst]</option>
              </optgroup>
              <optgroup label="⭐ 4th Grade (Webelos - 4th)">
                <option value="aayash">⭐ Ayman Ayash (@aayash) — Ṭalīʿat TBD</option>
                <option value="mhammoud">🤝 Mahdi Hammoud (@mhammoud) [Asst]</option>
                <option value="afardous">🤝 Abbas Fardous (@afardous) [Asst]</option>
              </optgroup>
              <optgroup label="⭐ 5th Grade (Arrow of Light - 5th)">
                <option value="tsafwan">⭐ Tamer Safwan (@tsafwan) — Ṭalīʿat Amīr al-Muʾminīn (ʿa)</option>
                <option value="mmussa">🤝 Mohamed Hussein Mussa (@mmussa) [Asst]</option>
                <option value="mhaidarahmad">🤝 Mohammad Haidar-Ahmad (@mhaidarahmad) [Asst]</option>
              </optgroup>
              <optgroup label="⭐ 6th Grade (Patrol 1 - 6th)">
                <option value="mjalloul">⭐ Mohamad Jalloul (@mjalloul) — Ṭalīʿat ʿIshāq al-Ḥusayn (ʿa)</option>
                <option value="hberro">🤝 Hamze Berro (@hberro) [Asst]</option>
              </optgroup>
              <optgroup label="⭐ 7th Grade (Patrol 2 - 6th/7th)">
                <option value="hissa">⭐ Hassan Issa (@hissa) — Ṭalīʿat Abū al-Faḍl al-ʿAbbās</option>
                <option value="ialwishah">🤝 Ibrahim Alwishah (@ialwishah) [Asst]</option>
              </optgroup>
              <optgroup label="⭐ 8th Grade (Patrol 3 - 8th)">
                <option value="hyahfoufi8">⭐ Hasan Yahfoufi (@hyahfoufi8) — Ṭalīʿat al-Bāqir (ʿa)</option>
                <option value="ihassan">🤝 Ibrahim Hassan (@ihassan) [Asst]</option>
              </optgroup>
              <optgroup label="⭐ 9th Grade (Patrol 4 - 9th)">
                <option value="mmourtada">⭐ Mustapha Mourtada (@mmourtada) — Ṭalīʿat Asadullāh (ʿa)</option>
              </optgroup>
              <optgroup label="⭐ 10th / 11th Grade (Patrol 5 - 10th/11th)">
                <option value="mchoucair">⭐ Mustapha Choucair (@mchoucair) — Ṭalīʿat Abā ʿAbdillāh (ʿa)</option>
                <option value="aharajli">⭐ Ali Harajli (@aharajli) — Ṭalīʿat Abā ʿAbdillāh (ʿa)</option>
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
                <div className="mt-2 p-2 bg-[#f4f1e8] rounded-xl border border-[#ded9cc] text-[11px] text-[#66736c] space-y-1">
                  <div className="flex items-center justify-between">
                    <span>
                      User: <strong className="text-[#123c2d]">{currentProfile.name}</strong>
                    </span>
                    <span className="scout-pill text-[10px]">
                      {currentProfile.assignedGrade === 'ALL' ? 'All Units' : currentProfile.assignedGrade}
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