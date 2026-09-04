# Deployment Guide

## Overview

KLU Attend+ is deployed across:

- **Frontend**: Vercel
- **Backend**: Render/Railway/Fly.io
- **Database**: Supabase (PostgreSQL)

Total cost: **$0-30/month** (free tier available)

## Prerequisites

- GitHub account (for version control)
- Vercel account (free)
- Supabase project (free tier)
- Backend hosting (free tier)
- Custom domain (optional)

## Step 1: Database Setup (Supabase)

### Create Project

1. Go to https://supabase.com
2. Click "New Project"
3. Fill in project details:
   - Name: `klu-attend-plus`
   - Region: Closest to KL University (Asia-Singapore)
   - Database password: Strong, secure password
4. Click "Create new project"
5. Wait for project creation (~2 min)

### Get Credentials

1. Go to Settings → API
2. Copy:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (backend only)

### Run Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Link project
supabase link --project-ref your-project-id

# Push migrations
supabase db push
```

### Enable RLS

In Supabase dashboard:

1. Go to SQL Editor
2. Run: `ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;`
3. Repeat for all tables (attendance_records, courses, etc.)

## Step 2: Frontend Deployment (Vercel)

### Connect Repository

1. Push code to GitHub
2. Go to https://vercel.com
3. Click "New Project"
4. Import your GitHub repository
5. Configure project:
   - Framework: Vite
   - Root Directory: repository root (`.`)
   - The checked-in `vercel.json` builds `apps/web` and serves `apps/web/dist`.

### Set Environment Variables

In Vercel dashboard → Settings → Environment Variables:

```
VITE_API_URL=https://your-api-service.example.com
```

`VITE_API_URL` is required in Vercel. Do not leave it unset: the Vercel frontend
cannot use the local `localhost:3001` API in production.

### Deploy

1. Click "Deploy"
2. Wait for build (~3 min)
3. Get deployment URL: `https://klu-attend-plus.vercel.app`

### Custom Domain (Optional)

1. In Vercel: Settings → Domains
2. Add your domain
3. Update DNS records (Vercel shows instructions)
4. Wait for HTTPS certificate (~5 min)

## Step 3: Backend Deployment (Render)

### Create Web Service

1. Go to https://render.com
2. Click "New +"
3. Select "Web Service"
4. Connect GitHub repository
5. Configure:
   - Name: `klu-attend-plus-api`
   - Root Directory: `apps/api`
   - Build Command: `npm run build`
   - Start Command: `npm run start`
   - Environment: Node 18
   - Plan: Free (or Pro for more power)

### Set Environment Variables

In Render dashboard → Environment:

```
NODE_ENV=production
PORT=3001
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
CORS_ORIGIN=https://klu-attend-plus.vercel.app
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100
```

### Deploy

1. Click "Create Web Service"
2. Wait for build and deployment (~5 min)
3. Get service URL: `https://klu-attend-plus-api.onrender.com`

### Update Frontend

Set the Vercel environment variable before redeploying:

```
VITE_API_URL=https://klu-attend-plus-api.onrender.com
```

Redeploy frontend on Vercel.

## Step 4: Custom Domain

### Option A: Single Domain with CDN

```
yourdomain.com
├── api.yourdomain.com → Render backend
└── (root) → Vercel frontend
```

### Option B: Subdomains

```
app.yourdomain.com → Vercel (frontend)
api.yourdomain.com → Render (backend)
```

### DNS Configuration

Example with Cloudflare:

```
Type    Name              Value
CNAME   app               klu-attend-plus.vercel.app
CNAME   api               klu-attend-plus-api.onrender.com
CNAME   www               yourdomain.com
A       @                 (Cloudflare IP)
```

## Step 5: SSL/HTTPS

### Automatic (Recommended)

- Vercel: Automatic
- Render: Automatic
- Supabase: Automatic

All should be HTTPS by default.

### Manual (If Needed)

1. Vercel: Settings → Domains → Manage
2. Render: Environment → Enable HTTPS
3. Supabase: Not needed (managed)

## Step 6: Database Backups

### Supabase Automatic Backups

1. Go to Settings → Backups
2. Automatic daily backups enabled by default
3. Keep 7-day retention (free tier)

