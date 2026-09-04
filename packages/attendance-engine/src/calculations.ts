// Core Attendance Calculations Engine

export interface AttendanceData {
  attended: number;
  conducted: number;
}

export interface RiskLevel {
  level: "safe" | "warning" | "critical";
  percentage: number;
  message: string;
}

/**
 * Calculate attendance percentage
 * Handles edge cases: 0 conducted, invalid inputs
 */
export function calculateAttendance(data: AttendanceData): number {
  const { attended, conducted } = data;

  if (attended < 0 || conducted < 0) {
    throw new Error("Attendance values cannot be negative");
  }

  if (attended > conducted) {
    throw new Error("Attended cannot exceed conducted classes");
  }

  if (conducted === 0) return 0;
  return (attended / conducted) * 100;
}



export type AttendanceComponent = {
  name: string;
  attended: number;
  conducted: number;
  percentage?: number;
};

/** KLU component weights used for the subject-level percentage. */
export const KLU_COMPONENT_WEIGHTS = {
  Lecture: 1,
  Tutorial: 1,
  Practical: 0.5,
  Skill: 0.25,
  Other: 1,
} as const;

function componentWeight(name: string) {
  const value = name.trim().toLowerCase();
  if (value === 'l' || value.includes('lecture') || value.includes('theory')) return KLU_COMPONENT_WEIGHTS.Lecture;
  if (value === 't' || value.includes('tutorial')) return KLU_COMPONENT_WEIGHTS.Tutorial;
  if (value === 'p' || value.includes('practical') || value.includes('lab')) return KLU_COMPONENT_WEIGHTS.Practical;
  if (value === 's' || value.includes('skill')) return KLU_COMPONENT_WEIGHTS.Skill;
  return KLU_COMPONENT_WEIGHTS.Other;
}

/**
 * Calculate KLU's course-level attendance from LTPS component percentages.
 *
 * KLU weights the COMPONENT PERCENTAGES themselves:
 *   Lecture = 100% weight (multiplier 1.0)
 *   Practical = 50% weight (multiplier 0.5)
 *   Skill = 25% weight (multiplier 0.25)
 *
 * Formula:
 *   raw = (L% * 1 + P% * 0.5 + S% * 0.25) / (1 + 0.5 + 0.25)
 *   displayed = ceil(raw)
 *
 * This matches the LTPS-style result shown in the KLU calculator. For example,
 * 4/6 Lecture (66.67%), 8/10 Practical (80%), and 14/18 Skill (77.78%)
 * gives about 72.06%, which KLU displays as 73%. Likewise,
 * 6/6 Lecture, 6/8 Practical and 10/18 Skill gives about 86.51%, displayed as 87%.
 */
export function calculateKLUWeightedAttendance(components: AttendanceComponent[]) {
  let weightedPercentageSum = 0;
  let totalWeight = 0;

  for (const component of components) {
    if (component.attended < 0 || component.conducted < 0 || component.attended > component.conducted) {
      throw new Error('Invalid component attendance values');
    }
    if (component.conducted === 0) continue;

    const weight = componentWeight(component.name);
    const percentage = (component.attended / component.conducted) * 100;
    weightedPercentageSum += percentage * weight;
    totalWeight += weight;
  }

  const rawPercentage = totalWeight === 0 ? 0 : weightedPercentageSum / totalWeight;

  return {
    weightedAttended: weightedPercentageSum,
    weightedConducted: totalWeight,
    weightedScore: rawPercentage,
    totalWeight,
    rawPercentage,
    percentage: totalWeight === 0 ? 0 : Math.ceil(rawPercentage),
  };
}

/**
 * Calculate classes needed to reach target attendance
 */
export function classesNeededForTarget(
  attended: number,
  conducted: number,
  target: number
): number {
  if (target < 0 || target > 100) {
    throw new Error("Target must be between 0 and 100");
  }

  if (conducted === 0) {
    return target === 0 ? 0 : 1;
  }

  // Future classes needed: x
  // (attended + x) / (conducted + x) = target / 100
  // attended + x = (target / 100) * (conducted + x)
  // attended + x = target * conducted / 100 + target * x / 100
  // attended + x - target * x / 100 = target * conducted / 100
  // attended + x * (1 - target / 100) = target * conducted / 100
  // x * (1 - target / 100) = target * conducted / 100 - attended
  // x = (target * conducted / 100 - attended) / (1 - target / 100)

  const targetDecimal = target / 100;
  const numerator = target * conducted / 100 - attended;
  const denominator = 1 - targetDecimal;

  if (denominator === 0) {
    // Target is 100%
    return conducted > attended ? attended - conducted : 0;
  }

  const classesNeeded = numerator / denominator;

  // Already at or above target
  if (classesNeeded <= 0) {
    return 0;
  }

  return Math.ceil(classesNeeded);
}

