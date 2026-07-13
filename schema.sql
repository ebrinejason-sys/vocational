-- Vocational Training Management System Schema
-- Optimized for CBET, Trauma-Informed Care, and NGO Operations

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 0. BASE TABLE PRIVILEGES
-- RLS policies only ever get evaluated after Postgres's own GRANT layer
-- allows the query through. Supabase projects normally come with these
-- grants pre-configured for the public schema, but that can't be assumed —
-- without them every request fails with "permission denied for table X"
-- (Postgres error 42501), regardless of RLS policies, even for service_role.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 1. AUTH & ROLES
CREATE TYPE user_role AS ENUM ('admin', 'director', 'trainer', 'case_worker', 'finance_officer');

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SECURITY DEFINER so RLS policies can check the caller's role without
-- recursively hitting the RLS policy on profiles itself.
CREATE OR REPLACE FUNCTION current_role_is(roles user_role[])
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND active AND role = ANY(roles)
  );
$$;

-- 2. CORE STRUCTURE: BATCHES & TRADES
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL, -- e.g., Carpentry, Tailoring, Masonry, Electricity
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL, -- e.g., "Batch 5 - 2024"
    trade TEXT NOT NULL CHECK (trade IN ('Carpentry','Tailoring','Masonry','Electricity','Entrepreneurship')),
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','completed','archived')),
    budget_allocated DECIMAL(12,2) DEFAULT 0,
    target_enrollment INTEGER,
    trainer_name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TRAINEE MANAGEMENT
CREATE TABLE trainees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES batches(id),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('male','female')),
    phone_number TEXT,
    national_id TEXT,
    address TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    -- Selection & Vulnerability
    mobilization_source TEXT,
    vulnerability_score INTEGER,
    vulnerability_assessment JSONB,
    vulnerability_notes TEXT,
    status TEXT DEFAULT 'prospect' CHECK (status IN ('prospect','enrolled','graduated','dropped','alumni')),
    graduation_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vulnerability Assessment Details
CREATE TABLE vulnerability_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trainee_id UUID REFERENCES trainees(id) ON DELETE CASCADE,
    housing_status TEXT,
    food_security_level TEXT,
    previous_education TEXT,
    family_status TEXT,
    disability_info TEXT,
    total_score INTEGER,
    assessed_by UUID,
    assessment_date DATE DEFAULT CURRENT_DATE
);

-- 4. CBET & CURRICULUM
CREATE TABLE modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id UUID REFERENCES trades(id),
    code TEXT NOT NULL, -- e.g., CART-01
    name TEXT NOT NULL,
    description TEXT,
    credit_hours INTEGER
);

CREATE TABLE competency_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trainee_id UUID REFERENCES trainees(id) ON DELETE CASCADE,
    module_id UUID REFERENCES modules(id),
    level INTEGER NOT NULL, -- 1: Beginner, 2: Developing, 3: Proficient, 4: Independent
    score DECIMAL(5,2), -- Practical percentage if needed
    assessment_date DATE DEFAULT CURRENT_DATE,
    assessor_id UUID,
    feedback TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ATTENDANCE
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trainee_id UUID REFERENCES trainees(id) ON DELETE CASCADE,
    attendance_date DATE DEFAULT CURRENT_DATE,
    status TEXT NOT NULL, -- present, absent, late, excused
    notes TEXT,
    UNIQUE(trainee_id, attendance_date)
);

-- 6. CASE MANAGEMENT & TRAUMA-INFORMED CARE (Sensitive)
CREATE TABLE case_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trainee_id UUID REFERENCES trainees(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- trauma_healing, mentorship, safeguarding, medical, family
    content TEXT NOT NULL,
    is_critical BOOLEAN DEFAULT FALSE,
    follow_up_required BOOLEAN DEFAULT FALSE,
    author_id UUID NOT NULL, -- Staff UUID
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. INVENTORY & PROCUREMENT
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT, -- Tool, Material, Equipment
    unit TEXT NOT NULL, -- pcs, kg, m, liters
    quantity_on_hand DECIMAL(12,2) DEFAULT 0,
    reorder_level DECIMAL(12,2) DEFAULT 5,
    unit_cost DECIMAL(12,2)
);

