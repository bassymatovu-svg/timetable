# Build Prompt: School & University Timetabling Platform

> Paste this entire document into Kiro Code / Google Antigravity as your project brief. It is written as direct instructions to you, the coding agent. Follow the phases in order — do not skip ahead to polish before the core engine works.

---

## 1. Role & Objective

You are acting as a senior full-stack engineer and product architect. Build a production-grade **school and university timetabling platform** — a system in the same category as aSc TimeTables, FET, TimetableMaster, and Prime Timetable, but self-hosted, open, and running entirely on free-tier infrastructure.

The platform must:
- Automatically generate conflict-free timetables from a school's rooms, teachers, classes, and curriculum requirements.
- Support manual drag-and-drop adjustment with live conflict detection.
- Manage teacher absences and substitutions.
- Be visually professional and calm — this is administrative software people will use daily, not a marketing landing page.

**Budget constraint: $0 for core operation.** Every service used must have a genuinely free tier sufficient for a small-to-mid-size institution. Do not introduce paid APIs for the scheduling logic itself — the scheduling engine must be deterministic, explainable, algorithmic code, not a model call. The one exception is the Gemini API, used narrowly for the Smart Import feature (Section 5.7) to parse uploaded files — this runs comfortably within the Gemini API's free tier, or the monthly Google Cloud credit bundled with a Google AI Pro/Ultra subscription if the deploying admin has one. It must never become a hard dependency: the rest of the platform has to work fully without it.

---

## 2. Mandatory Tech Stack

**Frontend**
- React 18+ with TypeScript, built with Vite
- Tailwind CSS for styling
- shadcn/ui (Radix primitives) as the component base — but re-themed per Section 6, not left on defaults
- Lucide for icons (outline style only)
- TanStack Query for server state, TanStack Table for data grids
- @dnd-kit/core for drag-and-drop
- react-hook-form + zod for forms and validation
- Zustand for lightweight client UI state (not server state)
- date-fns for date/time handling
- recharts for the workload/utilization charts
- xlsx (SheetJS) for Excel export, native `window.print()` + print CSS for PDF/print, and a small `.ics` generator for calendar export
- fuse.js for fuzzy entity matching during the Smart Import flow (Section 5.7)

**Backend**
- Supabase (Postgres + Auth + Row Level Security + Edge Functions + Realtime + Storage) — free tier
- All business rules that must never be violated (see Section 5.2) are enforced **at the database level** via constraints/triggers, not just in application code
- Supabase Edge Functions (Deno/TypeScript) used for two things only: (1) background/scheduled regeneration — the primary generation engine runs client-side in a Web Worker (see Section 5.3 for why) — and (2) the Smart Import feature (Section 5.7), which calls the Gemini API server-side
- Google Gemini API (`gemini-2.5-flash` or the current cost-efficient equivalent) for the Smart Import feature only — never for scheduling logic, and never called with an exposed key from the client. Use structured JSON output (`responseSchema`) rather than freeform prompting; this is what makes extraction from messy spreadsheets reliable enough to trust.

**Hosting / Ops**
- Frontend: Vercel or Netlify free tier
- Version control: GitHub (free)
- No email/SMS provider required for MVP; if notifications are added later, use Resend's free tier — do not build this in until Phase 7+

Do not substitute Firebase, MongoDB, Redux, or any paid scheduling/optimization SaaS API. Do not add authentication providers beyond Supabase Auth.

---

## 3. User Roles & Permissions

| Role | Access |
|---|---|
| Super Admin | Full access across all institutions (if multi-tenant is enabled) |
| School Admin | Full access within their institution: setup, generation, editing, substitutions, reports |
| Department Head | Manage teachers/curriculum for their department; view full timetable; propose edits |
| Teacher | View own timetable, view own substitution history, submit absence requests |
| Student/Parent (read-only) | View published class timetable only — no edit access |

Enforce all of this through Supabase Row Level Security policies scoped by `institution_id` and `role`, not just UI hiding. Assume the frontend can be bypassed — the database is the real security boundary.

---

## 4. Data Model (Supabase / Postgres)

Use this as the starting schema. Adjust naming as needed but keep the relationships and constraints intact.

