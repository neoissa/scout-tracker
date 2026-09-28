// src/config/taliahConfig.ts

export interface TaliahDefinition {
  grade: string;
  taliahRank: string; // e.g. "Lions - KG", "Webelos - 4th", "Patrol 5 - 10th/11th"
  defaultName: string; // e.g. "Ṭalīʿat al-Mahdi (ʿaj)", "Ṭalīʿat TBD"
  category: 'Cub Scouts' | 'Webelos' | 'Scouts BSA' | 'Combined Senior';
  description?: string;
}

export const TALIAH_REGISTRY: Record<string, TaliahDefinition> = {
  'Kindergarten': {
    grade: 'Kindergarten',
    taliahRank: 'Lions - KG',
    defaultName: 'Ṭalīʿat al-Mahdi (ʿaj)',
    category: 'Cub Scouts'
  },
  '1st Grade': {
    grade: '1st Grade',
    taliahRank: 'Tigers - 1st',
    defaultName: 'Ṭalīʿat al-Muṣṭafā (ṣ)',
    category: 'Cub Scouts'
  },
  '2nd Grade': {
    grade: '2nd Grade',
    taliahRank: 'Wolf - 2nd',
    defaultName: 'Ṭalīʿat aṣ-Ṣādiq (ʿa)',
    category: 'Cub Scouts'
  },
  '3rd Grade': {
    grade: '3rd Grade',
    taliahRank: 'Bear - 3rd',
    defaultName: 'Ṭalīʿat ar-Riḍā (ʿa)',
    category: 'Cub Scouts'
  },
  '4th Grade': {
    grade: '4th Grade',
    taliahRank: 'Webelos - 4th',
    defaultName: 'Ṭalīʿat TBD',
    category: 'Webelos'
  },
  '5th Grade': {
    grade: '5th Grade',
    taliahRank: 'Arrow of Light - 5th',
    defaultName: 'Ṭalīʿat Amīr al-Muʾminīn (ʿa)',
    category: 'Webelos'
  },
  '6th Grade': {
    grade: '6th Grade',
    taliahRank: 'Patrol 1 - 6th',
    defaultName: 'Ṭalīʿat ʿIshāq al-Ḥusayn (ʿa)',
    category: 'Scouts BSA'
  },
  '7th Grade': {
    grade: '7th Grade',
    taliahRank: 'Patrol 2 - 6th/7th',
    defaultName: 'Ṭalīʿat Abū al-Faḍl al-ʿAbbās',
    category: 'Scouts BSA'
  },
  '8th Grade': {
    grade: '8th Grade',
    taliahRank: 'Patrol 3 - 8th',
    defaultName: 'Ṭalīʿat al-Bāqir (ʿa)',
    category: 'Scouts BSA'
  },
  '9th Grade': {
    grade: '9th Grade',
    taliahRank: 'Patrol 4 - 9th',
    defaultName: 'Ṭalīʿat Asadullāh (ʿa)',
    category: 'Scouts BSA'
  },
  '10th / 11th Grade': {
    grade: '10th / 11th Grade',
    taliahRank: 'Patrol 5 - 10th/11th',
    defaultName: 'Ṭalīʿat Abā ʿAbdillāh (ʿa)',
    category: 'Combined Senior'
  }
};

const STORAGE_KEY = 'dhulfiqar_custom_taliah_names';

// Get saved custom names from localStorage
export function getSavedTaliahNames(): Record<string, string> {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load custom Taliah names from storage:', err);
  }
  return {};
}

// Save custom name for a specific grade
export function setCustomTaliahName(grade: string, newName: string): Record<string, string> {
  const current = getSavedTaliahNames();
  const trimmed = newName.trim();
  if (!trimmed) {
    delete current[grade];
  } else {
    current[grade] = trimmed;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.error('Failed to save custom Taliah name:', err);
  }
  return current;
}

// Reset a specific grade or all grades
export function resetCustomTaliahName(grade?: string): Record<string, string> {
  const current = getSavedTaliahNames();
  if (grade) {
    delete current[grade];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } else {
    localStorage.removeItem(STORAGE_KEY);
    return {};
  }
  return current;
}

// Helper to get Taliah Rank and active Name for any grade
export function getTaliahForGrade(
  grade: string,
  customMap?: Record<string, string>
): { taliahRank: string; taliahName: string; isCustom: boolean; isTBD: boolean } {
  const def = TALIAH_REGISTRY[grade];
  if (!def) {
    return {
      taliahRank: grade,
      taliahName: grade,
      isCustom: false,
      isTBD: false
    };
  }

  const savedMap = customMap || getSavedTaliahNames();
  const customName = savedMap[grade];
  const activeName = customName && customName.trim().length > 0 ? customName.trim() : def.defaultName;
  const isTBD = activeName.toLowerCase().includes('tbd');

  return {
    taliahRank: def.taliahRank,
    taliahName: activeName,
    isCustom: !!customName && customName !== def.defaultName,
    isTBD
  };
}
