-- 002_exam_and_test_timetables.sql
-- Migration to support Exam Timetables and Test Timetables with duration, room booking, and supervisor assignments.

-- 1. Assessment Sessions table (supports both Exam and Test timetables)
create table if not exists assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  term_id uuid not null references terms(id) on delete cascade,
  type text not null check (type in ('exam', 'test')),
  title text not null,
  subject_id uuid not null references subjects(id) on delete cascade,
  class_group_ids uuid[] not null default '{}',
  date date not null,
  start_time time not null,
  duration_minutes int not null check (duration_minutes > 0),
  end_time time not null,
  room_ids uuid[] not null default '{}',
  supervisor_ids uuid[] not null default '{}',
  chief_supervisor_id uuid references teachers(id) on delete set null,
  instructions text,
  status text not null default 'scheduled' check (status in ('draft', 'scheduled', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

-- 2. Helpful Indexes
create index if not exists idx_assessment_sessions_inst_date on assessment_sessions(institution_id, date);
create index if not exists idx_assessment_sessions_term on assessment_sessions(term_id);
create index if not exists idx_assessment_sessions_type on assessment_sessions(type);

-- 3. Enable Row Level Security (RLS)
alter table assessment_sessions enable row level security;

-- 4. RLS Policies
create policy "Users can view assessment sessions within their institution"
  on assessment_sessions for select
  using (institution_id = current_user_institution() or is_super_admin());

create policy "Admins and Dept Heads can manage assessment sessions"
  on assessment_sessions for all
  using (
    (institution_id = current_user_institution() and current_user_role() in ('super_admin', 'school_admin', 'dept_head'))
    or is_super_admin()
  );
