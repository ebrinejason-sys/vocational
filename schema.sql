-- Vocational Training Management System Schema
-- Optimized for CBET, Trauma-Informed Care, and NGO Operations

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. AUTH & ROLES
-- Roles: admin, manager, trainer, case_worker, finance_officer
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL
);

INSERT INTO roles (name) VALUES ('admin'), ('manager'), ('trainer'), ('case_worker'), ('finance_officer');

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
    trade_id UUID REFERENCES trades(id),
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT DEFAULT 'planned', -- planned, active, completed, archived
    budget_allocated DECIMAL(12,2) DEFAULT 0,
    target_enrollment INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TRAINEE MANAGEMENT
CREATE TABLE trainees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID REFERENCES batches(id),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE,
    gender TEXT,
    phone_number TEXT,
    national_id TEXT,
    address TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    -- Selection & Vulnerability
    mobilization_source TEXT, -- e.g., Community Leader, Church, Outreach
    vulnerability_score INTEGER, -- Computed from assessment
    vulnerability_notes TEXT,
    status TEXT DEFAULT 'prospect', -- prospect, enrolled, graduated, dropped, alumni
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
