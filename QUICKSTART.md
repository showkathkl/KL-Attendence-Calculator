# Quick Start Guide

Get KLU Attend+ running in 5 minutes.

## 1. Prerequisites

- Node.js 18+ (check: `node --version`)
- npm 9+ (check: `npm --version`)
- Git

## 2. Clone & Install

```bash
# Clone repository
git clone https://github.com/yourusername/klu-attend-plus.git
cd klu-attend-plus

# Run setup script (handles monorepo installation)
bash setup.sh

# OR manual install
npm install
cd packages/shared-types && npm install && cd ../..
cd packages/attendance-engine && npm install && cd ../..
cd apps/web && npm install && cd ../..
```

Takes ~3-4 minutes.

## 3. Configure Environment

```bash
# Copy example env file
cp .env.example .env.local

# Add Supabase credentials (optional, demo works without)
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Demo mode works immediately without credentials.**

## 4. Start Development Server

`npm run dev` starts both the web app and API.

```bash
npm run dev
```

Opens at http://localhost:5173

## 5. Try Demo

1. Click "Try Demo" on landing page
2. See demo attendance data
3. Navigate between tabs
4. Click "Exit Demo" to return

## ✅ You're Done!

Explore:

- **Dashboard**: Overall attendance and risk status
- **Subjects**: Per-subject breakdown
- **Timetable**: Class schedule (placeholder)
- **Planner**: Scenario planning (placeholder)

## Common Tasks

### Run Tests

```bash
npm run test              # Unit tests
npm run test:e2e          # Browser tests
```

### Build for Production

```bash
npm run build             # Build all packages
npm run preview           # Preview production build
```

### Check Type Errors

```bash
npm run typecheck
```

### Format Code

```bash
npm run format
```

### Clean Install

```bash
npm run clean
npm install
```

## Project Structure

```
klu-attend-plus/
├── apps/
│   ├── web/           # React frontend
│   └── api/           # Node.js backend
├── packages/
│   ├── shared-types/  # TypeScript types
│   └── attendance-engine/  # Math calculations
├── docs/              # Documentation
└── README.md          # Full docs
```

## Next Steps

### To Add Real ERP

1. See `docs/ERP_INTEGRATION.md`
2. Set `VITE_ENABLE_ERP_INTEGRATION=true`
3. Implement authentication flow

### To Deploy

1. See `docs/DEPLOYMENT.md`
2. Push to GitHub
3. Connect Vercel for frontend
4. Connect Render for backend
5. Link Supabase database

### To Customize

- Colors: `apps/web/tailwind.config.ts`
- Components: `apps/web/src/components/`
- Logic: `packages/attendance-engine/`
- APIs: `apps/api/src/`

## Troubleshooting

### Port Already in Use

```bash
# Use different port
npm run dev -- --port 3000
```

### Build Errors

```bash
# Clean and reinstall
npm run clean
npm install
npm run build
```

### TypeScript Errors

```bash
# Check types
npm run typecheck

# Fix automatically (if possible)
npm run format
```

### Supabase Connection Issues

- Verify credentials in `.env.local`
- Check Supabase project is active
- Test connection: `curl https://your-project.supabase.co`

## Support

- 📖 Full docs: See `README.md`
- 🐛 Issues: GitHub Issues
- 💬 Questions: Discussions

## What's Included

✅ Full-stack monorepo setup  
✅ Attendance calculation engine (20+ tests)  
✅ React dashboard with demo data  
✅ TypeScript everywhere  
✅ Tailwind CSS styling  
✅ Dark mode support  
✅ PWA ready  
✅ E2E tests  
✅ Production deployment guides  
✅ Security documentation  

## Demo Data

Default demo includes 5 subjects:

- Data Structures: 66.7% (34/51) - Critical
- Java Programming: 78.4% (40/51) - Critical
- Database Systems: 90% (45/50) - Safe
- Mathematics: 86% (43/50) - Safe
- Web Technologies: 79.2% (38/48) - Warning

All calculations against 85% target.

## What's NOT Included

❌ Real ERP integration (blocked by CAPTCHA)  
❌ Backend API implementation (stubs only)  
❌ Database migrations (manual)  
❌ Deployment secrets  
❌ Real attendance data  

These are documented for you to add.

---

**Questions?** Check `README.md` or open an issue.

**Happy coding!** 🚀
