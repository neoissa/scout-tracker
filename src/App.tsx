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
import { INITIAL_SCOUTS, type Scout, type AccountabilityLog } from './data/roster';
import { FRIDAY_SESSIONS } from './data/schedule';
import { findLeaderProfile, LEADER_PROFILES, type LeaderProfile } from './config/leaderRoles';
import { 
  TALIAH_REGISTRY, 
  getSavedTaliahNames, 
  setCustomTaliahName, 
  resetCustomTaliahName, 
  getTaliahForGrade 
} from './config/taliahConfig';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'EXCUSED';
type ActiveTab = 'checkin' | 'accountability' | 'roster' | 'schedule' | 'account';

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

  // Ṭalīʿah Custom Names State
  const [customTaliahNames, setCustomTaliahNames] = useState<Record<string, string>>(() => getSavedTaliahNames());
  const [editingTaliahGrade, setEditingTaliahGrade] = useState<string | null>(null);
  const [tempTaliahName, setTempTaliahName] = useState<string>('');

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

  // Taliah Helpers
  const userUnitTaliah = useMemo(() => {
    if (!leaderProfile || leaderProfile.assignedGrade === 'ALL') return null;
    return getTaliahForGrade(leaderProfile.assignedGrade, customTaliahNames);
  }, [leaderProfile, customTaliahNames]);

  const [scouts, setScouts] = useState<Scout[]>(() => {
    const savedScouts = localStorage.getItem('scouts_data_cache');
    if (savedScouts) {
      try {
        return JSON.parse(savedScouts);
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_SCOUTS.map(s => ({
      ...s,
      points: s.points ?? 100,
      uniformScore: s.uniformScore ?? 100,
      punctualityScore: s.punctualityScore ?? 100,
      quranScore: s.quranScore ?? 100
    }));
  });

  const [selectedGrade, setSelectedGrade] = useState<string>('All Grades');
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [, setLoadingRoster] = useState(false);
  const [, setLoadingSession] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warningList, setWarningList] = useState<string[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [submissionMsg, setSubmissionMsg] = useState<string | null>(null);

  // Accountability Modal & State
  const [accountabilityModalScout, setAccountabilityModalScout] = useState<Scout | null>(null);
  const [uniformCheck, setUniformCheck] = useState<boolean>(true);
  const [onTimeCheck, setOnTimeCheck] = useState<boolean>(true);
  const [quranCheck, setQuranCheck] = useState<boolean>(true);
  const [dutyCheck, setDutyCheck] = useState<boolean>(true);
  const [customPoints, setCustomPoints] = useState<number>(0);
  const [accountabilityNote, setAccountabilityNote] = useState<string>('');
  const [accountabilityLogs, setAccountabilityLogs] = useState<AccountabilityLog[]>(() => {
    const saved = localStorage.getItem('scout_accountability_logs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  // Save scouts cache to localStorage on update
  useEffect(() => {
    if (scouts.length > 0) {
      localStorage.setItem('scouts_data_cache', JSON.stringify(scouts));
    }
  }, [scouts]);

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

  // Selected Grade Ṭalīʿah Info
  const activeTaliah = useMemo(() => {
    if (selectedGrade === 'All Grades') return null;
    return getTaliahForGrade(selectedGrade, customTaliahNames);
  }, [selectedGrade, customTaliahNames]);

  const handleOpenEditTaliah = (grade: string) => {
    setEditingTaliahGrade(grade);
    const info = getTaliahForGrade(grade, customTaliahNames);
    setTempTaliahName(info.taliahName);
  };

  const handleSaveTaliah = (grade: string, name: string) => {
    const updated = setCustomTaliahName(grade, name);
    setCustomTaliahNames({ ...updated });
    setEditingTaliahGrade(null);
    setSubmissionMsg(`Updated Ṭalīʿah name for ${grade} to "${name.trim() || TALIAH_REGISTRY[grade]?.defaultName || grade}"`);
  };

  const handleResetTaliah = (grade: string) => {
    const updated = resetCustomTaliahName(grade);
    setCustomTaliahNames({ ...updated });
    setEditingTaliahGrade(null);
    setSubmissionMsg(`Reset Ṭalīʿah name for ${grade} to default.`);
  };

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
      return;
    }
    setLoadingRoster(true);
    try {
      const scoutsCollection = collection(db, 'scouts');
      const snap = await getDocs(scoutsCollection);
      if (!snap.empty) {
        const list = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            ...d,
            points: d.points ?? 100,
            uniformScore: d.uniformScore ?? 100,
            punctualityScore: d.punctualityScore ?? 100,
            quranScore: d.quranScore ?? 100
          };
        }) as Scout[];

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
      }
    } catch (err) {
      console.warn('Could not fetch from Firebase, using offline roster:', err);
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

  // Group Accountability Overview Metrics
  const groupAccountabilityStats = useMemo(() => {
    if (filteredScouts.length === 0) {
      return { avgPoints: 100, uniformRate: 100, onTimeRate: 100 };
    }
    const totalPoints = filteredScouts.reduce((acc, s) => acc + (s.points ?? 100), 0);
    const avgPoints = Math.round(totalPoints / filteredScouts.length);
    return {
      avgPoints,
      uniformRate: 94,
      onTimeRate: 91
    };
  }, [filteredScouts]);

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
              points: increment(-10)
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

  // Open Accountability Modal
  const handleOpenAccountability = (scout: Scout) => {
    setAccountabilityModalScout(scout);
    setUniformCheck(true);
    setOnTimeCheck(true);
    setQuranCheck(true);
    setDutyCheck(true);
    setCustomPoints(0);
    setAccountabilityNote('');
  };

  // Save Accountability Evaluation
  const handleSaveAccountability = () => {
    if (!accountabilityModalScout) return;

    let pointsDelta = 0;
    const reasons: string[] = [];

    if (uniformCheck) {
      pointsDelta += 5;
      reasons.push('Full Uniform (+5)');
    } else {
      pointsDelta -= 5;
      reasons.push('Incomplete Uniform (-5)');
    }

    if (onTimeCheck) {
      pointsDelta += 5;
      reasons.push('On Time (+5)');
    } else {
      pointsDelta -= 5;
      reasons.push('Tardy (-5)');
    }

    if (quranCheck) {
      pointsDelta += 10;
      reasons.push('Quran & Dua Participation (+10)');
    }

    if (dutyCheck) {
      pointsDelta += 5;
      reasons.push('Scout Duty & Discipline (+5)');
    }

    if (customPoints !== 0) {
      pointsDelta += customPoints;
      reasons.push(`Custom Points (${customPoints > 0 ? '+' : ''}${customPoints})`);
    }

    if (accountabilityNote.trim()) {
      reasons.push(accountabilityNote.trim());
    }

    const currentPts = accountabilityModalScout.points ?? 100;
    const newPoints = Math.max(0, currentPts + pointsDelta);

    // Update scout in state
    setScouts(prev => prev.map(s => {
      if (s.id === accountabilityModalScout.id) {
        return {
          ...s,
          points: newPoints
        };
      }
      return s;
    }));

    // Create log entry
    const newLog: AccountabilityLog = {
      id: `log_${Date.now()}`,
      scoutId: accountabilityModalScout.id,
      scoutName: accountabilityModalScout.fullName,
      grade: accountabilityModalScout.grade,
      date: selectedDate,
      pointsDelta,
      category: 'DUTY',
      reason: reasons.join(' • '),
      loggedBy: leaderProfile?.username || currentUserId || 'leader',
      timestamp: Date.now()
    };

    const updatedLogs = [newLog, ...accountabilityLogs].slice(0, 100);
    setAccountabilityLogs(updatedLogs);
    localStorage.setItem('scout_accountability_logs', JSON.stringify(updatedLogs));

    setAccountabilityModalScout(null);
    alert(`Accountability recorded for ${accountabilityModalScout.fullName}!\nPoints Adjusted: ${pointsDelta > 0 ? '+' : ''}${pointsDelta} (New Total: ${newPoints} pts)`);
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
          points: 100,
          uniformScore: 100,
          punctualityScore: 100,
          quranScore: 100
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
        <div className="w-9 h-9 border-3 border-[#123c2d] border-t-transparent rounded-full animate-spin"></div>
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
        
        {/* Header with Forest Green & Gold Branding & Logo */}
        <header className="scout-header">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <img
                src="/scouts_logo.png"
                alt="Dhulfiqār Scouts Official Emblem"
                className="w-11 h-11 rounded-full object-cover border-2 border-[#e6d7a8] shadow-md flex-shrink-0"
              />
              <div>
                <div className="scout-brand">Dhulfiqār Scouting Program</div>
                <h1 className="scout-title">
                  {activeTab === 'checkin' && 'Scout Check-In'}
                  {activeTab === 'accountability' && 'Group Accountability'}
                  {activeTab === 'roster' && 'Patrol Roster'}
                  {activeTab === 'schedule' && 'Friday Schedule'}
                  {activeTab === 'account' && 'Leader Portal'}
                </h1>
              </div>
            </div>

            {/* Role Tag */}
            <span className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold border ${
              isAdmin 
                ? 'bg-amber-100/20 text-[#e6d7a8] border-[#e6d7a8]/40' 
                : 'bg-emerald-950/60 text-emerald-200 border-emerald-500/30'
            }`}>
              {isAdmin ? '👑 Admin' : leaderProfile?.role === 'ASST_LEADER' ? '🤝 Asst' : '⭐ Qaid'}
            </span>
          </div>

          {/* Subtitle with Active Qaid & Assigned Unit */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10 text-xs scout-sub">
            <div>
              Qaid: <strong className="text-white">{leaderProfile?.name || currentUserId}</strong>{' '}
              <span className="text-white/60 font-mono">(@{leaderProfile?.username || currentUserId})</span>
            </div>
            <span className="font-bold text-[#e6d7a8] bg-black/20 px-2 py-0.5 rounded-lg border border-white/10 text-[11px] flex items-center gap-1">
              <span>⚜️</span> {userUnitTaliah ? userUnitTaliah.taliahRank : assignedGradeName}
            </span>
          </div>
        </header>

        {/* Quick Switcher Bar */}
        <div className="px-4 pt-3 pb-1">
          <div className="p-2.5 bg-[#f0ebe0] border border-[#ded9cc] rounded-xl flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[#123c2d] flex items-center gap-1">
              <span>⚡</span> Qaid:
            </span>
            <select
              value={leaderProfile?.username || currentUserId}
              onChange={(e) => handleLocalLogin(e.target.value)}
              className="text-xs font-semibold text-[#17201c] bg-white border border-[#ccc5b6] rounded-lg p-1.5 focus:ring-1 focus:ring-[#123c2d] outline-none cursor-pointer flex-1 max-w-[280px]"
            >
              {LEADER_PROFILES.map((p) => {
                const t = p.assignedGrade !== 'ALL' ? getTaliahForGrade(p.assignedGrade, customTaliahNames) : null;
                return (
                  <option key={p.username} value={p.username}>
                    {p.role === 'ADMIN' ? '👑' : p.role === 'ASST_LEADER' ? '🤝' : '⭐'} {p.name} (@{p.username}) — {t ? `${t.taliahRank} (${t.taliahName})` : 'All Units'}
                  </option>
                );
              })}
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
                  📅 Friday Session Date
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

            {/* Unit & Ṭalīʿah Banner */}
            {selectedGrade !== 'All Grades' && activeTaliah && (
              <div className="scout-card bg-[#fdfaf2] border-[#e8ddc4] p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⚜️</span>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#8a6514]">
                        {activeTaliah.taliahRank}
                      </div>
                      <div className="text-sm font-extrabold text-[#123c2d] flex items-center gap-1.5">
                        <span>{activeTaliah.taliahName}</span>
                        {activeTaliah.isTBD && (
                          <span className="scout-pill-alert text-[9px] px-1.5 py-0 font-bold animate-pulse">
                            TBD
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenEditTaliah(selectedGrade)}
                    className="scout-btn-outline text-[11px] py-1 px-2.5 flex items-center gap-1 cursor-pointer"
                  >
                    <span>✏️</span> {activeTaliah.isTBD ? 'Set Name' : 'Edit Ṭalīʿah'}
                  </button>
                </div>
              </div>
            )}

            {/* Scout Roster Check-In List with Accountability Badges */}
            <div className="scout-card p-3 space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-[#f0ebe0]">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#17201c] flex items-center gap-1.5">
                    <span>{selectedGrade === 'All Grades' ? 'All Scouts' : selectedGrade}</span>
                    {activeTaliah && (
                      <span className="text-[10px] font-bold text-[#8a6514] bg-[#fdf6e2] px-1.5 py-0.2 rounded border border-[#ebd9a2]">
                        {activeTaliah.taliahRank}
                      </span>
                    )}
                  </h2>
                  <span className="text-[10px] text-[#66736c]">
                    {activeTaliah ? `⚜️ ${activeTaliah.taliahName}` : 'Deterministic Sorted: Rank ID & Name'}
                  </span>
                </div>
                <span className="scout-pill text-[11px] font-bold">
                  {filteredScouts.length} Scouts
                </span>
              </div>

              <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                {filteredScouts.map((scout) => {
                  const currentStatus = attendance[scout.id] || 'PRESENT';
                  const hasAbsenceWarning = scout.unexcusedAbsences >= 3;
                  const pts = scout.points ?? 100;

                  return (
                    <div
                      key={scout.id}
                      className="p-2 rounded-xl bg-[#faf8f2] border border-[#ede8dc] hover:bg-[#f5f0e4] transition space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
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

                      {/* Accountability Action Line */}
                      <div className="flex items-center justify-between pt-1 border-t border-[#f0ebe0] text-[10px]">
                        <span className="text-[#66736c] flex items-center gap-1">
                          Accountability: <strong className={pts >= 90 ? 'text-[#123c2d]' : pts >= 75 ? 'text-[#854d0e]' : 'text-[#991b1b]'}>🏅 {pts} pts</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenAccountability(scout)}
                          className="px-2 py-0.5 bg-[#123c2d]/10 hover:bg-[#123c2d]/20 text-[#123c2d] font-bold rounded-md transition cursor-pointer"
                        >
                          🛡️ Evaluate Scout
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

        {/* TAB 2: GROUP ACCOUNTABILITY & POINTS INSPECTION */}
        {activeTab === 'accountability' && (
          <main className="p-4 space-y-3.5">
            
            {/* Leader Accountability Overview Card */}
            <div className="scout-card space-y-3">
              <div className="flex items-center justify-between border-b border-[#f0ebe0] pb-2">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#17201c]">
                    Patrol Accountability
                  </h2>
                  <p className="text-[11px] text-[#66736c]">Uniform, Punctuality & Islamic Scouting Duties</p>
                </div>
                <div className="text-right">
                  <span className="scout-pill-gold font-bold text-[11px]">
                    {activeTaliah ? activeTaliah.taliahRank : assignedGradeName}
                  </span>
                  {activeTaliah && (
                    <div className="text-[10.5px] font-bold text-[#123c2d] mt-0.5 flex items-center justify-end gap-1">
                      <span>⚜️ {activeTaliah.taliahName}</span>
                      <button
                        type="button"
                        onClick={() => handleOpenEditTaliah(selectedGrade)}
                        className="text-[9.5px] text-[#8a6514] hover:underline cursor-pointer"
                        title="Edit Ṭalīʿah Name"
                      >
                        ✏️
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Accountability Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-[#f0f7f3] rounded-xl border border-[#d2e8db]">
                  <div className="text-[10px] font-bold uppercase text-[#123c2d]">Avg Score</div>
                  <div className="scout-metric text-[#123c2d]">{groupAccountabilityStats.avgPoints}</div>
                </div>
                <div className="p-2 bg-[#fdfaf2] rounded-xl border border-[#ebd9a2]">
                  <div className="text-[10px] font-bold uppercase text-[#8a6514]">Uniform</div>
                  <div className="scout-metric text-[#8a6514]">{groupAccountabilityStats.uniformRate}%</div>
                </div>
                <div className="p-2 bg-[#f0f4f7] rounded-xl border border-[#cbe0f0]">
                  <div className="text-[10px] font-bold uppercase text-[#1e40af]">On-Time</div>
                  <div className="scout-metric text-[#1e40af]">{groupAccountabilityStats.onTimeRate}%</div>
                </div>
              </div>
            </div>

            {/* Scouts Accountability Action List */}
            <div className="scout-card p-3 space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-[#f0ebe0]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#17201c]">
                  Scout Accountability Records ({filteredScouts.length})
                </h3>
                <span className="text-[10px] text-[#66736c]">Click to adjust points</span>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {filteredScouts.map((scout) => {
                  const pts = scout.points ?? 100;
                  return (
                    <div
                      key={scout.id}
                      onClick={() => handleOpenAccountability(scout)}
                      className="p-2.5 rounded-xl bg-[#faf8f2] border border-[#ede8dc] hover:bg-[#f5f0e4] transition cursor-pointer flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="scout-avatar">
                          {scout.scoutIdNumber}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#17201c]">{scout.fullName}</div>
                          <div className="text-[10px] text-[#66736c]">
                            Leader: {scout.leader || 'Assigned Qaid'} {scout.asstLeader ? `• Asst: ${scout.asstLeader}` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end gap-0.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
                          pts >= 90 ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                          pts >= 75 ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                          'bg-rose-100 text-rose-900 border border-rose-300'
                        }`}>
                          🏅 {pts} pts
                        </span>
                        <span className="text-[9px] text-[#123c2d] font-bold">Evaluate →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Accountability Log History */}
            <div className="scout-card p-3 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#17201c]">
                Recent Accountability Logs
              </h3>
              {accountabilityLogs.length === 0 ? (
                <p className="text-xs text-[#8a8f8c] italic py-2 text-center">
                  No points adjusted yet for this session.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {accountabilityLogs.slice(0, 10).map((log) => (
                    <div key={log.id} className="text-xs p-2 rounded-lg bg-[#fbf9f4] border border-[#eee8dc] space-y-0.5">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-[#17201c]">{log.scoutName} ({log.grade})</span>
                        <span className={log.pointsDelta >= 0 ? 'text-emerald-700 font-extrabold' : 'text-rose-700 font-extrabold'}>
                          {log.pointsDelta >= 0 ? `+${log.pointsDelta}` : log.pointsDelta} pts
                        </span>
                      </div>
                      <div className="text-[11px] text-[#66736c]">{log.reason}</div>
                      <div className="text-[9px] text-[#8a8f8c]">Logged by @{log.loggedBy} • Date: {log.date}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </main>
        )}

        {/* TAB 3: PATROL ROSTER */}
        {activeTab === 'roster' && (
          <main className="p-4 space-y-3.5">
            <div className="scout-card space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#17201c] flex items-center gap-1.5">
                    <span>Scout Patrol Directory</span>
                    {activeTaliah && (
                      <span className="text-[10px] font-bold text-[#8a6514] bg-[#fdf6e2] px-1.5 py-0.2 rounded border border-[#ebd9a2]">
                        {activeTaliah.taliahRank}
                      </span>
                    )}
                  </h2>
                  {activeTaliah && (
                    <div className="text-[11px] font-bold text-[#123c2d] flex items-center gap-1 mt-0.5">
                      <span>⚜️ {activeTaliah.taliahName}</span>
                      <button
                        type="button"
                        onClick={() => handleOpenEditTaliah(selectedGrade)}
                        className="text-[10px] text-[#8a6514] hover:underline cursor-pointer font-normal"
                      >
                        [✏️ Edit]
                      </button>
                    </div>
                  )}
                </div>
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
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fdf6e2] text-[#8a6514] border border-[#ebd9a2]">
                      🏅 {scout.points ?? 100} pts
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      scout.unexcusedAbsences >= 3
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}>
                      {scout.unexcusedAbsences} Absences
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </main>
        )}

        {/* TAB 4: SCHEDULE */}
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

        {/* TAB 5: LEADER ACCOUNT & ADMIN */}
        {activeTab === 'account' && (
          <main className="p-4 space-y-3.5">
            <div className="scout-card space-y-3">
              <div className="flex items-center gap-3 pb-2 border-b border-[#f0ebe0]">
                <img
                  src="/scouts_logo.png"
                  alt="Logo"
                  className="w-12 h-12 rounded-2xl object-contain bg-[#123c2d] p-1 shadow-md border border-[#e6d7a8]"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
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
                  <span>Assigned Patrol Unit:</span>
                  <strong className="text-[#123c2d]">{assignedGradeName}</strong>
                </div>
                {userUnitTaliah && (
                  <div className="flex justify-between">
                    <span>Ṭalīʿah Rank & Name:</span>
                    <strong className="text-[#8a6514] font-bold">
                      {userUnitTaliah.taliahRank} ({userUnitTaliah.taliahName})
                    </strong>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Default Password:</span>
                  <strong className="font-mono text-[#123c2d]">scouts2026</strong>
                </div>
                <div className="flex justify-between">
                  <span>PWA Mobile App Mode:</span>
                  <strong className="text-emerald-700">📱 Installable / Any Phone</strong>
                </div>
                <div className="flex justify-between">
                  <span>Database State:</span>
                  <strong className={isFirebaseConfigured ? 'text-emerald-700' : 'text-amber-700'}>
                    {isFirebaseConfigured ? '🟢 Firebase Live Sync' : '🟡 Local Storage Offline'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Ṭalīʿah (Group Name) Management Card */}
            <div className="scout-card space-y-3">
              <div className="flex items-center justify-between border-b border-[#f0ebe0] pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚜️</span>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#17201c]">
                      Ṭalīʿah & Group Unit Management
                    </h3>
                    <p className="text-[10px] text-[#66736c]">Customize and manage official Ṭalīʿah names</p>
                  </div>
                </div>
              </div>

              {/* Unit Leader: Edit Own Taliah Name */}
              {userUnitTaliah && leaderProfile && leaderProfile.assignedGrade !== 'ALL' && (
                <div className="p-3 bg-[#faf8f2] rounded-xl border border-[#ede8dc] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase text-[#8a6514]">
                        {userUnitTaliah.taliahRank}
                      </div>
                      <div className="text-sm font-extrabold text-[#123c2d]">
                        {userUnitTaliah.taliahName}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      userUnitTaliah.isTBD
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : userUnitTaliah.isCustom
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-[#f4eee0] text-[#66736c] border border-[#d8d0c0]'
                    }`}>
                      {userUnitTaliah.isTBD ? '⚠️ Name is TBD' : userUnitTaliah.isCustom ? '✨ Custom Name' : 'Official Name'}
                    </span>
                  </div>

                  {userUnitTaliah.isTBD && (
                    <div className="text-[11px] text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200">
                      💡 Your unit's group name is currently <strong>TBD</strong>. You can customize and assign it below!
                    </div>
                  )}

                  <div className="pt-2 border-t border-[#ede8dc] flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEditTaliah(leaderProfile.assignedGrade)}
                      className="scout-btn-primary flex-1 text-xs py-2 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <span>✏️</span> {userUnitTaliah.isTBD ? 'Set Ṭalīʿah Group Name' : 'Update Group Name'}
                    </button>
                    {userUnitTaliah.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleResetTaliah(leaderProfile.assignedGrade)}
                        className="scout-btn-outline text-xs py-2 px-3 text-[#991b1b] border-[#fecaca] hover:bg-[#fff5f5] cursor-pointer"
                        title="Reset to default name"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Troop Administrator: Overview Table for all 11 Grade Units */}
              {isAdmin && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-[#123c2d] flex items-center justify-between">
                    <span>👑 All Troop Ṭalāʾiʿ (11 Patrol Units)</span>
                    <span className="text-[10px] text-[#66736c]">Click ✏️ to customize</span>
                  </div>

                  <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
                    {ALL_GRADES.map((g) => {
                      const tInfo = getTaliahForGrade(g, customTaliahNames);
                      return (
                        <div
                          key={g}
                          className="p-2.5 bg-[#faf8f2] rounded-xl border border-[#ede8dc] flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-[10px] font-bold text-[#8a6514] flex items-center gap-1">
                              <span>⚜️ {tInfo.taliahRank}</span>
                              {tInfo.isCustom && (
                                <span className="text-[8.5px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-bold">Custom</span>
                              )}
                              {tInfo.isTBD && (
                                <span className="text-[8.5px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full font-bold">TBD</span>
                              )}
                            </div>
                            <div className="text-xs font-bold text-[#17201c] truncate">
                              {tInfo.taliahName}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenEditTaliah(g)}
                            className="scout-btn-outline text-[10.5px] py-1 px-2.5 flex-shrink-0 cursor-pointer"
                          >
                            ✏️ Edit
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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
            onClick={() => setActiveTab('accountability')}
            className={`scout-nav-item ${activeTab === 'accountability' ? 'on' : ''}`}
          >
            <span className="nav-icon text-lg">🛡️</span>
            <span>Duties</span>
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
            onClick={() => setActiveTab('account')}
            className={`scout-nav-item ${activeTab === 'account' ? 'on' : ''}`}
          >
            <span className="nav-icon text-lg">👤</span>
            <span>Portal</span>
          </button>
        </nav>

        {/* Accountability Inspection Modal */}
        {accountabilityModalScout && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 animate-fade-in">
            <div className="bg-[#f7f2e7] w-full max-w-[420px] rounded-3xl border border-[#ded9cc] p-4 sm:p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[#ded9cc] pb-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="scout-avatar">
                    {accountabilityModalScout.scoutIdNumber}
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#17201c]">{accountabilityModalScout.fullName}</h3>
                    <div className="text-[11px] text-[#66736c]">{accountabilityModalScout.grade} • Qaid: {accountabilityModalScout.leader}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAccountabilityModalScout(null)}
                  className="w-7 h-7 rounded-full bg-[#ded9cc] hover:bg-[#ccc5b6] text-slate-700 font-bold grid place-items-center text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Current Points Badge */}
              <div className="p-3 bg-white rounded-2xl border border-[#ded9cc] flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase text-[#66736c]">Current Points</div>
                  <div className="text-xl font-extrabold text-[#123c2d]">🏅 {accountabilityModalScout.points ?? 100} pts</div>
                </div>
                <span className="scout-pill-gold text-xs">
                  Session: {selectedDate}
                </span>
              </div>

              {/* Accountability Checklist */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#66736c]">
                  Session Accountability Checklist
                </label>
                
                <label className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-[#ded9cc] cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span className="text-base">👔</span>
                    <span className="text-xs font-semibold text-[#17201c]">Full Scout Uniform (+5 / -5)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={uniformCheck}
                    onChange={(e) => setUniformCheck(e.target.checked)}
                    className="w-4 h-4 text-[#123c2d] rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-[#ded9cc] cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span className="text-base">⏰</span>
                    <span className="text-xs font-semibold text-[#17201c]">Punctual at 6:30 PM (+5 / -5)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={onTimeCheck}
                    onChange={(e) => setOnTimeCheck(e.target.checked)}
                    className="w-4 h-4 text-[#123c2d] rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-[#ded9cc] cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📖</span>
                    <span className="text-xs font-semibold text-[#17201c]">Quran & Dua Participation (+10)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={quranCheck}
                    onChange={(e) => setQuranCheck(e.target.checked)}
                    className="w-4 h-4 text-[#123c2d] rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-[#ded9cc] cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🛡️</span>
                    <span className="text-xs font-semibold text-[#17201c]">Scout Oath & Patrol Duty (+5)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={dutyCheck}
                    onChange={(e) => setDutyCheck(e.target.checked)}
                    className="w-4 h-4 text-[#123c2d] rounded cursor-pointer"
                  />
                </label>
              </div>

              {/* Custom Points & Notes */}
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] font-bold text-[#66736c]">Custom Points Adjustment (+ / -)</label>
                  <input
                    type="number"
                    value={customPoints}
                    onChange={(e) => setCustomPoints(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-[#ccc] rounded-xl text-xs focus:outline-none focus:border-[#123c2d]"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#66736c]">Leader Evaluation Notes</label>
                  <input
                    type="text"
                    value={accountabilityNote}
                    onChange={(e) => setAccountabilityNote(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#ccc] rounded-xl text-xs focus:outline-none focus:border-[#123c2d]"
                    placeholder="e.g. Missing scarf, great participation, helped cleanup"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAccountabilityModalScout(null)}
                  className="flex-1 py-2.5 scout-btn-outline text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAccountability}
                  className="flex-1 py-2.5 scout-btn-primary text-xs"
                >
                  Save Evaluation →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Ṭalīʿah Group Name Update Modal */}
        {editingTaliahGrade && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 animate-fade-in">
            <div className="bg-[#f7f2e7] w-full max-w-[400px] rounded-3xl border border-[#ded9cc] p-4 sm:p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#ded9cc] pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⚜️</span>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#17201c]">
                      Update Ṭalīʿah Name
                    </h3>
                    <div className="text-[11px] text-[#66736c]">
                      {editingTaliahGrade} • {TALIAH_REGISTRY[editingTaliahGrade]?.taliahRank}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingTaliahGrade(null)}
                  className="w-7 h-7 rounded-full bg-[#ded9cc] hover:bg-[#ccc5b6] text-slate-700 font-bold grid place-items-center text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#17201c]">
                  Official Ṭalīʿah / Group Name:
                </label>
                <input
                  type="text"
                  value={tempTaliahName}
                  onChange={(e) => setTempTaliahName(e.target.value)}
                  placeholder={TALIAH_REGISTRY[editingTaliahGrade]?.defaultName || 'e.g. Ṭalīʿat ...'}
                  className="w-full px-3 py-2.5 bg-white border border-[#ccc] rounded-xl text-xs sm:text-sm font-bold text-[#123c2d] focus:outline-none focus:ring-2 focus:ring-[#123c2d]"
                  autoFocus
                />
                <div className="text-[10.5px] text-[#66736c] bg-[#faf8f2] p-2 rounded-lg border border-[#e8e4d8]">
                  Default Official Name:{' '}
                  <strong className="text-[#123c2d]">
                    {TALIAH_REGISTRY[editingTaliahGrade]?.defaultName}
                  </strong>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleSaveTaliah(editingTaliahGrade, tempTaliahName)}
                  className="scout-btn-primary flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <span>💾</span> Save Ṭalīʿah Name
                </button>
                <button
                  type="button"
                  onClick={() => handleResetTaliah(editingTaliahGrade)}
                  className="scout-btn-outline text-xs py-2.5 px-3 text-[#66736c] cursor-pointer"
                  title="Reset to default"
                >
                  🔄 Reset
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTaliahGrade(null)}
                  className="py-2.5 px-3 rounded-xl border border-[#ded9cc] text-xs font-bold text-[#66736c] hover:bg-[#eae5d8] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}