// src/config/accountabilityConfig.ts

export type AccountabilityCategory = 'BEHAVIOR' | 'DEVICES' | 'ATTENDANCE' | 'IMPROVEMENT' | 'CUSTOM';

export interface InfractionPreset {
  id: string;
  category: AccountabilityCategory;
  tier: string;
  points: number;
  title: string;
  description: string;
  severity: 'minor' | 'moderate' | 'serious' | 'major' | 'critical' | 'improvement';
}

export interface WarningStageInfo {
  stage: 'COACHING' | 'WARNING_1' | 'PARENT_CONFERENCE' | 'PROBATION' | 'FINAL_WARNING' | 'REMOVAL_REVIEW';
  label: string;
  pointRange: string;
  minPoints: number;
  action: string;
  color: string;
  badgeClass: string;
  icon: string;
  level: number;
}

// Exact stages from Point Accumulation Path slide
export const WARNING_STAGES: WarningStageInfo[] = [
  {
    stage: 'COACHING',
    label: 'Coaching',
    pointRange: '0–2 Points',
    minPoints: 0,
    action: 'Leader correction & counseling',
    color: '#123c2d',
    badgeClass: 'bg-[#f0f7f3] text-[#123c2d] border-[#d2e8db]',
    icon: '🟢',
    level: 0
  },
  {
    stage: 'WARNING_1',
    label: '1st Warning',
    pointRange: '3 Points',
    minPoints: 3,
    action: 'Formal scout warning',
    color: '#b99645',
    badgeClass: 'bg-[#fffcf0] text-[#854d0e] border-[#fef08a]',
    icon: '🟡',
    level: 1
  },
  {
    stage: 'PARENT_CONFERENCE',
    label: 'Parent Conference',
    pointRange: '5 Points',
    minPoints: 5,
    action: 'Second warning + parent involvement',
    color: '#ea580c',
    badgeClass: 'bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]',
    icon: '🟠',
    level: 2
  },
  {
    stage: 'PROBATION',
    label: 'Probation',
    pointRange: '7 Points',
    minPoints: 7,
    action: 'Camp/event eligibility subject to leadership approval',
    color: '#be123c',
    badgeClass: 'bg-[#fff1f2] text-[#be123c] border-[#fecdd3]',
    icon: '🔴',
    level: 3
  },
  {
    stage: 'FINAL_WARNING',
    label: 'Final Warning',
    pointRange: '9 Points',
    minPoints: 9,
    action: 'Enrollment at risk • possible suspension',
    color: '#dc2626',
    badgeClass: 'bg-[#fef2f2] text-[#991b1b] border-[#fecaca]',
    icon: '🚨',
    level: 4
  },
  {
    stage: 'REMOVAL_REVIEW',
    label: 'Removal Review',
    pointRange: '10+ Points',
    minPoints: 10,
    action: 'Presumption of removal unless mitigating circumstances exist',
    color: '#7f1d1d',
    badgeClass: 'bg-[#450a0a] text-[#fef2f2] border-[#991b1b]',
    icon: '⛔',
    level: 5
  }
];

// Helper to determine active warning stage based on points
export function getScoutWarningStage(points: number): WarningStageInfo {
  const pts = Math.max(0, points);
  if (pts >= 10) return WARNING_STAGES[5];
  if (pts >= 9) return WARNING_STAGES[4];
  if (pts >= 7) return WARNING_STAGES[3];
  if (pts >= 5) return WARNING_STAGES[2];
  if (pts >= 3) return WARNING_STAGES[1];
  return WARNING_STAGES[0];
}

