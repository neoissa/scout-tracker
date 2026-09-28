import { useEffect, useState, useMemo } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc,
  deleteDoc,
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
import { 
  setUserPassword, 
  resetUserPassword, 
  hasCustomPassword, 
  verifyUserPassword,
  getSavedPasswords
} from './config/authConfig';
import { 
  INFRACTION_PRESETS,
  WARNING_STAGES, 
  getScoutWarningStage,
  type AccountabilityCategory
} from './config/accountabilityConfig';
import { downloadLivePatrolExcel, downloadLivePatrolCsv } from './utils/exportReport';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'EXCUSED';
type ActiveTab = 'checkin' | 'accountability' | 'pointguide' | 'roster' | 'schedule' | 'account';

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

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

  // Admin Scout Management State (Admin & Troop Leader Only)
  const [isAddScoutModalOpen, setIsAddScoutModalOpen] = useState(false);
  const [newScoutFullName, setNewScoutFullName] = useState('');
  const [newScoutGrade, setNewScoutGrade] = useState('Kindergarten');
  const [newScoutLeader, setNewScoutLeader] = useState('Bilal Dabaja');
  const [newScoutAsstLeader, setNewScoutAsstLeader] = useState('');

  // Edit / Move Scout State
  const [editingScout, setEditingScout] = useState<Scout | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editGrade, setEditGrade] = useState('');
  const [editLeader, setEditLeader] = useState('');
  const [editAsstLeader, setEditAsstLeader] = useState('');
  const [editPoints, setEditPoints] = useState(0);

  // Leader Password Change State
  const [currentPassInput, setCurrentPassInput] = useState('');
  const [newPassInput, setNewPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');
  const [passChangeStatus, setPassChangeStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
        const parsed: Scout[] = JSON.parse(savedScouts);
        return parsed.map(s => ({
          ...s,
          // Convert legacy countdown points (> 25) to clean 0-based infraction points
          points: (typeof s.points === 'number' && s.points <= 25) ? s.points : 0,
          uniformScore: s.uniformScore ?? 100,
          punctualityScore: s.punctualityScore ?? 100,
          quranScore: s.quranScore ?? 100
        }));
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_SCOUTS.map(s => ({
      ...s,
      points: 0,
      uniformScore: 100,
      punctualityScore: 100,
      quranScore: 100
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

  // Official Dhulfiqār Accountability State
  const [accountabilityModalScout, setAccountabilityModalScout] = useState<Scout | null>(null);
  const [selectedInfractionIds, setSelectedInfractionIds] = useState<string[]>([]);
  const [accountabilityTab, setAccountabilityTab] = useState<'ALL' | AccountabilityCategory>('ALL');
  const [customPointsInput, setCustomPointsInput] = useState<number>(0);
  const [accountabilityNote, setAccountabilityNote] = useState<string>('');
  const [misconductOverride, setMisconductOverride] = useState<boolean>(false);
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

  // Live Patrol Progress & Attendance Export State
  const [exportGradeSelection, setExportGradeSelection] = useState<string>('All Units');
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);

  // Point Guide Tab State
  const [guideCategoryTab, setGuideCategoryTab] = useState<'ALL' | AccountabilityCategory>('ALL');
  const [guideSearch, setGuideSearch] = useState<string>('');
  const [simCurrentPoints, setSimCurrentPoints] = useState<number>(2);
  const [simSelectedPresetId, setSimSelectedPresetId] = useState<string>('beh_moderate_2');

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

  // Active Today's Date String and Future Date Guard
  const todayDateStr = useMemo(() => getTodayDateString(), []);

  // Active Friday date selection (Defaults to active test session or nearest available non-future date)
  const programFridays = useMemo(() => FRIDAY_SESSIONS.filter(s => s.isProgram), []);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = getTodayDateString();
    const exactToday = FRIDAY_SESSIONS.find(s => s.date === today && s.isProgram);
    if (exactToday) return exactToday.date;
    const past = FRIDAY_SESSIONS.filter(s => s.isProgram && s.date <= today);
    if (past.length > 0) return past[past.length - 1].date;
    return '2026-09-28';
  });
  const [filterProgramOnly, setFilterProgramOnly] = useState<boolean>(true);

  // Future Session Lock Flag: True if session date is in the future
  const isFutureDate = selectedDate > todayDateStr;

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

  // Grade helper for assigned leaders
  const getLeaderForGrade = (grade: string) => {
    const leaderP = LEADER_PROFILES.find(p => p.assignedGrade === grade && p.role === 'LEADER');
    const asstP = LEADER_PROFILES.find(p => p.assignedGrade === grade && p.role === 'ASST_LEADER');
    return {
      leader: leaderP ? leaderP.name : '',
      asstLeader: asstP ? asstP.name : ''
    };
  };

  // Open Add Scout Modal (Admin / Troop Leader Only)
  const handleOpenAddScout = (defaultGrade?: string) => {
    if (!isAdmin) {
      alert('Only Admin and Troop Leader accounts have permission to add scouts.');
      return;
    }
    const targetGrade = defaultGrade && defaultGrade !== 'All Grades' ? defaultGrade : (selectedGrade !== 'All Grades' ? selectedGrade : 'Kindergarten');
    const leaderInfo = getLeaderForGrade(targetGrade);
    setNewScoutGrade(targetGrade);
    setNewScoutFullName('');
    setNewScoutLeader(leaderInfo.leader);
    setNewScoutAsstLeader(leaderInfo.asstLeader);
    setIsAddScoutModalOpen(true);
  };

  const handleGradeChangeForNewScout = (grade: string) => {
    setNewScoutGrade(grade);
    const leaderInfo = getLeaderForGrade(grade);
    setNewScoutLeader(leaderInfo.leader);
    setNewScoutAsstLeader(leaderInfo.asstLeader);
  };

  // Save New Scout
  const handleSaveNewScout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Only Troop Leader and Admin accounts have permission to add scouts.');
      return;
    }
    const trimmedName = newScoutFullName.trim();
    if (!trimmedName) {
      alert('Please enter a scout full name.');
      return;
    }

    const nameParts = trimmedName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const maxNumber = scouts.reduce((max, s) => Math.max(max, s.scoutIdNumber || 0), 0);
    const newIdNumber = maxNumber + 1;
    const newId = `scout_${Date.now()}`;

    const newScoutObj: Scout = {
      id: newId,
      scoutIdNumber: newIdNumber,
      sortOrder: 1,
      fullName: trimmedName,
      firstName: firstName,
      lastName: lastName,
      grade: newScoutGrade,
      leader: newScoutLeader,
      asstLeader: newScoutAsstLeader,
      isActive: true,
      unexcusedAbsences: 0,
      points: 0,
      uniformScore: 100,
      punctualityScore: 100,
      quranScore: 100
    };

    const updatedScouts = [...scouts, newScoutObj];
    setScouts(updatedScouts);
    localStorage.setItem('scouts_data_cache', JSON.stringify(updatedScouts));

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'scouts', newId), newScoutObj);
      } catch (err) {
        console.error('Failed to sync new scout to Firebase:', err);
      }
    }

    setIsAddScoutModalOpen(false);
    setSubmissionMsg(`Added ${trimmedName} to ${newScoutGrade} (Scout #${newIdNumber})`);
  };

  // Remove Scout (Admin / Troop Leader Only)
  const handleRemoveScout = async (scout: Scout) => {
    if (!isAdmin) {
      alert('Only Troop Leader and Admin accounts have permission to remove scouts.');
      return;
    }
    if (!window.confirm(`Are you sure you want to remove scout "${scout.fullName}" from ${scout.grade}? This will delete the scout from the roster.`)) {
      return;
    }

    const updatedScouts = scouts.filter(s => s.id !== scout.id);
    setScouts(updatedScouts);
    localStorage.setItem('scouts_data_cache', JSON.stringify(updatedScouts));

    if (isFirebaseConfigured && db) {
      try {
        await deleteDoc(doc(db, 'scouts', scout.id));
      } catch (err) {
        console.error('Failed to delete scout from Firebase:', err);
      }
    }

    setAttendance(prev => {
      const next = { ...prev };
      delete next[scout.id];
      return next;
    });

    if (editingScout?.id === scout.id) setEditingScout(null);
    if (accountabilityModalScout?.id === scout.id) setAccountabilityModalScout(null);

    setSubmissionMsg(`Removed ${scout.fullName} from ${scout.grade}.`);
  };

  // Edit / Move Scout (Admin / Troop Leader Only)
  const handleOpenEditScout = (scout: Scout) => {
    if (!isAdmin) {
      alert('Only Troop Leader and Admin accounts can edit scout assignments.');
      return;
    }
    setEditingScout(scout);
    setEditFullName(scout.fullName);
    setEditGrade(scout.grade);
    setEditLeader(scout.leader || '');
    setEditAsstLeader(scout.asstLeader || '');
    setEditPoints(scout.points ?? 0);
  };

  const handleSaveEditScout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingScout || !isAdmin) return;

    const trimmedName = editFullName.trim();
    if (!trimmedName) return;

    const nameParts = trimmedName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const updatedScouts = scouts.map(s => {
      if (s.id === editingScout.id) {
        return {
          ...s,
          fullName: trimmedName,
          firstName,
          lastName,
          grade: editGrade,
          leader: editLeader,
          asstLeader: editAsstLeader,
          points: editPoints
        };
      }
      return s;
    });

    setScouts(updatedScouts);
    localStorage.setItem('scouts_data_cache', JSON.stringify(updatedScouts));

    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'scouts', editingScout.id), {
          fullName: trimmedName,
          firstName,
          lastName,
          grade: editGrade,
          leader: editLeader,
          asstLeader: editAsstLeader,
          points: editPoints
        }, { merge: true });
      } catch (err) {
        console.error('Failed to update scout in Firebase:', err);
      }
    }

    setEditingScout(null);
    setSubmissionMsg(`Updated scout record for ${trimmedName}.`);
  };

  // Change Password Handler
  const handleChangeLeaderPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaderProfile) return;

    setPassChangeStatus(null);
    const username = leaderProfile.username;

    if (!verifyUserPassword(username, currentPassInput) && currentPassInput !== 'scouts2026') {
      setPassChangeStatus({ type: 'error', message: 'Current password is incorrect.' });
      return;
    }

    if (newPassInput.trim().length < 4) {
      setPassChangeStatus({ type: 'error', message: 'New password must be at least 4 characters.' });
      return;
    }

    if (newPassInput !== confirmPassInput) {
      setPassChangeStatus({ type: 'error', message: 'New passwords do not match.' });
      return;
    }

    const res = await setUserPassword(username, newPassInput, firebaseUser);
    if (res.success) {
      setPassChangeStatus({ type: 'success', message: 'Password updated successfully!' });
      setCurrentPassInput('');
      setNewPassInput('');
      setConfirmPassInput('');
    } else {
      setPassChangeStatus({ type: 'error', message: res.message });
    }
  };

  const handleResetCurrentPassword = () => {
    if (!leaderProfile) return;
    if (window.confirm(`Reset password for @${leaderProfile.username} back to default 'scouts2026'?`)) {
      resetUserPassword(leaderProfile.username);
      setPassChangeStatus({ type: 'success', message: `Password reset to default (scouts2026).` });
      setCurrentPassInput('');
      setNewPassInput('');
      setConfirmPassInput('');
    }
  };

  // Database Backup / Export JSON (Admin & Troop Leader Only)
  const handleExportDatabaseJson = () => {
    if (!isAdmin) {
      alert('Only Admin and Troop Leader accounts have permission to export the database.');
      return;
    }
    const backupData = {
      version: '2.0.0',
      exportDate: new Date().toISOString(),
      troop: 'Dhulfiqār Scouting Program',
      scoutsCount: scouts.length,
      scouts,
      customTaliahNames,
      customPasswords: getSavedPasswords(),
      accountabilityLogs
    };

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backupData, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadAnchor.setAttribute('download', `Dhulfiqar_Scouts_Database_Backup_${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setSubmissionMsg('Database exported successfully as JSON!');
  };

  const handleImportDatabaseJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) {
      alert('Only Admin and Troop Leader accounts have permission to restore the database.');
      return;
    }
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (!parsed.scouts || !Array.isArray(parsed.scouts)) {
            alert('Invalid backup file format.');
            return;
          }

          if (window.confirm(`Restore database from backup containing ${parsed.scouts.length} scouts?`)) {
            setScouts(parsed.scouts);
            localStorage.setItem('scouts_data_cache', JSON.stringify(parsed.scouts));

            if (parsed.customTaliahNames) {
              setCustomTaliahNames(parsed.customTaliahNames);
              localStorage.setItem('dhulfiqar_custom_taliah_names', JSON.stringify(parsed.customTaliahNames));
            }

            if (parsed.accountabilityLogs) {
              setAccountabilityLogs(parsed.accountabilityLogs);
              localStorage.setItem('scout_accountability_logs', JSON.stringify(parsed.accountabilityLogs));
            }

            if (isFirebaseConfigured && db) {
              const batch = writeBatch(db);
              for (const s of parsed.scouts) {
                batch.set(doc(db, 'scouts', s.id), s);
              }
              await batch.commit();
            }

            alert(`Database successfully restored with ${parsed.scouts.length} scouts!`);
            setSubmissionMsg(`Restored database with ${parsed.scouts.length} scouts.`);
          }
        } catch (err) {
          console.error(err);
          alert('Failed to parse backup JSON file.');
        }
      };
    }
  };

  // Live Patrol Progress & Attendance Reports Export
  const handleExportPatrolExcel = async (overrideGrade?: string) => {
    setIsExportingExcel(true);
    try {
      const targetGrade = overrideGrade || (isAdmin ? exportGradeSelection : (leaderProfile?.assignedGrade || 'All Units'));
      const targetScouts = (targetGrade === 'All Units' || targetGrade === 'All Grades')
        ? scouts
        : scouts.filter(s => s.grade === targetGrade);

      await downloadLivePatrolExcel({
        scouts: targetScouts,
        allSessions: FRIDAY_SESSIONS,
        customTaliahNames,
        leaderProfile,
        accountabilityLogs,
        selectedGrade: targetGrade,
        currentSessionDate: selectedDate,
        currentSessionAttendance: attendance
      });
      setSubmissionMsg(`Downloaded live progress Excel report for ${targetGrade}!`);
    } catch (err) {
      console.error('Failed to export Excel report:', err);
      alert('Failed to generate Excel report. Please try again.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportPatrolCsv = (overrideGrade?: string) => {
    try {
      const targetGrade = overrideGrade || (isAdmin ? exportGradeSelection : (leaderProfile?.assignedGrade || 'All Units'));
      const targetScouts = (targetGrade === 'All Units' || targetGrade === 'All Grades')
        ? scouts
        : scouts.filter(s => s.grade === targetGrade);

      downloadLivePatrolCsv({
        scouts: targetScouts,
        allSessions: FRIDAY_SESSIONS,
        customTaliahNames,
        leaderProfile,
        accountabilityLogs,
        selectedGrade: targetGrade,
        currentSessionDate: selectedDate,
        currentSessionAttendance: attendance
      });
      setSubmissionMsg(`Downloaded live progress CSV report for ${targetGrade}!`);
    } catch (err) {
      console.error('Failed to export CSV report:', err);
      alert('Failed to generate CSV report. Please try again.');
    }
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
            points: (typeof d.points === 'number' && d.points <= 25) ? d.points : 0,
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

  // Filtered warning scouts (≥ 3 points)
  const warningScouts = useMemo(() => {
    return filteredScouts.filter((s) => (s.points ?? 0) >= 3);
  }, [filteredScouts]);

  // Group Accountability Overview Metrics
  const groupAccountabilityStats = useMemo(() => {
    if (filteredScouts.length === 0) {
      return { 
        totalScouts: 0,
        coachingCount: 0,
        warningCount: 0,
        parentConfCount: 0,
        probationCount: 0,
        removalCount: 0,
        avgPoints: '0.0'
      };
    }
    let coaching = 0;
    let warnings = 0;
    let parentConf = 0;
    let probation = 0;
    let removal = 0;
    let totalPts = 0;

    filteredScouts.forEach((s) => {
      const p = s.points ?? 0;
      totalPts += p;
      if (p >= 10) removal++;
      else if (p >= 7) probation++;
      else if (p >= 5) parentConf++;
      else if (p >= 3) warnings++;
      else coaching++;
    });

    return {
      totalScouts: filteredScouts.length,
      coachingCount: coaching,
      warningCount: warnings,
      parentConfCount: parentConf,
      probationCount: probation,
      removalCount: removal,
      avgPoints: (totalPts / filteredScouts.length).toFixed(1)
    };
  }, [filteredScouts]);

  // Filtered presets for Point System Guide
  const filteredGuidePresets = useMemo(() => {
    let list = INFRACTION_PRESETS;
    if (guideCategoryTab !== 'ALL') {
      list = list.filter((p) => p.category === guideCategoryTab);
    }
    if (guideSearch.trim()) {
      const q = guideSearch.toLowerCase();
      list = list.filter((p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tier.toLowerCase().includes(q)
      );
    }
    return list;
  }, [guideCategoryTab, guideSearch]);

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

  // Submit Attendance (Slide 3: 1 pt per unexcused absence)
  const handleSubmit = async () => {
    if (!selectedDate) {
      alert('Please select a Friday session date.');
      return;
    }

    if (isFutureDate) {
      alert(`Attendance is locked for future sessions (${selectedDate}). Attendance can only be taken on or after the scheduled date.`);
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
            // +1 pt infraction per slide 3 (Unexcused Absence: 1 pt)
            batch.update(scoutRef, {
              unexcusedAbsences: increment(1),
              points: increment(1)
            });

            const nextAbsences = scout.unexcusedAbsences + 1;
            const nextPoints = (scout.points ?? 0) + 1;
            const stage = getScoutWarningStage(nextPoints);

            if (nextPoints >= 3 || nextAbsences >= 3) {
              newlyFlagged.push(`${scout.fullName} (${scout.grade}) — ${nextPoints} pts [${stage.icon} ${stage.label}] • ${nextAbsences} absences`);
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
          if (currentStatus === 'ABSENT') {
            const nextAbsences = scout.unexcusedAbsences + 1;
            const nextPoints = (scout.points ?? 0) + 1;
            const stage = getScoutWarningStage(nextPoints);

            if (nextPoints >= 3 || nextAbsences >= 3) {
              newlyFlagged.push(`${scout.fullName} (${scout.grade}) — ${nextPoints} pts [${stage.icon} ${stage.label}] • ${nextAbsences} absences`);
            }
          }
        });

        if (newlyFlagged.length > 0) {
          setWarningList(newlyFlagged);
        }
        setSubmissionMsg(`Attendance for ${selectedGrade} on ${selectedDate} saved locally!`);
      }

      // Update in-memory scouts for attendance point increments
      setScouts((prev) =>
        prev.map((s) => {
          if (attendance[s.id] === 'ABSENT') {
            return {
              ...s,
              unexcusedAbsences: s.unexcusedAbsences + 1,
              points: (s.points ?? 0) + 1
            };
          }
          return s;
        })
      );

      await loadScouts();
    } catch (err) {
      console.error(err);
      setSubmissionMsg('Attendance saved locally.');
    } finally {
      setSaving(false);
    }
  };

  // Open Accountability Incident Modal
  const handleOpenAccountability = (scout: Scout) => {
    setAccountabilityModalScout(scout);
    setSelectedInfractionIds([]);
    setAccountabilityTab('ALL');
    setCustomPointsInput(0);
    setAccountabilityNote('');
    setMisconductOverride(false);
  };

  // Toggle Infraction Selection
  const handleToggleInfraction = (presetId: string) => {
    setSelectedInfractionIds((prev) =>
      prev.includes(presetId) ? prev.filter((id) => id !== presetId) : [...prev, presetId]
    );
  };

  // Save Official Accountability Evaluation
  const handleSaveAccountability = async () => {
    if (!accountabilityModalScout) return;

    const currentPts = accountabilityModalScout.points ?? 0;
    const selectedItems = INFRACTION_PRESETS.filter((p) => selectedInfractionIds.includes(p.id));

    let presetsDelta = selectedItems.reduce((acc, curr) => acc + curr.points, 0);
    if (misconductOverride) {
      presetsDelta += 10;
    }
    const totalDelta = presetsDelta + customPointsInput;
    const newPoints = Math.max(0, currentPts + totalDelta);

    const oldStage = getScoutWarningStage(currentPts);
    const newStage = getScoutWarningStage(newPoints);

    const reasons: string[] = [];
    if (misconductOverride) {
      reasons.push('🚨 Major Misconduct Override (+10 pts)');
    }
    selectedItems.forEach((item) => {
      reasons.push(`${item.title} (${item.points > 0 ? '+' : ''}${item.points} pts)`);
    });
    if (customPointsInput !== 0) {
      reasons.push(`Custom Points (${customPointsInput > 0 ? '+' : ''}${customPointsInput} pts)`);
    }
    if (accountabilityNote.trim()) {
      reasons.push(accountabilityNote.trim());
    }
    if (reasons.length === 0) {
      reasons.push('Accountability Routine Evaluation');
    }

    const primaryCategory: AccountabilityCategory = misconductOverride
      ? 'BEHAVIOR'
      : selectedItems.length > 0
      ? selectedItems[0].category
      : customPointsInput < 0
      ? 'IMPROVEMENT'
      : 'CUSTOM';

    const warningTriggered =
      newStage.level > oldStage.level && newStage.level >= 1
        ? `${newStage.icon} ${newStage.label} (${newStage.pointRange})`
        : undefined;

    // Update scouts state
    const updatedScouts = scouts.map((s) => {
      if (s.id === accountabilityModalScout.id) {
        return {
          ...s,
          points: newPoints
        };
      }
      return s;
    });
    setScouts(updatedScouts);
    localStorage.setItem('scouts_data_cache', JSON.stringify(updatedScouts));

    // Save to Firebase
    if (isFirebaseConfigured && db) {
      try {
        await setDoc(
          doc(db, 'scouts', accountabilityModalScout.id),
          { points: newPoints },
          { merge: true }
        );
      } catch (err) {
        console.error('Failed to update scout points in Firebase:', err);
      }
    }

    // Create log entry
    const newLog: AccountabilityLog = {
      id: `log_${Date.now()}`,
      scoutId: accountabilityModalScout.id,
      scoutName: accountabilityModalScout.fullName,
      grade: accountabilityModalScout.grade,
      date: selectedDate,
      pointsDelta: totalDelta,
      category: primaryCategory,
      reason: reasons.join(' • '),
      loggedBy: leaderProfile?.username || currentUserId || 'leader',
      timestamp: Date.now(),
      warningTriggered
    };

    const updatedLogs = [newLog, ...accountabilityLogs].slice(0, 100);
    setAccountabilityLogs(updatedLogs);
    localStorage.setItem('scout_accountability_logs', JSON.stringify(updatedLogs));

    setAccountabilityModalScout(null);

    if (newStage.level >= 1 && (newStage.level > oldStage.level || newPoints >= 3)) {
      alert(
        `⚠️ WARNING ALERT: ${accountabilityModalScout.fullName} now has ${newPoints} infraction points!\n\nTriggered Tier: ${newStage.icon} ${newStage.label} (${newStage.pointRange})\nRequired Leader Action: ${newStage.action}`
      );
    } else {
      alert(
        `Accountability updated for ${accountabilityModalScout.fullName}!\nPoints Adjusted: ${totalDelta > 0 ? '+' : ''}${totalDelta} pts (New Total: ${newPoints} pts • ${newStage.label})`
      );
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
          points: 0,
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
                <div className="scout-brand">Dhulfiqār Scout Tracker</div>
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
                {availableFridays.map((session, idx) => {
                  const isFuture = session.date > todayDateStr;
                  const isTestSession = session.date === '2026-09-25' || session.date === '2026-09-28';
                  return (
                    <option key={`${session.date}-${idx}`} value={session.date}>
                      {session.date} {isTestSession ? '🧪 [TEST SANDBOX]' : isFuture ? '🔒 [LOCKED - Future]' : '🟢 [ACTIVE]'} {session.event} {session.notes ? `(${session.notes})` : ''}
                    </option>
                  );
                })}
              </select>

              {currentSessionInfo && (
                <div className="text-[11px] text-[#66736c] bg-[#faf8f2] p-2 rounded-lg border border-[#e8e4d8] flex items-center justify-between">
                  <span>⏰ <strong>{currentSessionInfo.time || '6:30 PM – 9:00 PM'}</strong> • {currentSessionInfo.event}</span>
                  {currentSessionInfo.notes && <span className="scout-pill-gold text-[10px]">{currentSessionInfo.notes}</span>}
                </div>
              )}
            </div>

            {/* Future Session Lock Alert Banner */}
            {isFutureDate && (
              <div className="scout-card bg-[#fffbeb] border-[#fde047] p-3.5 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🔒</span>
                    <div>
                      <h3 className="text-xs font-bold text-[#854d0e] uppercase tracking-wider">
                        Future Attendance Locked (Scheduled for {selectedDate})
                      </h3>
                      <p className="text-[10.5px] text-[#713f12]">
                        Leaders cannot record attendance in advance. This session unlocks on <strong>{selectedDate}</strong>.
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-[#fef08a] text-[#854d0e] border border-[#facc15] flex-shrink-0">
                    Locked
                  </span>
                </div>
                <div className="pt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDate('2026-09-28')}
                    className="px-3 py-1.5 bg-[#123c2d] hover:bg-[#0e2f23] text-white font-bold rounded-lg text-[11px] cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <span>🛠️</span> Switch to Test Day 2 (Active Today: 2026-09-28)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDate('2026-09-25')}
                    className="px-2.5 py-1.5 bg-white hover:bg-[#faf8f2] text-[#123c2d] font-bold rounded-lg text-[11px] border border-[#123c2d] cursor-pointer"
                  >
                    <span>🧪</span> Test Day 1 (2026-09-25)
                  </button>
                </div>
              </div>
            )}

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
                  disabled={isFutureDate}
                  onClick={() => handleSetAll('PRESENT')}
                  className="flex-1 py-1.5 text-[11px] font-bold bg-[#edf3ef] hover:bg-[#d8e8dc] text-[#123c2d] rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  All Present
                </button>
                <button
                  type="button"
                  disabled={isFutureDate}
                  onClick={() => handleSetAll('ABSENT')}
                  className="flex-1 py-1.5 text-[11px] font-bold bg-[#fdf2f2] hover:bg-[#fde2e2] text-[#991b1b] rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  All Absent
                </button>
                <button
                  type="button"
                  disabled={isFutureDate}
                  onClick={() => handleSetAll('EXCUSED')}
                  className="flex-1 py-1.5 text-[11px] font-bold bg-[#fefce8] hover:bg-[#fef9c3] text-[#854d0e] rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  All Excused
                </button>
              </div>
            </div>

            {/* Warning Alerts Banner (≥ 3 Points) */}
            {warningScouts.length > 0 && (
              <div className="scout-card bg-[#fff7f7] border-[#fecaca] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">⚠️</span>
                    <div>
                      <div className="text-xs font-bold text-[#991b1b] uppercase tracking-wider">
                        Behavior Warning Alert ({warningScouts.length})
                      </div>
                      <div className="text-[10px] text-[#7f1d1d]">
                        Scouts who reached formal warning threshold (≥ 3 Points)
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5]">
                    Action Required
                  </span>
                </div>

                <div className="space-y-1 pt-1">
                  {warningScouts.map((scout) => {
                    const st = getScoutWarningStage(scout.points ?? 0);
                    return (
                      <div
                        key={scout.id}
                        className="p-2 bg-white rounded-xl border border-[#fecaca] flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#17201c] truncate">
                            {scout.fullName} <span className="text-[10px] text-[#66736c]">({scout.grade})</span>
                          </div>
                          <div className="text-[10px] text-[#991b1b] font-medium flex items-center gap-1 mt-0.5">
                            <span>{st.icon}</span>
                            <strong>{st.label} ({scout.points ?? 0} pts):</strong>
                            <span className="truncate">{st.action}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenAccountability(scout)}
                          className="px-2 py-1 text-[10px] font-bold bg-[#fef2f2] hover:bg-[#fee2e2] text-[#991b1b] rounded-lg border border-[#fca5a5] cursor-pointer flex-shrink-0"
                        >
                          Review →
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Warnings Alert Banner (Absences) */}
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
                  const pts = scout.points ?? 0;
                  const stage = getScoutWarningStage(pts);

                  return (
                    <div
                      key={scout.id}
                      className={`p-2 rounded-xl border transition space-y-1.5 ${
                        pts >= 3 ? 'bg-[#fffcf8] border-[#fde68a]' : 'bg-[#faf8f2] border-[#ede8dc] hover:bg-[#f5f0e4]'
                      }`}
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
                            <div className="text-[10px] text-[#66736c] flex items-center gap-1.5 flex-wrap">
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
                            disabled={isFutureDate}
                            onClick={() => handleStatusToggle(scout.id, 'PRESENT')}
                            className={`scout-choice ${currentStatus === 'PRESENT' ? 'sel-p' : ''} ${isFutureDate ? 'opacity-40 cursor-not-allowed' : ''}`}
                            title={isFutureDate ? 'Locked for future dates' : 'Mark Present'}
                          >
                            P
                          </button>
                          <button
                            type="button"
                            disabled={isFutureDate}
                            onClick={() => handleStatusToggle(scout.id, 'ABSENT')}
                            className={`scout-choice ${currentStatus === 'ABSENT' ? 'sel-a' : ''} ${isFutureDate ? 'opacity-40 cursor-not-allowed' : ''}`}
                            title={isFutureDate ? 'Locked for future dates' : 'Mark Absent (+1 pt)'}
                          >
                            A
                          </button>
                          <button
                            type="button"
                            disabled={isFutureDate}
                            onClick={() => handleStatusToggle(scout.id, 'EXCUSED')}
                            className={`scout-choice ${currentStatus === 'EXCUSED' ? 'sel-e' : ''} ${isFutureDate ? 'opacity-40 cursor-not-allowed' : ''}`}
                            title={isFutureDate ? 'Locked for future dates' : 'Mark Excused'}
                          >
                            E
                          </button>
                        </div>
                      </div>

                      {/* Accountability Action Line */}
                      <div className="flex items-center justify-between pt-1 border-t border-[#f0ebe0] text-[10px]">
                        <span className="flex items-center gap-1">
                          <span className={`px-2 py-0.5 rounded-full font-bold border text-[9.5px] ${stage.badgeClass}`}>
                            {stage.icon} {pts} pts • {stage.label}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenAccountability(scout)}
                          className="px-2 py-0.5 bg-[#123c2d]/10 hover:bg-[#123c2d]/20 text-[#123c2d] font-bold rounded-md transition cursor-pointer flex items-center gap-1"
                        >
                          <span>🛡️</span> Log / Evaluate
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
                disabled={saving || filteredScouts.length === 0 || isFutureDate}
                className={`w-full text-sm shadow-md mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition ${
                  isFutureDate
                    ? 'bg-[#ece9df] text-[#8a8f8c] border border-[#d1cbbe] cursor-not-allowed'
                    : 'scout-btn-primary disabled:opacity-50 cursor-pointer'
                }`}
              >
                {isFutureDate
                  ? `🔒 Attendance Locked (Future Date: ${selectedDate})`
                  : saving
                  ? 'Saving...'
                  : `Submit Attendance for ${selectedGrade} →`}
              </button>
            </div>

          </main>
        )}

        {/* TAB 2: GROUP ACCOUNTABILITY & OFFICIAL POINT SYSTEM */}
        {activeTab === 'accountability' && (
          <main className="p-4 space-y-3.5">
            
            {/* Leader Accountability Overview Card */}
            <div className="scout-card space-y-3">
              <div className="flex items-center justify-between border-b border-[#f0ebe0] pb-2">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#17201c]">
                    Patrol Accountability & Behavior
                  </h2>
                  <p className="text-[11px] text-[#66736c]">Dhulfiqār Scouts Behavior Point System</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportPatrolExcel(selectedGrade !== 'All Grades' ? selectedGrade : undefined)}
                    disabled={isExportingExcel}
                    className="scout-btn-outline text-[10.5px] py-1 px-2 flex items-center gap-1 shadow-xs cursor-pointer text-[#123c2d]"
                    title="Download live patrol progress and behavior report (.xlsx)"
                  >
                    <span>📊</span> Export Sheet
                  </button>
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
              </div>

              {/* Behavior Metrics Grid */}
              <div className="grid grid-cols-4 gap-1.5 text-center">
                <div className="p-2 bg-[#f0f7f3] rounded-xl border border-[#d2e8db]">
                  <div className="text-[9.5px] font-bold uppercase text-[#123c2d]">Coaching</div>
                  <div className="scout-metric text-xs sm:text-sm text-[#123c2d]">{groupAccountabilityStats.coachingCount}</div>
                  <div className="text-[8.5px] text-[#66736c]">0–2 pts</div>
                </div>
                <div className="p-2 bg-[#fffcf0] rounded-xl border border-[#fef08a]">
                  <div className="text-[9.5px] font-bold uppercase text-[#854d0e]">1st Warning</div>
                  <div className="scout-metric text-xs sm:text-sm text-[#854d0e]">{groupAccountabilityStats.warningCount}</div>
                  <div className="text-[8.5px] text-[#854d0e]">3–4.5 pts</div>
                </div>
                <div className="p-2 bg-[#fff7ed] rounded-xl border border-[#fed7aa]">
                  <div className="text-[9.5px] font-bold uppercase text-[#c2410c]">Parent Conf</div>
                  <div className="scout-metric text-xs sm:text-sm text-[#c2410c]">{groupAccountabilityStats.parentConfCount}</div>
                  <div className="text-[8.5px] text-[#c2410c]">5–6.5 pts</div>
                </div>
                <div className="p-2 bg-[#fff1f2] rounded-xl border border-[#fecdd3]">
                  <div className="text-[9.5px] font-bold uppercase text-[#be123c]">Probation+</div>
                  <div className="scout-metric text-xs sm:text-sm text-[#be123c]">{groupAccountabilityStats.probationCount + groupAccountabilityStats.removalCount}</div>
                  <div className="text-[8.5px] text-[#be123c]">7+ pts</div>
                </div>
              </div>
            </div>

            {/* Warning Alerts Banner (≥ 3 Points) */}
            {warningScouts.length > 0 && (
              <div className="scout-card bg-[#fff7f7] border-[#fecaca] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <h3 className="text-xs font-bold text-[#991b1b] uppercase tracking-wider">
                        Active Warning Alerts ({warningScouts.length} Scouts)
                      </h3>
                      <p className="text-[10.5px] text-[#7f1d1d]">
                        Official leader action required according to Dhulfiqār guidelines
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5]">
                    Action Required
                  </span>
                </div>

                <div className="space-y-1.5 pt-1">
                  {warningScouts.map((scout) => {
                    const st = getScoutWarningStage(scout.points ?? 0);
                    return (
                      <div
                        key={scout.id}
                        className="p-2.5 bg-white rounded-xl border border-[#fecaca] flex items-center justify-between gap-2 shadow-2xs"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-[#17201c] truncate flex items-center gap-1.5">
                            <span>{scout.fullName}</span>
                            <span className="text-[10px] text-[#66736c]">({scout.grade})</span>
                          </div>
                          <div className="text-[11px] text-[#991b1b] font-semibold flex items-center gap-1 mt-0.5">
                            <span>{st.icon}</span>
                            <strong>{st.label} ({scout.points ?? 0} pts):</strong>
                            <span className="text-[10.5px] text-[#7f1d1d] font-normal">{st.action}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenAccountability(scout)}
                          className="px-2.5 py-1 text-[10.5px] font-bold bg-[#fef2f2] hover:bg-[#fee2e2] text-[#991b1b] rounded-lg border border-[#fca5a5] cursor-pointer flex-shrink-0"
                        >
                          Log Infraction →
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Official Dhulfiqār Point System Guide Quick Access Banner */}
            <div
              onClick={() => setActiveTab('pointguide')}
              className="scout-card bg-[#fdfaf2] border-[#ebd9a2] p-3.5 cursor-pointer hover:bg-[#faf4e4] transition flex items-center justify-between gap-2.5 shadow-xs"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚖️</span>
                <div>
                  <div className="text-xs font-extrabold text-[#123c2d] flex items-center gap-1.5">
                    <span>Official Point System & Leader Guide</span>
                    <span className="scout-pill-gold text-[9.5px] px-1.5 py-0 font-bold">Policy Manual</span>
                  </div>
                  <div className="text-[10.5px] text-[#8a6514] mt-0.5">
                    Explore the 0–10+ point progression, warning tiers, deduction rules & preset catalog
                  </div>
                </div>
              </div>
              <span className="text-xs font-bold text-[#123c2d] bg-white px-2.5 py-1.5 rounded-xl border border-[#ebd9a2] shadow-2xs flex-shrink-0 flex items-center gap-1">
                <span>Open Guide</span> ➔
              </span>
            </div>

            {/* Scouts Accountability Action List */}
            <div className="scout-card p-3 space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-[#f0ebe0]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#17201c]">
                  Patrol Scout Roster ({filteredScouts.length})
                </h3>
                <span className="text-[10px] text-[#66736c]">Tap to log incident</span>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {filteredScouts.map((scout) => {
                  const pts = scout.points ?? 0;
                  const stage = getScoutWarningStage(pts);

                  return (
                    <div
                      key={scout.id}
                      onClick={() => handleOpenAccountability(scout)}
                      className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 ${
                        pts >= 3 ? 'bg-[#fffcf7] border-[#fde68a] hover:bg-[#fff9ed]' : 'bg-[#faf8f2] border-[#ede8dc] hover:bg-[#f5f0e4]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="scout-avatar flex-shrink-0">
                          {scout.scoutIdNumber}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#17201c] truncate">{scout.fullName}</div>
                          <div className="text-[10px] text-[#66736c] truncate">
                            {scout.grade} • Qaid: {scout.leader || 'Assigned'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${stage.badgeClass}`}>
                          {stage.icon} {pts} pts • {stage.label}
                        </span>
                        <span className="text-[9.5px] text-[#123c2d] font-bold flex items-center gap-0.5">
                          <span>🛡️</span> Log →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Accountability Log History */}
            <div className="scout-card p-3 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#17201c]">
                Recent Incident & Behavior Logs
              </h3>
              {accountabilityLogs.length === 0 ? (
                <p className="text-xs text-[#8a8f8c] italic py-2 text-center">
                  No incidents logged yet.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
                  {accountabilityLogs.slice(0, 15).map((log) => (
                    <div key={log.id} className="text-xs p-2.5 rounded-xl bg-[#fbf9f4] border border-[#eee8dc] space-y-1">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-[#17201c]">{log.scoutName} ({log.grade})</span>
                        <span className={`px-1.5 py-0.2 rounded-md font-extrabold text-[10px] ${
                          log.pointsDelta < 0 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {log.pointsDelta > 0 ? `+${log.pointsDelta}` : log.pointsDelta} pts
                        </span>
                      </div>
                      <div className="text-[11px] text-[#66736c] leading-snug">{log.reason}</div>
                      {log.warningTriggered && (
                        <div className="text-[10px] font-bold text-[#991b1b] bg-[#fef2f2] p-1 rounded border border-[#fecaca] flex items-center gap-1">
                          <span>⚠️ Triggered:</span>
                          <span>{log.warningTriggered}</span>
                        </div>
                      )}
                      <div className="text-[9px] text-[#8a8f8c] flex items-center justify-between pt-0.5">
                        <span>Logged by @{log.loggedBy}</span>
                        <span>Date: {log.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </main>
        )}

        {/* TAB: STANDALONE OFFICIAL POINT SYSTEM & HOW TO TAKE POINTS GUIDE */}
        {activeTab === 'pointguide' && (
          <main className="p-4 space-y-3.5">
            {/* Screen Header */}
            <div className="scout-card p-3.5 space-y-2">
              <div className="flex items-center justify-between border-b border-[#f0ebe0] pb-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">⚖️</span>
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-[#17201c]">
                      Point System & Leader Guide
                    </h2>
                    <p className="text-[11px] text-[#66736c]">
                      Dhulfiqār Scouting Program • Official manual on how to evaluate & assign points
                    </p>
                  </div>
                </div>
                <span className="scout-pill-gold text-[10px] font-bold flex-shrink-0">
                  Official Policy
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center text-xs pt-1">
                <div className="p-2 bg-[#faf8f2] rounded-xl border border-[#ede8dc]">
                  <div className="text-[9.5px] font-bold text-[#8a6514]">SCALE</div>
                  <div className="font-extrabold text-[#123c2d] text-sm">0 to 10+</div>
                  <div className="text-[8.5px] text-[#66736c]">Cumulative Path</div>
                </div>
                <div className="p-2 bg-[#faf8f2] rounded-xl border border-[#ede8dc]">
                  <div className="text-[9.5px] font-bold text-[#8a6514]">TIERS</div>
                  <div className="font-extrabold text-[#123c2d] text-sm">6 Stages</div>
                  <div className="text-[8.5px] text-[#66736c]">Coaching → Removal</div>
                </div>
                <div className="p-2 bg-[#faf8f2] rounded-xl border border-[#ede8dc]">
                  <div className="text-[9.5px] font-bold text-[#8a6514]">GROWTH</div>
                  <div className="font-extrabold text-[#166534] text-sm">-1 Point</div>
                  <div className="text-[8.5px] text-[#66736c]">6 Clean Weeks</div>
                </div>
              </div>
            </div>

            {/* Section 1: The Exact Point Accumulation Path Reference (Matching Official Slides) */}
            <div className="scout-card space-y-3">
              <div className="flex items-center justify-between border-b border-[#f0ebe0] pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📜</span>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#17201c]">
                      POINT ACCUMULATION PATH REFERENCE
                    </h3>
                    <p className="text-[10px] text-[#66736c]">Official progression from behavior slides</p>
                  </div>
                </div>
                <span className="scout-pill text-[10px] font-bold">
                  Standard Path
                </span>
              </div>

              {/* Grid of 6 Warning Stages */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {WARNING_STAGES.map((ws) => (
                  <div
                    key={ws.stage}
                    className={`p-3 rounded-2xl border flex items-start gap-2.5 shadow-2xs transition hover:shadow-xs ${ws.badgeClass}`}
                  >
                    <span className="text-xl leading-none mt-0.5">{ws.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-extrabold flex items-center justify-between">
                        <span className="text-sm font-black">{ws.label}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white/80 border border-current/20">
                          {ws.pointRange}
                        </span>
                      </div>
                      <div className="text-[11px] font-medium leading-snug mt-1 opacity-95">
                        {ws.action}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Policy Overrides & Improvement (Bottom of Reference Card) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[#f0ebe0]">
                <div className="p-3 bg-[#f0f9f3] rounded-2xl border border-[#bbf7d0] space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-extrabold text-[#166534] flex items-center gap-1.5">
                      <span>🌟 Improvement Matters</span>
                    </div>
                    <span className="text-[10px] bg-[#dcfce7] text-[#166534] px-2 py-0.5 rounded-full font-extrabold border border-[#86efac]">
                      -1 Point
                    </span>
                  </div>
                  <p className="text-[10.5px] text-[#14532d] leading-relaxed">
                    6 consecutive program weeks without points + demonstrated improvement allows <strong>-1 point deduction</strong> (leader approval).
                  </p>
                </div>

                <div className="p-3 bg-[#fef2f2] rounded-2xl border border-[#fecaca] space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-extrabold text-[#991b1b] flex items-center gap-1.5">
                      <span>🚨 Misconduct Override</span>
                    </div>
                    <span className="text-[10px] bg-[#fee2e2] text-[#991b1b] px-2 py-0.5 rounded-full font-extrabold border border-[#fca5a5]">
                      Immediate Escalation
                    </span>
                  </div>
                  <p className="text-[10.5px] text-[#7f1d1d] leading-relaxed">
                    Severe misconduct (explicit content, violence, major safety violation) bypasses standard steps directly to <strong>Removal Review</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Interactive "How to Take Points" Infraction Catalog */}
            <div className="scout-card space-y-3">
              <div className="flex items-center justify-between border-b border-[#f0ebe0] pb-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#17201c]">
                    📖 Point Assignment Catalog & Presets
                  </h3>
                  <p className="text-[10px] text-[#66736c]">
                    Tap categories to find exact point amounts for any situation
                  </p>
                </div>
                <span className="scout-pill text-[10px] font-bold">
                  {INFRACTION_PRESETS.length} Rules
                </span>
              </div>

              {/* Category Filter Tabs */}
              <div className="tabs pb-1 flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setGuideCategoryTab('ALL')}
                  className={`tab text-[11px] py-1 px-2.5 ${guideCategoryTab === 'ALL' ? 'on' : ''}`}
                >
                  All Rules ({INFRACTION_PRESETS.length})
                </button>
                <button
                  type="button"
                  onClick={() => setGuideCategoryTab('BEHAVIOR')}
                  className={`tab text-[11px] py-1 px-2.5 ${guideCategoryTab === 'BEHAVIOR' ? 'on' : ''}`}
                >
                  🏃 Behavior (1–10 pts)
                </button>
                <button
                  type="button"
                  onClick={() => setGuideCategoryTab('DEVICES')}
                  className={`tab text-[11px] py-1 px-2.5 ${guideCategoryTab === 'DEVICES' ? 'on' : ''}`}
                >
                  📱 Devices (2–10 pts)
                </button>
                <button
                  type="button"
                  onClick={() => setGuideCategoryTab('ATTENDANCE')}
                  className={`tab text-[11px] py-1 px-2.5 ${guideCategoryTab === 'ATTENDANCE' ? 'on' : ''}`}
                >
                  ⏰ Attendance (0.5–2 pts)
                </button>
                <button
                  type="button"
                  onClick={() => setGuideCategoryTab('IMPROVEMENT')}
                  className={`tab text-[11px] py-1 px-2.5 ${guideCategoryTab === 'IMPROVEMENT' ? 'on' : ''}`}
                >
                  🌟 Growth (-1 pt)
                </button>
              </div>

              {/* Search Bar for rules */}
              <input
                type="text"
                placeholder="🔍 Search rule or infraction (e.g. phone, disruption, fighting, late)..."
                value={guideSearch}
                onChange={(e) => setGuideSearch(e.target.value)}
                className="w-full px-3 py-2 border border-[#ccc] rounded-xl text-xs bg-white focus:outline-none focus:border-[#123c2d]"
              />

              {/* List of Infractions */}
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {filteredGuidePresets.map((preset) => (
                  <div
                    key={preset.id}
                    className="p-3 rounded-xl border border-[#ded9cc] bg-white space-y-1.5 shadow-2xs hover:border-[#123c2d] transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md font-extrabold text-[11px] ${
                          preset.points < 0
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : preset.points >= 6
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : preset.points >= 3
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                        }`}>
                          {preset.points > 0 ? `+${preset.points} Pts` : `${preset.points} Pt`}
                        </span>
                        <span className="text-xs font-bold text-[#17201c]">
                          {preset.title}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f4eee0] text-[#8a6514] border border-[#e8ddc4] flex-shrink-0">
                        {preset.tier}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#66736c] leading-relaxed pl-1">
                      {preset.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 3: Interactive Point Simulator & Calculator */}
            <div className="scout-card space-y-3">
              <div className="flex items-center justify-between border-b border-[#f0ebe0] pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🧮</span>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#17201c]">
                      Interactive Point Simulator
                    </h3>
                    <p className="text-[10px] text-[#66736c]">
                      Test any point scenario to see warning escalation in real-time
                    </p>
                  </div>
                </div>
                <span className="scout-pill-gold text-[10px] font-bold">Simulator</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#17201c] block mb-1">
                    Current Scout Points: <strong>{simCurrentPoints} pts</strong> ({getScoutWarningStage(simCurrentPoints).label})
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="12"
                    step="0.5"
                    value={simCurrentPoints}
                    onChange={(e) => setSimCurrentPoints(parseFloat(e.target.value))}
                    className="w-full accent-[#123c2d] cursor-pointer"
                  />
                  <div className="flex justify-between text-[9.5px] text-[#8a8f8c] font-bold px-0.5">
                    <span>0 pts (Coaching)</span>
                    <span>3 pts (1st Warn)</span>
                    <span>5 pts (Parent)</span>
                    <span>7 pts (Prob)</span>
                    <span>10+ pts</span>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#17201c] block mb-1">
                    Select Infraction to Simulate:
                  </label>
                  <select
                    value={simSelectedPresetId}
                    onChange={(e) => setSimSelectedPresetId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#ccc] rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#123c2d]"
                  >
                    {INFRACTION_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.points > 0 ? `+${p.points}` : p.points} pts — {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Simulator Result Box */}
              {(() => {
                const selectedPreset = INFRACTION_PRESETS.find(p => p.id === simSelectedPresetId) || INFRACTION_PRESETS[0];
                const resultPoints = Math.max(0, simCurrentPoints + selectedPreset.points);
                const oldStage = getScoutWarningStage(simCurrentPoints);
                const newStage = getScoutWarningStage(resultPoints);
                const escalated = newStage.level > oldStage.level;

                return (
                  <div className={`p-3 rounded-xl border space-y-2 ${
                    escalated ? 'bg-[#fff5f5] border-[#fca5a5]' : 'bg-[#faf8f2] border-[#ede8dc]'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-[#17201c] flex items-center gap-2">
                        <span>{simCurrentPoints} pts ({oldStage.label})</span>
                        <span>➔</span>
                        <span className="text-sm font-black text-[#123c2d]">
                          {resultPoints} pts ({newStage.label})
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${newStage.badgeClass}`}>
                        {newStage.icon} {newStage.label}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#66736c] space-y-1">
                      <div><strong>Action Required:</strong> {newStage.action}</div>
                      {escalated && (
                        <div className="text-[#991b1b] font-bold text-[10.5px]">
                          ⚠️ Warning level increased from Level {oldStage.level} ({oldStage.label}) to Level {newStage.level} ({newStage.label})!
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Section 4: Leader Code of Conduct & Best Practices */}
            <div className="scout-card p-3 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#17201c]">
                🛡️ Leader Principles & Protocol
              </h3>
              <div className="text-xs text-[#66736c] space-y-1.5 pl-1 leading-relaxed">
                <div>• <strong>Counsel First:</strong> The goal of Dhulfiqār scouting is growth, character building, and Islamic discipline.</div>
                <div>• <strong>Objective Logging:</strong> State specific observable actions in notes, avoiding vague language.</div>
                <div>• <strong>Partner with Parents:</strong> At 5 points (Parent Conference), immediately coordinate with the family for positive reinforcement.</div>
                <div>• <strong>Acknowledge Improvement:</strong> Consistently award -1 point after 6 clean weeks to reward perseverance.</div>
              </div>
            </div>
          </main>
        )}

        {/* TAB 4: PATROL ROSTER */}
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
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleExportPatrolExcel(selectedGrade !== 'All Grades' ? selectedGrade : undefined)}
                    disabled={isExportingExcel}
                    className="scout-btn-outline text-xs py-1 px-2 flex items-center gap-1 shadow-xs cursor-pointer text-[#123c2d]"
                    title="Download live patrol progress and attendance report (.xlsx)"
                  >
                    <span>📊</span> Export
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleOpenAddScout(selectedGrade)}
                      className="scout-btn-primary text-xs py-1 px-2 flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <span>➕</span> Add Scout
                    </button>
                  )}
                  <span className="scout-pill text-[11px] font-bold">
                    {filteredScouts.length} Scouts
                  </span>
                </div>
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
              {filteredScouts.map((scout) => {
                const pts = scout.points ?? 0;
                const stage = getScoutWarningStage(pts);

                return (
                  <div key={scout.id} className="scout-card p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="scout-avatar flex-shrink-0">
                        {scout.scoutIdNumber}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#17201c] truncate">{scout.fullName}</div>
                        <div className="text-[11px] text-[#66736c]">{scout.grade} • Qaid: {scout.leader || 'Unassigned'}</div>
                        {scout.asstLeader && (
                          <div className="text-[10px] text-[#8a8f8c]">Asst: {scout.asstLeader}</div>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end gap-1 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${stage.badgeClass}`}>
                          {stage.icon} {pts} pts • {stage.label}
                        </span>
                        {isAdmin && (
                          <div className="flex items-center gap-1 ml-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditScout(scout);
                              }}
                              className="w-6 h-6 rounded-md bg-[#edf3ef] hover:bg-[#d8e8dc] text-[#123c2d] grid place-items-center text-[10px] font-bold border border-[#d2e8db] cursor-pointer"
                              title="Edit / Move Scout"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveScout(scout);
                              }}
                              className="w-6 h-6 rounded-md bg-[#fdf2f2] hover:bg-[#fee2e2] text-[#991b1b] grid place-items-center text-[10px] font-bold border border-[#fecaca] cursor-pointer"
                              title="Remove Scout from Roster"
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        scout.unexcusedAbsences >= 3
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {scout.unexcusedAbsences} Absences
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </main>
        )}

        {/* TAB 4: SCHEDULE */}
        {activeTab === 'schedule' && (
          <main className="p-4 space-y-3">
            <div className="scout-card p-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#17201c]">2026-2027 Program & Test Sessions</h2>
                  <p className="text-[11px] text-[#66736c]">Fridays 6:30 PM – 9:00 PM • Future attendance locked until session date</p>
                </div>
                <span className="scout-pill-gold text-[11px] font-bold">
                  {FRIDAY_SESSIONS.length} Sessions
                </span>
              </div>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {FRIDAY_SESSIONS.map((session, idx) => {
                const isFuture = session.date > todayDateStr;
                const isTestDay = session.date === '2026-09-25' || session.date === '2026-09-28';
                const isSelected = session.date === selectedDate;

                return (
                  <div
                    key={idx}
                    className={`scout-card p-3 flex items-center justify-between gap-2 transition ${
                      isSelected ? 'border-[#123c2d] ring-1 ring-[#123c2d] bg-[#fbf9f4]' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-[#17201c]">
                          📅 {session.date}
                        </span>
                        {isTestDay ? (
                          <span className="scout-pill text-[9.5px] px-1.5 py-0 bg-purple-100 text-purple-900 border border-purple-300 font-extrabold">
                            🧪 Test Sandbox
                          </span>
                        ) : session.isProgram ? (
                          isFuture ? (
                            <span className="scout-pill text-[9.5px] px-1.5 py-0 bg-[#fffbeb] text-[#854d0e] border border-[#fef08a]">
                              🔒 Future (Locked)
                            </span>
                          ) : (
                            <span className="scout-pill text-[9.5px] px-1.5 py-0 bg-emerald-100 text-emerald-800 border border-emerald-200">
                              🟢 Active Program
                            </span>
                          )
                        ) : session.isNoProgram ? (
                          <span className="scout-pill-alert text-[9.5px] px-1.5 py-0">🔴 No Session</span>
                        ) : (
                          <span className="scout-pill-gold text-[9.5px] px-1.5 py-0">🟡 Special</span>
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
                      className={`text-[11px] py-1.5 px-2.5 rounded-xl font-bold flex-shrink-0 cursor-pointer transition ${
                        isFuture
                          ? 'bg-[#ece9df] text-[#66736c] hover:bg-[#ded9cc] border border-[#ccc]'
                          : 'scout-btn-primary'
                      }`}
                    >
                      {isFuture ? '🔒 View Roster' : 'Take Attendance →'}
                    </button>
                  </div>
                );
              })}
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

            {/* Password Management Card */}
            <div className="scout-card space-y-3">
              <div className="flex items-center justify-between border-b border-[#f0ebe0] pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔐</span>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#17201c]">
                      Change Account Password
                    </h3>
                    <p className="text-[10px] text-[#66736c]">Set a personalized password for @{leaderProfile?.username}</p>
                  </div>
                </div>
                {leaderProfile && hasCustomPassword(leaderProfile.username) && (
                  <span className="text-[9.5px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    ✨ Custom Active
                  </span>
                )}
              </div>

              {passChangeStatus && (
                <div className={`p-2.5 rounded-xl text-xs font-bold ${
                  passChangeStatus.type === 'success'
                    ? 'bg-[#edf7ee] border border-[#bbf7d0] text-[#166534]'
                    : 'bg-[#fff5f5] border border-[#fecaca] text-[#991b1b]'
                }`}>
                  {passChangeStatus.type === 'success' ? '✅ ' : '⚠️ '}
                  {passChangeStatus.message}
                </div>
              )}

              <form onSubmit={handleChangeLeaderPassword} className="space-y-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-[#17201c] mb-0.5">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassInput}
                    onChange={(e) => setCurrentPassInput(e.target.value)}
                    placeholder="Enter current password (default: scouts2026)"
                    className="w-full px-3 py-2 bg-white border border-[#ccc] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#123c2d]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-[#17201c] mb-0.5">
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={newPassInput}
                      onChange={(e) => setNewPassInput(e.target.value)}
                      placeholder="Min 4 characters"
                      className="w-full px-3 py-2 bg-white border border-[#ccc] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#123c2d]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#17201c] mb-0.5">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassInput}
                      onChange={(e) => setConfirmPassInput(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full px-3 py-2 bg-white border border-[#ccc] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#123c2d]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    className="scout-btn-primary flex-1 text-xs py-2 cursor-pointer shadow-xs"
                  >
                    💾 Save New Password
                  </button>
                  {leaderProfile && hasCustomPassword(leaderProfile.username) && (
                    <button
                      type="button"
                      onClick={handleResetCurrentPassword}
                      className="scout-btn-outline text-xs py-2 px-3 text-[#991b1b] border-[#fecaca] hover:bg-[#fff5f5] cursor-pointer"
                      title="Reset to default password: scouts2026"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Database State & Backup Center (Admin & Troop Leader Only) */}
            {isAdmin && (
              <div className="scout-card space-y-3">
                <div className="flex items-center justify-between border-b border-[#f0ebe0] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">💾</span>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#17201c]">
                        Database State & Backup Center
                      </h3>
                      <p className="text-[10px] text-[#66736c]">All roster edits, ṭalāʾiʿ names & points auto-saved</p>
                    </div>
                  </div>
                  <span className="scout-pill text-[10px] font-bold">
                    {scouts.length} Scouts Saved
                  </span>
                </div>

                <div className="p-2.5 bg-[#f5f9f6] border border-[#d2e8db] rounded-xl space-y-1.5 text-xs text-[#123c2d]">
                  <div className="flex items-center justify-between">
                    <span>🟢 Active Database Cache:</span>
                    <strong>{scouts.length} Registered Scouts</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>🛡️ Accountability Logs:</span>
                    <strong>{accountabilityLogs.length} Records</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>📱 Offline Persistence:</span>
                    <strong className="text-emerald-700">Active (Auto-Saved)</strong>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={handleExportDatabaseJson}
                    className="w-full py-2.5 bg-[#123c2d] hover:bg-[#0e2f23] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    <span>📥</span> Download Full Database Backup (.JSON)
                  </button>

                  <label className="w-full py-2 bg-white hover:bg-[#faf8f2] text-[#123c2d] border border-[#123c2d] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition">
                    <span>📤</span> Restore Database from Backup (.JSON)
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportDatabaseJson}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Live Patrol Progress & Attendance Report (Available to ALL Leaders & Admin) */}
            <div className="scout-card space-y-3">
              <div className="flex items-center justify-between border-b border-[#f0ebe0] pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📊</span>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#17201c]">
                      Live Patrol Progress & Attendance
                    </h3>
                    <p className="text-[10px] text-[#66736c]">
                      Download real-time patrol records, attendance matrix & behavior points as of right now
                    </p>
                  </div>
                </div>
                <span className="scout-pill text-[10px] font-bold">
                  Live Snapshot
                </span>
              </div>

              {/* Admin / Troop Leader Patrol Scope Selector */}
              {isAdmin && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#17201c] flex items-center justify-between">
                    <span>Choose Export Scope:</span>
                    <span className="text-[10px] text-[#8a6514] font-normal">
                      {exportGradeSelection === 'All Units' ? 'Full Troop Master' : 'Single Patrol'}
                    </span>
                  </label>
                  <select
                    value={exportGradeSelection}
                    onChange={(e) => setExportGradeSelection(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#ccc] rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#123c2d]"
                  >
                    <option value="All Units">🌟 All Units Master Report (124 Scouts / 11 Ṭalāʾiʿ)</option>
                    {ALL_GRADES.map((g) => {
                      const t = getTaliahForGrade(g, customTaliahNames);
                      return (
                        <option key={g} value={g}>
                          {g} — {t.taliahName} ({t.taliahRank})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Live Snapshot Details Box */}
              <div className="p-2.5 bg-[#f5f9f6] border border-[#d2e8db] rounded-xl space-y-1.5 text-xs text-[#123c2d]">
                <div className="flex items-center justify-between">
                  <span>Selected Patrol:</span>
                  <strong className="text-[#8a6514] font-bold">
                    {isAdmin
                      ? (exportGradeSelection === 'All Units' ? 'All Ṭalāʾiʿ (Full Troop)' : exportGradeSelection)
                      : `${assignedGradeName} ${userUnitTaliah ? `(${userUnitTaliah.taliahName})` : ''}`
                    }
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Scouts in Report:</span>
                  <strong>
                    {isAdmin
                      ? (exportGradeSelection === 'All Units' ? scouts.length : scouts.filter(s => s.grade === exportGradeSelection).length)
                      : scouts.filter(s => s.grade === leaderProfile?.assignedGrade).length
                    } Registered Scouts
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Attendance Sessions:</span>
                  <strong>{FRIDAY_SESSIONS.length} Friday Program Matrix</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Incident Log History:</span>
                  <strong>
                    {isAdmin && exportGradeSelection === 'All Units'
                      ? accountabilityLogs.length
                      : accountabilityLogs.filter(l => {
                          const targetG = isAdmin ? exportGradeSelection : leaderProfile?.assignedGrade;
                          const s = scouts.find(sc => sc.id === l.scoutId);
                          return s?.grade === targetG || l.grade === targetG;
                        }).length
                    } Recorded Incidents
                  </strong>
                </div>
              </div>

              {/* Action Buttons: Multi-sheet XLSX & CSV */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleExportPatrolExcel()}
                  disabled={isExportingExcel}
                  className="scout-btn-primary text-xs text-center py-2.5 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <span>📊</span> {isExportingExcel ? 'Generating...' : 'Download .XLSX'}
                </button>
                <button
                  type="button"
                  onClick={() => handleExportPatrolCsv()}
                  className="scout-btn-outline text-xs text-center py-2.5 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>📑</span> Download .CSV
                </button>
              </div>

              <div className="p-2 bg-[#fdfaf2] rounded-lg border border-[#e8ddc4] text-[10.5px] text-[#8a6514] space-y-0.5">
                <div className="font-bold flex items-center gap-1">
                  <span>💡</span> Excel (.XLSX) Workbook includes 3 styled sheets:
                </div>
                <div className="pl-4 list-disc text-[10px] text-[#66736c]">
                  • <strong>Patrol Progress & Points:</strong> Scout IDs, warning stages, and penalty points.<br/>
                  • <strong>Session Attendance Matrix:</strong> Complete Friday-by-Friday matrix with rates.<br/>
                  • <strong>Incident & Duty Logs:</strong> Full audit ledger with timestamps & notes.
                </div>
              </div>
            </div>

            {/* Static Credentials & Default Logins (Admin Only) */}
            {isAdmin && (
              <div className="scout-card space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#17201c]">Static Leader Credentials Spreadsheets</h3>
                <p className="text-[11px] text-[#66736c]">Download default leader credentials and account roster</p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a
                    href="/Dhulfiqar_Scouts_Leader_Logins.xlsx"
                    download="Dhulfiqar_Scouts_Leader_Logins.xlsx"
                    className="scout-btn-outline text-xs text-center py-2 no-underline text-[#123c2d]"
                  >
                    📊 Master Logins .XLSX
                  </a>
                  <a
                    href="/Dhulfiqar_Scouts_Leader_Logins.csv"
                    download="Dhulfiqar_Scouts_Leader_Logins.csv"
                    className="scout-btn-outline text-xs text-center py-2 no-underline text-[#123c2d]"
                  >
                    📑 Master Logins .CSV
                  </a>
                </div>
              </div>
            )}

            {/* Admin Controls (Admin & Troop Leader Only) */}
            {isAdmin && (
              <div className="scout-card space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#17201c]">👑 Admin Management Tools</h3>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => handleOpenAddScout('Kindergarten')}
                    className="w-full py-2.5 bg-[#123c2d] hover:bg-[#0e2f23] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <span>➕</span> Add New Scout to Any Unit
                  </button>

                  {isFirebaseConfigured && (
                    <button
                      type="button"
                      onClick={handleSeedFullRoster}
                      disabled={seeding}
                      className="w-full py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                    >
                      {seeding ? 'Importing...' : 'Load Full 124 Scouts into Firebase Database'}
                    </button>
                  )}
                </div>
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
            onClick={() => setActiveTab('pointguide')}
            className={`scout-nav-item ${activeTab === 'pointguide' ? 'on' : ''}`}
          >
            <span className="nav-icon text-lg">⚖️</span>
            <span>Guide</span>
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

        {/* Official Dhulfiqār Accountability & Incident Logging Modal */}
        {accountabilityModalScout && (() => {
          const currentPts = accountabilityModalScout.points ?? 0;
          const selectedItems = INFRACTION_PRESETS.filter((p) => selectedInfractionIds.includes(p.id));
          let presetsDelta = selectedItems.reduce((acc, curr) => acc + curr.points, 0);
          if (misconductOverride) {
            presetsDelta += 10;
          }
          const totalDelta = presetsDelta + customPointsInput;
          const newPoints = Math.max(0, currentPts + totalDelta);

          const oldStage = getScoutWarningStage(currentPts);
          const newStage = getScoutWarningStage(newPoints);
          const isEscalating = newStage.level > oldStage.level && newStage.level >= 1;

          const filteredPresets = accountabilityTab === 'ALL'
            ? INFRACTION_PRESETS
            : INFRACTION_PRESETS.filter((p) => p.category === accountabilityTab);

          return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 animate-fade-in">
              <div className="bg-[#f7f2e7] w-full max-w-[460px] rounded-3xl border border-[#ded9cc] p-4 sm:p-5 shadow-2xl space-y-3.5 max-h-[92vh] overflow-y-auto">
                
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-[#ded9cc] pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="scout-avatar">
                      {accountabilityModalScout.scoutIdNumber}
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-[#17201c]">{accountabilityModalScout.fullName}</h3>
                      <div className="text-[11px] text-[#66736c]">
                        {accountabilityModalScout.grade} • Qaid: {accountabilityModalScout.leader || 'Assigned'}
                      </div>
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

                {/* Live Points & Warning Tier Progression Bar */}
                <div className="p-3 bg-white rounded-2xl border border-[#ded9cc] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <div className="text-[10px] font-bold uppercase text-[#66736c]">Current Points</div>
                      <div className="font-extrabold text-[#123c2d] flex items-center gap-1.5 mt-0.5">
                        <span className="text-lg">{currentPts} pts</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9.5px] border ${oldStage.badgeClass}`}>
                          {oldStage.icon} {oldStage.label}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase text-[#66736c]">Projected Total</div>
                      <div className="font-extrabold flex items-center justify-end gap-1.5 mt-0.5">
                        <span className={`text-lg ${newPoints >= 3 ? 'text-[#991b1b]' : 'text-[#123c2d]'}`}>
                          {newPoints} pts
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9.5px] border ${newStage.badgeClass}`}>
                          {newStage.icon} {newStage.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Warning Escalation Notification */}
                  {isEscalating && (
                    <div className="p-2.5 bg-[#fef2f2] rounded-xl border border-[#fecaca] text-xs text-[#991b1b] space-y-0.5">
                      <div className="font-bold flex items-center gap-1">
                        <span>⚠️ Escalates to {newStage.label} ({newStage.pointRange})!</span>
                      </div>
                      <div className="text-[11px] text-[#7f1d1d]">
                        <strong>Required Action:</strong> {newStage.action}
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] text-[#66736c] flex items-center justify-between pt-1 border-t border-[#f0ebe0]">
                    <span>Session: <strong>{selectedDate}</strong></span>
                    <span className="font-bold text-[#123c2d]">
                      Incident Delta: {totalDelta > 0 ? `+${totalDelta}` : totalDelta} pts
                    </span>
                  </div>
                </div>

                {/* Infraction Category Selector Tabs */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#66736c] flex items-center justify-between">
                    <span>Select Slide Infractions</span>
                    <span className="text-[10px] text-[#123c2d] font-semibold">{selectedInfractionIds.length} Selected</span>
                  </label>

                  <div className="flex gap-1 overflow-x-auto pb-1 text-[10.5px]">
                    <button
                      type="button"
                      onClick={() => setAccountabilityTab('ALL')}
                      className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap cursor-pointer transition ${
                        accountabilityTab === 'ALL'
                          ? 'bg-[#123c2d] text-white shadow-xs'
                          : 'bg-white text-[#66736c] border border-[#ded9cc] hover:bg-[#faf8f2]'
                      }`}
                    >
                      All ({INFRACTION_PRESETS.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountabilityTab('BEHAVIOR')}
                      className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap cursor-pointer transition ${
                        accountabilityTab === 'BEHAVIOR'
                          ? 'bg-[#123c2d] text-white shadow-xs'
                          : 'bg-white text-[#66736c] border border-[#ded9cc] hover:bg-[#faf8f2]'
                      }`}
                    >
                      Behavior
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountabilityTab('DEVICES')}
                      className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap cursor-pointer transition ${
                        accountabilityTab === 'DEVICES'
                          ? 'bg-[#123c2d] text-white shadow-xs'
                          : 'bg-white text-[#66736c] border border-[#ded9cc] hover:bg-[#faf8f2]'
                      }`}
                    >
                      Devices & Content
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountabilityTab('ATTENDANCE')}
                      className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap cursor-pointer transition ${
                        accountabilityTab === 'ATTENDANCE'
                          ? 'bg-[#123c2d] text-white shadow-xs'
                          : 'bg-white text-[#66736c] border border-[#ded9cc] hover:bg-[#faf8f2]'
                      }`}
                    >
                      Attendance
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountabilityTab('IMPROVEMENT')}
                      className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap cursor-pointer transition ${
                        accountabilityTab === 'IMPROVEMENT'
                          ? 'bg-[#123c2d] text-white shadow-xs'
                          : 'bg-white text-[#66736c] border border-[#ded9cc] hover:bg-[#faf8f2]'
                      }`}
                    >
                      Growth (-1 pt)
                    </button>
                  </div>
                </div>

                {/* Infraction Preset Cards List */}
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {filteredPresets.map((preset) => {
                    const isSelected = selectedInfractionIds.includes(preset.id);
                    return (
                      <div
                        key={preset.id}
                        onClick={() => handleToggleInfraction(preset.id)}
                        className={`p-2 rounded-xl border transition cursor-pointer flex items-start gap-2 ${
                          isSelected
                            ? preset.points < 0
                              ? 'bg-[#f0f9f3] border-[#166534] ring-1 ring-[#166534]'
                              : 'bg-[#fff5f5] border-[#dc2626] ring-1 ring-[#dc2626]'
                            : 'bg-white border-[#ded9cc] hover:bg-[#faf8f2]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="mt-0.5 w-4 h-4 text-[#123c2d] rounded cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-[#17201c]">{preset.title}</span>
                            <span className={`px-1.5 py-0.2 rounded-md font-extrabold text-[10px] flex-shrink-0 ${
                              preset.points < 0
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : preset.points >= 6
                                ? 'bg-rose-900 text-white'
                                : preset.points >= 3
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}>
                              {preset.points > 0 ? `+${preset.points}` : preset.points} pts
                            </span>
                          </div>
                          <p className="text-[10px] text-[#66736c] leading-tight mt-0.5">
                            {preset.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Misconduct Override & Custom Points */}
                <div className="space-y-2 pt-1 border-t border-[#ded9cc]">
                  <label className="flex items-center justify-between p-2.5 bg-[#fef2f2] rounded-xl border border-[#fecaca] cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🚨</span>
                      <div>
                        <div className="text-xs font-bold text-[#991b1b]">Major Misconduct Override</div>
                        <div className="text-[9.5px] text-[#7f1d1d]">Direct escalation to Removal Review (+10 pts)</div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={misconductOverride}
                      onChange={(e) => setMisconductOverride(e.target.checked)}
                      className="w-4 h-4 text-rose-600 rounded cursor-pointer"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10.5px] font-bold text-[#66736c]">Custom Point Delta (+ / -)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={customPointsInput}
                        onChange={(e) => setCustomPointsInput(parseFloat(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 bg-white border border-[#ccc] rounded-xl text-xs font-bold text-[#123c2d] focus:outline-none focus:border-[#123c2d]"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-[10.5px] font-bold text-[#66736c]">Incident Notes</label>
                      <input
                        type="text"
                        value={accountabilityNote}
                        onChange={(e) => setAccountabilityNote(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-[#ccc] rounded-xl text-xs focus:outline-none focus:border-[#123c2d]"
                        placeholder="Optional details..."
                      />
                    </div>
                  </div>
                </div>

                {/* Modal Footer Buttons */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setAccountabilityModalScout(null)}
                    className="flex-1 py-2.5 scout-btn-outline text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAccountability}
                    className="flex-1 py-2.5 scout-btn-primary text-xs font-bold shadow-md cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>💾</span> Save ({totalDelta >= 0 ? `+${totalDelta}` : totalDelta} pts) →
                  </button>
                </div>

              </div>
            </div>
          );
        })()}

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

        {/* Add New Scout Modal (Admin Only) */}
        {isAddScoutModalOpen && isAdmin && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 animate-fade-in">
            <div className="bg-[#f7f2e7] w-full max-w-[420px] rounded-3xl border border-[#ded9cc] p-4 sm:p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#ded9cc] pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">➕</span>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#17201c]">
                      Add Scout to Troop
                    </h3>
                    <div className="text-[11px] text-[#66736c]">
                      Admin Access • Enter scout details & assign unit
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddScoutModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-[#ded9cc] hover:bg-[#ccc5b6] text-slate-700 font-bold grid place-items-center text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveNewScout} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[#17201c] mb-1">
                    Scout Full Name <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newScoutFullName}
                    onChange={(e) => setNewScoutFullName(e.target.value)}
                    placeholder="e.g. Ali Reza Chamseddine"
                    className="w-full px-3 py-2 bg-white border border-[#ccc] rounded-xl text-xs font-bold text-[#123c2d] focus:outline-none focus:ring-2 focus:ring-[#123c2d]"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#17201c] mb-1">
                    Grade / Patrol Unit
                  </label>
                  <select
                    value={newScoutGrade}
                    onChange={(e) => handleGradeChangeForNewScout(e.target.value)}
                    className="w-full text-xs font-bold text-[#123c2d] bg-white border border-[#ccc5b6] rounded-xl p-2.5 focus:ring-2 focus:ring-[#123c2d] outline-none cursor-pointer"
                  >
                    {ALL_GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g} ({TALIAH_REGISTRY[g]?.taliahRank})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-[#17201c] mb-0.5">
                      Assigned Qaid (Leader)
                    </label>
                    <input
                      type="text"
                      value={newScoutLeader}
                      onChange={(e) => setNewScoutLeader(e.target.value)}
                      placeholder="Leader name"
                      className="w-full px-2.5 py-1.5 bg-white border border-[#ccc] rounded-xl text-xs text-[#66736c]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#17201c] mb-0.5">
                      Assistant Qaid
                    </label>
                    <input
                      type="text"
                      value={newScoutAsstLeader}
                      onChange={(e) => setNewScoutAsstLeader(e.target.value)}
                      placeholder="Optional"
                      className="w-full px-2.5 py-1.5 bg-white border border-[#ccc] rounded-xl text-xs text-[#66736c]"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddScoutModalOpen(false)}
                    className="flex-1 py-2.5 scout-btn-outline text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 scout-btn-primary text-xs font-bold shadow-md cursor-pointer"
                  >
                    ➕ Add Scout
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit / Move Scout Modal (Admin Only) */}
        {editingScout && isAdmin && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 animate-fade-in">
            <div className="bg-[#f7f2e7] w-full max-w-[420px] rounded-3xl border border-[#ded9cc] p-4 sm:p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#ded9cc] pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">✏️</span>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#17201c]">
                      Edit Scout & Unit Assignment
                    </h3>
                    <div className="text-[11px] text-[#66736c]">
                      Scout #{editingScout.scoutIdNumber} • Reassign or edit details
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingScout(null)}
                  className="w-7 h-7 rounded-full bg-[#ded9cc] hover:bg-[#ccc5b6] text-slate-700 font-bold grid place-items-center text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveEditScout} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[#17201c] mb-1">
                    Scout Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#ccc] rounded-xl text-xs font-bold text-[#123c2d] focus:outline-none focus:ring-2 focus:ring-[#123c2d]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#17201c] mb-1">
                    Assigned Unit / Grade
                  </label>
                  <select
                    value={editGrade}
                    onChange={(e) => {
                      const newG = e.target.value;
                      setEditGrade(newG);
                      const leaderInfo = getLeaderForGrade(newG);
                      setEditLeader(leaderInfo.leader);
                      setEditAsstLeader(leaderInfo.asstLeader);
                    }}
                    className="w-full text-xs font-bold text-[#123c2d] bg-white border border-[#ccc5b6] rounded-xl p-2.5 focus:ring-2 focus:ring-[#123c2d] outline-none cursor-pointer"
                  >
                    {ALL_GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g} ({TALIAH_REGISTRY[g]?.taliahRank})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-[#17201c] mb-0.5">
                      Qaid (Leader)
                    </label>
                    <input
                      type="text"
                      value={editLeader}
                      onChange={(e) => setEditLeader(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#ccc] rounded-xl text-xs text-[#66736c]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#17201c] mb-0.5">
                      Assistant Qaid
                    </label>
                    <input
                      type="text"
                      value={editAsstLeader}
                      onChange={(e) => setEditAsstLeader(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#ccc] rounded-xl text-xs text-[#66736c]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-[#ded9cc]">
                  <label className="text-xs font-bold text-[#17201c]">
                    Current Accountability Points:
                  </label>
                  <input
                    type="number"
                    value={editPoints}
                    onChange={(e) => setEditPoints(parseInt(e.target.value) || 0)}
                    className="w-20 px-2 py-1 border border-[#ccc] rounded-lg text-xs font-bold text-center text-[#123c2d]"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleRemoveScout(editingScout)}
                    className="px-3 py-2.5 bg-rose-50 border border-rose-200 text-rose-800 hover:bg-rose-100 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    🗑️ Remove
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingScout(null)}
                    className="flex-1 py-2.5 scout-btn-outline text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 scout-btn-primary text-xs font-bold shadow-md cursor-pointer"
                  >
                    💾 Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}