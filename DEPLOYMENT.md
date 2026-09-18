# Deployment Guide

## ✅ Build Status
The application builds successfully and is ready for deployment!

## 🚀 Deploy to Vercel (Free Tier)

### Prerequisites
1. A [Vercel account](https://vercel.com/signup) (free)
2. A [Supabase account](https://supabase.com) (free tier available)

### Step 1: Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Project Settings** → **API**
3. Copy your:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **Anon/Public Key** (starts with `eyJ...`)
4. Run your database migrations:
   ```bash
   # Install Supabase CLI if needed
   npm install -g supabase
   
   # Link your project
   supabase link --project-ref your-project-ref
   
   # Push migrations
   supabase db push
   ```

### Step 2: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and log in
2. Click **"Add New Project"**
3. Import from GitHub: `bassymatovu-svg/timetable`
4. Configure **Environment Variables**:
   - `VITE_SUPABASE_URL` = Your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = Your Supabase Anon Key
5. Click **"Deploy"**

### Step 3: Deploy Supabase Edge Functions (Optional)

If you need the import processing function:

```bash
supabase functions deploy process-import
```

## 📊 What's Included

- ✅ React + TypeScript + Vite
- ✅ Tailwind CSS for styling
- ✅ Supabase for backend (database, auth, storage)
- ✅ Zustand for state management
- ✅ React Query for data fetching
- ✅ Complete timetabling engine with constraints

## 💰 Pricing

### Vercel Free Tier Includes:
- 100GB Bandwidth per month
- Unlimited projects
- Automatic HTTPS
- Global CDN
- Preview deployments

### Supabase Free Tier Includes:
- 500MB Database
- 1GB File Storage
- 2GB Bandwidth
- 50MB Database Backups

## 🔧 Local Development

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📝 Build Configuration

The following files configure the deployment:

- `vercel.json` - Vercel deployment settings
- `vite.config.ts` - Vite bundler configuration
- `tsconfig.json` - TypeScript configuration
- `.env.example` - Environment variable template

## 🐛 Troubleshooting

### Build fails on Vercel
- Check that environment variables are set correctly
- Review build logs for specific errors

### Supabase connection issues
- Verify your Supabase URL and Anon Key are correct
- Check that your Supabase project is active
- Ensure Row Level Security (RLS) policies are configured

### Slow build times
- The build takes ~1-2 minutes, which is normal for this size of application
- Vercel's free tier has plenty of build minutes

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Vite Documentation](https://vitejs.dev/)

---

**Your application is now ready to deploy! 🎉**