CREATE TABLE inventory_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID REFERENCES inventory_items(id),
    batch_id UUID REFERENCES batches(id),
    trainee_id UUID REFERENCES trainees(id), -- If assigned to specific trainee
    quantity_used DECIMAL(12,2) NOT NULL,
    usage_date DATE DEFAULT CURRENT_DATE,
    purpose TEXT -- e.g., "Practical Exam", "Daily Training"
);

CREATE TABLE procurement_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID REFERENCES inventory_items(id),
    quantity_requested DECIMAL(12,2) NOT NULL,
    estimated_cost DECIMAL(12,2),
    status TEXT DEFAULT 'pending', -- pending, approved, purchased, cancelled
    requested_by UUID,
    approved_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. PRODUCTION & SALES (Income Generation)
CREATE TABLE production_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES batches(id),
    item_produced TEXT NOT NULL, -- e.g., "Dining Table", "School Uniform"
    quantity INTEGER DEFAULT 1,
    date_produced DATE DEFAULT CURRENT_DATE
);

CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES batches(id),
    description TEXT,
    amount DECIMAL(12,2) NOT NULL,
    sale_date DATE DEFAULT CURRENT_DATE,
    customer_contact TEXT,
    payment_status TEXT DEFAULT 'paid' -- paid, partial, pending
);

-- 9. FINANCIAL TRACKING (NGO Accounting)
CREATE TABLE financial_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES batches(id),
    category TEXT NOT NULL, -- stipend, materials, trainers_fee, utilities, outreach
    transaction_type TEXT NOT NULL, -- income, expense
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    transaction_date DATE DEFAULT CURRENT_DATE,
    donor_id TEXT, -- For donor reporting
    recorded_by UUID
);

-- 10. POST-GRADUATION & ALUMNI
CREATE TABLE alumni_follow_ups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trainee_id UUID REFERENCES trainees(id) ON DELETE CASCADE,
    follow_up_date DATE DEFAULT CURRENT_DATE,
    employment_status TEXT, -- employed, self_employed, unemployed, further_studies
    current_employer TEXT,
    average_monthly_income DECIMAL(12,2),
    starter_kit_status TEXT, -- in_use, sold, lost, damaged
    notes TEXT,
    recorded_by UUID
);

CREATE TABLE job_placements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trainee_id UUID REFERENCES trainees(id) ON DELETE CASCADE,
    employer_name TEXT NOT NULL,
    position TEXT,
    start_date DATE,
    contact_person TEXT,
    contact_phone TEXT
);

-- 11. STARTER KITS
CREATE TABLE starter_kits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trainee_id UUID REFERENCES trainees(id) UNIQUE,
    kit_description TEXT, -- List of tools
    issued_date DATE,
    received_by_signature_url TEXT,
    total_value DECIMAL(12,2)
);

-- VIEW FOR DASHBOARD (Example)
CREATE OR REPLACE VIEW batch_performance_summary AS
SELECT
    b.id as batch_id,
    b.name as batch_name,
    COUNT(t.id) as total_enrolled,
    COUNT(CASE WHEN t.status = 'graduated' THEN 1 END) as total_graduated,
    AVG(t.vulnerability_score) as avg_vulnerability_score,
    SUM(f.amount) FILTER (WHERE f.transaction_type = 'expense') as total_expenses,
    SUM(s.amount) as total_production_sales
FROM batches b
LEFT JOIN trainees t ON b.id = t.batch_id
LEFT JOIN financial_transactions f ON b.id = f.batch_id
LEFT JOIN sales s ON b.id = s.batch_id
GROUP BY b.id, b.name;

-- ============================================================
-- 12. ROW LEVEL SECURITY
-- Permission matrix per docs/superpowers/specs/2026-07-12-auth-rbac-foundation-design.md §4
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select ON profiles FOR SELECT
  USING (id = auth.uid() OR current_role_is(ARRAY['director','admin']::user_role[]));