// Exact Infraction Presets from Behavior, Devices & Attendance slides
export const INFRACTION_PRESETS: InfractionPreset[] = [
  // 1. BEHAVIOR POINTS (Slide 1)
  {
    id: 'beh_minor_1',
    category: 'BEHAVIOR',
    tier: 'Minor',
    points: 1,
    title: 'Minor Disruption / Horseplay',
    description: 'Repeated disruption after correction • routine horseplay • failure to follow normal instructions',
    severity: 'minor'
  },
  {
    id: 'beh_moderate_2',
    category: 'BEHAVIOR',
    tier: 'Moderate',
    points: 2,
    title: 'Disrespect / Inappropriate Language',
    description: 'Disrespect • unauthorized phone/device • inappropriate language • repeated disruption',
    severity: 'moderate'
  },
  {
    id: 'beh_serious_3',
    category: 'BEHAVIOR',
    tier: 'Serious',
    points: 3,
    title: 'Profanity / Bullying / Aggressive Behavior',
    description: 'Profanity/vulgarity • bullying • aggressive behavior • lying to avoid accountability • leaving assigned area',
    severity: 'serious'
  },
  {
    id: 'beh_major_4',
    category: 'BEHAVIOR',
    tier: 'Major',
    points: 4,
    title: 'Targeted Severe Vulgarity / Defiance',
    description: 'Targeted severe vulgarity • fighting • serious defiance • intentional property damage • repeated bullying',
    severity: 'major'
  },
  {
    id: 'beh_major_5',
    category: 'BEHAVIOR',
    tier: 'Major',
    points: 5,
    title: 'Physical Fighting / Property Damage',
    description: 'Severe physical fight • intentional severe property damage • serious defiance',
    severity: 'major'
  },
  {
    id: 'beh_critical_6',
    category: 'BEHAVIOR',
    tier: 'Critical',
    points: 6,
    title: 'Explicit Content / Serious Threats',
    description: 'Sexually explicit/pornographic content • deliberately exposing others • serious threats/violence • major youth-safety violation',
    severity: 'critical'
  },
  {
    id: 'beh_critical_8',
    category: 'BEHAVIOR',
    tier: 'Critical',
    points: 8,
    title: 'Deliberate Exposing / Major Safety Violation',
    description: 'Deliberately exposing others to explicit material • severe violence or credible threat',
    severity: 'critical'
  },
  {
    id: 'beh_critical_10',
    category: 'BEHAVIOR',
    tier: 'Critical',
    points: 10,
    title: 'Major Youth-Safety Violation (Removal Review)',
    description: 'Severe sexual/violent misconduct • immediate removal review triggered',
    severity: 'critical'
  },

  // 2. DEVICES & INAPPROPRIATE CONTENT (Slide 2)
  {
    id: 'dev_unauthorized_2',
    category: 'DEVICES',
    tier: 'Devices',
    points: 2,
    title: 'Unauthorized Phone / Device',
    description: 'Bringing or using a device contrary to program rules.',
    severity: 'moderate'
  },
  {
    id: 'dev_repeated_3',
    category: 'DEVICES',
    tier: 'Devices',
    points: 3,
    title: 'Repeated Device Violation',
    description: 'Continued unauthorized use after a previous violation.',
    severity: 'serious'
  },
  {
    id: 'dev_misuse_4',
    category: 'DEVICES',
    tier: 'Devices',
    points: 4,
    title: 'Serious Device Misuse (4 Pts)',
    description: 'Improper recording, disruption, or accessing clearly inappropriate material.',
    severity: 'major'
  },
  {
    id: 'dev_misuse_5',
    category: 'DEVICES',
    tier: 'Devices',
    points: 5,
    title: 'Serious Device Misuse (5 Pts)',
    description: 'Severe unauthorized recording or major device disruption.',
    severity: 'major'
  },
  {
    id: 'dev_explicit_6',
    category: 'DEVICES',
    tier: 'Devices',
    points: 6,
    title: 'Explicit Content View (6 Pts)',
    description: 'Viewing sexually explicit/pornographic or similarly severe material during a program.',
    severity: 'critical'
  },
  {
    id: 'dev_exposing_8',
    category: 'DEVICES',
    tier: 'Devices',
    points: 8,
    title: 'Exposing Others to Explicit Content (8 Pts)',
    description: 'Intentionally showing, sending, or exposing another scout to severe explicit content.',
    severity: 'critical'
  },
  {
    id: 'dev_exposing_10',
    category: 'DEVICES',
    tier: 'Devices',
    points: 10,
    title: 'Severe Distribution to Others (10 Pts)',
    description: 'Severe and deliberate distribution of explicit material to multiple scouts.',
    severity: 'critical'
  },

  // 3. ATTENDANCE POINTS (Slide 3)
  {
    id: 'att_late_05',
    category: 'ATTENDANCE',
    tier: 'Attendance',
    points: 0.5,
    title: 'Unexcused Late Arrival (0.5 Pt)',
    description: 'Unexcused late arrival. The goal is to build punctuality and respect for the Ṭalīʿah and program schedule.',
    severity: 'minor'
  },
  {
    id: 'att_absent_1',
    category: 'ATTENDANCE',
    tier: 'Attendance',
    points: 1,
    title: 'Unexcused Absence (1 Pt)',
    description: 'Unexcused absence from a regular program. (Reasonable excused absences receive no points).',
    severity: 'minor'
  },
  {
    id: 'att_noshow_1',
    category: 'ATTENDANCE',
    tier: 'Attendance',
    points: 1,
    title: 'Committed Outing No-Show (1 Pt)',
    description: 'No-show after committing to an outing or required major activity.',
    severity: 'moderate'
  },
  {
    id: 'att_noshow_2',
    category: 'ATTENDANCE',
    tier: 'Attendance',
    points: 2,
    title: 'Major Activity Critical No-Show (2 Pts)',
    description: 'No-show after committing when planning/transportation depended on attendance.',
    severity: 'moderate'
  },

  // 4. IMPROVEMENT MATTERS (Slide 5)
  {
    id: 'imp_deduction_1',
    category: 'IMPROVEMENT',
    tier: 'Growth',
    points: -1,
    title: 'Demonstrated Improvement (-1 Pt)',
    description: 'After 6 consecutive program weeks without additional behavioral points—and with demonstrated improvement (Subject to leader approval).',
    severity: 'improvement'
  }
];
