# TimetableOS — Institutional School & University Timetabling Platform

> A production-grade, self-hosted, multi-tenant school and university timetabling platform running on **$0/month free-tier infrastructure** (Supabase free tier + Vercel / Netlify).

---

## 🌟 Key Capabilities & Architectural Highlights

1. **Deterministic Constraint-Satisfaction Engine**:
   - Zero-dependency TypeScript scheduling engine located at `src/lib/scheduler-engine/`.
   - Heuristic constructive placement: **Most-Constrained-First** ordering (placing linked double-periods, specialist room requirements, and constrained faculty first).
   - Forward checking and bounded backtracking solver.
   - **Simulated Annealing Local Search Optimizer**: post-processes feasible timetables to minimize teacher gaps, eliminate student idle holes, distribute subjects evenly, avoid high-cognitive subjects during the final period, and prevent room hopping.
   - 100% verified with automated tests in Vitest (zero hard-constraint violations).

2. **Database-Enforced Invariant Safety Net**:
   - Every hard constraint is enforced **at the database layer** via Postgres unique constraints:
     - `unique (term_id, teacher_id, period_id, week_pattern)`
     - `unique (term_id, room_id, period_id, week_pattern)`
     - `unique (term_id, class_group_id, period_id, week_pattern)`
   - Full Row Level Security (RLS) policies scoped by `institution_id` and caller role (`super_admin`, `school_admin`, `dept_head`, `teacher`, `viewer`).

3. **Interactive Master Timetable Grid with Live Validation**:
   - Built with `@dnd-kit/core`.
   - Real-time drag-over feedback: turns green for legal placements and red with conflict reason alerts for illegal drops.
   - **WCAG AA Keyboard-Accessible Alternative**: click "Move to..." to reposition any lesson using keyboard controls without requiring a mouse.
   - Lesson locking: lock lessons in place to preserve manual assignments during future regeneration runs.

4. **Intelligent Substitution Management**:
   - Faculty absence logging by date or range.
   - Instant conflict isolation of affected lessons.
   - **Candidate Substitute Ranking Algorithm**: prioritizes subject-qualified instructors who are free in that period and under weekly load limits, followed by available non-specialist instructors.

5. **Smart Import & Legacy Timetable Migration**:
   - **Mode A (Curriculum Import)**: imports subjects, teachers, and weekly period requirements.
   - **Mode B (Legacy Timetable Migration)**: imports existing day/period schedules into editable lessons on the master grid.
   - **Fuzzy Entity Matching (Fuse.js)**: matches extracted names to existing classes, subjects, teachers, and rooms with confidence scores. Low-confidence matches (<0.70) are flagged for human review.
   - **Pre-Commit Conflict Detection**: checks legacy timetables for pre-existing internal collisions before committing to the database.
   - Supabase Edge Function (`supabase/functions/process-import`) calling Google Gemini API (`gemini-2.5-flash`) with structured JSON schema (`responseSchema`).

6. **Institutional Analytics & Multi-Format Export**:
   - **Recharts** visualizations for faculty workload and room utilization rates.
   - **Excel Export (.xlsx)**: multi-sheet export with master schedule, teacher loads, and facility usage.
   - **Calendar Export (.ics)**: RFC 5545 compliant calendar format for Google Calendar, Apple Calendar, and Outlook.
   - **Print-Optimized Layouts**: clean `@media print` stylesheet for formatted physical printing.

7. **Multi-Tenant Architecture**:
   - Super-Admin institution switcher to manage multiple schools, colleges, or campus locations in a single deployment.

---

## 🛠 Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS v4, `@tailwindcss/vite`
- **UI & Accessibility**: shadcn/ui (Radix primitives), Lucide monochrome icons
- **State Management**: Zustand (with local persistence fallback), TanStack Query, TanStack Table
- **Drag-and-Drop**: `@dnd-kit/core`
- **Data & Charts**: SheetJS (`xlsx`), Recharts, Fuse.js, date-fns
- **Backend & Database**: Supabase (Postgres + Auth + RLS + Edge Functions)
- **Testing**: Vitest, React Testing Library, JSDOM

---

## 🚀 Quickstart & Local Setup

### 1. Prerequisites
- Node.js 18+ (tested on Node.js v25)
- npm 9+

### 2. Install Dependencies
```bash
git clone https://github.com/your-repo/timetable-platform.git
cd timetable-platform
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Populate with your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```
*(Note: If Supabase credentials are not provided, TimetableOS runs in local offline mode with pre-seeded realistic institutional data)*.

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Run Automated Tests
```bash
# Run unit and integration tests
npm run test
```

### 6. Build for Production
```bash
npm run build
```

---

## 🏛 Database Setup & Migrations (Supabase)

1. Create a free project on [Supabase](https://supabase.com).
2. Navigate to the **SQL Editor** in your Supabase dashboard.
3. Run the migration script in `supabase/migrations/001_initial_schema.sql`.
4. (Optional) Run `supabase/seed.sql` to populate sample demo data.

---

## 🚢 Deploying to Vercel (Free Tier)

1. Push your repository to GitHub.
2. Go to [Vercel](https://vercel.com) and click **Add New Project**.
3. Import your GitHub repository.
4. Set Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Click **Deploy**. Vercel will automatically build and host the application globally.
