// scripts/generate_excel_and_csv.mjs
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
const artifactDir = 'C:\\Users\\hassa\\.gemini\\antigravity\\brain\\55d3e370-8660-4182-81a5-6e3da6d795cd';

const DEFAULT_PASSWORD = 'scouts2026';

const ACCOUNTS = [
  { grade: 'All Units (Admin)', taliahRank: 'Troop Command', taliahName: 'All Troop Units (11 Ṭalāʾiʿ)', role: 'Admin', name: 'Troop Leader', username: 'leader', password: DEFAULT_PASSWORD, email: 'leader@dhulfiqarscouts.org', scoutsCount: 124, notes: 'Full admin access to all grades, ṭalāʾiʿ & sessions' },
  { grade: 'All Units (Admin)', taliahRank: 'Troop Command', taliahName: 'All Troop Units (11 Ṭalāʾiʿ)', role: 'Admin', name: 'Troop Admin', username: 'admin', password: DEFAULT_PASSWORD, email: 'admin@dhulfiqarscouts.org', scoutsCount: 124, notes: 'Full admin access to all grades, ṭalāʾiʿ & sessions' },
  { grade: 'Kindergarten', taliahRank: 'Lions - KG', taliahName: 'Ṭalīʿat al-Mahdi (ʿaj)', role: 'Leader', name: 'Bilal Dabaja', username: 'bdabaja', password: DEFAULT_PASSWORD, email: 'bdabaja@dhulfiqarscouts.org', scoutsCount: 12, notes: 'Kindergarten patrol leader' },
  { grade: '1st Grade', taliahRank: 'Tigers - 1st', taliahName: 'Ṭalīʿat al-Muṣṭafā (ṣ)', role: 'Leader', name: 'Nader Chamseddine', username: 'nchamseddine', password: DEFAULT_PASSWORD, email: 'nchamseddine@dhulfiqarscouts.org', scoutsCount: 11, notes: '1st Grade patrol leader' },
  { grade: '1st Grade', taliahRank: 'Tigers - 1st', taliahName: 'Ṭalīʿat al-Muṣṭafā (ṣ)', role: 'Assistant Leader', name: 'Mohamad Ali Soueidan', username: 'msoueidan', password: DEFAULT_PASSWORD, email: 'msoueidan@dhulfiqarscouts.org', scoutsCount: 11, notes: '1st Grade assistant leader' },
  { grade: '2nd Grade', taliahRank: 'Wolf - 2nd', taliahName: 'Ṭalīʿat aṣ-Ṣādiq (ʿa)', role: 'Leader', name: 'Jawad Hazime', username: 'jhazime', password: DEFAULT_PASSWORD, email: 'jhazime@dhulfiqarscouts.org', scoutsCount: 10, notes: '2nd Grade patrol leader' },
  { grade: '2nd Grade', taliahRank: 'Wolf - 2nd', taliahName: 'Ṭalīʿat aṣ-Ṣādiq (ʿa)', role: 'Assistant Leader', name: 'Ahmad Mohsen', username: 'amohsen', password: DEFAULT_PASSWORD, email: 'amohsen@dhulfiqarscouts.org', scoutsCount: 10, notes: '2nd Grade assistant leader' },
  { grade: '3rd Grade', taliahRank: 'Bear - 3rd', taliahName: 'Ṭalīʿat ar-Riḍā (ʿa)', role: 'Leader', name: 'Hussein Yahfoufi', username: 'hyahfoufi', password: DEFAULT_PASSWORD, email: 'hyahfoufi@dhulfiqarscouts.org', scoutsCount: 10, notes: '3rd Grade patrol leader' },
  { grade: '3rd Grade', taliahRank: 'Bear - 3rd', taliahName: 'Ṭalīʿat ar-Riḍā (ʿa)', role: 'Assistant Leader', name: 'Basel Saleh', username: 'bsaleh', password: DEFAULT_PASSWORD, email: 'bsaleh@dhulfiqarscouts.org', scoutsCount: 10, notes: '3rd Grade assistant leader' },
  { grade: '4th Grade', taliahRank: 'Webelos - 4th', taliahName: 'Ṭalīʿat TBD', role: 'Leader', name: 'Ayman Ayash', username: 'aayash', password: DEFAULT_PASSWORD, email: 'aayash@dhulfiqarscouts.org', scoutsCount: 15, notes: '4th Grade patrol leader (Name customizable in portal)' },
  { grade: '4th Grade', taliahRank: 'Webelos - 4th', taliahName: 'Ṭalīʿat TBD', role: 'Assistant Leader', name: 'Mahdi Hammoud', username: 'mhammoud', password: DEFAULT_PASSWORD, email: 'mhammoud@dhulfiqarscouts.org', scoutsCount: 15, notes: '4th Grade assistant leader' },
  { grade: '4th Grade', taliahRank: 'Webelos - 4th', taliahName: 'Ṭalīʿat TBD', role: 'Assistant Leader', name: 'Abbas Fardous', username: 'afardous', password: DEFAULT_PASSWORD, email: 'afardous@dhulfiqarscouts.org', scoutsCount: 15, notes: '4th Grade assistant leader' },
  { grade: '5th Grade', taliahRank: 'Arrow of Light - 5th', taliahName: 'Ṭalīʿat Amīr al-Muʾminīn (ʿa)', role: 'Leader', name: 'Tamer Safwan', username: 'tsafwan', password: DEFAULT_PASSWORD, email: 'tsafwan@dhulfiqarscouts.org', scoutsCount: 14, notes: '5th Grade patrol leader' },
  { grade: '5th Grade', taliahRank: 'Arrow of Light - 5th', taliahName: 'Ṭalīʿat Amīr al-Muʾminīn (ʿa)', role: 'Assistant Leader', name: 'Mohamed Hussein Mussa', username: 'mmussa', password: DEFAULT_PASSWORD, email: 'mmussa@dhulfiqarscouts.org', scoutsCount: 14, notes: '5th Grade assistant leader' },
  { grade: '5th Grade', taliahRank: 'Arrow of Light - 5th', taliahName: 'Ṭalīʿat Amīr al-Muʾminīn (ʿa)', role: 'Assistant Leader', name: 'Mohammad Haidar-Ahmad', username: 'mhaidarahmad', password: DEFAULT_PASSWORD, email: 'mhaidarahmad@dhulfiqarscouts.org', scoutsCount: 14, notes: '5th Grade assistant leader' },
  { grade: '6th Grade', taliahRank: 'Patrol 1 - 6th', taliahName: 'Ṭalīʿat ʿIshāq al-Ḥusayn (ʿa)', role: 'Leader', name: 'Mohamad Jalloul', username: 'mjalloul', password: DEFAULT_PASSWORD, email: 'mjalloul@dhulfiqarscouts.org', scoutsCount: 12, notes: '6th Grade patrol leader' },
  { grade: '6th Grade', taliahRank: 'Patrol 1 - 6th', taliahName: 'Ṭalīʿat ʿIshāq al-Ḥusayn (ʿa)', role: 'Assistant Leader', name: 'Hamze Berro', username: 'hberro', password: DEFAULT_PASSWORD, email: 'hberro@dhulfiqarscouts.org', scoutsCount: 12, notes: '6th Grade assistant leader' },
  { grade: '7th Grade', taliahRank: 'Patrol 2 - 6th/7th', taliahName: 'Ṭalīʿat Abū al-Faḍl al-ʿAbbās', role: 'Leader', name: 'Hassan Issa', username: 'hissa', password: DEFAULT_PASSWORD, email: 'hissa@dhulfiqarscouts.org', scoutsCount: 13, notes: '7th Grade patrol leader' },
  { grade: '7th Grade', taliahRank: 'Patrol 2 - 6th/7th', taliahName: 'Ṭalīʿat Abū al-Faḍl al-ʿAbbās', role: 'Assistant Leader', name: 'Ibrahim Alwishah', username: 'ialwishah', password: DEFAULT_PASSWORD, email: 'ialwishah@dhulfiqarscouts.org', scoutsCount: 13, notes: '7th Grade assistant leader' },
  { grade: '8th Grade', taliahRank: 'Patrol 3 - 8th', taliahName: 'Ṭalīʿat al-Bāqir (ʿa)', role: 'Leader', name: 'Hasan Yahfoufi', username: 'hyahfoufi8', password: DEFAULT_PASSWORD, email: 'hyahfoufi8@dhulfiqarscouts.org', scoutsCount: 8, notes: '8th Grade patrol leader' },
  { grade: '8th Grade', taliahRank: 'Patrol 3 - 8th', taliahName: 'Ṭalīʿat al-Bāqir (ʿa)', role: 'Assistant Leader', name: 'Ibrahim Hassan', username: 'ihassan', password: DEFAULT_PASSWORD, email: 'ihassan@dhulfiqarscouts.org', scoutsCount: 8, notes: '8th Grade assistant leader' },
  { grade: '9th Grade', taliahRank: 'Patrol 4 - 9th', taliahName: 'Ṭalīʿat Asadullāh (ʿa)', role: 'Leader', name: 'Mustapha Mourtada', username: 'mmourtada', password: DEFAULT_PASSWORD, email: 'mmourtada@dhulfiqarscouts.org', scoutsCount: 9, notes: '9th Grade patrol leader' },
  { grade: '10th / 11th Grade', taliahRank: 'Patrol 5 - 10th/11th', taliahName: 'Ṭalīʿat Abā ʿAbdillāh (ʿa)', role: 'Leader', name: 'Mustapha Choucair', username: 'mchoucair', password: DEFAULT_PASSWORD, email: 'mchoucair@dhulfiqarscouts.org', scoutsCount: 11, notes: 'Combined 10th & 11th Grade unit leader' },
  { grade: '10th / 11th Grade', taliahRank: 'Patrol 5 - 10th/11th', taliahName: 'Ṭalīʿat Abā ʿAbdillāh (ʿa)', role: 'Leader', name: 'Ali Harajli', username: 'aharajli', password: DEFAULT_PASSWORD, email: 'aharajli@dhulfiqarscouts.org', scoutsCount: 11, notes: 'Combined 10th & 11th Grade unit leader' }
];