```sql
-- Institutions (multi-tenant ready even for single-school deployments)
create table institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'UTC',
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Extends auth.users
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  institution_id uuid references institutions(id),
  role text not null check (role in ('super_admin','school_admin','dept_head','teacher','viewer')),
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table terms (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id),
  name text not null,
  start_date date not null,
  end_date date not null,
  weeks_per_cycle int not null default 1 -- 1 = single week, 2 = A/B fortnightly
);

create table periods (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id),
  day_of_week int not null check (day_of_week between 1 and 7),
  period_number int not null,
  start_time time not null,
  end_time time not null,
  is_break boolean not null default false
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id),
  name text not null,
  capacity int not null,
  room_type text not null default 'classroom', -- classroom, lab, gym, auditorium, etc.
  features jsonb not null default '[]'
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id),
  name text not null,
  code text not null,
  color text not null default '#475569',
  required_room_type text
);

create table teachers (
  id uuid primary key references profiles(id),
  institution_id uuid not null references institutions(id),
  max_periods_per_day int not null default 6,
  max_periods_per_week int not null default 25,
  qualified_subject_ids uuid[] not null default '{}'
);

create table teacher_unavailability (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id),
  period_id uuid not null references periods(id),
  reason text
);

create table class_groups (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id),
  name text not null,          -- e.g. "Grade 10B"
  year_level int,
  size int not null default 0
);

create table curriculum_requirements (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references terms(id),
  class_group_id uuid not null references class_groups(id),
  subject_id uuid not null references subjects(id),
  teacher_id uuid references teachers(id),
  periods_per_week int not null,
  double_period boolean not null default false
);

create table constraints_config (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id),
  constraint_key text not null,   -- e.g. 'minimize_teacher_gaps'
  constraint_type text not null check (constraint_type in ('hard','soft')),
  enabled boolean not null default true,
  weight int not null default 5  -- 1-10, soft constraints only
);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references terms(id),
  class_group_id uuid not null references class_groups(id),
  subject_id uuid not null references subjects(id),
  teacher_id uuid not null references teachers(id),
  room_id uuid not null references rooms(id),
  period_id uuid not null references periods(id),
  week_pattern text not null default 'all', -- 'all' | 'A' | 'B'
  locked boolean not null default false,

  -- Hard-constraint safety net at the DB layer:
  unique (term_id, teacher_id, period_id, week_pattern),
  unique (term_id, room_id, period_id, week_pattern),
  unique (term_id, class_group_id, period_id, week_pattern)
);

-- Staging area for the Smart Import feature (Section 5.7) — nothing here
-- is authoritative until a human reviews and commits it.
create table draft_imports (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id),
  term_id uuid references terms(id),
  source_type text not null check (source_type in ('curriculum_list','legacy_timetable')),
  original_filename text not null,
  status text not null default 'processing' check (status in ('processing','needs_review','committed','discarded')),
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table draft_import_rows (
  id uuid primary key default gen_random_uuid(),
  draft_import_id uuid not null references draft_imports(id) on delete cascade,
  raw_data jsonb not null,                        -- exactly what Gemini extracted, untouched
  matched_class_group_id uuid references class_groups(id),
  matched_subject_id uuid references subjects(id),
  matched_teacher_id uuid references teachers(id),
  matched_room_id uuid references rooms(id),
  match_confidence numeric,                       -- 0-1, from the fuzzy-match step
  needs_manual_review boolean not null default false,
  resolved boolean not null default false,
  day_of_week int,                                -- null for curriculum_list imports
  period_number int,                              -- null for curriculum_list imports
  periods_per_week int,                           -- used for curriculum_list imports
  hard_conflict boolean not null default false,    -- set after running Section 5.2 validators
  conflict_details jsonb
);

create table substitutions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id),
  date date not null,
  absent_teacher_id uuid not null references teachers(id),
  substitute_teacher_id uuid references teachers(id),
  status text not null default 'pending' check (status in ('pending','assigned','declined')),
  reason text,
  created_at timestamptz not null default now()
);

create table generation_runs (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references terms(id),
  status text not null default 'running',
  hard_violations int not null default 0,
  soft_score numeric,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  log jsonb
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id),
  user_id uuid references profiles(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  diff jsonb,
  created_at timestamptz not null default now()
);
```

Enable RLS on every table above. Every policy must filter by `institution_id` matching the caller's `profiles.institution_id`, with additional role checks for write access.

---

## 5. Core Modules

### 5.1 Setup & Configuration
CRUD screens for institutions, terms, periods (day/period grid builder), rooms, subjects, teachers, class groups, and curriculum requirements. This is standard data-management UI — clean tables, inline edit, bulk import via CSV (use `xlsx` to parse uploads).

### 5.2 Constraint Engine

