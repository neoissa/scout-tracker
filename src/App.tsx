import { useEffect, useState, useMemo } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  doc, 
  writeBatch, 
  increment, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from './firebase';
import { Login } from './Login';
import { INITIAL_SCOUTS, type Scout } from './data/roster';
import { FRIDAY_SESSIONS } from './data/schedule';
import { findLeaderProfile, LEADER_PROFILES, type LeaderProfile } from './config/leaderRoles';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'EXCUSED';
type ActiveTab = 'checkin' | 'roster' | 'schedule' | 'stats' | 'account';

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
  '10th / 11th Grade'
];

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [localUserId, setLocalUserId] = useState<string | null>(() => {
    return localStorage.getItem('scout_tracker_local_user');
  });
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('checkin');
  const [rosterSearch, setRosterSearch] = useState('');

  const currentUserId = firebaseUser?.email || localUserId;

  // Leader Profile Lookup
  const leaderProfile: LeaderProfile | undefined = useMemo(() => {
    if (!currentUserId) return undefined;
    return findLeaderProfile(currentUserId) || {
      username: currentUserId.includes('@') ? currentUserId.split('@')[0] : currentUserId,
      name: currentUserId.includes('@') ? currentUserId.split('@')[0] : currentUserId,
      assignedGrade: 'ALL',
      role: 'ADMIN'
    };
  }, [currentUserId]);

  const isAdmin = leaderProfile?.role === 'ADMIN' || leaderProfile?.assignedGrade === 'ALL';
  const assignedGradeName = leaderProfile?.assignedGrade === 'ALL' ? 'All Units' : (leaderProfile?.assignedGrade || 'All Units');

  const [scouts, setScouts] = useState<Scout[]>(INITIAL_SCOUTS);
  const [selectedGrade, setSelectedGrade] = useState<string>('All Grades');
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [, setLoadingRoster] = useState(false);
  const [, setLoadingSession] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warningList, setWarningList] = useState<string[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [submissionMsg, setSubmissionMsg] = useState<string | null>(null);

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
      const scoutsCollection = collection(db, 'scouts');
      const snap = await getDocs(scoutsCollection);
      if (!snap.empty) {
        const list = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        })) as Scout[];

        list.sort((a, b) => {
          const sortA = a.sortOrder ?? 99;
          const sortB = b.sortOrder ?? 99;
          if (sortA !== sortB) return sortA - sortB;
          const idA = a.scoutIdNumber ?? 999;
          const idB = b.scoutIdNumber ?? 999;
          if (idA !== idB) return idA - idB;
          return a.fullName.localeCompare(b.fullName);
        });

        setScouts(list);
      } else {
        setScouts(INITIAL_SCOUTS);
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
    if (!currentUserId || scouts.length === 0 || !selectedDate) return;
    loadSessionAttendance(selectedDate);
  }, [selectedDate, scouts.length, currentUserId]);

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
        } catch (err) {
          console.warn('Could not read session from Firebase:', err);
        }
      }

      if (Object.keys(existingData).length === 0) {
        const localData = localStorage.getItem(`attendance_${date}`);
        if (localData) {
          try {
            existingData = JSON.parse(localData);
          } catch (e) {
            console.error(e);
          }
        }
      }

      // Initialize default to PRESENT if not yet marked
      const initialMap: Record<string, AttendanceStatus> = {};
      scouts.forEach((scout) => {
        initialMap[scout.id] = existingData[scout.id] || 'PRESENT';
      });

      setAttendance(initialMap);
    } finally {
      setLoadingSession(false);
    }
  };

  // Filtered scouts strictly scoped by Leader assignment or Admin selection
  const filteredScouts = useMemo(() => {
    let result = scouts;

    if (!isAdmin && leaderProfile && leaderProfile.assignedGrade !== 'ALL') {
      result = result.filter(s => s.grade === leaderProfile.assignedGrade);
    } else if (selectedGrade !== 'All Grades') {
      result = result.filter(s => s.grade === selectedGrade);
    }

    if (rosterSearch.trim()) {
      const q = rosterSearch.toLowerCase();
      result = result.filter(s => 
        s.fullName.toLowerCase().includes(q) || 
        s.grade.toLowerCase().includes(q) ||
        (s.leader && s.leader.toLowerCase().includes(q))
      );
    }

    return [...result].sort((a, b) => {
      const sortA = a.sortOrder ?? 99;
      const sortB = b.sortOrder ?? 99;
      if (sortA !== sortB) return sortA - sortB;
      const idA = a.scoutIdNumber ?? 999;
      const idB = b.scoutIdNumber ?? 999;
      if (idA !== idB) return idA - idB;
      return a.fullName.localeCompare(b.fullName);
    });
  }, [scouts, selectedGrade, isAdmin, leaderProfile, rosterSearch]);

  // Attendance metrics
  const { countPresent, countAbsent, countExcused } = useMemo(() => {
    let p = 0;
    let a = 0;
    let e = 0;
    filteredScouts.forEach((scout) => {
      const st = attendance[scout.id];
      if (st === 'PRESENT') p++;
      else if (st === 'ABSENT') a++;
      else if (st === 'EXCUSED') e++;
    });
    return { countPresent: p, countAbsent: a, countExcused: e };
  }, [filteredScouts, attendance]);

  const handleStatusToggle = (scoutId: string, status: AttendanceStatus) => {
    setAttendance((prev) => ({
      ...prev,
      [scoutId]: status
    }));
  };

  const handleSetAll = (status: AttendanceStatus) => {
    const updated: Record<string, AttendanceStatus> = { ...attendance };
    filteredScouts.forEach((scout) => {
      updated[scout.id] = status;
    });
    setAttendance(updated);
  };

  // Submit Attendance
  const handleSubmit = async () => {
    if (!selectedDate) {
      alert('Please select a Friday session date.');
      return;
    }

    if (filteredScouts.length === 0) {
      alert('No scouts to submit attendance for.');
      return;
    }

    setSaving(true);
    setWarningList([]);
    setSubmissionMsg(null);

    try {
      localStorage.setItem(`attendance_${selectedDate}`, JSON.stringify(attendance));

      if (isFirebaseConfigured && db) {
        const batch = writeBatch(db);
        const newlyFlagged: string[] = [];

        const sessionDocRef = doc(db, 'sessions', selectedDate);
        batch.set(sessionDocRef, {
          date: selectedDate,
          lastUpdated: serverTimestamp(),
          lastUpdatedBy: currentUserId,
          eventName: currentSessionInfo?.event || 'Dhulfiqār Scouting Program',
        }, { merge: true });

        filteredScouts.forEach((scout) => {
          const currentStatus = attendance[scout.id] || 'PRESENT';
          const recordRef = doc(db, 'sessions', selectedDate, 'records', scout.id);
          
          batch.set(recordRef, {
            status: currentStatus,
            scoutName: scout.fullName,
            grade: scout.grade,
            submittedBy: leaderProfile?.username || currentUserId,
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
        }
        setSubmissionMsg(`Attendance for ${selectedGrade} on ${selectedDate} saved to Firebase!`);
      } else {
        const newlyFlagged: string[] = [];
        filteredScouts.forEach((scout) => {
          const currentStatus = attendance[scout.id] || 'PRESENT';
          if (currentStatus === 'ABSENT' && scout.unexcusedAbsences + 1 >= 3) {
            newlyFlagged.push(`${scout.fullName} (${scout.grade}) - ${scout.unexcusedAbsences + 1} absences`);
          }
        });

        if (newlyFlagged.length > 0) {
          setWarningList(newlyFlagged);
        }
        setSubmissionMsg(`Attendance for ${selectedGrade} on ${selectedDate} saved locally!`);
      }

      await loadScouts();
    } catch (err) {
      console.error(err);
      setSubmissionMsg('Attendance saved locally.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    if (auth && isFirebaseConfigured) {
      signOut(auth).catch(() => {});
    }
    localStorage.removeItem('scout_tracker_local_user');
    setLocalUserId(null);
    setFirebaseUser(null);
  };

  const handleLocalLogin = (userIdentifier: string) => {
    localStorage.setItem('scout_tracker_local_user', userIdentifier);
    setLocalUserId(userIdentifier);
  };

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
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-700 text-sm gap-2" style={{ backgroundColor: 'var(--body-bg)' }}>
        <div className="w-8 h-8 border-3 border-[#123c2d] border-t-transparent rounded-full animate-spin"></div>
        <div className="font-bold text-[#123c2d]">Loading Dhulfiqār Scout Tracker...</div>
      </div>
    );
  }

  if (!currentUserId) {
    return <Login onLocalLogin={handleLocalLogin} />;
  }

  return (
    <div className="min-h-screen p-2 sm:p-4" style={{ backgroundColor: 'var(--body-bg)' }}>
      <div className="phone-container">
        
        {/* Header with Forest Green & Gold Branding */}
        <header className="scout-header">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <img
                src="/scouts_logo.png"
                alt="Dhulfiqār Scouts"
                className="w-10 h-10 rounded-xl object-contain bg-white/10 p-0.5 border border-white/20 shadow-sm flex-shrink-0"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div>
                <div className="scout-brand">Dhulfiqār Scouting Program</div>
                <h1 className="scout-title">
                  {activeTab === 'checkin' && 'Scout Check-In'}
                  {activeTab === 'roster' && 'Patrol Roster'}
                  {activeTab === 'schedule' && 'Friday Schedule'}
                  {activeTab === 'stats' && 'Unit Progress'}
                  {activeTab === 'account' && 'Leader Portal'}
                </h1>
              </div>
            </div>

            {/* Role Tag & Badge */}
            <span className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold border ${
              isAdmin 
                ? 'bg-amber-100/20 text-[#e6d7a8] border-[#e6d7a8]/40' 
                : 'bg-emerald-950/60 text-emerald-200 border-emerald-500/30'
            }`}>
              {isAdmin ? '👑 Admin' : leaderProfile?.role === 'ASST_LEADER' ? '🤝 Asst' : '⭐ Qaid'}
            </span>
          </div>

          {/* Subtitle with Leader Identity & Assigned Grade Unit */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10 text-xs scout-sub">
            <div>
              Qaid: <strong className="text-white">{leaderProfile?.name || currentUserId}</strong>{' '}
              <span className="text-white/60 font-mono">(@{leaderProfile?.username || currentUserId})</span>
            </div>
            <span className="font-bold text-[#e6d7a8] bg-black/20 px-2 py-0.5 rounded-lg border border-white/10 text-[11px]">
              {assignedGradeName}
            </span>
          </div>
        </header>

        {/* Leader Switcher Bar */}
        <div className="px-4 pt-3 pb-1">
          <div className="p-2.5 bg-[#f0ebe0] border border-[#ded9cc] rounded-xl flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[#123c2d] flex items-center gap-1">
              <span>⚡</span> Switch Qaid:
            </span>
            <select
              value={leaderProfile?.username || currentUserId}
              onChange={(e) => handleLocalLogin(e.target.value)}
              className="text-xs font-semibold text-[#17201c] bg-white border border-[#ccc5b6] rounded-lg p-1.5 focus:ring-1 focus:ring-[#123c2d] outline-none cursor-pointer flex-1 max-w-[280px]"
            >
              {LEADER_PROFILES.map((p) => (
                <option key={p.username} value={p.username}>
                  {p.role === 'ADMIN' ? '👑' : p.role === 'ASST_LEADER' ? '🤝' : '⭐'} {p.name} (@{p.username}) — {p.assignedGrade === 'ALL' ? 'All Units' : p.assignedGrade}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* TAB 1: ATTENDANCE CHECK-IN */}
        {activeTab === 'checkin' && (
          <main className="p-4 space-y-3.5">
            
            {/* Friday Session Selector Card */}
            <div className="scout-card space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#66736c]">
                  📅 Friday Attendance Date
                </label>
                <label className="text-[11px] text-[#123c2d] font-semibold flex items-center gap-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={filterProgramOnly}
                    onChange={(e) => setFilterProgramOnly(e.target.checked)}
                    className="rounded border-[#ccc] text-[#123c2d] cursor-pointer"
                  />
                  <span>Program Fridays ({programFridays.length})</span>
                </label>
              </div>

              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full text-xs sm:text-sm font-bold text-[#123c2d] bg-[#f7f2e7] border border-[#ccc5b6] rounded-xl p-2.5 focus:ring-2 focus:ring-[#123c2d] outline-none cursor-pointer"
              >
                {availableFridays.map((session, idx) => (
                  <option key={`${session.date}-${idx}`} value={session.date}>
                    {session.date} {session.isProgram ? '🟢 [Program Session]' : session.isNoProgram ? '🔴 [Break / No Session]' : '🟡 [Special Event]'} {session.notes ? `(${session.notes})` : ''}
                  </option>
                ))}
              </select>

              {currentSessionInfo && (
                <div className="text-[11px] text-[#66736c] bg-[#faf8f2] p-2 rounded-lg border border-[#e8e4d8] flex items-center justify-between">
                  <span>⏰ <strong>{currentSessionInfo.time || '6:30 PM – 9:00 PM'}</strong> • {currentSessionInfo.event}</span>
                  {currentSessionInfo.notes && <span className="scout-pill-gold text-[10px]">{currentSessionInfo.notes}</span>}
                </div>
              )}
            </div>

            {/* Admin Grade Tabs (If Admin) */}
            {isAdmin && (
              <div className="space-y-1">
                <div className="text-[11px] font-bold text-[#66736c] uppercase tracking-wider">Select Unit Filter:</div>
                <div className="tabs pb-1">
                  <button
                    type="button"
                    onClick={() => setSelectedGrade('All Grades')}
                    className={`tab ${selectedGrade === 'All Grades' ? 'on' : ''}`}
                  >
                    All Units (124)
                  </button>
                  {ALL_GRADES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setSelectedGrade(g)}
                      className={`tab ${selectedGrade === g ? 'on' : ''}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Presence Metric Counters */}
            <div className="scout-card p-3.5">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-[#f0f7f3] rounded-xl border border-[#d2e8db]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#123c2d]">Present</div>
                  <div className="scout-metric text-[#123c2d]">{countPresent}</div>
                </div>
                <div className="p-2 bg-[#fdf2f2] rounded-xl border border-[#fecaca]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#991b1b]">Absent</div>
                  <div className="scout-metric text-[#991b1b]">{countAbsent}</div>
                </div>
                <div className="p-2 bg-[#fffcf0] rounded-xl border border-[#fef08a]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#854d0e]">Excused</div>
                  <div className="scout-metric text-[#854d0e]">{countExcused}</div>
                </div>
              </div>

              {/* Mark All Quick Buttons */}
              <div className="flex items-center justify-between gap-1.5 mt-3 pt-2.5 border-t border-[#f0ebe0]">
                <button
                  type="button"
                  onClick={() => handleSetAll('PRESENT')}
                  className="flex-1 py-1.5 text-[11px] font-bold bg-[#edf3ef] hover:bg-[#d8e8dc] text-[#123c2d] rounded-lg transition"
                >
                  All Present
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAll('ABSENT')}
                  className="flex-1 py-1.5 text-[11px] font-bold bg-[#fdf2f2] hover:bg-[#fde2e2] text-[#991b1b] rounded-lg transition"
                >
                  All Absent
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAll('EXCUSED')}
                  className="flex-1 py-1.5 text-[11px] font-bold bg-[#fefce8] hover:bg-[#fef9c3] text-[#854d0e] rounded-lg transition"
                >
                  All Excused
                </button>
              </div>
            </div>

            {/* Warnings Alert Banner */}
            {warningList.length > 0 && (
              <div className="scout-card bg-[#fff5f5] border-[#fecaca] p-3 text-xs text-[#991b1b] space-y-1">
                <div className="font-bold">⚠️ Absence Threshold Alert (≥ 3 Absences)</div>
                <ul className="list-disc pl-4 text-[11px] space-y-0.5">
                  {warningList.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {submissionMsg && (
              <div className="scout-card bg-[#edf7ee] border-[#bbf7d0] p-3 text-xs text-[#166534] font-bold">
                ✅ {submissionMsg}
              </div>
            )}

            {/* Scout Roster Check-In List */}
            <div className="scout-card p-3 space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-[#f0ebe0]">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#17201c]">
                    {selectedGrade === 'All Grades' ? 'All Scouts' : selectedGrade}
                  </h2>
                  <span className="text-[10px] text-[#66736c]">Deterministic Sorted: Rank ID & Name</span>
                </div>
                <span className="scout-pill text-[11px] font-bold">
                  {filteredScouts.length} Scouts
                </span>
              </div>

              <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                {filteredScouts.map((scout) => {
                  const currentStatus = attendance[scout.id] || 'PRESENT';
                  const hasAbsenceWarning = scout.unexcusedAbsences >= 3;

                  return (
                    <div
                      key={scout.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-[#faf8f2] border border-[#ede8dc] hover:bg-[#f5f0e4] transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div className="scout-avatar">
                          {scout.scoutIdNumber}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#17201c] truncate">
                            {scout.fullName}
                          </div>
                          <div className="text-[10px] text-[#66736c] flex items-center gap-1.5">
                            <span>{scout.grade}</span>
                            {hasAbsenceWarning && (
                              <span className="scout-pill-alert text-[9px] px-1.5 py-0">
                                {scout.unexcusedAbsences} Absences
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Choice Buttons: P / A / E */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStatusToggle(scout.id, 'PRESENT')}
                          className={`scout-choice ${currentStatus === 'PRESENT' ? 'sel-p' : ''}`}
                        >
                          P
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusToggle(scout.id, 'ABSENT')}
                          className={`scout-choice ${currentStatus === 'ABSENT' ? 'sel-a' : ''}`}
                        >
                          A
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusToggle(scout.id, 'EXCUSED')}
                          className={`scout-choice ${currentStatus === 'EXCUSED' ? 'sel-e' : ''}`}
                        >
                          E
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Submit Attendance Button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || filteredScouts.length === 0}
                className="w-full scout-btn-primary text-sm shadow-md mt-2 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? 'Saving...' : `Submit Attendance for ${selectedGrade} →`}
              </button>
            </div>

          </main>
        )}

        {/* TAB 2: PATROL ROSTER */}
        {activeTab === 'roster' && (
          <main className="p-4 space-y-3.5">
            <div className="scout-card space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#17201c]">
                  Scout Patrol Directory
                </h2>
                <span className="scout-pill text-[11px] font-bold">
                  {filteredScouts.length} Scouts
                </span>
              </div>

              <input
                type="text"
                placeholder="🔍 Search scout name, grade, leader..."
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                className="w-full px-3 py-2 border border-[#ccc] rounded-xl text-xs bg-white focus:outline-none focus:border-[#123c2d]"
              />

              {isAdmin && (
                <div className="tabs pb-1">
                  <button
                    type="button"
                    onClick={() => setSelectedGrade('All Grades')}
                    className={`tab ${selectedGrade === 'All Grades' ? 'on' : ''}`}
                  >
                    All
                  </button>
                  {ALL_GRADES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setSelectedGrade(g)}
                      className={`tab ${selectedGrade === g ? 'on' : ''}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {filteredScouts.map((scout) => (
                <div key={scout.id} className="scout-card p-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="scout-avatar">
                      {scout.scoutIdNumber}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#17201c]">{scout.fullName}</div>
                      <div className="text-[11px] text-[#66736c]">{scout.grade} • Qaid: {scout.leader || 'Unassigned'}</div>
                      {scout.asstLeader && (
                        <div className="text-[10px] text-[#8a8f8c]">Asst: {scout.asstLeader}</div>
                      )}
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      scout.unexcusedAbsences >= 3
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}>
                      {scout.unexcusedAbsences} Absences
                    </span>
                    <span className="text-[10px] text-emerald-700 font-bold">Active</span>
                  </div>
                </div>
              ))}
            </div>
          </main>
        )}

        {/* TAB 3: SCHEDULE */}
        {activeTab === 'schedule' && (
          <main className="p-4 space-y-3">
            <div className="scout-card p-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#17201c]">2026-2027 Friday Sessions</h2>
                  <p className="text-[11px] text-[#66736c]">Scouting Program: 6:30 PM – 9:00 PM</p>
                </div>
                <span className="scout-pill-gold text-[11px] font-bold">
                  25 Fridays
                </span>
              </div>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {FRIDAY_SESSIONS.map((session, idx) => (
                <div
                  key={idx}
                  className={`scout-card p-3 flex items-center justify-between gap-2 ${
                    session.date === selectedDate ? 'border-[#123c2d] ring-1 ring-[#123c2d]' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#17201c]">
                        📅 {session.date}
                      </span>
                      {session.isProgram && (
                        <span className="scout-pill text-[10px] px-1.5 py-0">🟢 Program</span>
                      )}
                      {session.isNoProgram && (
                        <span className="scout-pill-alert text-[10px] px-1.5 py-0">🔴 No Session</span>
                      )}
                      {!session.isProgram && !session.isNoProgram && (
                        <span className="scout-pill-gold text-[10px] px-1.5 py-0">🟡 Special</span>
                      )}
                    </div>
                    <div className="text-xs font-medium text-[#123c2d] mt-0.5">{session.event}</div>
                    {session.notes && (
                      <div className="text-[10px] text-[#8a6514] font-medium mt-0.5">{session.notes}</div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate(session.date);
                      setActiveTab('checkin');
                    }}
                    className="scout-btn-outline text-[11px] py-1 px-2.5 flex-shrink-0"
                  >
                    Take Attendance →
                  </button>
                </div>
              ))}
            </div>
          </main>
        )}

        {/* TAB 4: STATS & GOALS */}
        {activeTab === 'stats' && (
          <main className="p-4 space-y-3.5">
            <div className="scout-card space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#17201c]">
                Unit Presence & Goals
              </h2>
              <p className="text-[11px] text-[#66736c]">Overview of patrol engagement and attendance rates</p>
            </div>

            <div className="scout-card space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-[#123c2d]">
                <span>Patrol Attendance Rate</span>
                <span>
                  {filteredScouts.length > 0 
                    ? Math.round((countPresent / filteredScouts.length) * 100) 
                    : 100}%
                </span>
              </div>
              <div className="progress-bar">
                <span style={{ width: `${filteredScouts.length > 0 ? (countPresent / filteredScouts.length) * 100 : 100}%` }}></span>
              </div>
              <div className="flex justify-between text-[11px] text-[#66736c] pt-1">
                <span>🟢 {countPresent} Present</span>
                <span>🔴 {countAbsent} Absent</span>
                <span>🟡 {countExcused} Excused</span>
              </div>
            </div>

            <div className="scout-card space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#17201c]">Recent Session Audit Log</h3>
              <div className="text-xs text-[#66736c] space-y-1.5 pt-1">
                <div className="flex justify-between border-b border-[#f0ebe0] pb-1">
                  <span>Last Active Session:</span>
                  <strong className="text-[#123c2d]">{selectedDate}</strong>
                </div>
                <div className="flex justify-between border-b border-[#f0ebe0] pb-1">
                  <span>Logged Qaid:</span>
                  <strong className="text-[#123c2d]">@{leaderProfile?.username}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Assigned Unit:</span>
                  <strong className="text-[#123c2d]">{assignedGradeName}</strong>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* TAB 5: LEADER ACCOUNT & ADMIN */}
        {activeTab === 'account' && (
          <main className="p-4 space-y-3.5">
            <div className="scout-card space-y-3">
              <div className="flex items-center gap-3 pb-2 border-b border-[#f0ebe0]">
                <div className="w-12 h-12 rounded-2xl bg-[#123c2d] text-[#e6d7a8] font-bold text-lg grid place-items-center">
                  ⚜️
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#17201c]">{leaderProfile?.name}</h2>
                  <div className="text-xs text-[#66736c] font-mono">@{leaderProfile?.username}</div>
                  <span className="scout-pill text-[10px] mt-1">
                    {leaderProfile?.role === 'ADMIN' ? '👑 Troop Administrator' : leaderProfile?.role === 'ASST_LEADER' ? '🤝 Assistant Qaid' : '⭐ Qaid (Unit Leader)'}
                  </span>
                </div>
              </div>

              <div className="text-xs space-y-2 text-[#66736c]">
                <div className="flex justify-between">
                  <span>Assigned Unit:</span>
                  <strong className="text-[#123c2d]">{assignedGradeName}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Default Password:</span>
                  <strong className="font-mono text-[#123c2d]">scouts2026</strong>
                </div>
                <div className="flex justify-between">
                  <span>Database Mode:</span>
                  <strong className={isFirebaseConfigured ? 'text-emerald-700' : 'text-amber-700'}>
                    {isFirebaseConfigured ? '🟢 Firebase Firestore Live' : '🟡 Local Storage Offline'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Excel & CSV Downloads */}
            <div className="scout-card space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#17201c]">Credentials & Spreadsheets</h3>
              <p className="text-[11px] text-[#66736c]">Download full roster and account logins</p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <a
                  href="/Dhulfiqar_Scouts_Leader_Logins.xlsx"
                  download="Dhulfiqar_Scouts_Leader_Logins.xlsx"
                  className="scout-btn-primary text-xs text-center py-2 no-underline"
                >
                  📊 Download .XLSX
                </a>
                <a
                  href="/Dhulfiqar_Scouts_Leader_Logins.csv"
                  download="Dhulfiqar_Scouts_Leader_Logins.csv"
                  className="scout-btn-outline text-xs text-center py-2 no-underline"
                >
                  📑 Download .CSV
                </a>
              </div>
            </div>

            {/* Admin Controls */}
            {isAdmin && isFirebaseConfigured && (
              <div className="scout-card space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#17201c]">Admin Database Tools</h3>
                <button
                  type="button"
                  onClick={handleSeedFullRoster}
                  disabled={seeding}
                  className="w-full py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  {seeding ? 'Importing...' : 'Load Full 124 Scouts into Firebase Database'}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleSignOut}
              className="w-full py-2.5 bg-rose-50 border border-rose-200 text-rose-800 hover:bg-rose-100 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Sign Out of Portal
            </button>
          </main>
        )}

        {/* Bottom Navigation Bar */}
        <nav className="scout-bottom-nav">
          <button
            type="button"
            onClick={() => setActiveTab('checkin')}
            className={`scout-nav-item ${activeTab === 'checkin' ? 'on' : ''}`}
          >
            <span className="nav-icon text-lg">📋</span>
            <span>Check-In</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            className={`scout-nav-item ${activeTab === 'roster' ? 'on' : ''}`}
          >
            <span className="nav-icon text-lg">👥</span>
            <span>Roster</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('schedule')}
            className={`scout-nav-item ${activeTab === 'schedule' ? 'on' : ''}`}
          >
            <span className="nav-icon text-lg">📅</span>
            <span>Fridays</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            className={`scout-nav-item ${activeTab === 'stats' ? 'on' : ''}`}
          >
            <span className="nav-icon text-lg">🏆</span>
            <span>Stats</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('account')}
            className={`scout-nav-item ${activeTab === 'account' ? 'on' : ''}`}
          >
            <span className="nav-icon text-lg">👤</span>
            <span>Account</span>
          </button>
        </nav>

      </div>
    </div>
  );
}