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
CREATE TYPE user_role AS ENUM ('admin', 'director', 'project_coordinator', 'trainer', 'case_worker', 'finance_officer', 'logistics_officer');

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
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','completed','archived')),
    budget_allocated DECIMAL(12,2) DEFAULT 0,
    target_enrollment INTEGER,
    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Which trades each trainer profile teaches (many trainers per trade allowed).
CREATE TABLE profile_trades (
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    trade TEXT NOT NULL CHECK (trade IN ('Carpentry','Tailoring','Masonry','Electricity')),
    PRIMARY KEY (profile_id, trade)
);

-- Trades offered in a batch + assigned trainer (login profile).
CREATE TABLE batch_trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    trade TEXT NOT NULL CHECK (trade IN ('Carpentry','Tailoring','Masonry','Electricity')),
    trainer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    UNIQUE (batch_id, trade)
);

-- 3. TRAINEE MANAGEMENT
CREATE TABLE trainees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES batches(id),
    trade TEXT CHECK (trade IS NULL OR trade IN ('Carpentry','Tailoring','Masonry','Electricity')),
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
  USING (
    id = auth.uid()
    OR current_role_is(ARRAY['director','admin']::user_role[])
    OR (
      role = 'trainer'
      AND active
      AND current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[])
    )
  );
CREATE POLICY profiles_insert ON profiles FOR INSERT
  WITH CHECK (current_role_is(ARRAY['admin']::user_role[]));