**Hard constraints (never violated — reject any placement that breaks these):**
1. A teacher cannot be scheduled in two places in the same period.
2. A room cannot be double-booked in the same period.
3. A class group cannot have two lessons in the same period.
4. A teacher cannot be scheduled outside their declared availability.
5. A room must satisfy the subject's required room type and have sufficient capacity for the class size.
6. Each class must receive exactly its required periods-per-week for every subject in the curriculum.
7. Double periods must be scheduled as two consecutive periods, same day, same room.
8. A teacher cannot exceed their max periods per day or per week.

**Soft constraints (optimized, each with an adjustable weight):**
1. Minimize gaps/free periods in teacher schedules.
2. Minimize gaps in student/class schedules.
3. Spread a subject's periods evenly across the week rather than clustering.
4. Avoid placing demanding subjects in the last period of the day.
5. Respect teacher time-of-day preferences where declared.
6. Balance each teacher's workload across the week.
7. Minimize the number of different rooms a class or teacher uses per day.
8. Avoid isolated single free periods ("holes") in a schedule.

Implement every one of these as a pure, independently unit-tested function: `(candidateLesson, currentTimetable) => Violation[]`. These same functions must be reused for (a) the generation engine, and (b) real-time validation while a user drags a lesson in the UI. Do not write the logic twice.

### 5.3 Timetable Generation Engine

This is the core of the product. Implement it as a standalone, framework-agnostic TypeScript module (e.g. `src/lib/scheduler-engine/`) so it can run in a Web Worker with no DOM dependency.

**Algorithm:**

1. **Requirement expansion** — Expand every `curriculum_requirements` row into individual lesson-slots to place (a double period counts as one linked pair).
2. **Constructive placement** — Order unplaced lessons by a *most-constrained-first* heuristic (place the hardest-to-place lessons first: teachers with limited availability, subjects needing scarce specialist rooms). For each lesson, evaluate candidate (day, period, room) combinations, use forward checking to skip placements that would leave a remaining lesson with zero legal options, and backtrack within a bounded budget when a dead end is hit.
3. **Local search optimization** — Once a hard-constraint-valid timetable exists, run simulated annealing (or hill-climbing with random restarts) over lesson-pair swaps, scoring each candidate state against the weighted soft-constraint list and accepting improvements (and occasionally accepting a worse state early on, to escape local minima).
4. **Reporting** — Persist the run's hard-violation count (should be zero) and soft score to `generation_runs`, and expose a human-readable violation/score breakdown in the UI.

**Execution environment:** Run this in a **Web Worker on the client** for the MVP — this avoids Supabase Edge Function timeout limits entirely and costs nothing. Post progress messages back to the main thread for a live progress bar. Persist the final result to `lessons` in a single transaction. Only after the MVP works, optionally add a Supabase Edge Function wrapper around the same engine module for scheduled/background regeneration — do not build this until Phase 7+.

Write unit tests for every hard constraint validator before writing the generation loop itself. Correctness here is the entire value proposition of the product.

### 5.4 Manual Editing (Master Timetable Grid)
A drag-and-drop grid (days × periods) using @dnd-kit, filterable by class, teacher, or room. Every drag operation runs the same constraint validators from 5.2 in real time and visually flags illegal drops before the user releases the drag — never allow a drop that violates a hard constraint to actually save. Provide a **keyboard-accessible alternative** to drag-and-drop (click a lesson → "Move to…" dialog with a period picker) so the grid is usable without a mouse — this is not optional, it is an accessibility requirement.

### 5.5 Substitution Management
Admin marks a teacher absent for a date (or range). System finds affected lessons, ranks candidate substitutes (subject-qualified teachers who are free that period and under their weekly load, ranked above any other free teacher), admin approves, system logs the change and updates the affected views.

### 5.6 Reporting & Export
Master timetable and individual teacher/class/room views, print-optimized (a real `@media print` stylesheet, not just "export the screen"), Excel export of raw lesson data, and `.ics` calendar export per teacher/class. Include a workload dashboard (periods per teacher, room utilization %) using recharts.

### 5.7 Smart Import & Legacy Timetable Migration

**Why this exists:** the single biggest reason a school doesn't switch scheduling tools is the cost of re-entering years of existing data. This feature removes that cost, and it is a genuine differentiator — none of aSc TimeTables, FET, TimetableMaster, or Prime Timetable offer an AI-assisted "upload what you already have" onboarding path. Lead with this in any pitch or demo.

