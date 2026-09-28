// src/utils/exportReport.ts
import ExcelJS from 'exceljs';
import type { Scout, AccountabilityLog } from '../data/roster';
import type { FridaySession } from '../data/schedule';
import type { LeaderProfile } from '../config/leaderRoles';
import { getTaliahForGrade } from '../config/taliahConfig';
import { getScoutWarningStage } from '../config/accountabilityConfig';

export interface ExportReportOptions {
  scouts: Scout[];
  allSessions: FridaySession[];
  customTaliahNames: Record<string, string>;
  leaderProfile?: LeaderProfile;
  accountabilityLogs: AccountabilityLog[];
  selectedGrade: string; // e.g. "Kindergarten", "All Units", "All Grades"
  currentSessionDate?: string;
  currentSessionAttendance?: Record<string, 'PRESENT' | 'ABSENT' | 'EXCUSED'>;
}

// Helper to gather all attendance across all sessions from localStorage and current state
export function gatherAllAttendanceRecords(
  allSessions: FridaySession[],
  currentSessionDate?: string,
  currentSessionAttendance?: Record<string, 'PRESENT' | 'ABSENT' | 'EXCUSED'>
): Record<string, Record<string, 'PRESENT' | 'ABSENT' | 'EXCUSED'>> {
  const result: Record<string, Record<string, 'PRESENT' | 'ABSENT' | 'EXCUSED'>> = {};

  for (const session of allSessions) {
    let sessionMap: Record<string, 'PRESENT' | 'ABSENT' | 'EXCUSED'> = {};

    // Check if it's the active session currently in memory
    if (currentSessionDate && session.date === currentSessionDate && currentSessionAttendance) {
      sessionMap = { ...currentSessionAttendance };
    } else {
      // Load from localStorage
      const saved = localStorage.getItem(`attendance_${session.date}`);
      if (saved) {
        try {
          sessionMap = JSON.parse(saved);
        } catch (e) {
          console.error(`Failed to parse attendance for ${session.date}`, e);
        }
      }
    }
    result[session.date] = sessionMap;
  }

  return result;
}

// Helper to sanitize file names
function sanitizeForFileName(str: string): string {
  return str.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
}

/**
 * Generates and downloads a rich, multi-sheet Excel (.XLSX) workbook for the patrol/troop.
 */