CREATE POLICY profiles_update ON profiles FOR UPDATE
  USING (current_role_is(ARRAY['admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['admin']::user_role[]));
CREATE POLICY profiles_delete ON profiles FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE profile_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY profile_trades_select ON profile_trades FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));
CREATE POLICY profile_trades_insert ON profile_trades FOR INSERT
  WITH CHECK (current_role_is(ARRAY['director','admin']::user_role[]));
CREATE POLICY profile_trades_update ON profile_trades FOR UPDATE
  USING (current_role_is(ARRAY['director','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['director','admin']::user_role[]));
CREATE POLICY profile_trades_delete ON profile_trades FOR DELETE
  USING (current_role_is(ARRAY['director','admin']::user_role[]));

-- Bucket A: batches, trades — view: all operational roles, edit: trainer/case_worker/PC/director/admin
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY batches_select ON batches FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));
CREATE POLICY batches_insert ON batches FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
CREATE POLICY batches_update ON batches FOR UPDATE
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
CREATE POLICY batches_delete ON batches FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE batch_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY batch_trades_select ON batch_trades FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));
CREATE POLICY batch_trades_insert ON batch_trades FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
CREATE POLICY batch_trades_update ON batch_trades FOR UPDATE
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
CREATE POLICY batch_trades_delete ON batch_trades FOR DELETE
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY trades_select ON trades FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));
CREATE POLICY trades_insert ON trades FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
CREATE POLICY trades_update ON trades FOR UPDATE
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
CREATE POLICY trades_delete ON trades FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- Bucket B: trainees — same shape as batches
ALTER TABLE trainees ENABLE ROW LEVEL SECURITY;
CREATE POLICY trainees_select ON trainees FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));
CREATE POLICY trainees_insert ON trainees FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
CREATE POLICY trainees_update ON trainees FOR UPDATE
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
CREATE POLICY trainees_delete ON trainees FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- Bucket C: attendance, competency_assessments, modules — view: trainer/case_worker/director/admin, edit: trainer/admin
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY attendance_select ON attendance FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
CREATE POLICY attendance_insert ON attendance FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY attendance_update ON attendance FOR UPDATE
  USING (current_role_is(ARRAY['trainer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY attendance_delete ON attendance FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE competency_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY competency_assessments_select ON competency_assessments FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
CREATE POLICY competency_assessments_insert ON competency_assessments FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY competency_assessments_update ON competency_assessments FOR UPDATE
  USING (current_role_is(ARRAY['trainer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','admin']::user_role[]));
CREATE POLICY competency_assessments_delete ON competency_assessments FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY modules_select ON modules FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
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
  USING (current_role_is(ARRAY['trainer','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));
CREATE POLICY inventory_items_insert ON inventory_items FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','logistics_officer','admin']::user_role[]));
CREATE POLICY inventory_items_update ON inventory_items FOR UPDATE
  USING (current_role_is(ARRAY['trainer','logistics_officer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','logistics_officer','admin']::user_role[]));
CREATE POLICY inventory_items_delete ON inventory_items FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE inventory_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_usage_select ON inventory_usage FOR SELECT
  USING (current_role_is(ARRAY['trainer','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));
CREATE POLICY inventory_usage_insert ON inventory_usage FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','logistics_officer','admin']::user_role[]));
CREATE POLICY inventory_usage_update ON inventory_usage FOR UPDATE
  USING (current_role_is(ARRAY['trainer','logistics_officer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','logistics_officer','admin']::user_role[]));
CREATE POLICY inventory_usage_delete ON inventory_usage FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE procurement_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY procurement_requests_select ON procurement_requests FOR SELECT
  USING (current_role_is(ARRAY['trainer','project_coordinator','finance_officer','logistics_officer','director','admin']::user_role[]));
CREATE POLICY procurement_requests_insert ON procurement_requests FOR INSERT
  WITH CHECK (current_role_is(ARRAY['trainer','logistics_officer','admin']::user_role[]));
CREATE POLICY procurement_requests_update ON procurement_requests FOR UPDATE
  USING (current_role_is(ARRAY['trainer','logistics_officer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['trainer','logistics_officer','admin']::user_role[]));
CREATE POLICY procurement_requests_delete ON procurement_requests FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

-- Bucket F: production_logs, sales, financial_transactions — view: finance_officer/director/admin, edit: finance_officer/admin
ALTER TABLE production_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY production_logs_select ON production_logs FOR SELECT
  USING (current_role_is(ARRAY['project_coordinator','finance_officer','director','admin']::user_role[]));
CREATE POLICY production_logs_insert ON production_logs FOR INSERT
  WITH CHECK (current_role_is(ARRAY['finance_officer','admin']::user_role[]));
CREATE POLICY production_logs_update ON production_logs FOR UPDATE
  USING (current_role_is(ARRAY['finance_officer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['finance_officer','admin']::user_role[]));
CREATE POLICY production_logs_delete ON production_logs FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_select ON sales FOR SELECT
  USING (current_role_is(ARRAY['project_coordinator','finance_officer','director','admin']::user_role[]));
CREATE POLICY sales_insert ON sales FOR INSERT
  WITH CHECK (current_role_is(ARRAY['finance_officer','admin']::user_role[]));
CREATE POLICY sales_update ON sales FOR UPDATE
  USING (current_role_is(ARRAY['finance_officer','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['finance_officer','admin']::user_role[]));
CREATE POLICY sales_delete ON sales FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY financial_transactions_select ON financial_transactions FOR SELECT
  USING (current_role_is(ARRAY['project_coordinator','finance_officer','director','admin']::user_role[]));
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
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','logistics_officer','director','admin']::user_role[]));
CREATE POLICY starter_kits_insert ON starter_kits FOR INSERT
  WITH CHECK (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[]));
CREATE POLICY starter_kits_update ON starter_kits FOR UPDATE
  USING (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[]));
CREATE POLICY starter_kits_delete ON starter_kits FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE alumni_follow_ups ENABLE ROW LEVEL SECURITY;
CREATE POLICY alumni_follow_ups_select ON alumni_follow_ups FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
CREATE POLICY alumni_follow_ups_insert ON alumni_follow_ups FOR INSERT
  WITH CHECK (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[]));
CREATE POLICY alumni_follow_ups_update ON alumni_follow_ups FOR UPDATE
  USING (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[]));
CREATE POLICY alumni_follow_ups_delete ON alumni_follow_ups FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

ALTER TABLE job_placements ENABLE ROW LEVEL SECURITY;
CREATE POLICY job_placements_select ON job_placements FOR SELECT
  USING (current_role_is(ARRAY['trainer','case_worker','project_coordinator','director','admin']::user_role[]));
CREATE POLICY job_placements_insert ON job_placements FOR INSERT
  WITH CHECK (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[]));
CREATE POLICY job_placements_update ON job_placements FOR UPDATE
  USING (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[]))
  WITH CHECK (current_role_is(ARRAY['case_worker','project_coordinator','admin']::user_role[]));
CREATE POLICY job_placements_delete ON job_placements FOR DELETE
  USING (current_role_is(ARRAY['admin']::user_role[]));

