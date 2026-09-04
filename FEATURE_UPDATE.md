# KLU Attend+ Feature Update

This build adds:

1. Component-wise attendance display
   - Lecture
   - Practical
   - Skill
   - Tutorial
   - Other component names are preserved when the ERP exposes them.
2. ERP timetable sync
   - Uses the same Academic Year and Semester selected for attendance.
   - Follows the logged-in ERP Time Tables navigation first.
   - Reads day, start time, end time, course, component, room and faculty when those values are present.
   - Does not fabricate times.
3. Built-in weekly calendar
   - Monday-Saturday columns
   - Previous/next week
   - Today button
   - ERP timetable event cards with time, component and room/faculty.

Setup:

```bash
rm -rf node_modules
npm install
npx playwright install chromium
npm run build
npm run dev
```

Open http://localhost:5173