export async function downloadLivePatrolExcel(options: ExportReportOptions): Promise<void> {
  const {
    scouts,
    allSessions,
    customTaliahNames,
    leaderProfile,
    accountabilityLogs,
    selectedGrade,
    currentSessionDate,
    currentSessionAttendance
  } = options;

  const now = new Date();
  const formattedTimestamp = now.toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'medium'
  });
  const fileDateStr = now.toISOString().slice(0, 10);
  const fileTimeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

  const isAll = selectedGrade === 'All Grades' || selectedGrade === 'All Units' || !selectedGrade;
  const taliahInfo = !isAll ? getTaliahForGrade(selectedGrade, customTaliahNames) : null;
  const patrolTitle = isAll
    ? 'All Ṭalāʾiʿ — Full Troop'
    : `${selectedGrade} — ${taliahInfo?.taliahName || ''}`;

  const allAttendance = gatherAllAttendanceRecords(allSessions, currentSessionDate, currentSessionAttendance);

  // Filter accountability logs for relevant scouts
  const scoutIdSet = new Set(scouts.map(s => s.id));
  const relevantLogs = accountabilityLogs.filter(log => scoutIdSet.has(log.scoutId));

  // Initialize ExcelJS Workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Dhulfiqār Scout Tracker';
  workbook.lastModifiedBy = leaderProfile?.name || 'Dhulfiqār Leader';
  workbook.created = now;
  workbook.modified = now;

  // Colors
  const FOREST_GREEN = 'FF123C2D';
  const GOLD = 'FFB99645';
  const CREAM = 'FFF7F2E7';
  const WHITE = 'FFFFFFFF';
  const DARK_GRAY = 'FF333333';
  const LIGHT_BORDER = 'FFDED9CC';

  // -------------------------------------------------------------
  // SHEET 1: Patrol Overview & Infraction Points
  // -------------------------------------------------------------
  const wsProgress = workbook.addWorksheet('Patrol Progress & Points', {
    views: [{ showGridLines: true }]
  });

  // Header banner
  wsProgress.mergeCells('A1:N1');
  const headerCell = wsProgress.getCell('A1');
  headerCell.value = '⚔️ DHULFIQĀR SCOUTING PROGRAM — PATROL PROGRESS & ACCOUNTABILITY';
  headerCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: WHITE } };
  headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FOREST_GREEN } };
  headerCell.alignment = { vertical: 'middle', horizontal: 'center' };
  wsProgress.getRow(1).height = 30;

  // Metadata rows
  wsProgress.mergeCells('A2:N2');
  const subCell = wsProgress.getCell('A2');
  subCell.value = `Patrol / Unit: ${patrolTitle}  |  Unit Leader: ${leaderProfile?.name || 'Assigned Leader'} (@${leaderProfile?.username || 'leader'})`;
  subCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: FOREST_GREEN } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREAM } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  wsProgress.getRow(2).height = 20;

  wsProgress.mergeCells('A3:N3');
  const metaCell = wsProgress.getCell('A3');
  metaCell.value = `Live Download Timestamp: ${formattedTimestamp}  |  Active Scouts in Report: ${scouts.length}  |  Incident Records: ${relevantLogs.length}`;
  metaCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: DARK_GRAY } };
  metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREAM } };
  metaCell.alignment = { vertical: 'middle', horizontal: 'center' };
  wsProgress.getRow(3).height = 18;

  wsProgress.addRow([]); // Blank spacer row 4

  // Table Column Headers (Row 5)
  const progressHeaders = [
    'Scout #',
    'Full Name',
    'First Name',
    'Last Name',
    'Grade / Rank',
    'Ṭalīʿah Name',
    'Assigned Leader',
    'Infraction Points',
    'Active Warning Stage',
    'Required Action / Policy',
    'Unexcused Absences',
    'Uniform Score (%)',
    'Punctuality (%)',
    'Active Status'
  ];

  const headerRow5 = wsProgress.addRow(progressHeaders);
  headerRow5.height = 24;
  headerRow5.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FOREST_GREEN } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: GOLD } },
      bottom: { style: 'medium', color: { argb: GOLD } },
      left: { style: 'thin', color: { argb: LIGHT_BORDER } },
      right: { style: 'thin', color: { argb: LIGHT_BORDER } }
    };
  });

  // Populate Scout Data Rows
  scouts.forEach((scout, idx) => {
    const pts = scout.points ?? 0;
    const stage = getScoutWarningStage(pts);
    const taliah = getTaliahForGrade(scout.grade, customTaliahNames);

    const row = wsProgress.addRow([
      scout.scoutIdNumber ? `#${String(scout.scoutIdNumber).padStart(3, '0')}` : `#${idx + 1}`,
      scout.fullName,
      scout.firstName || '',
      scout.lastName || '',
      scout.grade,
      taliah.taliahName,
      scout.leader || leaderProfile?.name || '',
      pts,
      `${stage.icon} ${stage.label}`,
      stage.action,
      scout.unexcusedAbsences ?? 0,
      `${scout.uniformScore ?? 100}%`,
      `${scout.punctualityScore ?? 100}%`,
      scout.isActive ? 'Active' : 'Inactive'
    ]);

    row.height = 20;

    // Apply conditional styling based on warning stage
    const rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF9F8F5';
    let warningBg = 'FFF0F7F3';
    let warningFg = 'FF123C2D';

    if (pts >= 10) {
      warningBg = 'FF450A0A';
      warningFg = 'FFFFFFFF';
    } else if (pts >= 9) {
      warningBg = 'FFFECACA';
      warningFg = 'FF991B1B';
    } else if (pts >= 7) {
      warningBg = 'FFFECDD3';
      warningFg = 'FFBE123C';
    } else if (pts >= 5) {
      warningBg = 'FFFED7AA';
      warningFg = 'FFC2410C';
    } else if (pts >= 3) {
      warningBg = 'FFFEF08A';
      warningFg = 'FF854D0E';
    }

    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 9.5 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.border = {
        top: { style: 'thin', color: { argb: LIGHT_BORDER } },
        bottom: { style: 'thin', color: { argb: LIGHT_BORDER } },
        left: { style: 'thin', color: { argb: LIGHT_BORDER } },
        right: { style: 'thin', color: { argb: LIGHT_BORDER } }
      };

      // Alignments
      if (colNumber === 1 || colNumber === 8 || colNumber === 11 || colNumber === 12 || colNumber === 13 || colNumber === 14) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber === 9 || colNumber === 10) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }

      // Format Warning Badge cell
      if (colNumber === 8) {
        cell.font = { name: 'Calibri', size: 10, bold: true };
      }
      if (colNumber === 9) {
        cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: warningFg } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: warningBg } };
      }
    });
  });

  // Set column widths
  wsProgress.columns = [
    { width: 10 }, // Scout #
    { width: 24 }, // Full Name
    { width: 15 }, // First Name
    { width: 15 }, // Last Name
    { width: 18 }, // Grade / Rank
    { width: 28 }, // Ṭalīʿah Name
    { width: 20 }, // Assigned Leader
    { width: 16 }, // Infraction Points
    { width: 22 }, // Warning Stage
    { width: 44 }, // Action
    { width: 18 }, // Unexcused Absences
    { width: 16 }, // Uniform Score
    { width: 16 }, // Punctuality
    { width: 14 }  // Active Status
  ];

  // Summary box at the bottom of Sheet 1
  wsProgress.addRow([]); // Blank row
  const summaryRow = wsProgress.addRow([
    'UNIT SUMMARY',
    `Total Scouts: ${scouts.length}`,
    '',
    '',
    '',
    '',
    'Stage Totals:',
    `Avg Pts: ${(scouts.reduce((acc, s) => acc + (s.points ?? 0), 0) / (scouts.length || 1)).toFixed(1)}`,
    `⚠️ Active Warnings (≥3 pts): ${scouts.filter(s => (s.points ?? 0) >= 3).length}`,
    `🚨 Probation / Removal (≥7 pts): ${scouts.filter(s => (s.points ?? 0) >= 7).length}`,
    `Total Absences: ${scouts.reduce((acc, s) => acc + (s.unexcusedAbsences ?? 0), 0)}`,
    '',
    '',
    ''
  ]);
  summaryRow.height = 22;
  summaryRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: FOREST_GREEN } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREAM } };
    cell.border = {
      top: { style: 'medium', color: { argb: GOLD } },
      bottom: { style: 'medium', color: { argb: GOLD } },
      left: { style: 'thin', color: { argb: LIGHT_BORDER } },
      right: { style: 'thin', color: { argb: LIGHT_BORDER } }
    };
  });

  // -------------------------------------------------------------
  // SHEET 2: Full Session Attendance Matrix
  // -------------------------------------------------------------
  const wsAttendance = workbook.addWorksheet('Session Attendance Matrix', {
    views: [{ showGridLines: true }]
  });

  // Header Banner
  wsAttendance.mergeCells(`A1:${String.fromCharCode(65 + Math.min(25, 7 + allSessions.length))}1`);
  const attHeaderCell = wsAttendance.getCell('A1');
  attHeaderCell.value = '📋 DHULFIQĀR SCOUTING PROGRAM — LIVE SESSION ATTENDANCE MATRIX';
  attHeaderCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: WHITE } };
  attHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FOREST_GREEN } };
  attHeaderCell.alignment = { vertical: 'middle', horizontal: 'center' };
  wsAttendance.getRow(1).height = 30;

  wsAttendance.mergeCells(`A2:${String.fromCharCode(65 + Math.min(25, 7 + allSessions.length))}2`);
  const attSubCell = wsAttendance.getCell('A2');
  attSubCell.value = `Unit: ${patrolTitle}  |  Generated On: ${formattedTimestamp}  |  Total Program Sessions: ${allSessions.length}`;
  attSubCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: FOREST_GREEN } };
  attSubCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREAM } };
  attSubCell.alignment = { vertical: 'middle', horizontal: 'center' };
  wsAttendance.getRow(2).height = 20;

  wsAttendance.addRow([]); // Blank spacer row 3

  // Dynamic Column Headers (Row 4)
  const attHeaders = [
    'Scout #',
    'Full Name',
    'Grade',
    'Ṭalīʿah',
    'Sessions Recorded',
    'Present Total',
    'Absent Total',
    'Excused Total',
    'Attendance Rate (%)'
  ];

  // Add each Friday session as a column
  allSessions.forEach((s) => {
    attHeaders.push(`${s.date}\n(${s.event})`);
  });

  const attHeaderRow = wsAttendance.addRow(attHeaders);
  attHeaderRow.height = 32;
  attHeaderRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FOREST_GREEN } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: GOLD } },
      bottom: { style: 'medium', color: { argb: GOLD } },
      left: { style: 'thin', color: { argb: LIGHT_BORDER } },
      right: { style: 'thin', color: { argb: LIGHT_BORDER } }
    };
  });

  // Populate Scout Attendance Data
  scouts.forEach((scout, idx) => {
    const taliah = getTaliahForGrade(scout.grade, customTaliahNames);

    let presentCount = 0;
    let absentCount = 0;
    let excusedCount = 0;
    let sessionsRecorded = 0;

    const sessionStatuses: string[] = [];

    allSessions.forEach((s) => {
      const sessionMap = allAttendance[s.date] || {};
      const status = sessionMap[scout.id];

      if (status === 'PRESENT') {
        presentCount++;
        sessionsRecorded++;
        sessionStatuses.push('PRESENT ✅');
      } else if (status === 'ABSENT') {
        absentCount++;
        sessionsRecorded++;
        sessionStatuses.push('ABSENT ❌');
      } else if (status === 'EXCUSED') {
        excusedCount++;
        sessionsRecorded++;
        sessionStatuses.push('EXCUSED ⚠️');
      } else {
        sessionStatuses.push('—');
      }
    });

    const rate = sessionsRecorded > 0 ? `${Math.round((presentCount / sessionsRecorded) * 100)}%` : '100%';

    const rowData = [
      scout.scoutIdNumber ? `#${String(scout.scoutIdNumber).padStart(3, '0')}` : `#${idx + 1}`,
      scout.fullName,
      scout.grade,
      taliah.taliahName,
      sessionsRecorded,
      presentCount,
      absentCount,
      excusedCount,
      rate,
      ...sessionStatuses
    ];

    const attRow = wsAttendance.addRow(rowData);
    attRow.height = 20;

    const rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF9F8F5';

    attRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 9 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.border = {
        top: { style: 'thin', color: { argb: LIGHT_BORDER } },
        bottom: { style: 'thin', color: { argb: LIGHT_BORDER } },
        left: { style: 'thin', color: { argb: LIGHT_BORDER } },
        right: { style: 'thin', color: { argb: LIGHT_BORDER } }
      };

      if (colNumber <= 4) {
        cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'center' : 'left' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      }

      // Highlight session cells
      if (colNumber > 9) {
        const val = String(cell.value || '');
        if (val.includes('PRESENT')) {
          cell.font = { name: 'Calibri', size: 8.5, color: { argb: 'FF166534' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
        } else if (val.includes('ABSENT')) {
          cell.font = { name: 'Calibri', size: 8.5, bold: true, color: { argb: 'FF991B1B' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
        } else if (val.includes('EXCUSED')) {
          cell.font = { name: 'Calibri', size: 8.5, color: { argb: 'FF854D0E' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
        }
      }
    });
  });

  // Base Column widths for Attendance Sheet
  const attColWidths = [
    { width: 10 }, // Scout #
    { width: 24 }, // Full Name
    { width: 16 }, // Grade
    { width: 26 }, // Ṭalīʿah
    { width: 18 }, // Sessions Recorded
    { width: 14 }, // Present Total
    { width: 14 }, // Absent Total
    { width: 14 }, // Excused Total
    { width: 18 }  // Rate
  ];
  allSessions.forEach(() => attColWidths.push({ width: 20 }));
  wsAttendance.columns = attColWidths;

  // -------------------------------------------------------------
  // SHEET 3: Incident & Accountability Log History
  // -------------------------------------------------------------
  const wsLogs = workbook.addWorksheet('Incident & Duty Logs', {
    views: [{ showGridLines: true }]
  });

  // Header Banner
  wsLogs.mergeCells('A1:I1');
  const logHeaderCell = wsLogs.getCell('A1');
  logHeaderCell.value = '🛡️ DHULFIQĀR SCOUTING PROGRAM — INCIDENT & BEHAVIOR AUDIT LOG';
  logHeaderCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: WHITE } };
  logHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FOREST_GREEN } };
  logHeaderCell.alignment = { vertical: 'middle', horizontal: 'center' };
  wsLogs.getRow(1).height = 30;

  wsLogs.mergeCells('A2:I2');
  const logSubCell = wsLogs.getCell('A2');
  logSubCell.value = `Unit: ${patrolTitle}  |  Recorded Incidents: ${relevantLogs.length}  |  Audit Timestamp: ${formattedTimestamp}`;
  logSubCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: FOREST_GREEN } };
  logSubCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREAM } };
  logSubCell.alignment = { vertical: 'middle', horizontal: 'center' };
  wsLogs.getRow(2).height = 20;

  wsLogs.addRow([]); // Blank spacer row 3

  // Table Headers (Row 4)
  const logHeaders = [
    'Date & Time',
    'Scout ID',
    'Scout Name',
    'Grade / Unit',
    'Category',
    'Points Delta',
    'Violation / Reason Details',
    'Warning Triggered',
    'Logged By Leader'
  ];

  const logHeaderRow = wsLogs.addRow(logHeaders);
  logHeaderRow.height = 24;
  logHeaderRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FOREST_GREEN } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: GOLD } },
      bottom: { style: 'medium', color: { argb: GOLD } },
      left: { style: 'thin', color: { argb: LIGHT_BORDER } },
      right: { style: 'thin', color: { argb: LIGHT_BORDER } }
    };
  });

  if (relevantLogs.length === 0) {
    const emptyRow = wsLogs.addRow([
      formattedTimestamp,
      '—',
      'All Scouts Clean',
      selectedGrade,
      'CLEAN RECORD',
      '0 pts',
      'No behavioral infractions recorded for this unit.',
      '🟢 Coaching Level (0 pts)',
      `@${leaderProfile?.username || 'leader'}`
    ]);
    emptyRow.height = 22;
    emptyRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 9.5, italic: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
  } else {
    // Sort logs descending by timestamp
    const sortedLogs = [...relevantLogs].sort((a, b) => b.timestamp - a.timestamp);

    sortedLogs.forEach((log, idx) => {
      const scout = scouts.find(s => s.id === log.scoutId);
      const pointsFormatted = log.pointsDelta > 0 ? `+${log.pointsDelta} pts` : `${log.pointsDelta} pts`;
      const dateFormatted = log.timestamp
        ? new Date(log.timestamp).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })
        : log.date;

      const row = wsLogs.addRow([
        dateFormatted,
        scout?.scoutIdNumber ? `#${String(scout.scoutIdNumber).padStart(3, '0')}` : log.scoutId,
        log.scoutName || scout?.fullName || 'Unknown Scout',
        scout?.grade || log.grade || selectedGrade,
        log.category,
        pointsFormatted,
        log.reason || 'Accountability entry',
        log.warningTriggered || '—',
        log.loggedBy ? `@${log.loggedBy}` : `@${leaderProfile?.username || 'leader'}`
      ]);

      row.height = 22;
      const rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF9F8F5';

      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 9.5 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        cell.border = {
          top: { style: 'thin', color: { argb: LIGHT_BORDER } },
          bottom: { style: 'thin', color: { argb: LIGHT_BORDER } },
          left: { style: 'thin', color: { argb: LIGHT_BORDER } },
          right: { style: 'thin', color: { argb: LIGHT_BORDER } }
        };

        if (colNumber === 1 || colNumber === 2 || colNumber === 5 || colNumber === 6 || colNumber === 9) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }

        if (colNumber === 6) {
          cell.font = {
            name: 'Calibri',
            size: 9.5,
            bold: true,
            color: { argb: log.pointsDelta > 0 ? 'FF991B1B' : 'FF166534' }
          };
        }
      });
    });
  }

  wsLogs.columns = [
    { width: 20 }, // Date & Time
    { width: 12 }, // Scout ID
    { width: 24 }, // Scout Name
    { width: 18 }, // Grade / Unit
    { width: 16 }, // Category
    { width: 14 }, // Points Delta
    { width: 44 }, // Reason / Details
    { width: 24 }, // Warning Triggered
    { width: 20 }  // Logged By
  ];

  // -------------------------------------------------------------
  // Generate & Trigger Download
  // -------------------------------------------------------------
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  const sanitizedUnit = sanitizeForFileName(isAll ? 'All_Units' : `${selectedGrade}_${taliahInfo?.taliahName || ''}`);
  const fileName = `Dhulfiqar_${sanitizedUnit}_Progress_${fileDateStr}_${fileTimeStr}.xlsx`;

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
}

