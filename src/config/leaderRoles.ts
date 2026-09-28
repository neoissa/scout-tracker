// src/config/leaderRoles.ts

export interface LeaderProfile {
  username: string;
  email?: string;
  name: string;
  assignedGrade: string; // Must match the Grade string in your roster, or 'ALL'
  role: 'LEADER' | 'ASST_LEADER' | 'ADMIN';
}

export const LEADER_PROFILES: LeaderProfile[] = [
  // Admin with full access across all grades
  {
    username: 'leader',
    email: 'leader@dhulfiqarscouts.org',
    name: 'Troop Leader',
    assignedGrade: 'ALL',
    role: 'ADMIN'
  },
  {
    username: 'admin',
    email: 'admin@dhulfiqarscouts.org',
    name: 'Troop Admin',
    assignedGrade: 'ALL',
    role: 'ADMIN'
  },

  // Kindergarten
  {
    username: 'bdabaja',
    name: 'Bilal Dabaja',
    assignedGrade: 'Kindergarten',
    role: 'LEADER'
  },

  // 1st Grade
  {
    username: 'nchamseddine',
    name: 'Nader Chamseddine',
    assignedGrade: '1st Grade',
    role: 'LEADER'
  },
  {
    username: 'msoueidan',
    name: 'Mohamad Ali Soueidan',
    assignedGrade: '1st Grade',
    role: 'ASST_LEADER'
  },

  // 2nd Grade
  {
    username: 'jhazime',
    name: 'Jawad Hazime',
    assignedGrade: '2nd Grade',
    role: 'LEADER'
  },
  {
    username: 'amohsen',
    name: 'Ahmad Mohsen',
    assignedGrade: '2nd Grade',
    role: 'ASST_LEADER'
  },

  // 3rd Grade
  {
    username: 'hyahfoufi',
    name: 'Hussein Yahfoufi',
    assignedGrade: '3rd Grade',
    role: 'LEADER'
  },
  {
    username: 'bsaleh',
    name: 'Basel Saleh',
    assignedGrade: '3rd Grade',
    role: 'ASST_LEADER'
  },

  // 4th Grade
  {
    username: 'aayash',
    name: 'Ayman Ayash',
    assignedGrade: '4th Grade',
    role: 'LEADER'
  },
  {
    username: 'mhammoud',
    name: 'Mahdi Hammoud',
    assignedGrade: '4th Grade',
    role: 'ASST_LEADER'
  },
  {
    username: 'afardous',
    name: 'Abbas Fardous',
    assignedGrade: '4th Grade',
    role: 'ASST_LEADER'
  },

  // 5th Grade
  {
    username: 'tsafwan',
    name: 'Tamer Safwan',
    assignedGrade: '5th Grade',
    role: 'LEADER'
  },
  {
    username: 'mmussa',
    name: 'Mohamed Hussein Mussa',
    assignedGrade: '5th Grade',
    role: 'ASST_LEADER'
  },
  {
    username: 'mhaidarahmad',
    name: 'Mohammad Haidar-Ahmad',
    assignedGrade: '5th Grade',
    role: 'ASST_LEADER'
  },

  // 6th Grade
  {
    username: 'mjalloul',
    name: 'Mohamad Jalloul',
    assignedGrade: '6th Grade',
    role: 'LEADER'
  },
  {
    username: 'hberro',
    name: 'Hamze Berro',
    assignedGrade: '6th Grade',
    role: 'ASST_LEADER'
  },

  // 7th Grade
  {
    username: 'hissa',
    name: 'Hassan Issa',
    assignedGrade: '7th Grade',
    role: 'LEADER'
  },
  {
    username: 'ialwishah',
    name: 'Ibrahim Alwishah',
    assignedGrade: '7th Grade',
    role: 'ASST_LEADER'
  },

  // 8th Grade
  {
    username: 'hyahfoufi8',
    name: 'Hasan Yahfoufi',
    assignedGrade: '8th Grade',
    role: 'LEADER'
  },
  {
    username: 'ihassan',
    name: 'Ibrahim Hassan',
    assignedGrade: '8th Grade',
    role: 'ASST_LEADER'
  },

  // 9th Grade
  {
    username: 'mmourtada',
    name: 'Mustapha Mourtada',
    assignedGrade: '9th Grade',
    role: 'LEADER'
  },

  // Combined 10th & 11th Grade (Accessible by both Leaders)
  {
    username: 'mchoucair',
    name: 'Mustapha Choucair',
    assignedGrade: '10th / 11th Grade',
    role: 'LEADER'
  },
  {
    username: 'aharajli',
    name: 'Ali Harajli',
    assignedGrade: '10th / 11th Grade',
    role: 'LEADER'
  }
];

// Lookup map by username and email
export const LEADER_ROLE_MAP: Record<string, LeaderProfile> = {};

for (const profile of LEADER_PROFILES) {
  // Key by username
  LEADER_ROLE_MAP[profile.username.toLowerCase()] = profile;
  
  // Also key by email if exists, or generate fallback keys for backward compatibility
  if (profile.email) {
    LEADER_ROLE_MAP[profile.email.toLowerCase()] = profile;
  }
  LEADER_ROLE_MAP[`${profile.username.toLowerCase()}@gmail.com`] = profile;
  LEADER_ROLE_MAP[`${profile.username.toLowerCase()}@dhulfiqarscouts.org`] = profile;
}

export function findLeaderProfile(input?: string | null): LeaderProfile | undefined {
  if (!input) return undefined;
  const clean = input.trim().toLowerCase();
  
  // Exact match
  if (LEADER_ROLE_MAP[clean]) {
    return LEADER_ROLE_MAP[clean];
  }
  
  // Check if stripped username matches
  const usernamePart = clean.split('@')[0];
  if (LEADER_ROLE_MAP[usernamePart]) {
    return LEADER_ROLE_MAP[usernamePart];
  }

  return undefined;
}
