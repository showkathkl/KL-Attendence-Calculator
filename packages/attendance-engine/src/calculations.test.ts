import { describe, it, expect } from "vitest";
import {
  calculateAttendance,
  calculateKLUWeightedAttendance,
  classesNeededForTarget,
  maximumSafeAbsences,
  projectedAttendanceAfterSequence,
  projectedAttendanceForFutureClasses,
  calculateRiskLevel,
  isTargetAchievable,
} from "./calculations";

describe("Attendance Engine", () => {
  describe("calculateAttendance", () => {
    it("should calculate basic percentage", () => {
      const result = calculateAttendance({ attended: 40, conducted: 50 });
      expect(result).toBe(80);
    });

    it("should handle 0 conducted classes", () => {
      expect(calculateAttendance({ attended: 0, conducted: 0 })).toBe(0);
      expect(calculateAttendance({ attended: 1, conducted: 0 })).toBe(100);
    });

    it("should handle 100%", () => {
      const result = calculateAttendance({ attended: 50, conducted: 50 });
      expect(result).toBe(100);
    });

    it("should reject invalid inputs", () => {
      expect(() => calculateAttendance({ attended: -1, conducted: 50 })).toThrow();
      expect(() => calculateAttendance({ attended: 51, conducted: 50 })).toThrow();
    });

    it("should handle decimal percentages", () => {
      const result = calculateAttendance({ attended: 34, conducted: 51 });
      expect(result).toBeCloseTo(66.67, 1);
    });
  });

  describe("calculateKLUWeightedAttendance", () => {
    it("uses 100% lecture, 50% practical and 25% skill weights", () => {
      const result = calculateKLUWeightedAttendance([
        { name: "Lecture", attended: 6, conducted: 6, percentage: 100 },
        { name: "Practical", attended: 6, conducted: 8, percentage: 75 },
        { name: "Skill", attended: 10, conducted: 18, percentage: 55.555 },
      ]);

      // Weighted component percentages: (100*1 + 75*0.5 + 55.555*0.25) / 1.75
      // = 86.51%, then KLU course attendance is rounded up to 87%.
      expect(result.rawPercentage).toBeCloseTo(86.51, 2);
      expect(result.percentage).toBe(87);
    });

    it("ignores components that have no conducted classes", () => {
      const result = calculateKLUWeightedAttendance([
        { name: "Lecture", attended: 4, conducted: 5, percentage: 80 },
        { name: "Practical", attended: 0, conducted: 0, percentage: 0 },
      ]);
      expect(result.percentage).toBe(80);
    });

    it("calculates the DSA example using weighted attended/conducted hours", () => {
      const result = calculateKLUWeightedAttendance([
        { name: "Lecture", attended: 4, conducted: 6, percentage: 66.67 },
        { name: "Practical", attended: 8, conducted: 10, percentage: 80 },
        { name: "Skill", attended: 14, conducted: 18, percentage: 77.78 },
      ]);

      // (66.67*1 + 80*0.5 + 77.78*0.25) / 1.75 is about 72.06%, ceil = 73%.
      expect(result.rawPercentage).toBeCloseTo(72.06, 2);
      expect(result.percentage).toBe(73);
    });
  });

  describe("classesNeededForTarget", () => {
    it("should calculate classes needed for 85% from 80%", () => {
      // 40/50 = 80%, need to reach 85%
      const result = classesNeededForTarget(40, 50, 85);
      expect(result).toBeGreaterThan(0);
    });

    it("should return 0 if already at target", () => {
      const result = classesNeededForTarget(42.5, 50, 85);
      expect(result).toBe(0);
    });

    it("should return 0 if above target", () => {
      const result = classesNeededForTarget(45, 50, 85);
      expect(result).toBe(0);
    });

    it("should handle 100% target", () => {
      const result = classesNeededForTarget(40, 50, 100);
      expect(result).toBeGreaterThan(0);
    });

    it("should handle 0% target", () => {
      const result = classesNeededForTarget(40, 50, 0);
      expect(result).toBe(0);
    });

    it("should reject invalid targets", () => {
      expect(() => classesNeededForTarget(40, 50, -1)).toThrow();
      expect(() => classesNeededForTarget(40, 50, 101)).toThrow();
    });

    it("should handle from 0 conducted", () => {
      const result = classesNeededForTarget(0, 0, 85);
      expect(result).toBeGreaterThan(0);
    });
  });

  describe("maximumSafeAbsences", () => {
    it("should calculate safe absences from 90%", () => {
      // 45/50 = 90%, target 85%
      const result = maximumSafeAbsences(45, 50, 85);
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("should return 0 if below target", () => {
      // 40/50 = 80%, target 85%
      const result = maximumSafeAbsences(40, 50, 85);
      expect(result).toBe(0);
    });

    it("should return 0 if no more classes", () => {
      const result = maximumSafeAbsences(50, 50, 85);
      expect(result).toBe(0);
    });

    it("should handle exactly at target", () => {
      const result = maximumSafeAbsences(42.5, 50, 85);
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe("projectedAttendanceAfterSequence", () => {
    it("should project after sequence of presents", () => {
      const result = projectedAttendanceAfterSequence(40, 50, [true, true, true]);
      expect(result.newAttended).toBe(43);
      expect(result.newConducted).toBe(53);
      expect(result.percentage).toBeCloseTo(81.13, 1);
    });

    it("should project after sequence of absents", () => {
      const result = projectedAttendanceAfterSequence(40, 50, [false, false]);
      expect(result.newAttended).toBe(40);
      expect(result.newConducted).toBe(52);
    });

    it("should handle mixed sequence", () => {
      const result = projectedAttendanceAfterSequence(40, 50, [true, false, true]);
      expect(result.newAttended).toBe(42);
      expect(result.newConducted).toBe(53);
    });

    it("should handle empty sequence", () => {
      const result = projectedAttendanceAfterSequence(40, 50, []);
      expect(result.newAttended).toBe(40);
      expect(result.newConducted).toBe(50);
      expect(result.percentage).toBe(80);
    });
  });

  describe("projectedAttendanceForFutureClasses", () => {
    it("should project with 100% attendance", () => {
      const result = projectedAttendanceForFutureClasses(40, 50, 10, 100);
      expect(result).toBe(100);
    });

    it("should project with 0% attendance", () => {
      const result = projectedAttendanceForFutureClasses(40, 50, 10, 0);
      expect(result).toBeCloseTo(66.67, 1);
    });

    it("should project with 50% attendance", () => {
      const result = projectedAttendanceForFutureClasses(40, 50, 10, 50);
      expect(result).toBeCloseTo(73.33, 1);
    });

    it("should reject invalid rates", () => {
      expect(() =>
        projectedAttendanceForFutureClasses(40, 50, 10, -1)
      ).toThrow();
      expect(() =>
        projectedAttendanceForFutureClasses(40, 50, 10, 101)
      ).toThrow();
    });
  });

  describe("calculateRiskLevel", () => {
    it("should return safe for high attendance", () => {
      const result = calculateRiskLevel(50, 50, 80);
      expect(result.level).toBe("safe");
    });

    it("should return warning for near target", () => {
      const result = calculateRiskLevel(42.5, 50, 85);
      expect(result.level).toBe("warning");
    });

    it("should return critical for low attendance", () => {
      const result = calculateRiskLevel(30, 50, 85);
      expect(result.level).toBe("critical");
    });
  });

  describe("isTargetAchievable", () => {
    it("should be achievable with enough classes", () => {
      const result = isTargetAchievable(40, 50, 85, 50);
      expect(result).toBe(true);
    });

    it("should not be achievable with insufficient classes", () => {
      const result = isTargetAchievable(10, 50, 95, 1);
      expect(result).toBe(false);
    });

    it("should handle 100% target", () => {
      const result = isTargetAchievable(50, 50, 100, 10);
      expect(result).toBe(true);

      const result2 = isTargetAchievable(49, 50, 100, 10);
      expect(result2).toBe(false);
    });
  });

  // Edge cases
  describe("Edge Cases", () => {
    it("should handle very small numbers", () => {
      const result = calculateAttendance({ attended: 1, conducted: 3 });
      expect(result).toBeCloseTo(33.33, 1);
    });

    it("should handle very large numbers", () => {
      const result = calculateAttendance({ attended: 1000000, conducted: 1000001 });
      expect(result).toBeCloseTo(99.9999, 3);
    });

    it("should maintain precision in calculations", () => {
      const result1 = classesNeededForTarget(33, 50, 80);
      const result2 = classesNeededForTarget(33.333, 50, 80);
      expect(Math.abs(result1 - result2)).toBeLessThan(2);
    });
  });
});
