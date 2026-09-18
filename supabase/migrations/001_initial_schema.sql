-- 001_initial_schema.sql
-- School & University Timetabling Platform Schema
-- Multi-tenant schema with full Row Level Security

-- 1. Enable UUID extension
create extension if not exists "pgcrypto";

-- 2. Institutions table
create table if not exists institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'UTC',
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- 3. Profiles table (extends auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  institution_id uuid references institutions(id),
  role text not null check (role in ('super_admin','school_admin','dept_head','teacher','viewer')),
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

-- 4. Terms
create table if not exists terms (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  weeks_per_cycle int not null default 1 -- 1 = single week, 2 = A/B fortnightly
);

-- 5. Periods
create table if not exists periods (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  day_of_week int not null check (day_of_week between 1 and 7),
  period_number int not null,
  start_time time not null,
  end_time time not null,
  is_break boolean not null default false
);

-- 6. Rooms
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  name text not null,
  capacity int not null,
  room_type text not null default 'classroom', -- classroom, lab, gym, auditorium, etc.
  features jsonb not null default '[]'
);

-- 7. Subjects
create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  name text not null,
  code text not null,
  color text not null default '#475569',
  required_room_type text
);

-- 8. Teachers
create table if not exists teachers (
  id uuid primary key references profiles(id) on delete cascade,
  institution_id uuid not null references institutions(id) on delete cascade,
  max_periods_per_day int not null default 6,
  max_periods_per_week int not null default 25,
  qualified_subject_ids uuid[] not null default '{}'
);

-- 9. Teacher Unavailability
create table if not exists teacher_unavailability (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  period_id uuid not null references periods(id) on delete cascade,
  reason text
);

-- 10. Class Groups
create table if not exists class_groups (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  name text not null,          -- e.g. "Grade 10B"
  year_level int,
  size int not null default 0
);

