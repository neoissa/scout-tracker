import { useEffect, useState, useMemo } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  doc, 
  writeBatch, 
  increment, 
  serverTimestamp, 
  query, 
  where
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from './firebase';
import { Login } from './Login';
import { INITIAL_SCOUTS, type Scout } from './data/roster';
import { FRIDAY_SESSIONS } from './data/schedule';
import { LEADER_ROLE_MAP, type LeaderProfile } from './config/leaderRoles';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'EXCUSED';

const ALL_GRADES = [
  'Kindergarten',
  '1st Grade',
  '2nd Grade',
  '3rd Grade',
  '4th Grade',
  '5th Grade',
  '6th Grade',
  '7th Grade',
  '8th Grade',
  '9th Grade',
  '10th Grade',
  '11th Grade'
];

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [localUserEmail, setLocalUserEmail] = useState<string | null>(() => {
    return localStorage.getItem('scout_tracker_local_user');
  });
  const [authLoading, setAuthLoading] = useState(true);

  const currentUserEmail = firebaseUser?.email || localUserEmail;

  // Leader Profile Lookup
  const leaderProfile: LeaderProfile | undefined = useMemo(() => {
    if (!currentUserEmail) return undefined;
    return LEADER_ROLE_MAP[currentUserEmail.toLowerCase()] || {
      email: currentUserEmail,
      name: currentUserEmail.split('@')[0],
      assignedGrade: 'ALL',
      role: 'ADMIN'
    };
  }, [currentUserEmail]);

  const isAdmin = leaderProfile?.role === 'ADMIN' || leaderProfile?.assignedGrade === 'ALL';
  const assignedGradeName = leaderProfile?.assignedGrade === 'ALL' ? 'All Grades' : (leaderProfile?.assignedGrade || 'All Grades');

  const [scouts, setScouts] = useState<Scout[]>(INITIAL_SCOUTS);
  const [selectedGrade, setSelectedGrade] = useState<string>('All Grades');
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warningList, setWarningList] = useState<string[]>([]);
  const [seeding, setSeeding] = useState(false);

  // Set initial selected grade based on leader role
  useEffect(() => {
    if (leaderProfile) {
      if (leaderProfile.role !== 'ADMIN' && leaderProfile.assignedGrade !== 'ALL') {
        setSelectedGrade(leaderProfile.assignedGrade);
      } else {
        setSelectedGrade('All Grades');
      }
    }
  }, [leaderProfile]);

  // Active Friday date selection
  const programFridays = useMemo(() => FRIDAY_SESSIONS.filter(s => s.isProgram), []);
  const [selectedDate, setSelectedDate] = useState<string>(programFridays[0]?.date || '2026-10-02');
  const [filterProgramOnly, setFilterProgramOnly] = useState<boolean>(true);

  const availableFridays = useMemo(() => {
    return filterProgramOnly ? programFridays : FRIDAY_SESSIONS;
  }, [filterProgramOnly, programFridays]);

  const currentSessionInfo = useMemo(() => {
    return FRIDAY_SESSIONS.find(s => s.date === selectedDate);
  }, [selectedDate]);

  // Monitor Auth State
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setAuthLoading(false);
      return;
    }

    let unsubscribed = false;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (unsubscribed) return;
      setFirebaseUser(user);
      setAuthLoading(false);
      if (user) {
        loadScouts();
      }
    });

    const timer = setTimeout(() => {
      setAuthLoading(false);
    }, 1500);

    return () => {
      unsubscribed = true;
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  // Fetch Roster
  const loadScouts = async () => {
    if (!isFirebaseConfigured || !db) {
      setScouts(INITIAL_SCOUTS);
      return;
    }

    setLoadingRoster(true);
    try {
      const q = query(collection(db, 'scouts'), where('isActive', '==', true));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setScouts(INITIAL_SCOUTS);
      } else {
        const list: Scout[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            scoutIdNumber: data.scoutIdNumber ?? 0,
            sortOrder: data.sortOrder ?? 0,
            fullName: data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            grade: data.grade || 'Unassigned',
            leader: data.leader || '',
            asstLeader: data.asstLeader || '',
            isActive: data.isActive ?? true,
            unexcusedAbsences: data.unexcusedAbsences || 0,
          };
        });

        // Deterministic sorting
        list.sort((a, b) => (a.sortOrder - b.sortOrder) || a.scoutIdNumber - b.scoutIdNumber || a.fullName.localeCompare(b.fullName));
        setScouts(list);
      }
    } catch (err) {
      console.warn('Could not fetch from Firebase, using offline roster:', err);
      setScouts(INITIAL_SCOUTS);
    } finally {
      setLoadingRoster(false);
    }
  };

  // Load session attendance records for selected date
  useEffect(() => {
    if (!currentUserEmail || scouts.length === 0 || !selectedDate) return;
    loadSessionAttendance(selectedDate);
  }, [selectedDate, scouts.length, currentUserEmail]);

  const loadSessionAttendance = async (date: string) => {
    setLoadingSession(true);
    try {
      let existingData: Record<string, AttendanceStatus> = {};

      if (isFirebaseConfigured && db) {
        try {
          const sessionRecordsRef = collection(db, 'sessions', date, 'records');
          const snap = await getDocs(sessionRecordsRef);
          snap.docs.forEach((docSnap) => {
            const d = docSnap.data();
            if (d.status) existingData[docSnap.id] = d.status as AttendanceStatus;
          });
        } catch (e) {
          console.warn('Failed reading from Firestore, using local storage:', e);
        }
      }

      if (Object.keys(existingData).length === 0) {
        const localSaved = localStorage.getItem(`attendance_${date}`);
        if (localSaved) {
          try {
            existingData = JSON.parse(localSaved);
          } catch (e) {}
        }
      }

      // Default unset scouts to PRESENT
      const defaults: Record<string, AttendanceStatus> = {};
      scouts.forEach((s) => {
        defaults[s.id] = existingData[s.id] || 'PRESENT';
      });
      setAttendance(defaults);
    } catch (err) {
      console.error('Error loading session attendance:', err);
    } finally {
      setLoadingSession(false);
    }
  };

  // Deterministic Scout Filtering & Sorting
  const filteredScouts = useMemo(() => {
    const list = selectedGrade === 'All Grades' 
      ? [...scouts] 
      : scouts.filter((s) => s.grade === selectedGrade);

    return list.sort((a, b) => (a.sortOrder - b.sortOrder) || a.scoutIdNumber - b.scoutIdNumber || a.fullName.localeCompare(b.fullName));
  }, [scouts, selectedGrade]);

  // Current Grade Leaders Info
  const currentGradeLeaders = useMemo(() => {
    if (selectedGrade === 'All Grades' || filteredScouts.length === 0) return null;
    const first = filteredScouts[0];
    return {
      leader: first.leader,
      asstLeader: first.asstLeader,
    };
  }, [selectedGrade, filteredScouts]);

  // Stats for filtered view
  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let excused = 0;
    filteredScouts.forEach((s) => {
      const st = attendance[s.id] || 'PRESENT';
      if (st === 'PRESENT') present++;
      else if (st === 'ABSENT') absent++;
      else if (st === 'EXCUSED') excused++;
    });
    return { present, absent, excused, total: filteredScouts.length };
  }, [filteredScouts, attendance]);

  // Mark all visible scouts
  const handleMarkAllVisible = (status: AttendanceStatus) => {
    setAttendance((prev) => {
      const next = { ...prev };
      filteredScouts.forEach((s) => {
        next[s.id] = status;
      });
      return next;
    });
  };

  // Submit Attendance with Validation & Scoped Audit Trail
  const handleSubmit = async () => {
    if (!selectedDate) {
      alert('Please select a Friday session date.');
      return;
    }

    if (filteredScouts.length === 0) {
      alert('No scouts to submit attendance for.');
      return;
    }

    // Validation: Check that every displayed scout has an assigned status
    const unassigned = filteredScouts.find((s) => !attendance[s.id]);
    if (unassigned) {
      alert(`Please assign an attendance status (P / A / E) for ${unassigned.fullName} before submitting.`);
      return;
    }

    setSaving(true);
    setWarningList([]);

    try {
      // Local storage backup
      localStorage.setItem(`attendance_${selectedDate}`, JSON.stringify(attendance));

      if (isFirebaseConfigured && db) {
        const batch = writeBatch(db);
        const newlyFlagged: string[] = [];

        // Save session metadata
        const sessionDocRef = doc(db, 'sessions', selectedDate);
        batch.set(sessionDocRef, {
          date: selectedDate,
          lastUpdated: serverTimestamp(),
          lastUpdatedBy: currentUserEmail,
          eventName: currentSessionInfo?.event || 'Dhulfiqār Scouting Program',
        }, { merge: true });

        // Save records for all filtered scouts
        filteredScouts.forEach((scout) => {
          const currentStatus = attendance[scout.id] || 'PRESENT';
          const recordRef = doc(db, 'sessions', selectedDate, 'records', scout.id);
          
          batch.set(recordRef, {
            status: currentStatus,
            scoutName: scout.fullName,
            grade: scout.grade,
            submittedBy: currentUserEmail,
            timestamp: serverTimestamp(),
          });

          if (currentStatus === 'ABSENT') {
            const scoutRef = doc(db, 'scouts', scout.id);
            batch.update(scoutRef, {
              unexcusedAbsences: increment(1),
            });

            if (scout.unexcusedAbsences + 1 >= 3) {
              newlyFlagged.push(`${scout.fullName} (${scout.grade}) - ${scout.unexcusedAbsences + 1} absences`);
            }
          }
        });

        await batch.commit();

        if (newlyFlagged.length > 0) {
          setWarningList(newlyFlagged);
        } else {
          alert(`Attendance for ${selectedGrade} on Friday (${selectedDate}) saved successfully!`);
        }
      } else {
        // Local simulation of absence warning threshold
        const newlyFlagged: string[] = [];
        filteredScouts.forEach((scout) => {
          const currentStatus = attendance[scout.id] || 'PRESENT';
          if (currentStatus === 'ABSENT' && scout.unexcusedAbsences + 1 >= 3) {
            newlyFlagged.push(`${scout.fullName} (${scout.grade}) - ${scout.unexcusedAbsences + 1} absences`);
          }
        });

        if (newlyFlagged.length > 0) {
          setWarningList(newlyFlagged);
        } else {
          alert(`Attendance for ${selectedGrade} on Friday (${selectedDate}) saved locally!`);
        }
      }

      await loadScouts();
    } catch (err) {
      console.error(err);
      alert('Attendance saved locally. Firebase sync error encountered.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    if (auth && isFirebaseConfigured) {
      signOut(auth).catch(() => {});
    }
    localStorage.removeItem('scout_tracker_local_user');
    setLocalUserEmail(null);
    setFirebaseUser(null);
  };

  const handleLocalLogin = (email: string) => {
    localStorage.setItem('scout_tracker_local_user', email);
    setLocalUserEmail(email);
  };

  // Seed Full Roster
  const handleSeedFullRoster = async () => {
    if (!isFirebaseConfigured || !db) {
      setScouts(INITIAL_SCOUTS);
      alert(`Loaded ${INITIAL_SCOUTS.length} scouts from roster!`);
      return;
    }

    if (!window.confirm('Import all 124 scouts from roster into the Firebase database?')) return;
    setSeeding(true);
    try {
      const batch = writeBatch(db);
      for (const scout of INITIAL_SCOUTS) {
        const docRef = doc(db, 'scouts', scout.id);
        batch.set(docRef, {
          fullName: scout.fullName,
          scoutIdNumber: scout.scoutIdNumber,
          sortOrder: scout.sortOrder,
          firstName: scout.firstName,
          lastName: scout.lastName,
          grade: scout.grade,
          leader: scout.leader,
          asstLeader: scout.asstLeader,
          isActive: true,
          unexcusedAbsences: 0,
        });
      }
      await batch.commit();
      alert(`Successfully imported ${INITIAL_SCOUTS.length} scouts to Firebase!`);
      await loadScouts();
    } catch (err) {
      console.error('Error seeding full roster:', err);
      alert('Error importing roster data to Firebase.');
    } finally {
      setSeeding(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600 text-sm gap-2">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <div>Loading Scout Tracker...</div>
      </div>
    );
  }

  if (!currentUserEmail) {
    return <Login onLocalLogin={handleLocalLogin} />;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4 font-sans antialiased text-slate-900">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 bg-white/90 backdrop-blur sticky top-0 z-10">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dhulfiqār Scout Check-In</h1>
            {/* Assigned Unit Header Badge */}
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
              isAdmin 
                ? 'bg-purple-50 text-purple-700 border-purple-200' 
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}>
              Assigned Unit: {assignedGradeName} {isAdmin && '(Admin)'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Logged in as <span className="font-semibold text-slate-700">{leaderProfile?.name || currentUserEmail}</span> ({currentUserEmail})
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && isFirebaseConfigured && scouts.length === 0 && (
            <button
              onClick={handleSeedFullRoster}
              disabled={seeding}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1.5 rounded-md shadow-xs transition cursor-pointer"
            >
              {seeding ? 'Importing...' : 'Load Full Roster (124 Scouts)'}
            </button>
          )}
          <button
            onClick={handleSignOut}
            className="text-xs text-slate-600 hover:text-slate-900 border border-slate-300 px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 transition cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Friday Session Selector Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              Select Friday Attendance Date
            </label>
            <p className="text-[11px] text-slate-400">Restricted strictly to Friday program sessions</p>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filterProgramOnly}
              onChange={(e) => setFilterProgramOnly(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span>Active Program Fridays Only ({programFridays.length})</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="sm:col-span-2">
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full text-xs sm:text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {availableFridays.map((session, idx) => (
                <option key={`${session.date}-${idx}`} value={session.date}>
                  {session.date} {session.isProgram ? '🟢 [Scouting Program]' : session.isNoProgram ? '🔴 [NO Program / Break]' : '🟡 [Special Event]'} {session.notes ? `(${session.notes})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-center sm:justify-start px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-900 font-medium">
            📅 {new Date(selectedDate + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        {currentSessionInfo && (
          <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-600 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-semibold text-slate-800">{currentSessionInfo.event}</span>
              {currentSessionInfo.time && <span className="text-slate-500 ml-2">⏰ {currentSessionInfo.time}</span>}
            </div>
            {currentSessionInfo.notes && (
              <span className="px-2 py-0.5 text-[11px] bg-amber-100 text-amber-800 rounded font-medium">
                {currentSessionInfo.notes}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Grade Selector & Leader Scope */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              {isAdmin ? 'Grade / Unit Filter (Admin Mode)' : 'Assigned Grade Unit (Locked)'}
            </label>
            <p className="text-[11px] text-slate-400">
              {isAdmin 
                ? 'Select any grade or view all scouts across the troop' 
                : `You are assigned to take attendance for ${assignedGradeName}`}
            </p>
          </div>
          <div className="text-xs font-medium text-slate-600">
            Showing <span className="font-bold text-slate-900">{filteredScouts.length}</span> Scouts
          </div>
        </div>

        {/* Grade Pills */}
        <div className="flex flex-wrap gap-1.5">
          {isAdmin ? (
            <>
              <button
                type="button"
                onClick={() => setSelectedGrade('All Grades')}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  selectedGrade === 'All Grades'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                All Grades
              </button>
              {ALL_GRADES.map((grade) => (
                <button
                  key={grade}
                  type="button"
                  onClick={() => setSelectedGrade(grade)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                    selectedGrade === grade
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {grade}
                </button>
              ))}
            </>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold rounded-lg">
              <span>🔒 {assignedGradeName}</span>
              <span className="text-[10px] text-blue-600 font-normal">(Patrol Locked)</span>
            </div>
          )}
        </div>

        {/* Assigned Leaders Banner */}
        {currentGradeLeaders && (
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-900 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-indigo-600 font-bold uppercase text-[10px] tracking-wider block">Assigned Leader:</span>
              <span className="font-semibold text-slate-800">Qaid: {currentGradeLeaders.leader || 'Not Assigned'}</span>
            </div>
            {currentGradeLeaders.asstLeader && (
              <div className="text-right">
                <span className="text-indigo-600 font-bold uppercase text-[10px] tracking-wider block">Assistant:</span>
                <span className="font-semibold text-slate-800">{currentGradeLeaders.asstLeader}</span>
              </div>
            )}
          </div>
        )}
      </div>

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

      {/* Quick Mark All & Stats Bar */}
      {filteredScouts.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100/70 p-2.5 rounded-lg border border-slate-200 text-xs">
          <div className="flex items-center gap-3 font-medium text-slate-600">
            <span>Present: <b className="text-emerald-700">{stats.present}</b></span>
            <span>Absent: <b className="text-rose-700">{stats.absent}</b></span>
            <span>Excused: <b className="text-amber-700">{stats.excused}</b></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Mark all:</span>
            <button
              onClick={() => handleMarkAllVisible('PRESENT')}
              className="px-2 py-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 font-medium rounded text-[11px] transition cursor-pointer"
            >
              All Present
            </button>
            <button
              onClick={() => handleMarkAllVisible('ABSENT')}
              className="px-2 py-1 bg-rose-100 text-rose-800 hover:bg-rose-200 font-medium rounded text-[11px] transition cursor-pointer"
            >
              All Absent
            </button>
          </div>
        </div>
      )}

      {/* Deterministically Sorted Scout Roster List */}
      {loadingRoster || loadingSession ? (
        <div className="p-8 text-center text-slate-400 text-sm">
          {loadingRoster ? 'Loading scout roster...' : 'Loading session attendance records...'}
        </div>
      ) : filteredScouts.length === 0 ? (
        <div className="p-8 text-center border border-slate-200 rounded-xl text-slate-400 text-sm bg-white">
          No scouts registered in {selectedGrade}.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white shadow-xs overflow-hidden">
          {filteredScouts.map((scout) => {
            const status = attendance[scout.id] || 'PRESENT';
            const hasWarning = scout.unexcusedAbsences >= 3;

            return (
              <div key={scout.id} className="p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-slate-900 truncate">{scout.fullName}</span>
                    {hasWarning && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-rose-100 text-rose-700 font-bold rounded">
                        {scout.unexcusedAbsences} Absences
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                    <span className="font-medium text-slate-600">{scout.grade}</span>
                    {scout.leader && <span>• Qaid: {scout.leader}</span>}
                  </div>
                </div>

                <div className="flex gap-1 shrink-0">
                  {(['PRESENT', 'ABSENT', 'EXCUSED'] as AttendanceStatus[]).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAttendance((prev) => ({ ...prev, [scout.id]: val }))}
                      className={`text-xs px-2.5 sm:px-3 py-1.5 rounded-lg font-medium border transition-colors cursor-pointer ${
                        status === val
                          ? val === 'PRESENT'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : val === 'ABSENT'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                            : 'bg-amber-500 text-white border-amber-500 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                      title={val}
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

      {filteredScouts.length > 0 && (
        <button
          onClick={handleSubmit}
          disabled={saving || loadingRoster || loadingSession}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow transition-colors disabled:opacity-50 cursor-pointer"
        >
          {saving 
            ? 'Saving Records...' 
            : `Submit Attendance for ${selectedGrade === 'All Grades' ? 'All Grades' : selectedGrade} (${selectedDate})`}
        </button>
      )}
    </div>
  );
}