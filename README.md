# KLU Attend+

Unofficial KLU student attendance utility. The app can run in Demo Mode or connect to the KLU ERP through a short-lived Playwright browser bridge.

## Important

Use only your own authorized ERP account. The app does not solve or bypass CAPTCHA/MFA. Credentials are accepted only for the live login request and are not persisted. Do not deploy this connector publicly until you have confirmed that automated access is permitted by the ERP/operator.

## Run locally

```bash
npm install
npx playwright install chromium
npm run dev
```

Frontend: http://localhost:5173
API: http://localhost:3001

Set the values in `.env` based on `.env.example`.

## Live ERP flow

1. Open the app.
2. Click Connect KLU ERP.
3. The backend opens a temporary browser session to the ERP.
4. Enter your own ERP username/password.
5. Enter the verification code shown by the ERP and MFA if required.
6. The backend submits the normal login form.
7. After authentication it opens the documented Attendance Register route and parses visible attendance rows.

The connector intentionally uses heuristic selectors because the ERP is a private application and its exact DOM can change. If the current ERP changes its login or attendance page, update `apps/api/src/erp.ts` based on the live browser/network behavior; never guess or bypass security controls.

## ERP attendance flow (fixed)

The ERP integration now follows the real KLU portal flow:

1. Open `https://newerp.kluniversity.in` in a temporary Playwright browser session.
2. The user enters their own ERP username, password and the visible verification code.
3. The hidden MFA/QR field is not filled or bypassed.
4. After successful login, the backend opens the real KLU Attendance Register route:
   `studentattendance/studentdailyattendance/searchinput`.
5. The app reads the **Academic Year** and **Semester** dropdown options from that ERP page.
6. The user chooses both filters.
7. The backend selects those exact values in the ERP page and clicks the real **Search** button.
8. The attendance result table is parsed and returned to the dashboard.

The app also clears a stale KLU Attend+ API process on port 3001 when `npm run dev` starts, but it only attempts to terminate processes whose command line looks like this project. It does not intentionally kill unrelated services using port 3001.

### Run

```bash
npm install
npx playwright install chromium
npm run build
npm run dev
```

Open `http://localhost:5173`.

## New ERP features

The latest build now fetches the selected Academic Year and Semester from the logged-in ERP and uses the same selection for:

- component-wise attendance (Lecture, Practical, Skill, Tutorial when the ERP exposes them)
- ERP timetable entries, including day, start time, end time, room and faculty when exposed
- a built-in weekly timetable calendar in the web dashboard

The timetable reader first follows the logged-in ERP **Time Tables** navigation and only falls back to known timetable routes if that navigation is unavailable. It does not invent class times; if the ERP does not expose a time value, that entry is not added to the calendar.


### Attendance weighting
The overall and course attendance percentages use the ERP component rows with KLU weighting: Lecture/Tutorial 100%, Practical 50%, Skill 25%. Raw conducted/attended counts remain visible separately.


## V8 attendance calculation fix

The course percentage is calculated independently for each course from its ERP components. Component percentages are weighted by KLU's LTPS multipliers: Lecture 100% (1.0), Practical 50% (0.5), Skill 25% (0.25). The weighted average is then rounded **up** with `ceil`, matching the supplied KLU calculator examples. No cross-course overall attendance is used for subject eligibility. Eligibility is: **85%+ Eligible**, **75%–84% Conditional**, **below 75% Detained**.


## V11 planner fix

The Bunk Planner now has a live calculation layer. Every planned skip immediately recalculates the affected course from its ERP component attendance. One scheduled class contributes exactly 2 periods. The live cards show planned attendance, component-level adjusted counts, and the delta from the ERP value.
