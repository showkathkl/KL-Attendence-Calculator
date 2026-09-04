# V10 — Realtime Bunk Planner

## Included
- Separate **Bunk planner** section in the sidebar.
- Live browser clock updated every second.
- Large month calendar with Monday–Sunday columns.
- ERP timetable classes are converted into scheduled class blocks. Consecutive timetable periods belonging to the same course/component are grouped; a scheduled class is treated as **2 periods**, matching the KLU timetable used by this app.
- Click a date to see that day's classes.
- Click **Skip 2 periods** on a class to model an absence.
- Planned skips persist in `localStorage` so refreshing the page does not erase the plan.
- Each selected class shows the projected subject attendance loss using the actual ERP component attendance.
- Forecast panel calculates the first date each course reaches the displayed **75%** and **85%** thresholds while attending every non-skipped future class through **15 October 2026**.
- Forecast excludes the two general KLU public holidays that fall before the instruction-day cutoff: **4 September 2026** and **14 September 2026**.
- The uploaded KLU 2026 notice also lists **2 October 2026** under Social Service Activities with attendance mandatory; it is therefore not treated as a normal public holiday.

## Attendance model
For each course independently:
- Lecture component = 100% weight
- Practical component = 50% weight
- Skill component = 25% weight

Component percentages always start from ERP's `Total Attended / Total Conducted` values. A planned skipped class adds 2 to the selected component's conducted count and adds 0 attended.

The subject percentage uses the existing KLU weighted component calculation and ceiling display behavior.

## Semester cutoff
Current configuration: **15 October 2026** (last instruction day supplied by the user).