/**
 * Calculate maximum safe absences while maintaining target
 */
export function maximumSafeAbsences(
  attended: number,
  conducted: number,
  target: number
): number {
  if (target < 0 || target > 100) {
    throw new Error("Target must be between 0 and 100");
  }

  if (conducted === 0 || target === 0) {
    return 0;
  }

  const currentPercentage = calculateAttendance({ attended, conducted });

  // If already below target, safe absences = 0
  if (currentPercentage < target) {
    return 0;
  }

  // Maximum absences: x
  // attended / (conducted + x) = target / 100
  // attended = (target / 100) * (conducted + x)
  // attended = target * conducted / 100 + target * x / 100
  // attended - target * conducted / 100 = target * x / 100
  // x = (attended - target * conducted / 100) * 100 / target

  const targetDecimal = target / 100;
  const maxAbsences = (attended - targetDecimal * conducted) / targetDecimal;

  // Cannot exceed remaining classes
  const remaining = conducted - attended;
  const safe = Math.floor(Math.min(maxAbsences, remaining));

  return Math.max(0, safe);
}

/**
 * Project attendance after a sequence of classes
 */
export function projectedAttendanceAfterSequence(
  attended: number,
  conducted: number,
  sequence: boolean[]
): {
  newAttended: number;
  newConducted: number;
  percentage: number;
} {
  let newAttended = attended;
  let newConducted = conducted;

  for (const isPresent of sequence) {
    if (isPresent) {
      newAttended++;
    }
    newConducted++;
  }

  return {
    newAttended,
    newConducted,
    percentage: calculateAttendance({
      attended: newAttended,
      conducted: newConducted,
    }),
  };
}

/**
 * Calculate attendance projection for n future classes at given attendance rate
 */
export function projectedAttendanceForFutureClasses(
  attended: number,
  conducted: number,
  futureClasses: number,
  attendanceRate: number
): number {
  if (attendanceRate < 0 || attendanceRate > 100) {
    throw new Error("Attendance rate must be between 0 and 100");
  }

  const futureAttended = Math.round((futureClasses * attendanceRate) / 100);
  const newAttended = attended + futureAttended;
  const newConducted = conducted + futureClasses;

  return calculateAttendance({
    attended: newAttended,
    conducted: newConducted,
  });
}

/**
 * Calculate risk level based on current attendance and target
 */
export function calculateRiskLevel(
  attended: number,
  conducted: number,
  target: number,
  remainingClasses?: number
): RiskLevel {
  const current = calculateAttendance({ attended, conducted });

  // Safe: clearly above target with buffer
  if (current >= target + 5) {
    return {
      level: "safe",
      percentage: current,
      message: `You're safe at ${current.toFixed(1)}% (Target: ${target}%)`,
    };
  }

  // Warning: close to target or slightly below
  if (current >= target - 5) {
    const needed =
      remainingClasses ?
        classesNeededForTarget(attended, conducted, target)
        : 0;

    return {
      level: "warning",
      percentage: current,
      message:
        current < target ?
          `At ${current.toFixed(1)}%. Need ${needed} consecutive classes`
          : `At ${current.toFixed(1)}%. Maintain attendance`,
    };
  }

  // Critical: significantly below target
  const needed =
    remainingClasses ?
      classesNeededForTarget(attended, conducted, target)
      : 0;

  const feasible = !remainingClasses || needed <= remainingClasses;

  return {
    level: "critical",
    percentage: current,
    message:
      feasible ?
        `Critical at ${current.toFixed(1)}%. Need ${needed} classes to recover`
        : `Critical at ${current.toFixed(1)}%. Recovery may not be possible`,
  };
}

/**
 * Check if it's possible to reach target with remaining classes
 */
export function isTargetAchievable(
  attended: number,
  conducted: number,
  target: number,
  remainingClasses: number
): boolean {
  if (target === 100) {
    return attended === conducted && remainingClasses >= 0;
  }

  const needed = classesNeededForTarget(attended, conducted, target);
  return needed <= remainingClasses;
}
