import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';
import { LEADER_ROLE_MAP } from './config/leaderRoles';

interface LoginProps {
  onLocalLogin?: (email: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLocalLogin }) => {
  const [email, setEmail] = useState('leader@dhulfiqarscouts.org');
  const [password, setPassword] = useState('password123');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    if (!isFirebaseConfigured || !auth) {
      // Local / Offline mode
      if (onLocalLogin) {
        onLocalLogin(email.trim().toLowerCase());
      }
      setLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: any) {
      console.warn('Firebase login error, offering local fallback:', err);
      setErrorMsg(
        err?.message?.includes('invalid-credential')
          ? 'Invalid email or password.'
          : 'Authentication failed. Firebase backend not configured or invalid credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (selectedEmail?: string) => {
    const targetEmail = (selectedEmail || email).trim().toLowerCase();
    if (onLocalLogin) {
      onLocalLogin(targetEmail);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
        <div>
          <div className="inline-block px-2.5 py-1 bg-blue-50 text-blue-700 text-[11px] font-bold rounded-full mb-2">
            Dhulfiqār Scouting Program
          </div>
          <h2 className="text-xl font-bold text-slate-900">Leader Portal Login</h2>
          <p className="text-xs text-slate-500 mt-1">Sign in to take unit attendance</p>
        </div>

        {/* Quick Leader Switcher for Testing / Convenience */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Select Leader Profile
          </label>
          <select
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
          >
            {Object.values(LEADER_ROLE_MAP).map((leader) => (
              <option key={leader.email} value={leader.email}>
                {leader.name} — {leader.assignedGrade === 'ALL' ? 'Admin (All Grades)' : leader.assignedGrade}
              </option>
            ))}
          </select>
        </div>

        {!isFirebaseConfigured && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
            <p className="font-bold">ℹ️ Local Preview Mode Active</p>
            <p className="text-[11px] text-amber-700">
              Firebase credentials not detected. You can sign in directly with any profile above to preview role scoping.
            </p>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium space-y-2">
            <div>{errorMsg}</div>
            <button
              type="button"
              onClick={() => handleQuickDemo()}
              className="px-2.5 py-1 bg-rose-700 text-white rounded text-[11px] font-semibold hover:bg-rose-800 transition cursor-pointer"
            >
              Continue in Local Demo Mode →
            </button>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Leader Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 bg-slate-50/50"
              placeholder="leader@dhulfiqarscouts.org"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 bg-slate-50/50"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs sm:text-sm shadow transition-colors disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Authenticating...' : isFirebaseConfigured ? 'Sign In' : 'Sign In as Selected Leader'}
          </button>
        </form>

        {isFirebaseConfigured && (
          <button
            type="button"
            onClick={() => handleQuickDemo()}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-xs transition cursor-pointer"
          >
            Skip & Enter in Demo Mode
          </button>
        )}
      </div>
    </div>
  );
};