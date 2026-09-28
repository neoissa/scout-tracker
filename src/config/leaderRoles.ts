// src/config/leaderRoles.ts

export interface LeaderProfile {
  email: string;
  name: string;
  assignedGrade: string; // Must match the Grade string in your roster
  role: 'LEADER' | 'ASST_LEADER' | 'ADMIN';
}

export const LEADER_ROLE_MAP: Record<string, LeaderProfile> = {
  // Admin with full access across all grades
  'leader@dhulfiqarscouts.org': { email: 'leader@dhulfiqarscouts.org', name: 'Troop Leader', assignedGrade: 'ALL', role: 'ADMIN' },

  // Grade/Patrol Specific Leaders
  'bdabaja@gmail.com': { email: 'bdabaja@gmail.com', name: 'Bilal Dabaja', assignedGrade: 'Kindergarten', role: 'LEADER' },
  'nchamseddine@gmail.com': { email: 'nchamseddine@gmail.com', name: 'Nader Chamseddine', assignedGrade: '1st Grade', role: 'LEADER' },
  'jhazime@gmail.com': { email: 'jhazime@gmail.com', name: 'Jawad Hazime', assignedGrade: '2nd Grade', role: 'LEADER' },
  'hyahfoufi@gmail.com': { email: 'hyahfoufi@gmail.com', name: 'Hussein Yahfoufi', assignedGrade: '3rd Grade', role: 'LEADER' },
  'aayash@gmail.com': { email: 'aayash@gmail.com', name: 'Ayman Ayash', assignedGrade: '4th Grade', role: 'LEADER' },
  'tsafwan@gmail.com': { email: 'tsafwan@gmail.com', name: 'Tamer Safwan', assignedGrade: '5th Grade', role: 'LEADER' },
  'mjalloul@gmail.com': { email: 'mjalloul@gmail.com', name: 'Mohamad Jalloul', assignedGrade: '6th Grade', role: 'LEADER' },
  'hissa@gmail.com': { email: 'hissa@gmail.com', name: 'Hassan Issa', assignedGrade: '7th Grade', role: 'LEADER' },
  'hyahfoufi8@gmail.com': { email: 'hyahfoufi8@gmail.com', name: 'Hasan Yahfoufi', assignedGrade: '8th Grade', role: 'LEADER' },
  'mmourtada@gmail.com': { email: 'mmourtada@gmail.com', name: 'Mustapha Mourtada', assignedGrade: '9th Grade', role: 'LEADER' },
  'mchoucair@gmail.com': { email: 'mchoucair@gmail.com', name: 'Mustapha Choucair', assignedGrade: '10th Grade', role: 'LEADER' },
  'aharajli@gmail.com': { email: 'aharajli@gmail.com', name: 'Ali Harajli', assignedGrade: '11th Grade', role: 'LEADER' },
};