async function generateFiles() {
  // 1. Generate CSV
  const csvHeaders = ['Grade / Unit', 'Ṭalīʿah Rank', 'Ṭalīʿah Group Name', 'Role', 'Leader Name', 'Username', 'Password', 'Login Email', 'Scouts Count', 'Notes'];
  const csvRows = [
    csvHeaders.join(','),
    ...ACCOUNTS.map(a => [
      `"${a.grade}"`,
      `"${a.taliahRank}"`,
      `"${a.taliahName}"`,
      `"${a.role}"`,
      `"${a.name}"`,
      `"${a.username}"`,
      `"${a.password}"`,
      `"${a.email}"`,
      a.scoutsCount,
      `"${a.notes}"`
    ].join(','))
  ];

  const csvContent = csvRows.join('\n');

  const csvPaths = [
    path.join(projectRoot, 'Dhulfiqar_Scouts_Leader_Logins.csv'),
    path.join(publicDir, 'Dhulfiqar_Scouts_Leader_Logins.csv'),
    path.join(artifactDir, 'Dhulfiqar_Scouts_Leader_Logins.csv')
  ];

  for (const p of csvPaths) {
    fs.writeFileSync(p, csvContent, 'utf8');
    console.log(`✓ Generated CSV file: ${p}`);
  }

  // 2. Generate styled Excel Workbook (.xlsx)
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Dhulfiqar Scouting Program';
  workbook.created = new Date();

  // Sheet 1: Leader Logins
  const sheet1 = workbook.addWorksheet('Leader & Ṭalīʿah Logins', {
    views: [{ showGridLines: true }]
  });

  // Title Row
  sheet1.mergeCells('A1:J1');
  const titleCell = sheet1.getCell('A1');
  titleCell.value = '⚜️ Dhulfiqār Scouts — Leader & Ṭalīʿah (Group) Login Credentials';
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF123C2D' } }; // Forest Green
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet1.getRow(1).height = 36;

  // Subtitle Row
  sheet1.mergeCells('A2:J2');
  const subtitleCell = sheet1.getCell('A2');
  subtitleCell.value = 'Universal Mobile App: http://localhost:5173 | Default Password for All Accounts: scouts2026';
  subtitleCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF123C2D' } };
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F2E7' } }; // Cream
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet1.getRow(2).height = 22;

  // Headers
  const headers = ['Grade / Patrol Unit', 'Ṭalīʿah Rank', 'Ṭalīʿah Group Name', 'Role', 'Full Name', 'Username', 'Password', 'Firebase Email', 'Assigned Scouts', 'Notes & Scope'];
  const headerRow = sheet1.addRow(headers);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB99645' } }; // Gold
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'medium', color: { argb: 'FF123C2D' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } }
    };
  });

  // Data rows
  ACCOUNTS.forEach((acc, index) => {
    const row = sheet1.addRow([
      acc.grade,
      acc.taliahRank,
      acc.taliahName,
      acc.role,
      acc.name,
      acc.username,
      acc.password,
      acc.email,
      acc.scoutsCount,
      acc.notes
    ]);
    row.height = 22;

    const isEven = index % 2 === 0;
    const bgColor = isEven ? 'FFFFFFFF' : 'FFFDFBF7';

    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 10, color: { argb: 'FF17201C' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      if (colNumber === 6 || colNumber === 7) {
        // Username & Password font highlight
        cell.font = { name: 'Consolas', size: 10.5, bold: true, color: { argb: colNumber === 7 ? 'FFB91C1C' : 'FF123C2D' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber === 9) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  });

  // Column widths
  sheet1.columns = [
    { width: 22 }, // Grade
    { width: 22 }, // Taliah Rank
    { width: 30 }, // Taliah Name
    { width: 18 }, // Role
    { width: 26 }, // Name
    { width: 16 }, // Username
    { width: 16 }, // Password
    { width: 34 }, // Email
    { width: 18 }, // Scouts Count
    { width: 46 }  // Notes
  ];

  // Save workbooks
  const xlsxPaths = [
    path.join(projectRoot, 'Dhulfiqar_Scouts_Leader_Logins.xlsx'),
    path.join(publicDir, 'Dhulfiqar_Scouts_Leader_Logins.xlsx'),
    path.join(artifactDir, 'Dhulfiqar_Scouts_Leader_Logins.xlsx')
  ];

  for (const p of xlsxPaths) {
    await workbook.xlsx.writeFile(p);
    console.log(`✓ Generated Excel (.xlsx) file: ${p}`);
  }
}

generateFiles().catch(console.error);
