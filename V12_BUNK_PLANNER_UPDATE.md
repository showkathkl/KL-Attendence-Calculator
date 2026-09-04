# KLU Attend+ V12 — Bunk Planner Layout & Holiday Mapping

## What changed
- Bunk Planner now opens with the **calendar on the left** and **Skip Classes on the right**.
- Removed the large live-calculation course cards from above the calendar.
- Recovery data is now a dedicated, full-width **Live Recovery Forecast** section below the calendar/skip workspace.
- Planned attendance is recalculated immediately after every skip/restore.
- One timetable class is treated as **2 periods** for bunk planning.
- Subject attendance remains independent; there is no cross-subject overall attendance calculation.
- Component weighting remains **Lecture 100%, Practical 50%, Skill 25%**.
- Eligibility rules remain **85%+ Eligible, 75–84.9% Conditional, below 75% Detained**.
- Added October calendar mapping from the supplied KLU 2026 holiday circular:
  - 02-Oct-2026: Gandhi Jayanti / Social Service Activity — attendance mandatory; shown as a special activity, not excluded as a holiday.
  - 19-Oct-2026 through 24-Oct-2026: Dussehra vacation — mapped as holidays.
- September holidays from the same circular remain mapped.
- Semester forecast ends on **15-Oct-2026**, the last instruction day.

## Run
```bash
npm install
npm run build
npm run dev
```
