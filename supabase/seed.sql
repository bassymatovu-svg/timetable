-- seed.sql: Realistic demo institution data for TimetableOS
-- Includes 2 institutions for multi-tenant verification, realistic rooms, subjects, teachers, and curriculum

-- 1. Institutions
INSERT INTO institutions (id, name, timezone, settings) VALUES
('00000000-0000-0000-0000-000000000001', 'Oakwood High School', 'America/New_York', '{"working_days": [1, 2, 3, 4, 5]}'),
('00000000-0000-0000-0000-000000000002', 'St. Jude University College', 'America/Chicago', '{"working_days": [1, 2, 3, 4, 5]}')
ON CONFLICT (id) DO NOTHING;

-- 2. Terms for Oakwood High School
INSERT INTO terms (id, institution_id, name, start_date, end_date, weeks_per_cycle) VALUES
('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Fall Semester 2026', '2026-09-01', '2027-01-22', 1),
('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Spring Semester 2027', '2027-02-01', '2027-06-25', 1)
ON CONFLICT (id) DO NOTHING;

-- 3. Periods (Monday to Friday, 7 periods per day, period 4 is Lunch/Break)
DO $$
DECLARE
  day_idx int;
  period_num int;
  start_t time;
  end_t time;
  is_b boolean;
BEGIN
  FOR day_idx IN 1..5 LOOP
    FOR period_num IN 1..7 LOOP
      IF period_num = 1 THEN start_t := '08:00'; end_t := '08:50'; is_b := false;
      ELSIF period_num = 2 THEN start_t := '08:55'; end_t := '09:45'; is_b := false;
      ELSIF period_num = 3 THEN start_t := '09:50'; end_t := '10:40'; is_b := false;
      ELSIF period_num = 4 THEN start_t := '10:45'; end_t := '11:35'; is_b := true; -- Lunch
      ELSIF period_num = 5 THEN start_t := '11:40'; end_t := '12:30'; is_b := false;
      ELSIF period_num = 6 THEN start_t := '12:35'; end_t := '13:25'; is_b := false;
      ELSIF period_num = 7 THEN start_t := '13:30'; end_t := '14:20'; is_b := false;
      END IF;

      INSERT INTO periods (institution_id, day_of_week, period_number, start_time, end_time, is_break)
      VALUES ('00000000-0000-0000-0000-000000000001', day_idx, period_num, start_t, end_t, is_b);
    END LOOP;
  END LOOP;
END $$;

-- 4. Rooms
INSERT INTO rooms (id, institution_id, name, capacity, room_type, features) VALUES
('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Room 101', 32, 'classroom', '["projector", "whiteboard"]'),
('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Room 102', 32, 'classroom', '["projector", "whiteboard"]'),
('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Room 103', 30, 'classroom', '["whiteboard"]'),
('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Science Lab Alpha', 28, 'lab', '["fume_hood", "gas_taps", "sinks"]'),
('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Science Lab Beta', 28, 'lab', '["fume_hood", "microscopes", "sinks"]'),
('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Computer Lab A', 30, 'computer_lab', '["30_workstations", "network_switches"]'),
('20000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Main Gymnasium', 120, 'gym', '["indoor_court", "scoreboard"]'),
('20000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Fine Arts Studio', 26, 'art_studio', '["easels", "kiln", "wash_basins"]')
ON CONFLICT (id) DO NOTHING;

-- 5. Subjects
INSERT INTO subjects (id, institution_id, name, code, color, required_room_type) VALUES
('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Mathematics', 'MATH', '#1e40af', 'classroom'),
('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Physics', 'PHYS', '#0891b2', 'lab'),
('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Chemistry', 'CHEM', '#0d9488', 'lab'),
('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'English Literature', 'ENG', '#b45309', 'classroom'),
('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'World History', 'HIST', '#854d0e', 'classroom'),
('30000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Computer Science', 'CS', '#4338ca', 'computer_lab'),
('30000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Physical Education', 'PE', '#15803d', 'gym'),
('30000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Visual Arts', 'ART', '#be185d', 'art_studio')
ON CONFLICT (id) DO NOTHING;

-- 6. Class Groups
INSERT INTO class_groups (id, institution_id, name, year_level, size) VALUES
('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Grade 9A', 9, 28),
('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Grade 9B', 9, 26),
('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Grade 10A', 10, 29),
('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Grade 10B', 10, 27),
('40000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Grade 11-Science', 11, 24),
('40000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Grade 12-Arts', 12, 22)
ON CONFLICT (id) DO NOTHING;

-- 7. Constraints Config Default
INSERT INTO constraints_config (institution_id, constraint_key, constraint_type, enabled, weight) VALUES
('00000000-0000-0000-0000-000000000001', 'teacher_no_double_book', 'hard', true, 10),
('00000000-0000-0000-0000-000000000001', 'room_no_double_book', 'hard', true, 10),
('00000000-0000-0000-0000-000000000001', 'class_no_double_book', 'hard', true, 10),
('00000000-0000-0000-0000-000000000001', 'teacher_availability', 'hard', true, 10),
('00000000-0000-0000-0000-000000000001', 'room_type_and_capacity', 'hard', true, 10),
('00000000-0000-0000-0000-000000000001', 'curriculum_periods_fulfillment', 'hard', true, 10),
('00000000-0000-0000-0000-000000000001', 'double_period_consecutive', 'hard', true, 10),
('00000000-0000-0000-0000-000000000001', 'teacher_max_load_limits', 'hard', true, 10),
('00000000-0000-0000-0000-000000000001', 'minimize_teacher_gaps', 'soft', true, 8),
('00000000-0000-0000-0000-000000000001', 'minimize_student_gaps', 'soft', true, 9),
('00000000-0000-0000-0000-000000000001', 'spread_subject_evenly', 'soft', true, 7),
('00000000-0000-0000-0000-000000000001', 'avoid_demanding_subject_last', 'soft', true, 5),
('00000000-0000-0000-0000-000000000001', 'respect_time_preferences', 'soft', true, 6),
('00000000-0000-0000-0000-000000000001', 'balance_teacher_workload', 'soft', true, 6),
('00000000-0000-0000-0000-000000000001', 'minimize_room_changes', 'soft', true, 4),
('00000000-0000-0000-0000-000000000001', 'avoid_isolated_single_free_period', 'soft', true, 7);