### Manual Backup

```bash
pg_dump postgres://user:password@host/db > backup.sql
```

## Step 7: Monitoring

### Vercel Analytics

1. Dashboard → Analytics
2. Monitor:
   - Page load times
   - Error rates
   - Request/response times

### Render Monitoring

1. Dashboard → Metrics
2. Monitor:
   - CPU usage
   - Memory usage
   - Request rate
   - Response time

### Supabase Monitoring

1. Dashboard → Database
2. Check:
   - Connection count
   - Active connections
   - Database size

## Environment Variables Checklist

### Production

```env
# Frontend (Vercel)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=public-key
VITE_API_URL=https://api.yourdomain.com
VITE_ENABLE_DEMO_MODE=false
VITE_ENABLE_ERP_INTEGRATION=false
VITE_ENABLE_NOTIFICATIONS=false

# Backend (Render)
NODE_ENV=production
PORT=3001
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=private-key
CORS_ORIGIN=https://yourdomain.com
DATABASE_URL=postgres://...
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100
LOG_LEVEL=info

# Database (Supabase)
Database connection string in Render environment
```

## Health Checks

### Frontend

```bash
curl https://yourdomain.com/
# Should return HTML (200 OK)
```

### Backend

```bash
curl https://api.yourdomain.com/health
# Should return {"status": "ok"}
```

### Database

```bash
curl https://api.yourdomain.com/db-check
# Should return {"database": "connected"}
```

## Troubleshooting

### Build Fails

**Frontend**:
```bash
# Check dependencies
npm ci --workspace=apps/web

# Check TypeScript
npm run typecheck -w apps/web

# Test build locally
npm run build -w apps/web
```

**Backend**:
```bash
# Check dependencies
npm ci --workspace=apps/api

# Check TypeScript
npm run typecheck -w apps/api

# Test build locally
npm run build -w apps/api
```

### Deployment Timeouts

**Vercel**: Increase build timeout (Pro plan)  
**Render**: Add `.renderignore` to skip unnecessary files

### Environment Variable Issues

1. Verify in dashboard (never show secrets in logs)
2. Check naming (no spaces, correct case)
3. Restart service after change
4. Clear browser cache

### Database Connection Errors

```
Error: "Error: Failed to initialize database"
```

Check:
- `SUPABASE_URL` is correct
- `SUPABASE_SERVICE_ROLE_KEY` is valid
- Connection string is correct
- Database is running (check Supabase dashboard)

## Post-Deployment

### Testing

1. Visit frontend URL
2. Sign up with test account
3. Check demo mode
4. Test all features
5. Verify error handling

### Security

- [ ] Enable 2FA on hosting accounts
- [ ] Review RLS policies
- [ ] Check rate limiting
- [ ] Audit error logs
- [ ] Verify CORS settings

### Monitoring

- [ ] Set up alerts for downtime
- [ ] Monitor error rate
- [ ] Track performance metrics
- [ ] Review access logs weekly

### Maintenance

- [ ] Schedule weekly backups
- [ ] Update dependencies monthly
- [ ] Review security advisories
- [ ] Test disaster recovery quarterly

## Scaling

When traffic grows:

### Frontend

- Vercel Pro ($20/mo): Higher limits
- Add CDN caching
- Optimize bundle size

### Backend

- Render Standard ($7/mo): More resources
- Add load balancing
- Implement caching

### Database

- Supabase Pro ($25/mo): More storage
- Add read replicas (advanced)
- Optimize queries

## Cost Estimate

| Service | Free Tier | Pro | Annual |
|---------|-----------|-----|--------|
| Vercel | ✅ | $20 | $240 |
| Render | ✅ | $7 | $84 |
| Supabase | ✅ | $25 | $300 |
| Domain | - | $12 | $12 |
| **Total** | **$0** | **$64** | **$636** |

Free tier supports 1-10 concurrent users comfortably.

## Support

- Vercel Docs: https://vercel.com/docs
- Render Docs: https://render.com/docs
- Supabase Docs: https://supabase.com/docs
- GitHub Issues: This repository

---

**Last Updated**: September 2024

**Version**: 1.0

For latest changes, see this file in GitHub.
