import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';
import { LEADER_PROFILES, findLeaderProfile } from './config/leaderRoles';
import { getTaliahForGrade } from './config/taliahConfig';
import { 
  verifyUserPassword, 
  hasCustomPassword, 
  DEFAULT_APP_PASSWORD 
} from './config/authConfig';

interface LoginProps {
  onLocalLogin?: (usernameOrEmail: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLocalLogin }) => {
  const [identifier, setIdentifier] = useState('leader');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // When account is selected or changed, adjust password behavior
  useEffect(() => {
    const clean = identifier.trim().toLowerCase().split('@')[0];
    if (!clean) return;

    if (hasCustomPassword(clean)) {
      // If user changed their password, require them to input their custom password
      setPassword('');
    } else {
      // If default password is still active, pre-fill default scouts2026 for convenience
      setPassword(DEFAULT_APP_PASSWORD);
    }
    setErrorMsg(null);
  }, [identifier]);

  const handleSelectAccount = (selectedUsername: string) => {
    setIdentifier(selectedUsername);
    const clean = selectedUsername.trim().toLowerCase().split('@')[0];
    if (hasCustomPassword(clean)) {
      setPassword('');
    } else {
      setPassword(DEFAULT_APP_PASSWORD);
    }
    setErrorMsg(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanInput = identifier.trim().toLowerCase().split('@')[0];
    if (!cleanInput) {
      setErrorMsg('Please select or enter your Leader Username / ID.');
      return;
    }

    if (!password) {
      setErrorMsg(`Please enter the password for @${cleanInput}.`);
      return;
    }

    setLoading(true);

    const isCustom = hasCustomPassword(cleanInput);
    const isPasswordCorrect = verifyUserPassword(cleanInput, password);

    if (!isFirebaseConfigured || !auth) {
      // Local / Offline authentication mode
      if (!isPasswordCorrect) {
        if (isCustom) {
          setErrorMsg(`Incorrect custom password for @${cleanInput}. Please enter the new password you set.`);
        } else {
          setErrorMsg(`Incorrect password for @${cleanInput}. Default password is "${DEFAULT_APP_PASSWORD}".`);
        }
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
      console.warn('Firebase login attempt, validating credential store:', err);
      if (isPasswordCorrect && onLocalLogin) {
        onLocalLogin(cleanInput);
        setLoading(false);
        return;
      }
      if (isCustom) {
        setErrorMsg(`Incorrect custom password for @${cleanInput}. Please enter your updated password.`);
      } else {
        setErrorMsg('Invalid username or password. Please verify your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const cleanIdentifier = identifier.trim().toLowerCase().split('@')[0];
  const isAccountCustomized = hasCustomPassword(cleanIdentifier);
  const currentProfile = cleanIdentifier ? findLeaderProfile(cleanIdentifier) : null;
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
              <h1 className="scout-title text-2xl font-extrabold text-white">Leader Portal</h1>
            </div>
          </div>
          <p className="scout-sub mt-2">Sign in to take unit attendance & manage ṭalīʿah</p>
        </header>

        <main className="p-4 sm:p-5 space-y-4">
          
          {/* Account Selection Dropdown Card */}
          <div className="scout-card bg-[#fcfbf7] border-[#d8d3c5] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#66736c]">
                👤 Select Leader Account
              </label>
              <span className="text-[10px] font-bold scout-pill-gold px-2 py-0.5 rounded-full">
                {LEADER_PROFILES.length} Accounts
              </span>
            </div>

            <select
              value={currentProfile?.username || cleanIdentifier}
              onChange={(e) => handleSelectAccount(e.target.value)}
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

          {/* Active Profile Info Badge */}
          {currentProfile && (
            <div className="scout-card bg-[#f4f1e8] border-[#ded9cc] p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span>
                  Selected Qaid: <strong className="text-[#123c2d]">{currentProfile.name}</strong>
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

          {errorMsg && (
            <div className="scout-card bg-[#fff5f5] border-[#fecaca] p-3 text-xs text-[#991b1b] flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="scout-card space-y-3.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-[#17201c]">
                  Password <span className="text-rose-600">*</span>
                </label>
                {isAccountCustomized ? (
                  <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span>🔒</span> Custom Password Required
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-900 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                    Default Initial Password Active
                  </span>
                )}
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full px-3 py-2.5 pr-10 border rounded-xl text-xs sm:text-sm bg-white focus:outline-none focus:ring-1 ${
                    isAccountCustomized 
                      ? 'border-amber-400 focus:border-amber-600 focus:ring-amber-600' 
                      : 'border-[#ccc] focus:border-[#123c2d] focus:ring-[#123c2d]'
                  }`}
                  placeholder={isAccountCustomized ? 'Enter your custom password' : '••••••••'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 text-xs font-bold px-1"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>

              <div className="mt-1 text-[10.5px]">
                {isAccountCustomized ? (
                  <p className="text-amber-800 font-semibold">
                    ✨ You have set a personal password for <strong>@{cleanIdentifier}</strong>. Please input your password to log in.
                  </p>
                ) : (
                  <p className="text-[#8a8f8c]">
                    Default Password: <strong className="text-[#123c2d]">scouts2026</strong> (You can customize it in your profile)
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full scout-btn-primary text-sm shadow-md mt-2 py-3 flex items-center justify-center gap-2 cursor-pointer font-bold"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Sign In as @{cleanIdentifier} →</span>
              )}
            </button>
          </form>

          {/* Info Card */}
          <div className="scout-card bg-[#faf8f2] border-[#ded9cc] p-3 text-xs space-y-1 text-[#66736c]">
            <div className="flex items-center gap-1.5 font-bold text-[#123c2d]">
              <span>💡</span> Password Security Notice
            </div>
            <p className="text-[11px] leading-relaxed">
              If you updated your password in the <strong>Portal</strong> tab, enter your new password above. If you forgot your password, contact Troop Administration.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
};