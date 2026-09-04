# ERP Timetable Update

This version reads the KLU ERP Academic Timetable as a period matrix, matching the current ERP layout:

- Monday-Saturday rows
- Period columns 1-15
- Course code from each populated cell
- L/P/S component from the cell (`L` = Lecture, `P` = Practical, `S` = Skill)
- Room number from `RoomNo-*`
- Academic Year and Semester are the same values used for Attendance Register sync
- Course names are resolved from the attendance result when the timetable page itself only exposes course codes
- If KLU exposes actual clock times in DOM attributes/hidden timetable metadata, those are used in the Google-style time grid
- If the ERP view exposes only period numbers, the app displays the exact ERP periods instead of inventing clock times

The timetable page is discovered from the authenticated ERP navigation, including the Courses submenu, before falling back to known KLU timetable routes.


## Attendance weighting

The dashboard now calculates the KLU weighted attendance from the component rows returned by ERP:

- Lecture (L): 100% contribution
- Tutorial (T): 100% contribution
- Practical (P): 50% contribution
- Skill (S): 25% contribution

The raw ERP attended/conducted counts are still shown separately.
