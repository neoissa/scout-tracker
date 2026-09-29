// scripts/generate_excel_and_csv.mjs
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
const artifactDir = 'C:\\Users\\hassa\\.gemini\\antigravity\\brain\\55d3e370-8660-4182-81a5-6e3da6d795cd';

const APP_URL = 'https://scout-tracker-tau.vercel.app/';
const DEFAULT_PASSWORD = 'scouts2026';

// The 2 designated Admin Support Accounts
const ADMIN_SUPPORT_CONTACTS = [
  {
    role: 'Troop Leader (Command)',
    name: 'Troop Leader',
    username: 'leader',
    email: 'leader@dhulfiqarscouts.org',
    supportScope: 'Program Oversight, Grade Allocations & Emergency Password Resets'
  },
  {
    role: 'Troop Admin (Technical & Operations)',
    name: 'Troop Admin',
    username: 'admin',
    email: 'admin@dhulfiqarscouts.org',
    supportScope: 'Firebase Database, Portal Access, Password Recovery & Technical Troubleshooting'
  }
];

const LEADER_DIRECTORY = [
  // Command & Admin Accounts
  {
    grade: 'All Units (Admin)',
    taliahRank: 'Troop Command',
    taliahName: 'All Troop Units (11 Ṭalāʾiʿ)',
    role: 'Troop Leader (Admin)',
    name: 'Troop Leader',
    username: 'leader',
    initialPassword: DEFAULT_PASSWORD,
    email: 'leader@dhulfiqarscouts.org',
    scoutsCount: 124,
    supportContact: 'Self (Admin Support 1)',
    notes: 'Full troop master access; oversees all 11 ṭalāʾiʿ & provides password recovery support'
  },
  {
    grade: 'All Units (Admin)',
    taliahRank: 'Troop Command',
    taliahName: 'All Troop Units (11 Ṭalāʾiʿ)',
    role: 'Troop Admin (Admin)',
    name: 'Troop Admin',
    username: 'admin',
    initialPassword: DEFAULT_PASSWORD,
    email: 'admin@dhulfiqarscouts.org',
    scoutsCount: 124,
    supportContact: 'Self (Admin Support 2)',
    notes: 'Technical administrator; manages database, user provisioning & password reset service'
  },

  // Ṭalīʿah Leaders & Assistants
  {
    grade: 'Kindergarten',
    taliahRank: 'Lions - KG',
    taliahName: 'Ṭalīʿat al-Mahdi (ʿaj)',
    role: 'Patrol Leader',
    name: 'Bilal Dabaja',
    username: 'bdabaja',
    initialPassword: DEFAULT_PASSWORD,
    email: 'bdabaja@dhulfiqarscouts.org',
    scoutsCount: 12,
    supportContact: 'admin@dhulfiqarscouts.org / leader@dhulfiqarscouts.org',
    notes: 'Kindergarten patrol leader; manages attendance & star awards'
  },
  {
    grade: '1st Grade',
    taliahRank: 'Tigers - 1st',
    taliahName: 'Ṭalīʿat al-Muṣṭafā (ṣ)',
    role: 'Patrol Leader',
    name: 'Nader Chamseddine',
    username: 'nchamseddine',
    initialPassword: DEFAULT_PASSWORD,
    email: 'nchamseddine@dhulfiqarscouts.org',
    scoutsCount: 11,
    supportContact: 'admin@dhulfiqarscouts.org / leader@dhulfiqarscouts.org',
    notes: '1st Grade unit leader; manages check-ins & duty rotations'
  },
  {
    grade: '1st Grade',
    taliahRank: 'Tigers - 1st',
    taliahName: 'Ṭalīʿat al-Muṣṭafā (ṣ)',
    role: 'Assistant Leader',
    name: 'Mohamad Ali Soueidan',
    username: 'msoueidan',
    initialPassword: DEFAULT_PASSWORD,
    email: 'msoueidan@dhulfiqarscouts.org',
    scoutsCount: 11,
    supportContact: 'admin@dhulfiqarscouts.org / leader@dhulfiqarscouts.org',
    notes: '1st Grade assistant leader; co-manages attendance & roster'
  },
  {
    grade: '2nd Grade',
    taliahRank: 'Wolf - 2nd',
    taliahName: 'Ṭalīʿat aṣ-Ṣādiq (ʿa)',
    role: 'Patrol Leader',
    name: 'Jawad Hazime',
    username: 'jhazime',
    initialPassword: DEFAULT_PASSWORD,
    email: 'jhazime@dhulfiqarscouts.org',
    scoutsCount: 10,
    supportContact: 'admin@dhulfiqarscouts.org / leader@dhulfiqarscouts.org',
    notes: '2nd Grade patrol leader'
  },
  {
    grade: '2nd Grade',
    taliahRank: 'Wolf - 2nd',
    taliahName: 'Ṭalīʿat aṣ-Ṣādiq (ʿa)',
    role: 'Assistant Leader',
    name: 'Ahmad Mohsen',
    username: 'amohsen',
    initialPassword: DEFAULT_PASSWORD,
    email: 'amohsen@dhulfiqarscouts.org',
    scoutsCount: 10,
    supportContact: 'admin@dhulfiqarscouts.org / leader@dhulfiqarscouts.org',
    notes: '2nd Grade assistant leader'
  },
  {
    grade: '3rd Grade',
    taliahRank: 'Bear - 3rd',
    taliahName: 'Ṭalīʿat ar-Riḍā (ʿa)',
    role: 'Patrol Leader',
    name: 'Hussein Yahfoufi',
    username: 'hyahfoufi',
    initialPassword: DEFAULT_PASSWORD,
    email: 'hyahfoufi@dhulfiqarscouts.org',
    scoutsCount: 10,
    supportContact: 'admin@dhulfiqarscouts.org / leader@dhulfiqarscouts.org',
    notes: '3rd Grade patrol leader'
  },
  {
    grade: '3rd Grade',
    taliahRank: 'Bear - 3rd',
    taliahName: 'Ṭalīʿat ar-Riḍā (ʿa)',
    role: 'Assistant Leader',
    name: 'Basel Saleh',
    username: 'bsaleh',
    initialPassword: DEFAULT_PASSWORD,
    email: 'bsaleh@dhulfiqarscouts.org',
    scoutsCount: 10,
    supportContact: 'admin@dhulfiqarscouts.org / leader@dhulfiqarscouts.org',
    notes: '3rd Grade assistant leader'
  },
  {
    grade: '4th Grade',
    taliahRank: 'Webelos - 4th',
    taliahName: 'Ṭalīʿat TBD',
    role: 'Patrol Leader',
    name: 'Ayman Ayash',
    username: 'aayash',
    initialPassword: DEFAULT_PASSWORD,
    email: 'aayash@dhulfiqarscouts.org',
    scoutsCount: 15,
    supportContact: 'admin@dhulfiqarscouts.org / leader@dhulfiqarscouts.org',
    notes: '4th Grade patrol leader (Ṭalīʿah name customizable in Portal)'
  },
  {
    grade: '4th Grade',
    taliahRank: 'Webelos - 4th',
    taliahName: 'Ṭalīʿat TBD',
    role: 'Assistant Leader',
    name: 'Mahdi Hammoud',
    username: 'mhammoud',
    initialPassword: DEFAULT_PASSWORD,
    email: 'mhammoud@dhulfiqarscouts.org',
    scoutsCount: 15,
    supportContact: 'admin@dhulfiqarscouts.org / leader@dhulfiqarscouts.org',
    notes: '4th Grade assistant leader'
  },
  {
    grade: '4th Grade',
    taliahRank: 'Webelos - 4th',
    taliahName: 'Ṭalīʿat TBD',
    role: 'Assistant Leader',
    name: 'Abbas Fardous',
    username: 'afardous',
    initialPassword: DEFAULT_PASSWORD,
    email: 'afardous@dhulfiqarscouts.org',
    scoutsCount: 15,
    supportContact: 'admin@dhulfiqarscouts.org / leader@dhulfiqarscouts.org',
    notes: '4th Grade assistant leader'
  },
  {
    grade: '5th Grade',
    taliahRank: 'Arrow of Light - 5th',
    taliahName: 'Ṭalīʿat Amīr al-Muʾminīn (ʿa)',
    role: 'Patrol Leader',
    name: 'Tamer Safwan',
    username: 'tsafwan',
    initialPassword: DEFAULT_PASSWORD,
    email: 'tsafwan@dhulfiqarscouts.org',
    scoutsCount: 14,
    supportContact: 'admin@dhulfiqarscouts.org / leader@dhulfiqarscouts.org',
    notes: '5th Grade patrol leader'
  },
  {
    grade: '5th Grade',
    taliahRank: 'Arrow of Light - 5th',
    taliahName: 'Ṭalīʿat Amīr al-Muʾminīn (ʿa)',
    role: 'Assistant Leader',
    name: 'Mohamed Hussein Mussa',
    username: 'mmussa',
    initialPassword: DEFAULT_PASSWORD,
    email: 'mmussa@dhulfiqarscouts.org',
    scoutsCount: 14,
    supportContact: 'admin@dhulfiqarscouts.org / leader@dhulfiqarscouts.org',
    notes: '5th Grade assistant leader'
  },
  {
    grade: '5th Grade',
    taliahRank: 'Arrow of Light - 5th',
    taliahName: 'Ṭalīʿat Amīr al-Muʾminīn (ʿa)',
    role: 'Assistant Leader',
    name: 'Mohammad Haidar-Ahmad',
    username: 'mhaidarahmad',
    initialPassword: DEFAULT_PASSWORD,
    email: 'mhaidarahmad@dhulfiqarscouts.org',
    scoutsCount: 14,
    supportContact: 'admin@dhulfiqarscouts.org / leader@dhulfiqarscouts.org',
    notes: '5th Grade assistant leader'
  },
  {
    grade: '6th Grade',
    taliahRank: 'Patrol 1 - 6th',
    taliahName: 'Ṭalīʿat ʿIshāq al-Ḥusayn (ʿa)',
    role: 'Patrol Leader',
    name: 'Mohamad Jalloul',
    username: 'mjalloul',
    initialPassword: DEFAULT_PASSWORD,
    email: 'mjalloul@dhulfiqarscouts.org',
    scoutsCount: 12,
    supportContact: 'admin@dhulfiqarscouts.org / leader@dhulfiqarscouts.org',
    notes: '6th Grade patrol leader'
  },
  {
    grade: '6th Grade',
    taliahRank: 'Patrol 1 - 6th',
    taliahName: 'Ṭalīʿat ʿIshāq al-Ḥusayn (ʿa)',
    role: 'Assistant Leader',
    name: 'Hamze Berro',
    username: 'hberro',
    initialPassword: DEFAULT_PASSWORD,
    email: 'hberro@dhulfiqarscouts.org',
    scoutsCount: 12,
    supportContact: 'admin@dhulfiqarscouts.org / leader@dhulfiqarscouts.org',
    notes: '6th Grade assistant leader'
  },
  {
    grade: '7th Grade',
    taliahRank: 'Patrol 2 - 6th/7th',
    taliahName: 'Ṭalīʿat Abū al-Faḍl al-ʿAbbās',
    role: 'Patrol Leader',
    name: 'Hassan Issa',
    username: 'hissa',
    initialPassword: DEFAULT_PASSWORD,
    email: 'hissa@dhulfiqarscouts.org',
    scoutsCount: 13,
    supportContact: 'admin@dhulfiqarscouts.org / leader@dhulfiqarscouts.org',
    notes: '7th Grade patrol leader'
  },
  {
    grade: '7th Grade',
    taliahRank: 'Patrol 2 - 6th/7th',
    taliahName: 'Ṭalīʿat Abū al-Faḍl al-ʿAbbās',
    role: 'Assistant Leader',
    name: 'Ibrahim Alwishah',
    username: 'ialwishah',
    initialPassword: DEFAULT_PASSWORD,
    email: 'ialwishah@dhulfiqarscouts.org',
    scoutsCount: 13,
    supportContact: 'admin@dhulfiqarscouts.org / leader@dhulfiqarscouts.org',
    notes: '7th Grade assistant leader'
  },
  {
    grade: '8th Grade',
    taliahRank: 'Patrol 3 - 8th',
    taliahName: 'Ṭalīʿat al-Bāqir (ʿa)',
    role: 'Patrol Leader',
    name: 'Hasan Yahfoufi',
    username: 'hyahfoufi8',
    initialPassword: DEFAULT_PASSWORD,
    email: 'hyahfoufi8@dhulfiqarscouts.org',
    scoutsCount: 8,
    supportContact: 'admin@dhulfiqarscouts.org / leader@dhulfiqarscouts.org',
    notes: '8th Grade patrol leader'
  },
  {
    grade: '8th Grade',
    taliahRank: 'Patrol 3 - 8th',
    taliahName: 'Ṭalīʿat al-Bāqir (ʿa)',
    role: 'Assistant Leader',
    name: 'Ibrahim Hassan',
    username: 'ihassan',
    initialPassword: DEFAULT_PASSWORD,
    email: 'ihassan@dhulfiqarscouts.org',
    scoutsCount: 8,
    supportContact: 'admin@dhulfiqarscouts.org / leader@dhulfiqarscouts.org',
    notes: '8th Grade assistant leader'
  },
  {
    grade: '9th Grade',
    taliahRank: 'Patrol 4 - 9th',
    taliahName: 'Ṭalīʿat Asadullāh (ʿa)',
    role: 'Patrol Leader',
    name: 'Mustapha Mourtada',
    username: 'mmourtada',
    initialPassword: DEFAULT_PASSWORD,
    email: 'mmourtada@dhulfiqarscouts.org',
    scoutsCount: 9,
    supportContact: 'admin@dhulfiqarscouts.org / leader@dhulfiqarscouts.org',
    notes: '9th Grade patrol leader'
  },
  {
    grade: '10th / 11th Grade',
    taliahRank: 'Patrol 5 - 10th/11th',
    taliahName: 'Ṭalīʿat Abā ʿAbdillāh (ʿa)',
    role: 'Patrol Leader',
    name: 'Mustapha Choucair',
    username: 'mchoucair',
    initialPassword: DEFAULT_PASSWORD,
    email: 'mchoucair@dhulfiqarscouts.org',
    scoutsCount: 11,
    supportContact: 'admin@dhulfiqarscouts.org / leader@dhulfiqarscouts.org',
    notes: 'Combined senior unit leader'
  },
  {
    grade: '10th / 11th Grade',
    taliahRank: 'Patrol 5 - 10th/11th',
    taliahName: 'Ṭalīʿat Abā ʿAbdillāh (ʿa)',
    role: 'Patrol Leader',
    name: 'Ali Harajli',
    username: 'aharajli',
    initialPassword: DEFAULT_PASSWORD,
    email: 'aharajli@dhulfiqarscouts.org',
    scoutsCount: 11,
    supportContact: 'admin@dhulfiqarscouts.org / leader@dhulfiqarscouts.org',
    notes: 'Combined senior unit leader'
  }
];

