# KLU Attend+ fixed setup

This build is npm-workspace compatible. Do not use `workspace:*` dependencies.

## macOS setup

```bash
cd klu-attend-plus-no-mfa-year-fixed
npm install
npx playwright install chromium
npm run build
npm run dev
```

Open http://localhost:5173

If an older copy of the project gives `EUNSUPPORTEDPROTOCOL workspace:*`, delete that old copy or replace its `workspace:*` dependency values with `*`, then remove `node_modules` and `package-lock.json` and run `npm install` again.

The ERP integration keeps CAPTCHA human-entered and uses the authenticated Playwright session to read the Academic Year/Semester controls and press the real ERP Search button.