This feature has two modes. Both share the same pipeline; only the target table differs.

- **Mode A — Curriculum Import:** admin uploads a subjects/requirements spreadsheet (which classes take which subjects, with which teacher, how many periods per week). Extracted rows land in `draft_import_rows` and, once confirmed, commit into `curriculum_requirements`. This feeds the generation engine (5.3) directly — no day/period data required.
- **Mode B — Legacy Timetable Import:** admin uploads an existing timetable (spreadsheet, PDF, or a photo of a printed schedule). Extracted rows include day/period placement and, once confirmed, commit straight into `lessons` as an editable draft — so the admin is editing a pre-existing timetable on the master grid (5.4) instead of generating one from nothing.

**Pipeline (implement as a single Edge Function, `process-import`):**

1. Client uploads the file to a Supabase Storage bucket and invokes `process-import` with the storage path and the chosen mode.
2. The function downloads the file. Spreadsheets (`.xlsx`/`.csv`) are parsed server-side with SheetJS into plain text/CSV first — don't ship the raw binary to the model. PDFs or photos of printed timetables are passed directly to Gemini as multimodal input.
3. Call the Gemini API with a `responseSchema` that matches `draft_import_rows` (e.g. `{ className, subjectName, teacherName, roomName, dayOfWeek, periodNumber, periodsPerWeek }` per row, fields nullable depending on mode). Structured output mode, not freeform prompting — this is what makes the extraction reliable enough to trust.
4. Insert one `draft_import_rows` record per extracted row, with the raw extracted values preserved in `raw_data`.
5. Run fuzzy matching (fuse.js) against the institution's existing `class_groups`, `subjects`, `teachers`, and `rooms`. Populate the `matched_*_id` columns and `match_confidence`. Anything below a 0.7 confidence threshold is flagged `needs_manual_review` — never auto-commit a low-confidence match.
6. Set `draft_imports.status = 'needs_review'`. The client is already subscribed to this row via Realtime and moves to the review screen automatically.

**Review & Reconcile screen:** a table, one row per extracted lesson/requirement — the raw extracted text, the matched entity (editable dropdown so the admin can correct a bad match), a confidence indicator, and an include/exclude checkbox. Nothing is silently auto-applied; any row the admin doesn't explicitly confirm stays out of the commit.

**Commit step:** for Mode B specifically, before writing confirmed rows into `lessons`, run every row through the same hard-constraint validators from Section 5.2. A manually-built legacy timetable frequently already contains real conflicts (a teacher double-booked by accident, say) — surface these to the admin as a plain-language conflict report *before* committing, rather than letting the database's unique constraints (Section 4) reject the insert with a raw error. This is also a good pitch point: the import process finds problems in the school's current timetable that they didn't already know about.

**Cost and dependency notes:** Gemini calls happen only during an import action — occasional and human-triggered, not on any hot path — so this comfortably fits within the Gemini API's free tier or a Google AI Pro/Ultra subscription's bundled Cloud credit. Treat it strictly as an enhancement: if the Gemini API is ever unavailable, the rest of the platform (manual entry, generation, editing) must keep working unaffected.

---

## 6. Design System & UI/UX Direction

This software will be used by school administrators for hours at a time. It must read as **calm, professional, and information-dense** — closer to enterprise scheduling software than a marketing site.

**Explicitly avoid (do not do any of this):**
- Purple-to-pink or blue-to-purple gradient buttons, headers, or backgrounds
- Glassmorphism / frosted-glass overlays, glowing blur effects
- Any emoji used as icons, bullet markers, or in labels/buttons
- "AI assistant" chat-bubble mascots, sparkle/star decorative icons
- Marketing-style hero copy ("Supercharge your scheduling with AI")
- Overuse of `rounded-full` pill shapes on every element
- Stock illustration people/characters
- Heavy drop shadows on every card

**Do this instead:**
- Neutral base palette (slate/gray scale) with **one** deliberate accent color — pick a single accent such as a deep blue (`#1D4ED8`) or forest green (`#166534`), not a gradient, and use it sparingly (primary actions, active states) rather than everywhere
- A clean, professional sans-serif (Inter, Public Sans, or IBM Plex Sans) used consistently — no display/decorative fonts
- Lucide icons only, monochrome, consistent stroke width, used functionally (never decoratively)
- Flat design: clear 1px borders and generous whitespace instead of shadows to separate content
- shadcn/ui components re-themed to the palette above — do not leave the default violet/lavender shadcn theme in place
- The timetable grid itself should look like a well-built spreadsheet: crisp borders, legible type at small sizes, color used only to distinguish subjects (via the `subjects.color` field), not as decoration
- Real seed/demo data in every screenshot or demo state — no "Lorem Ipsum"