async function generateMasterFiles() {
  console.log('🚀 Generating Dhulfiqar Scouts Master Leader Directory & Guides...');

  // ==========================================
  // 1. GENERATE MASTER CSV
  // ==========================================
  const csvHeaders = [
    'Grade / Unit',
    'Ṭalīʿah Rank',
    'Ṭalīʿah Arabic Name',
    'Leadership Role',
    'Leader Full Name',
    'Username',
    'Initial Default Password',
    'Firebase Email',
    'Assigned Scouts',
    'Help & Recovery Admin Contact',
    'Notes & Permissions'
  ];

  const csvRows = [
    csvHeaders.join(','),
    ...LEADER_DIRECTORY.map(a => [
      `"${a.grade}"`,
      `"${a.taliahRank}"`,
      `"${a.taliahName}"`,
      `"${a.role}"`,
      `"${a.name}"`,
      `"${a.username}"`,
      `"${a.initialPassword}"`,
      `"${a.email}"`,
      a.scoutsCount,
      `"${a.supportContact}"`,
      `"${a.notes}"`
    ].join(','))
  ];

  const csvContent = csvRows.join('\n');

  const csvOutputs = [
    path.join(projectRoot, 'Dhulfiqar_Scouts_Master_Leader_Directory.csv'),
    path.join(projectRoot, 'Dhulfiqar_Scouts_Leader_Logins.csv'),
    path.join(publicDir, 'Dhulfiqar_Scouts_Master_Leader_Directory.csv'),
    path.join(publicDir, 'Dhulfiqar_Scouts_Leader_Logins.csv'),
    path.join(artifactDir, 'Dhulfiqar_Scouts_Leader_Logins.csv')
  ];

  for (const p of csvOutputs) {
    fs.writeFileSync(p, csvContent, 'utf8');
    console.log(`✓ CSV Saved: ${p}`);
  }

  // ==========================================
  // 2. GENERATE MASTER EXCEL WORKBOOK (.xlsx)
  // ==========================================
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Dhulfiqār Scouting Program';
  workbook.lastModifiedBy = 'Troop Admin & Command';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Load logo image if available
  const logoPath = path.join(publicDir, 'scouts_logo.png');
  let logoImageId = null;
  if (fs.existsSync(logoPath)) {
    logoImageId = workbook.addImage({
      filename: logoPath,
      extension: 'png'
    });
  }

  // ----------------------------------------------------------------
  // SHEET 1: ⚜️ Leader Directory & Logins
  // ----------------------------------------------------------------
  const sheet1 = workbook.addWorksheet('Leader & Ṭalīʿah Directory', {
    views: [{ showGridLines: true }]
  });

  // Top Banner: Title & System Information
  sheet1.mergeCells('B1:K1');
  const titleCell = sheet1.getCell('B1');
  titleCell.value = '⚜️ DHULFIQĀR SCOUTS — 2026–2027 MASTER LEADER & ṬALĪʿAH DIRECTORY';
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF123C2D' } }; // Forest Green
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet1.getRow(1).height = 34;

  sheet1.mergeCells('B2:K2');
  const subCell = sheet1.getCell('B2');
  subCell.value = `📲 Live App: ${APP_URL}   |   🔑 Initial Password: ${DEFAULT_PASSWORD}   |   Total Registered Scouts: 124`;
  subCell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FF123C2D' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F2E7' } }; // Cream
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet1.getRow(2).height = 24;

  // Support Contacts Callout Box
  sheet1.mergeCells('B3:K3');
  const adminBannerCell = sheet1.getCell('B3');
  adminBannerCell.value = '🛡️ DEDICATED ADMIN SUPPORT & PASSWORD RECOVERY CONTACTS:  [1] Troop Leader (@leader - leader@dhulfiqarscouts.org)  •  [2] Troop Admin (@admin - admin@dhulfiqarscouts.org)';
  adminBannerCell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF92400E' } }; // Amber dark
  adminBannerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // Light Amber/Gold
  adminBannerCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet1.getRow(3).height = 24;

  // Blank spacing row
  sheet1.getRow(4).height = 10;

  // Embed Logo at A1:A3
  if (logoImageId !== null) {
    sheet1.addImage(logoImageId, {
      tl: { col: 0.1, row: 0.1 },
      ext: { width: 75, height: 75 }
    });
  }

  // Table Headers
  const tableHeaders = [
    'Grade / Unit',
    'Ṭalīʿah Rank',
    'Ṭalīʿah Group Name',
    'Leadership Role',
    'Full Name',
    'Username',
    'Initial Password',
    'Firebase Email',
    'Scouts',
    'Password Support Admin',
    'Notes & Permissions'
  ];

  const headerRow = sheet1.getRow(5);
  tableHeaders.forEach((th, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = th;
    cell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB99645' } }; // Gold
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF123C2D' } },
      left: { style: 'thin', color: { argb: 'FFD4AF37' } },
      bottom: { style: 'medium', color: { argb: 'FF123C2D' } },
      right: { style: 'thin', color: { argb: 'FFD4AF37' } }
    };
  });
  headerRow.height = 28;

  // Populate Leader Data
  LEADER_DIRECTORY.forEach((leader, idx) => {
    const rowNumber = idx + 6;
    const row = sheet1.getRow(rowNumber);
    row.values = [
      leader.grade,
      leader.taliahRank,
      leader.taliahName,
      leader.role,
      leader.name,
      leader.username,
      leader.initialPassword,
      leader.email,
      leader.scoutsCount,
      leader.supportContact,
      leader.notes
    ];
    row.height = 23;

    const isAdmin = leader.username === 'admin' || leader.username === 'leader';
    const isEven = idx % 2 === 0;
    const rowBg = isAdmin ? 'FFF0FDF4' : (isEven ? 'FFFFFFFF' : 'FFFAF8F5'); // Soft green for admin rows, alternating soft cream/white

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      // Alignment & Styling specializations
      if (colNumber === 1 || colNumber === 2) {
        cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF123C2D' } };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else if (colNumber === 3) {
        cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F766E' } };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else if (colNumber === 4) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (isAdmin) {
          cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF166534' } };
        }
      } else if (colNumber === 5) {
        cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else if (colNumber === 6) {
        // Username
        cell.font = { name: 'Consolas', size: 10, bold: true, color: { argb: 'FF1E40AF' } }; // Navy Blue
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber === 7) {
        // Password
        cell.font = { name: 'Consolas', size: 10, bold: true, color: { argb: 'FFB91C1C' } }; // Ruby Red
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber === 8) {
        // Email
        cell.font = { name: 'Consolas', size: 9, color: { argb: 'FF475569' } };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else if (colNumber === 9) {
        // Scouts Count
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF123C2D' } };
      } else if (colNumber === 10) {
        // Support Contact
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF92400E' } };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  });

  // Column Widths for Sheet 1
  sheet1.columns = [
    { width: 20 }, // Grade / Unit
    { width: 22 }, // Taliah Rank
    { width: 30 }, // Taliah Arabic Name
    { width: 22 }, // Leadership Role
    { width: 26 }, // Full Name
    { width: 16 }, // Username
    { width: 18 }, // Password
    { width: 32 }, // Firebase Email
    { width: 12 }, // Scouts
    { width: 34 }, // Support Contact
    { width: 48 }  // Notes
  ];

  // ----------------------------------------------------------------
  // SHEET 2: 🛡️ Admin Password Recovery & Support Guide
  // ----------------------------------------------------------------
  const sheet2 = workbook.addWorksheet('Admin Support & Recovery', {
    views: [{ showGridLines: true }]
  });

  sheet2.mergeCells('A1:G1');
  const s2Title = sheet2.getCell('A1');
  s2Title.value = '🛡️ ADMIN PROTOCOL: PASSWORD RECOVERY & LEADER SUPPORT WORKFLOW';
  s2Title.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  s2Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF123C2D' } };
  s2Title.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet2.getRow(1).height = 32;

  sheet2.mergeCells('A2:G2');
  const s2Sub = sheet2.getCell('A2');
  s2Sub.value = 'Designated Support Administrators: Troop Leader (@leader) & Troop Admin (@admin)';
  s2Sub.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF123C2D' } };
  s2Sub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F2E7' } };
  s2Sub.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet2.getRow(2).height = 22;

  // Blank row
  sheet2.getRow(3).height = 12;

  // Table of Admin Contacts
  const adminHeaders = ['Admin Role', 'Full Name', 'Username', 'Firebase Auth Email', 'Support Scope', 'Direct WhatsApp / Help Desk'];
  const aHeadRow = sheet2.getRow(4);
  adminHeaders.forEach((h, i) => {
    const c = aHeadRow.getCell(i + 1);
    c.value = h;
    c.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB99645' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  aHeadRow.height = 24;

  ADMIN_SUPPORT_CONTACTS.forEach((adm, idx) => {
    const r = sheet2.getRow(idx + 5);
    r.values = [
      adm.role,
      adm.name,
      `@${adm.username}`,
      adm.email,
      adm.supportScope,
      'Available via Troop Leadership WhatsApp Channel'
    ];
    r.height = 22;
    r.eachCell((cell, cNum) => {
      cell.font = { name: 'Arial', size: 9.5 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
      if (cNum === 3) {
        cell.font = { name: 'Consolas', size: 9.5, bold: true, color: { argb: 'FF1E40AF' } };
      }
    });
  });

  // Step-by-Step Recovery Protocol
  sheet2.getRow(8).height = 14;
  sheet2.mergeCells('A9:G9');
  const stepTitle = sheet2.getCell('A9');
  stepTitle.value = '📋 STEP-BY-STEP LEADER PASSWORD RECOVERY PROCEDURE (FOR ADMINS):';
  stepTitle.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF123C2D' } };
  stepTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  sheet2.getRow(9).height = 24;

  const recoverySteps = [
    {
      step: 'Step 1: Verify Identity',
      detail: 'Leader contacts @leader or @admin requesting a password reset if they forgot their custom password.',
      action: 'Confirm the leader\'s full name, grade unit, and username in Sheet 1.'
    },
    {
      step: 'Step 2: Firebase Console Reset',
      detail: 'Admin opens Google Firebase Console -> Authentication -> Users tab.',
      action: 'Search the leader\'s email (e.g. bdabaja@dhulfiqarscouts.org), click the 3 dots menu, and select "Reset Password" or set temporary password.'
    },
    {
      step: 'Step 3: In-App Portal Reset',
      detail: 'Admin logs into https://scout-tracker-tau.vercel.app/ as @admin or @leader.',
      action: 'Navigate to ⚙️ Portal -> Leader Accounts -> Locate Leader -> Click "Reset to Default (scouts2026)".'
    },
    {
      step: 'Step 4: Notify Leader & Change',
      detail: 'Leader logs in with default password scouts2026.',
      action: 'Leader goes to ⚙️ Portal -> "Security & Password Management" to set their new private password.'
    }
  ];

  recoverySteps.forEach((st, idx) => {
    const row = sheet2.getRow(idx + 10);
    row.values = [st.step, st.detail, '', st.action];
    sheet2.mergeCells(`B${idx + 10}:C${idx + 10}`);
    sheet2.mergeCells(`D${idx + 10}:G${idx + 10}`);
    row.height = 26;

    row.eachCell((cell, cNum) => {
      cell.font = { name: 'Arial', size: 9.5 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
      if (cNum === 1) {
        cell.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF123C2D' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    });
  });

  sheet2.columns = [
    { width: 24 },
    { width: 30 },
    { width: 20 },
    { width: 32 },
    { width: 38 },
    { width: 40 },
    { width: 20 }
  ];

  // ----------------------------------------------------------------
  // SHEET 3: 📲 WhatsApp Quick Setup Guide
  // ----------------------------------------------------------------
  const sheet3 = workbook.addWorksheet('WhatsApp Quick-Start Guide', {
    views: [{ showGridLines: true }]
  });

  sheet3.mergeCells('A1:E1');
  const s3Title = sheet3.getCell('A1');
  s3Title.value = '📲 WHATSAPP BROADCAST MESSAGE TEMPLATE FOR LEADERS';
  s3Title.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  s3Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF123C2D' } };
  s3Title.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet3.getRow(1).height = 32;

  const whatsappLines = [
    '⚜️ DHULFIQĀR SCOUT TRACKER — LEADER ONBOARDING & SETUP GUIDE ⚜️',
    'Salam Alaykum Leaders! 🌲',
    'We are excited to launch the official Dhulfiqār Scout Tracker app for our 2026–2027 scouting year.',
    `📲 APP LINK: ${APP_URL}`,
    '',
    '📱 STEP 1: INSTALL ON YOUR PHONE (ADD TO HOME SCREEN)',
    '🍏 For iPhone / iPad users (MUST use Safari):',
    '   1. Open link in Safari -> Tap Share (square with arrow ⬆️) -> Tap "Add to Home Screen" -> Tap Add.',
    '🤖 For Android users (MUST use Chrome):',
    '   1. Open link in Chrome -> Tap 3 dots (⋮) -> Tap "Install app" or "Add to Home screen" -> Tap Install.',
    '',
    '🔑 STEP 2: HOW TO LOG IN',
    '   1. Select your name & Ṭalīʿah in the dropdown.',
    '   2. Initial Default Password: scouts2026',
    '   3. Tap Sign In.',
    '',
    '🔒 STEP 3: CHANGE YOUR PASSWORD (MANDATORY)',
    '   1. Go to ⚙️ Portal tab -> "Security & Password Management".',
    '   2. Enter current password (scouts2026) -> Enter new private password -> Tap Update Password.',
    '',
    '🧪 STEP 4: PRACTICE WITH TEST 1 & TEST 2 SANDBOXES',
    '   • Test 1 (2026-09-25): Practice Check-In (Present / Absent / Excused).',
    '   • Test 2 (2026-09-28): Practice Star Ratings in 🛡️ Duties & Point Adjustments in 👥 Roster.',
    '',
    '🛡️ PASSWORD RECOVERY & ADMIN SUPPORT:',
    '   If you ever forget your password or need assistance, please message our 2 Troop Admins:',
    '   • Troop Leader: leader@dhulfiqarscouts.org (@leader)',
    '   • Troop Admin: admin@dhulfiqarscouts.org (@admin)'
  ];

  whatsappLines.forEach((line, idx) => {
    const r = sheet3.getRow(idx + 3);
    r.getCell(1).value = line;
    sheet3.mergeCells(`A${idx + 3}:E${idx + 3}`);
    r.height = line.startsWith('⚜️') || line.startsWith('📱') || line.startsWith('🔑') || line.startsWith('🔒') || line.startsWith('🧪') || line.startsWith('🛡️') ? 22 : 18;

    const cell = r.getCell(1);
    if (line.startsWith('⚜️')) {
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF123C2D' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F2E7' } };
    } else if (line.startsWith('📱') || line.startsWith('🔑') || line.startsWith('🔒') || line.startsWith('🧪') || line.startsWith('🛡️')) {
      cell.font = { name: 'Arial', size: 10.5, bold: true, color: { argb: 'FF123C2D' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    } else if (line.includes('APP LINK:')) {
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1D4ED8' } };
    } else {
      cell.font = { name: 'Arial', size: 9.5, color: { argb: 'FF1E293B' } };
    }
  });

  sheet3.columns = [
    { width: 100 },
    { width: 20 },
    { width: 20 },
    { width: 20 },
    { width: 20 }
  ];

  // Save Excel Workbooks
  const xlsxOutputs = [
    path.join(projectRoot, 'Dhulfiqar_Scouts_Master_Leader_Directory.xlsx'),
    path.join(projectRoot, 'Dhulfiqar_Scouts_Leader_Logins.xlsx'),
    path.join(publicDir, 'Dhulfiqar_Scouts_Master_Leader_Directory.xlsx'),
    path.join(publicDir, 'Dhulfiqar_Scouts_Leader_Logins.xlsx'),
    path.join(artifactDir, 'Dhulfiqar_Scouts_Leader_Logins.xlsx')
  ];

  for (const p of xlsxOutputs) {
    await workbook.xlsx.writeFile(p);
    console.log(`✓ Excel Workbook Saved: ${p}`);
  }

  console.log('🎉 All Excel and CSV directories generated successfully with embedded logo and admin support link!');
}

generateMasterFiles().catch(console.error);