CREATE POLICY profiles_insert ON profiles FOR INSERT
  WITH CHECK (current_role_is(ARRAY['admin']::user_role[]));
CREATE POLICY profiles_update ON profiles FOR UPDATE
  USING (current_role_is(ARRAY['admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['admin']::user_role[]));
CREATE POLICY profiles_delete ON profiles FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- Bucket A: batches, trades — view: all 5 roles, edit: trainer/case_worker/director/admin
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY batches_select ON batches FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','finance_officer','director','admin']::user_role[]));
CREATE POLICY batches_insert ON batches FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]));
CREATE POLICY batches_update ON batches FOR UPDATE
  USING (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]));
CREATE POLICY batches_delete ON batches FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY trades_select ON trades FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','finance_officer','director','admin']::user_role[]));
CREATE POLICY trades_insert ON trades FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]));
CREATE POLICY trades_update ON trades FOR UPDATE
  USING (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]));
CREATE POLICY trades_delete ON trades FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- Bucket B: trainees — same shape as batches
ALTER TABLE trainees ENABLE ROW LEVEL SECURITY;
CREATE POLICY trainees_select ON trainees FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','finance_officer','director','admin']::user_role[]));
CREATE POLICY trainees_insert ON trainees FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]));
CREATE POLICY trainees_update ON trainees FOR UPDATE
  USING (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]));