Reference points for tone: Linear, Notion's table views, and real school administration systems (PowerSchool, Infinite Campus) — not AI-startup landing pages.

---

## 7. Key Screens

1. Login
2. Setup wizard (institution → terms → period/day structure → rooms/subjects/teachers/classes)
3. Import & Reconcile wizard (Smart Import, Section 5.7): upload, review/match, commit
4. Dashboard (generation status, open conflicts, upcoming substitutions, quick stats)
5. Data management screens (Rooms, Subjects, Teachers, Class Groups, Curriculum Requirements)
6. Constraints configuration (toggle hard constraints, adjust soft-constraint weights)
7. Timetable Generator (run, live progress, violation/score report)
8. Master Timetable Grid (drag-and-drop, filterable, live conflict highlighting)
9. Individual views: Teacher / Class / Room timetable (print-optimized)
10. Substitution Manager
11. Reports & Export center
12. Settings, user/role management, audit log viewer

---

## 8. Non-Functional Requirements

- RLS enforced on every table; assume the frontend is not a security boundary
- Full audit log of every manual timetable edit and substitution decision
- WCAG AA accessibility, including the keyboard alternative to drag-and-drop (Section 5.4)
- Responsive down to tablet width (1024px); the timetable grid is data-dense and is not expected to be phone-first
- Performance target: generate a ~30-class secondary-school timetable (roughly 800–1200 lesson-slots) in under 60 seconds on a typical laptop
- Design for Supabase free-tier limits: paginate all list views, avoid unnecessary Realtime subscriptions, keep queries indexed and scoped

---

## 9. Build Plan (follow in order)

**Phase 0 — Scaffolding:** Vite + React + TS app, Tailwind + shadcn configured to the palette in Section 6, Supabase project + local env config, repo structure, lint/test setup (Vitest).

**Phase 1 — Auth & Core Data:** Run the schema migrations from Section 4, enable RLS policies for every role, build auth flows and role-based route guarding, build CRUD screens for institution setup data.

**Phase 2 — Curriculum & Constraints:** Curriculum requirement builder, constraint configuration UI, confirm the DB-level uniqueness constraints are active and tested.

**Phase 3 — Scheduling Engine:** Build and unit-test every constraint validator first, then the constructive backtracking placement algorithm, then the local-search optimizer, then wrap it in a Web Worker with progress reporting, then persist results.

**Phase 4 — Timetable Grid:** Master grid component, drag-and-drop with live validation (reusing Phase 3's validators), filtered teacher/class/room views, lesson locking.

**Phase 5 — Substitutions:** Absence entry, candidate ranking, approval flow, history log.

**Phase 6 — Smart Import:** Build the `process-import` Edge Function (Section 5.7), the Gemini structured-extraction call, the fuzzy-matching step, and the review/reconcile screen. Confirm Mode B commits run through the Phase 3 validators before writing to `lessons`.

**Phase 7 — Reporting & Export:** Print stylesheets, Excel export, `.ics` export, workload/utilization dashboard.

**Phase 8 — Polish & QA:** Keyboard accessibility pass, responsive pass, empty/loading/error states everywhere, a full design review against the anti-pattern list in Section 6, seed realistic demo data, write a README with local setup and deployment steps.

---

## 10. Definition of Done

- A generated timetable has **zero** hard-constraint violations, verified by automated tests, not just visual inspection
- Every hard constraint is additionally enforced at the database layer (Section 4's unique constraints), not only in application logic
- A user can manually drag a lesson to an illegal slot and the system blocks the save with a clear reason, both via mouse and via the keyboard-accessible alternative
- Marking a teacher absent produces a ranked, qualified list of substitute candidates within their availability and load limits
- Every screen in Section 7 exists, uses real data, and contains no emoji, gradient decoration, or placeholder Lorem Ipsum
- Uploading a legacy timetable or curriculum spreadsheet produces a reviewable, editable set of matches — nothing is committed to `lessons` or `curriculum_requirements` without explicit admin confirmation, and any conflicts in an imported legacy timetable are surfaced before commit, not after
- The entire stack runs on $0/month at small-institution scale (Supabase free tier + Vercel/Netlify free tier); the Gemini-powered import is the one optional exception, and the platform must function fully without it if the API is unavailable