/**
 * Generates and downloads a clean, comprehensive CSV report of the patrol/troop progress and attendance.
 */
export function downloadLivePatrolCsv(options: ExportReportOptions): void {
  const {
    scouts,
    allSessions,
    customTaliahNames,
    leaderProfile,
    selectedGrade,
    currentSessionDate,
    currentSessionAttendance
  } = options;

  const now = new Date();
  const formattedTimestamp = now.toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'medium'
  });
  const fileDateStr = now.toISOString().slice(0, 10);
  const fileTimeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

  const isAll = selectedGrade === 'All Grades' || selectedGrade === 'All Units' || !selectedGrade;
  const taliahInfo = !isAll ? getTaliahForGrade(selectedGrade, customTaliahNames) : null;
  const patrolTitle = isAll
    ? 'All Ṭalāʾiʿ — Full Troop'
    : `${selectedGrade} — ${taliahInfo?.taliahName || ''}`;

  const allAttendance = gatherAllAttendanceRecords(allSessions, currentSessionDate, currentSessionAttendance);

  const escapeCsv = (str: string | number | undefined | null) => {
    if (str === undefined || str === null) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows: string[] = [];

  // Metadata headers
  rows.push(`"DHULFIQĀR SCOUTING PROGRAM — LIVE PATROL PROGRESS & ATTENDANCE REPORT"`);
  rows.push(`"Patrol / Unit:","${patrolTitle}","Leader:","${leaderProfile?.name || 'Leader'} (@${leaderProfile?.username || 'leader'})"`);
  rows.push(`"Generated Live At:","${formattedTimestamp}","Total Scouts:","${scouts.length}"`);
  rows.push('');

  // Column Headers
  const headers = [
    'Scout #',
    'Full Name',
    'First Name',
    'Last Name',
    'Grade / Rank',
    'Ṭalīʿah Name',
    'Assigned Leader',
    'Current Infraction Points',
    'Warning Level Stage',
    'Policy Action Required',
    'Unexcused Absences',
    'Uniform Score (%)',
    'Punctuality Score (%)',
    'Active Status',
    'Sessions Recorded',
    'Present Count',
    'Absent Count',
    'Excused Count',
    'Attendance Rate (%)'
  ];

  allSessions.forEach((s) => {
    headers.push(`${s.date} (${s.event})`);
  });

  rows.push(headers.map(escapeCsv).join(','));

  // Scout Data Rows
  scouts.forEach((scout, idx) => {
    const pts = scout.points ?? 0;
    const stage = getScoutWarningStage(pts);
    const taliah = getTaliahForGrade(scout.grade, customTaliahNames);

    let presentCount = 0;
    let absentCount = 0;
    let excusedCount = 0;
    let sessionsRecorded = 0;

    const sessionStatuses: string[] = [];

    allSessions.forEach((s) => {
      const sessionMap = allAttendance[s.date] || {};
      const status = sessionMap[scout.id];

      if (status === 'PRESENT') {
        presentCount++;
        sessionsRecorded++;
        sessionStatuses.push('PRESENT');
      } else if (status === 'ABSENT') {
        absentCount++;
        sessionsRecorded++;
        sessionStatuses.push('ABSENT');
      } else if (status === 'EXCUSED') {
        excusedCount++;
        sessionsRecorded++;
        sessionStatuses.push('EXCUSED');
      } else {
        sessionStatuses.push('-');
      }
    });

    const rate = sessionsRecorded > 0 ? `${Math.round((presentCount / sessionsRecorded) * 100)}%` : '100%';

    const scoutRow = [
      scout.scoutIdNumber ? `#${String(scout.scoutIdNumber).padStart(3, '0')}` : `#${idx + 1}`,
      scout.fullName,
      scout.firstName || '',
      scout.lastName || '',
      scout.grade,
      taliah.taliahName,
      scout.leader || leaderProfile?.name || '',
      pts,
      `${stage.icon} ${stage.label}`,
      stage.action,
      scout.unexcusedAbsences ?? 0,
      `${scout.uniformScore ?? 100}%`,
      `${scout.punctualityScore ?? 100}%`,
      scout.isActive ? 'Active' : 'Inactive',
      sessionsRecorded,
      presentCount,
      absentCount,
      excusedCount,
      rate,
      ...sessionStatuses
    ];

    rows.push(scoutRow.map(escapeCsv).join(','));
  });

  const csvContent = rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const sanitizedUnit = sanitizeForFileName(isAll ? 'All_Units' : `${selectedGrade}_${taliahInfo?.taliahName || ''}`);
  const fileName = `Dhulfiqar_${sanitizedUnit}_Progress_${fileDateStr}_${fileTimeStr}.csv`;

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
}