CREATE POLICY trainees_delete ON trainees FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- Bucket C: attendance, competency_assessments, modules — view: trainer/case_worker/director/admin, edit: trainer/admin
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY attendance_select ON attendance FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]));
CREATE POLICY attendance_insert ON attendance FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY attendance_update ON attendance FOR UPDATE
  USING (current_role_is(ARRAY['trainer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY attendance_delete ON attendance FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE competency_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY competency_assessments_select ON competency_assessments FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]));
CREATE POLICY competency_assessments_insert ON competency_assessments FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY competency_assessments_update ON competency_assessments FOR UPDATE
  USING (current_role_is(ARRAY['trainer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY competency_assessments_delete ON competency_assessments FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY modules_select ON modules FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]));
CREATE POLICY modules_insert ON modules FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY modules_update ON modules FOR UPDATE
  USING (current_role_is(ARRAY['trainer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY modules_delete ON modules FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- Bucket D: case_notes, vulnerability_assessments — view: case_worker/director/admin, edit: case_worker/admin
ALTER TABLE case_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY case_notes_select ON case_notes FOR SELECT
  USING (current_role_is(ARRAY['case_worker','director','admin']::user_role[]));
CREATE POLICY case_notes_insert ON case_notes FOR INSERT
  WITH CHECK (current_role_is(ARRAY['case_worker','admin']::user_role[]));
CREATE POLICY case_notes_update ON case_notes FOR UPDATE
  USING (current_role_is(ARRAY['case_worker','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['case_worker','admin']::user_role[]));
CREATE POLICY case_notes_delete ON case_notes FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE vulnerability_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY vulnerability_assessments_select ON vulnerability_assessments FOR SELECT
  USING (current_role_is(ARRAY['case_worker','director','admin']::user_role[]));
CREATE POLICY vulnerability_assessments_insert ON vulnerability_assessments FOR INSERT
  WITH CHECK (current_role_is(ARRAY['case_worker','admin']::user_role[]));
CREATE POLICY vulnerability_assessments_update ON vulnerability_assessments FOR UPDATE
  USING (current_role_is(ARRAY['case_worker','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['case_worker','admin']::user_role[]));
CREATE POLICY vulnerability_assessments_delete ON vulnerability_assessments FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- Bucket E: inventory_items, inventory_usage, procurement_requests — view: trainer/finance_officer/director/admin, edit: trainer/admin
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_items_select ON inventory_items FOR SELECT
  USING (current_role_is(ARRAY['trainer','finance_officer','director','admin']::user_role[]));
CREATE POLICY inventory_items_insert ON inventory_items FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY inventory_items_update ON inventory_items FOR UPDATE
  USING (current_role_is(ARRAY['trainer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY inventory_items_delete ON inventory_items FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE inventory_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_usage_select ON inventory_usage FOR SELECT
  USING (current_role_is(ARRAY['trainer','finance_officer','director','admin']::user_role[]));
CREATE POLICY inventory_usage_insert ON inventory_usage FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY inventory_usage_update ON inventory_usage FOR UPDATE
  USING (current_role_is(ARRAY['trainer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY inventory_usage_delete ON inventory_usage FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE procurement_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY procurement_requests_select ON procurement_requests FOR SELECT
  USING (current_role_is(ARRAY['trainer','finance_officer','director','admin']::user_role[]));
CREATE POLICY procurement_requests_insert ON procurement_requests FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY procurement_requests_update ON procurement_requests FOR UPDATE
  USING (current_role_is(ARRAY['trainer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY procurement_requests_delete ON procurement_requests FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- Bucket F: production_logs, sales, financial_transactions — view: finance_officer/director/admin, edit: finance_officer/admin
ALTER TABLE production_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY production_logs_select ON production_logs FOR SELECT
  USING (current_role_is(ARRAY['finance_officer','director','admin']::user_role[]));
CREATE POLICY production_logs_insert ON production_logs FOR INSERT
  WITH CHECK (current_role_is(ARRAY['finance_officer','admin']::user_role[]));
CREATE POLICY production_logs_update ON production_logs FOR UPDATE
  USING (current_role_is(ARRAY['finance_officer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['finance_officer','admin']::user_role[]));
CREATE POLICY production_logs_delete ON production_logs FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_select ON sales FOR SELECT
  USING (current_role_is(ARRAY['finance_officer','director','admin']::user_role[]));
CREATE POLICY sales_insert ON sales FOR INSERT
  WITH CHECK (current_role_is(ARRAY['finance_officer','admin']::user_role[]));
CREATE POLICY sales_update ON sales FOR UPDATE
  USING (current_role_is(ARRAY['finance_officer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['finance_officer','admin']::user_role[]));
CREATE POLICY sales_delete ON sales FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY financial_transactions_select ON financial_transactions FOR SELECT
  USING (current_role_is(ARRAY['finance_officer','director','admin']::user_role[]));
CREATE POLICY financial_transactions_insert ON financial_transactions FOR INSERT
  WITH CHECK (current_role_is(ARRAY['finance_officer','admin']::user_role[]));
CREATE POLICY financial_transactions_update ON financial_transactions FOR UPDATE
  USING (current_role_is(ARRAY['finance_officer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['finance_officer','admin']::user_role[]));
CREATE POLICY financial_transactions_delete ON financial_transactions FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- Bucket G: starter_kits, alumni_follow_ups, job_placements — view: trainer/case_worker/director/admin, edit: case_worker/admin
ALTER TABLE starter_kits ENABLE ROW LEVEL SECURITY;
CREATE POLICY starter_kits_select ON starter_kits FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]));
CREATE POLICY starter_kits_insert ON starter_kits FOR INSERT
  WITH CHECK (current_role_is(ARRAY['case_worker','admin']::user_role[]));
CREATE POLICY starter_kits_update ON starter_kits FOR UPDATE
  USING (current_role_is(ARRAY['case_worker','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['case_worker','admin']::user_role[]));
CREATE POLICY starter_kits_delete ON starter_kits FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE alumni_follow_ups ENABLE ROW LEVEL SECURITY;
CREATE POLICY alumni_follow_ups_select ON alumni_follow_ups FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]));
CREATE POLICY alumni_follow_ups_insert ON alumni_follow_ups FOR INSERT
  WITH CHECK (current_role_is(ARRAY['case_worker','admin']::user_role[]));
CREATE POLICY alumni_follow_ups_update ON alumni_follow_ups FOR UPDATE
  USING (current_role_is(ARRAY['case_worker','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['case_worker','admin']::user_role[]));
CREATE POLICY alumni_follow_ups_delete ON alumni_follow_ups FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE job_placements ENABLE ROW LEVEL SECURITY;
CREATE POLICY job_placements_select ON job_placements FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','director','admin']::user_role[]));
CREATE POLICY job_placements_insert ON job_placements FOR INSERT
  WITH CHECK (current_role_is(ARRAY['case_worker','admin']::user_role[]));
CREATE POLICY job_placements_update ON job_placements FOR UPDATE
  USING (current_role_is(ARRAY['case_worker','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['case_worker','admin']::user_role[]));
CREATE POLICY job_placements_delete ON job_placements FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- ============================================================
-- 13. SEED DATA — Batches + Trainees
-- Fixed UUIDs so locally-seeded demo data for the other 10 modules
-- (attendance, competency, case notes, etc. — still local-only this
-- phase) keeps referencing the same trainee/batch ids. See
-- docs/superpowers/plans/2026-07-12-auth-rbac-foundation.md Global
-- Constraints for the full id map.
-- ============================================================

INSERT INTO batches (id, name, trade, start_date, end_date, status, budget_allocated, target_enrollment, trainer_name, description) VALUES
('10000000-0000-4000-8000-000000000001', 'Batch 1 — Carpentry 2021', 'Carpentry', '2021-02-01', '2021-07-30', 'completed', 4200000, 15, 'Mr. Byamugisha Ronald', 'Foundation batch focused on furniture making and wood joinery.'),
('10000000-0000-4000-8000-000000000002', 'Batch 2 — Tailoring 2022', 'Tailoring', '2022-01-10', '2022-06-30', 'completed', 3800000, 12, 'Ms. Kyomuhangi Grace', 'Tailoring and garment construction for vulnerable young women.'),
('10000000-0000-4000-8000-000000000003', 'Batch 3 — Masonry 2023', 'Masonry', '2023-01-16', '2023-07-14', 'completed', 5100000, 16, 'Mr. Tumusiime Patrick', 'Bricklaying, plastering, and construction for street-connected youth.'),
('10000000-0000-4000-8000-000000000004', 'Batch 4 — Electricity 2024', 'Electricity', '2024-02-05', '2024-07-26', 'completed', 4800000, 14, 'Mr. Ruhweza Denis', 'Domestic and commercial wiring with safety and entrepreneurship integration.'),
('10000000-0000-4000-8000-000000000005', 'Batch 5 — Carpentry 2025', 'Carpentry', '2025-02-03', NULL, 'active', 5500000, 15, 'Mr. Byamugisha Ronald', 'Advanced carpentry: furniture, cabinetry, and production unit operations.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO trainees (id, batch_id, first_name, last_name, date_of_birth, gender, phone_number, address, emergency_contact_name, emergency_contact_phone, mobilization_source, vulnerability_score, vulnerability_assessment, status, graduation_date) VALUES
('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Mugisha', 'Samuel', '1999-04-12', 'male', '+256 701 234 567', 'Bwindi Cell, Ishaka', 'Mugisha Rose', '+256 772 111 222', 'Church Outreach', 88, '{"housingStatus":"street","foodSecurity":"none","previousEducation":"primary","familyStatus":"orphan","hasDisability":false,"disabilityDetails":""}'::jsonb, 'alumni', '2021-07-30'),
('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Atuhaire', 'Prossy', '2000-08-22', 'female', '+256 702 345 678', 'Kagongo, Bushenyi', 'Atuhaire James', '+256 772 222 333', 'Community Leader', 76, '{"housingStatus":"shelter","foodSecurity":"inadequate","previousEducation":"primary","familyStatus":"single_parent","hasDisability":false,"disabilityDetails":""}'::jsonb, 'alumni', '2021-07-30'),
('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Banturaki', 'John', '1998-11-05', 'male', '+256 703 456 789', 'Kashenyi, Bushenyi', 'Banturaki Mary', '+256 772 333 444', 'Probation Office', 92, '{"housingStatus":"street","foodSecurity":"none","previousEducation":"none","familyStatus":"street_connected","hasDisability":false,"disabilityDetails":""}'::jsonb, 'alumni', '2021-07-30'),
('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'Natukunda', 'Allen', '2001-03-17', 'female', '+256 704 567 890', 'Biharwe, Mbarara', 'Natukunda Peter', '+256 772 444 555', 'Church Outreach', 84, '{"housingStatus":"rented","foodSecurity":"inadequate","previousEducation":"primary","familyStatus":"single_parent","hasDisability":false,"disabilityDetails":""}'::jsonb, 'alumni', '2022-06-30'),
('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', 'Ampaire', 'Beatrice', '2000-06-09', 'female', '+256 705 678 901', 'Ntare, Mbarara', 'Ampaire Fred', '+256 772 555 666', 'Social Worker', 79, '{"housingStatus":"shelter","foodSecurity":"adequate","previousEducation":"primary","familyStatus":"orphan","hasDisability":false,"disabilityDetails":""}'::jsonb, 'alumni', '2022-06-30'),
('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000002', 'Kabagambe', 'Ruth', '2002-01-28', 'female', '+256 706 789 012', 'Ruharo, Mbarara', 'Kabagambe Thomas', '+256 772 666 777', 'Church Outreach', 72, '{"housingStatus":"rented","foodSecurity":"inadequate","previousEducation":"secondary","familyStatus":"both_parents","hasDisability":true,"disabilityDetails":"Partial hearing impairment"}'::jsonb, 'dropped', NULL),
('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000003', 'Tumusiime', 'Richard', '1999-09-14', 'male', '+256 707 890 123', 'Ishaka Town', 'Tumusiime Grace', '+256 772 777 888', 'Community Leader', 81, '{"housingStatus":"street","foodSecurity":"none","previousEducation":"primary","familyStatus":"street_connected","hasDisability":false,"disabilityDetails":""}'::jsonb, 'alumni', '2023-07-14'),
('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000003', 'Rwabuhanga', 'Moses', '2001-05-30', 'male', '+256 708 901 234', 'Kyabugimbi, Bushenyi', 'Rwabuhanga Janet', '+256 772 888 999', 'Probation Office', 94, '{"housingStatus":"street","foodSecurity":"none","previousEducation":"none","familyStatus":"orphan","hasDisability":false,"disabilityDetails":""}'::jsonb, 'alumni', '2023-07-14'),
('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000003', 'Atwine', 'Caroline', '2002-12-03', 'female', '+256 709 012 345', 'Rubirizi Town', 'Atwine Paul', '+256 772 999 000', 'Church Outreach', 68, '{"housingStatus":"rented","foodSecurity":"adequate","previousEducation":"secondary","familyStatus":"single_parent","hasDisability":false,"disabilityDetails":""}'::jsonb, 'alumni', '2023-07-14'),
('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000004', 'Kamanzi', 'Felix', '2000-07-19', 'male', '+256 710 123 456', 'Bushenyi Town', 'Kamanzi Sarah', '+256 773 111 222', 'Church Outreach', 87, '{"housingStatus":"street","foodSecurity":"none","previousEducation":"primary","familyStatus":"orphan","hasDisability":false,"disabilityDetails":""}'::jsonb, 'alumni', '2024-07-26'),
('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000004', 'Tukamushaba', 'Sharon', '2001-10-08', 'female', '+256 711 234 567', 'Nyakabirizi, Bushenyi', 'Tukamushaba David', '+256 773 222 333', 'Social Worker', 75, '{"housingStatus":"shelter","foodSecurity":"inadequate","previousEducation":"primary","familyStatus":"single_parent","hasDisability":false,"disabilityDetails":""}'::jsonb, 'alumni', '2024-07-26'),
('20000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000004', 'Bigiriwe', 'Nathan', '1999-02-25', 'male', '+256 712 345 678', 'Ishaka Town', 'Bigiriwe Agnes', '+256 773 333 444', 'Probation Office', 91, '{"housingStatus":"street","foodSecurity":"none","previousEducation":"primary","familyStatus":"street_connected","hasDisability":false,"disabilityDetails":""}'::jsonb, 'alumni', '2024-07-26'),
('20000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000005', 'Nkurunziza', 'Emmanuel', '2003-06-11', 'male', '+256 713 456 789', 'Bwindi Cell, Ishaka', 'Nkurunziza Rose', '+256 773 444 555', 'Church Outreach', 90, '{"housingStatus":"street","foodSecurity":"none","previousEducation":"primary","familyStatus":"orphan","hasDisability":false,"disabilityDetails":""}'::jsonb, 'enrolled', NULL),
('20000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000005', 'Turyasingura', 'Diana', '2004-03-22', 'female', '+256 714 567 890', 'Kagongo, Bushenyi', 'Turyasingura John', '+256 773 555 666', 'Community Leader', 83, '{"housingStatus":"shelter","foodSecurity":"inadequate","previousEducation":"primary","familyStatus":"single_parent","hasDisability":false,"disabilityDetails":""}'::jsonb, 'enrolled', NULL),
('20000000-0000-4000-8000-000000000015', '10000000-0000-4000-8000-000000000005', 'Mutabazi', 'Brian', '2002-09-07', 'male', '+256 715 678 901', 'Kashenyi, Bushenyi', 'Mutabazi Grace', '+256 773 666 777', 'Probation Office', 95, '{"housingStatus":"street","foodSecurity":"none","previousEducation":"none","familyStatus":"street_connected","hasDisability":false,"disabilityDetails":""}'::jsonb, 'enrolled', NULL),
('20000000-0000-4000-8000-000000000016', '10000000-0000-4000-8000-000000000005', 'Kyomuhangi', 'Lydia', '2003-12-15', 'female', '+256 716 789 012', 'Biharwe, Mbarara', 'Kyomuhangi Frank', '+256 773 777 888', 'Church Outreach', 77, '{"housingStatus":"rented","foodSecurity":"inadequate","previousEducation":"secondary","familyStatus":"both_parents","hasDisability":false,"disabilityDetails":""}'::jsonb, 'enrolled', NULL),
('20000000-0000-4000-8000-000000000017', '10000000-0000-4000-8000-000000000005', 'Byaruhanga', 'Ivan', '2001-04-18', 'male', '+256 717 890 123', 'Ruharo, Mbarara', 'Byaruhanga Mary', '+256 773 888 999', 'Social Worker', 86, '{"housingStatus":"street","foodSecurity":"none","previousEducation":"primary","familyStatus":"orphan","hasDisability":false,"disabilityDetails":""}'::jsonb, 'enrolled', NULL),
('20000000-0000-4000-8000-000000000018', '10000000-0000-4000-8000-000000000005', 'Tumuhairwe', 'Sandra', '2004-07-29', 'female', '+256 718 901 234', 'Ishaka Town', 'Tumuhairwe Peter', '+256 773 999 000', 'Church Outreach', 71, '{"housingStatus":"rented","foodSecurity":"adequate","previousEducation":"secondary","familyStatus":"single_parent","hasDisability":false,"disabilityDetails":""}'::jsonb, 'enrolled', NULL),
('20000000-0000-4000-8000-000000000019', '10000000-0000-4000-8000-000000000005', 'Nshemereirwe', 'Patrick', '2002-11-02', 'male', '+256 719 012 345', 'Kyabugimbi, Bushenyi', 'Nshemereirwe Agnes', '+256 774 111 222', 'Community Leader', 89, '{"housingStatus":"street","foodSecurity":"none","previousEducation":"primary","familyStatus":"street_connected","hasDisability":true,"disabilityDetails":"Mild speech difficulty"}'::jsonb, 'enrolled', NULL),
('20000000-0000-4000-8000-000000000020', '10000000-0000-4000-8000-000000000005', 'Nyamuhanga', 'Irene', '2003-02-14', 'female', '+256 720 123 456', 'Rubirizi Town', 'Nyamuhanga Robert', '+256 774 222 333', 'Church Outreach', 74, '{"housingStatus":"shelter","foodSecurity":"inadequate","previousEducation":"primary","familyStatus":"single_parent","hasDisability":false,"disabilityDetails":""}'::jsonb, 'enrolled', NULL)
ON CONFLICT (id) DO NOTHING;
