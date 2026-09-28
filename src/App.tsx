import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  doc, 
  writeBatch, 
  increment, 
  serverTimestamp, 
  query, 
  where,
  addDoc
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Login } from './Login';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'EXCUSED';

interface Scout {
  id: string;
  fullName: string;
  patrolName: string;
  unexcusedAbsences: number;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [scouts, setScouts] = useState<Scout[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warningList, setWarningList] = useState<string[]>([]);

  // Monitor Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        loadScouts();
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch Roster
  const loadScouts = async () => {
    setLoadingRoster(true);
    try {
      const q = query(collection(db, 'scouts'), where('isActive', '==', true));
      const snap = await getDocs(q);
      
      const list: Scout[] = snap.docs.map((d) => ({
        id: d.id,
        fullName: d.data().fullName,
        patrolName: d.data().patrolName || 'Patrol 1',
        unexcusedAbsences: d.data().unexcusedAbsences || 0,
      }));

      setScouts(list);
      const defaults: Record<string, AttendanceStatus> = {};
      list.forEach((s) => (defaults[s.id] = 'PRESENT'));
      setAttendance(defaults);
    } catch (err) {
      console.error('Error fetching roster:', err);
    } finally {
      setLoadingRoster(false);
    }
  };

  // Seed sample scouts if collection is empty
  const handleSeedData = async () => {
    const initialScouts = [
      { fullName: 'Zayd Al-Husseini', patrolName: 'Patrol 1', unexcusedAbsences: 2, isActive: true },
      { fullName: 'Ali Mansour', patrolName: 'Patrol 1', unexcusedAbsences: 0, isActive: true },
      { fullName: 'Hussein Kanso', patrolName: 'Patrol 2', unexcusedAbsences: 1, isActive: true },
    ];
    for (const item of initialScouts) {
      await addDoc(collection(db, 'scouts'), item);
    }
    await loadScouts();
  };

  // Submit Attendance & Update Absence Counters
  const handleSubmit = async () => {
    setSaving(true);
    setWarningList([]);

    try {
      const batch = writeBatch(db);
      const today = new Date().toISOString().split('T')[0];
      const newlyFlagged: string[] = [];

      scouts.forEach((scout) => {
        const currentStatus = attendance[scout.id];
        const recordRef = doc(db, 'sessions', today, 'records', scout.id);
        
        batch.set(recordRef, {
          status: currentStatus,
          submittedBy: user?.email,
          timestamp: serverTimestamp(),
        });

        if (currentStatus === 'ABSENT') {
          const scoutRef = doc(db, 'scouts', scout.id);
          batch.update(scoutRef, {
            unexcusedAbsences: increment(1),
          });

          if (scout.unexcusedAbsences + 1 >= 3) {
            newlyFlagged.push(`${scout.fullName} (${scout.unexcusedAbsences + 1} absences)`);
          }
        }
      });

      await batch.commit();

      if (newlyFlagged.length > 0) {
        setWarningList(newlyFlagged);
      } else {
        alert('Attendance records submitted successfully.');
      }

      await loadScouts();
    } catch (err) {
      console.error(err);
      alert('Error committing records to Firebase.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">
        Verifying leader credentials...
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      {/* Header */}
      <header className="flex justify-between items-center border-b pb-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Scout Check-In</h1>
          <p className="text-xs text-slate-500">Logged in as {user.email}</p>
        </div>
        <button
          onClick={() => signOut(auth)}
          className="text-xs text-slate-600 hover:text-slate-900 border border-slate-300 px-2.5 py-1 rounded-md"
        >
          Sign Out
        </button>
      </header>

      {/* Warning Box */}
      {warningList.length > 0 && (
        <div className="p-3.5 bg-rose-50 border-l-4 border-rose-600 rounded-r-lg text-xs text-rose-800 space-y-1">
          <p className="font-bold">⚠️ Absence Threshold Alert (≥ 3 Absences):</p>
          <ul className="list-disc list-inside font-medium">
            {warningList.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Roster Area */}
      {loadingRoster ? (
        <div className="p-8 text-center text-slate-400 text-sm">Loading scout roster...</div>
      ) : scouts.length === 0 ? (
        <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-lg space-y-3">
          <p className="text-sm text-slate-500">No scouts in your database yet.</p>
          <button
            onClick={handleSeedData}
            className="px-3 py-1.5 bg-slate-800 text-white rounded text-xs font-medium"
          >
            Add 3 Test Scouts
          </button>
        </div>
      ) : (
        <div className="divide-y border rounded-lg bg-white shadow-sm overflow-hidden">
          {scouts.map((scout) => {
            const status = attendance[scout.id];
            const hasWarning = scout.unexcusedAbsences >= 3;

            return (
              <div key={scout.id} className="p-3 flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-800">{scout.fullName}</span>
                    {hasWarning && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-rose-100 text-rose-700 font-bold rounded">
                        {scout.unexcusedAbsences} Absences
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400">{scout.patrolName}</span>
                </div>

                <div className="flex gap-1">
                  {(['PRESENT', 'ABSENT', 'EXCUSED'] as AttendanceStatus[]).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAttendance((prev) => ({ ...prev, [scout.id]: val }))}
                      className={`text-xs px-2.5 py-1.5 rounded font-medium border transition-colors ${
                        status === val
                          ? val === 'PRESENT'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : val === 'ABSENT'
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-amber-500 text-white border-amber-500'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {val[0]}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {scouts.length > 0 && (
        <button
          onClick={handleSubmit}
          disabled={saving || loadingRoster}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm shadow transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Submit Attendance'}
        </button>
      )}
    </div>
  );
}