-- 11. Curriculum Requirements
create table if not exists curriculum_requirements (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references terms(id) on delete cascade,
  class_group_id uuid not null references class_groups(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  teacher_id uuid references teachers(id) on delete set null,
  periods_per_week int not null,
  double_period boolean not null default false
);

-- 12. Constraints Config
create table if not exists constraints_config (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  constraint_key text not null,   -- e.g. 'minimize_teacher_gaps'
  constraint_type text not null check (constraint_type in ('hard','soft')),
  enabled boolean not null default true,
  weight int not null default 5  -- 1-10, soft constraints only
);

-- 13. Lessons
create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references terms(id) on delete cascade,
  class_group_id uuid not null references class_groups(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  teacher_id uuid not null references teachers(id) on delete cascade,
  room_id uuid not null references rooms(id) on delete cascade,
  period_id uuid not null references periods(id) on delete cascade,
  week_pattern text not null default 'all', -- 'all' | 'A' | 'B'
  locked boolean not null default false,

  -- Hard-constraint safety net at the DB layer:
  unique (term_id, teacher_id, period_id, week_pattern),
  unique (term_id, room_id, period_id, week_pattern),
  unique (term_id, class_group_id, period_id, week_pattern)
);

-- 14. Draft Imports (Staging area for Smart Import)
create table if not exists draft_imports (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  term_id uuid references terms(id) on delete set null,
  source_type text not null check (source_type in ('curriculum_list','legacy_timetable')),
  original_filename text not null,
  status text not null default 'processing' check (status in ('processing','needs_review','committed','discarded')),
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 15. Draft Import Rows
create table if not exists draft_import_rows (
  id uuid primary key default gen_random_uuid(),
  draft_import_id uuid not null references draft_imports(id) on delete cascade,
  raw_data jsonb not null,                        -- exactly what Gemini extracted, untouched
  matched_class_group_id uuid references class_groups(id) on delete set null,
  matched_subject_id uuid references subjects(id) on delete set null,
  matched_teacher_id uuid references teachers(id) on delete set null,
  matched_room_id uuid references rooms(id) on delete set null,
  match_confidence numeric,                       -- 0-1, from the fuzzy-match step
  needs_manual_review boolean not null default false,
  resolved boolean not null default false,
  day_of_week int,                                -- null for curriculum_list imports
  period_number int,                              -- null for curriculum_list imports
  periods_per_week int,                           -- used for curriculum_list imports
  hard_conflict boolean not null default false,    -- set after running validators
  conflict_details jsonb
);

-- 16. Substitutions
create table if not exists substitutions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  date date not null,
  absent_teacher_id uuid not null references teachers(id) on delete cascade,
  substitute_teacher_id uuid references teachers(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','assigned','declined')),
  reason text,
  created_at timestamptz not null default now()
);

-- 17. Generation Runs
create table if not exists generation_runs (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references terms(id) on delete cascade,
  status text not null default 'running',
  hard_violations int not null default 0,
  soft_score numeric,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  log jsonb
);

-- 18. Audit Log
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  diff jsonb,
  created_at timestamptz not null default now()
);

--------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
--------------------------------------------------------------------------------

-- Helper functions for RLS checks
create or replace function get_auth_profile()
returns profiles as $$
  select * from profiles where id = auth.uid() limit 1;
$$ language sql stable security definer;

create or replace function current_user_institution()
returns uuid as $$
  select institution_id from profiles where id = auth.uid() limit 1;
$$ language sql stable security definer;

create or replace function current_user_role()
returns text as $$
  select role from profiles where id = auth.uid() limit 1;
$$ language sql stable security definer;

create or replace function is_super_admin()
returns boolean as $$
  select coalesce(role = 'super_admin', false) from profiles where id = auth.uid() limit 1;
$$ language sql stable security definer;

create or replace function is_school_admin_or_higher()
returns boolean as $$
  select coalesce(role in ('super_admin', 'school_admin'), false) from profiles where id = auth.uid() limit 1;
$$ language sql stable security definer;

-- Enable RLS on every table
alter table institutions enable row level security;
alter table profiles enable row level security;
alter table terms enable row level security;
alter table periods enable row level security;
alter table rooms enable row level security;
alter table subjects enable row level security;
alter table teachers enable row level security;
alter table teacher_unavailability enable row level security;
alter table class_groups enable row level security;
alter table curriculum_requirements enable row level security;
alter table constraints_config enable row level security;
alter table lessons enable row level security;
alter table draft_imports enable row level security;
alter table draft_import_rows enable row level security;
alter table substitutions enable row level security;
alter table generation_runs enable row level security;
alter table audit_log enable row level security;

-- Policies for institutions
create policy "Super admin has full access to institutions"
  on institutions for all
  using (is_super_admin());

create policy "Users can view their own institution"
  on institutions for select
  using (id = current_user_institution());

create policy "School admin can update own institution"
  on institutions for update
  using (id = current_user_institution() and is_school_admin_or_higher());

-- Policies for profiles
create policy "Super admin has full access to profiles"
  on profiles for all
  using (is_super_admin());

create policy "Users can view profiles in their institution"
  on profiles for select
  using (institution_id = current_user_institution() or id = auth.uid());

create policy "Users can update their own profile"
  on profiles for update
  using (id = auth.uid());

create policy "School admin can manage profiles in their institution"
  on profiles for all
  using (institution_id = current_user_institution() and is_school_admin_or_higher());

-- Standard tenant policy macro for other tables
-- Terms
create policy "Terms tenant isolation select" on terms for select
  using (is_super_admin() or institution_id = current_user_institution());
create policy "Terms tenant admin write" on terms for all
  using (is_super_admin() or (institution_id = current_user_institution() and is_school_admin_or_higher()));

-- Periods
create policy "Periods tenant isolation select" on periods for select
  using (is_super_admin() or institution_id = current_user_institution());
create policy "Periods tenant admin write" on periods for all
  using (is_super_admin() or (institution_id = current_user_institution() and is_school_admin_or_higher()));

-- Rooms
create policy "Rooms tenant isolation select" on rooms for select
  using (is_super_admin() or institution_id = current_user_institution());
create policy "Rooms tenant admin write" on rooms for all
  using (is_super_admin() or (institution_id = current_user_institution() and is_school_admin_or_higher()));

-- Subjects
create policy "Subjects tenant isolation select" on subjects for select
  using (is_super_admin() or institution_id = current_user_institution());
create policy "Subjects tenant admin write" on subjects for all
  using (is_super_admin() or (institution_id = current_user_institution() and is_school_admin_or_higher()));

-- Teachers
create policy "Teachers tenant isolation select" on teachers for select
  using (is_super_admin() or institution_id = current_user_institution());
create policy "Teachers tenant admin write" on teachers for all
  using (is_super_admin() or (institution_id = current_user_institution() and is_school_admin_or_higher()));

-- Teacher unavailability
create policy "Teacher unavailability select" on teacher_unavailability for select
  using (is_super_admin() or exists (select 1 from teachers t where t.id = teacher_unavailability.teacher_id and t.institution_id = current_user_institution()));
create policy "Teacher unavailability write" on teacher_unavailability for all
  using (is_super_admin() or (
    exists (select 1 from teachers t where t.id = teacher_unavailability.teacher_id and t.institution_id = current_user_institution())
    and (is_school_admin_or_higher() or teacher_id = auth.uid())
  ));

-- Class groups
create policy "Class groups tenant isolation select" on class_groups for select
  using (is_super_admin() or institution_id = current_user_institution());
create policy "Class groups tenant admin write" on class_groups for all
  using (is_super_admin() or (institution_id = current_user_institution() and is_school_admin_or_higher()));

-- Curriculum requirements
create policy "Curriculum reqs tenant isolation select" on curriculum_requirements for select
  using (is_super_admin() or exists (select 1 from terms t where t.id = curriculum_requirements.term_id and t.institution_id = current_user_institution()));
create policy "Curriculum reqs tenant admin write" on curriculum_requirements for all
  using (is_super_admin() or (
    exists (select 1 from terms t where t.id = curriculum_requirements.term_id and t.institution_id = current_user_institution())
    and (is_school_admin_or_higher() or current_user_role() = 'dept_head')
  ));

-- Constraints config
create policy "Constraints config select" on constraints_config for select
  using (is_super_admin() or institution_id = current_user_institution());
create policy "Constraints config write" on constraints_config for all
  using (is_super_admin() or (institution_id = current_user_institution() and is_school_admin_or_higher()));

-- Lessons
create policy "Lessons tenant isolation select" on lessons for select
  using (is_super_admin() or exists (select 1 from terms t where t.id = lessons.term_id and t.institution_id = current_user_institution()));
create policy "Lessons tenant write" on lessons for all
  using (is_super_admin() or (
    exists (select 1 from terms t where t.id = lessons.term_id and t.institution_id = current_user_institution())
    and is_school_admin_or_higher()
  ));

-- Draft imports
create policy "Draft imports tenant select" on draft_imports for select
  using (is_super_admin() or institution_id = current_user_institution());
create policy "Draft imports tenant write" on draft_imports for all
  using (is_super_admin() or (institution_id = current_user_institution() and is_school_admin_or_higher()));

-- Draft import rows
create policy "Draft import rows select" on draft_import_rows for select
  using (is_super_admin() or exists (select 1 from draft_imports di where di.id = draft_import_rows.draft_import_id and di.institution_id = current_user_institution()));
create policy "Draft import rows write" on draft_import_rows for all
  using (is_super_admin() or (
    exists (select 1 from draft_imports di where di.id = draft_import_rows.draft_import_id and di.institution_id = current_user_institution())
    and is_school_admin_or_higher()
  ));

-- Substitutions
create policy "Substitutions select" on substitutions for select
  using (is_super_admin() or exists (
    select 1 from teachers t where t.id = substitutions.absent_teacher_id and t.institution_id = current_user_institution()
  ));
create policy "Substitutions write" on substitutions for all
  using (is_super_admin() or (
    exists (select 1 from teachers t where t.id = substitutions.absent_teacher_id and t.institution_id = current_user_institution())
    and (is_school_admin_or_higher() or absent_teacher_id = auth.uid())
  ));

-- Generation runs
create policy "Generation runs select" on generation_runs for select
  using (is_super_admin() or exists (select 1 from terms t where t.id = generation_runs.term_id and t.institution_id = current_user_institution()));
create policy "Generation runs write" on generation_runs for all
  using (is_super_admin() or (
    exists (select 1 from terms t where t.id = generation_runs.term_id and t.institution_id = current_user_institution())
    and is_school_admin_or_higher()
  ));

-- Audit log
create policy "Audit log select" on audit_log for select
  using (is_super_admin() or (institution_id = current_user_institution() and is_school_admin_or_higher()));
create policy "Audit log insert" on audit_log for insert
  with check (is_super_admin() or institution_id = current_user_institution());
