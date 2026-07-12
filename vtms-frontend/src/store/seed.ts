import type {
  Module, CompetencyAssessment, AttendanceRecord,
  CaseNote, InventoryItem, InventoryUsage, ProcurementRequest,
  ProductionLog, Sale, FinancialTransaction, StarterKit,
  AlumniFollowUp, JobPlacement
} from '../types';

export const SEED_MODULES: Module[] = [
  { id: 'm01', trade: 'Carpentry', code: 'CARP-01', name: 'Hand Tools & Safety', description: 'Identification, use, and maintenance of carpentry hand tools', creditHours: 8, weekNumber: 1 },
  { id: 'm02', trade: 'Carpentry', code: 'CARP-02', name: 'Wood Types & Measurement', description: 'Types of timber, grain, moisture, and accurate measurement', creditHours: 8, weekNumber: 2 },
  { id: 'm03', trade: 'Carpentry', code: 'CARP-03', name: 'Basic Wood Joints', description: 'Mortise & tenon, dovetail, butt and lap joints', creditHours: 10, weekNumber: 3 },
  { id: 'm04', trade: 'Carpentry', code: 'CARP-04', name: 'Furniture Framing', description: 'Chair, table, and bed frame construction techniques', creditHours: 12, weekNumber: 4 },
  { id: 'm05', trade: 'Carpentry', code: 'CARP-05', name: 'Surface Finishing', description: 'Sanding, painting, varnishing, and polish application', creditHours: 8, weekNumber: 5 },
  { id: 'm06', trade: 'Carpentry', code: 'CARP-06', name: 'Cabinet Making', description: 'Design and construction of kitchen and office cabinets', creditHours: 14, weekNumber: 6 },
  { id: 'm07', trade: 'Carpentry', code: 'CARP-07', name: 'Entrepreneurship & Pricing', description: 'Costing, pricing, customer service, and business basics', creditHours: 6, weekNumber: 7 },
  { id: 'm08', trade: 'Tailoring', code: 'TAIL-01', name: 'Machine Operation', description: 'Threading, tension, stitch types, and machine maintenance', creditHours: 8, weekNumber: 1 },
  { id: 'm09', trade: 'Tailoring', code: 'TAIL-02', name: 'Taking Measurements', description: 'Body measurement techniques for garment construction', creditHours: 6, weekNumber: 2 },
  { id: 'm10', trade: 'Tailoring', code: 'TAIL-03', name: 'Pattern Making', description: 'Drafting basic patterns for shirts, dresses, and trousers', creditHours: 10, weekNumber: 3 },
  { id: 'm11', trade: 'Masonry', code: 'MASON-01', name: 'Material Identification', description: 'Cement, sand, aggregate, and block quality assessment', creditHours: 8, weekNumber: 1 },
  { id: 'm12', trade: 'Masonry', code: 'MASON-02', name: 'Bricklaying Techniques', description: 'Bond patterns, joint finishing, and wall construction', creditHours: 12, weekNumber: 2 },
  { id: 'm13', trade: 'Electricity', code: 'ELEC-01', name: 'Electrical Safety', description: 'PPE, lockout/tagout, and electrical hazard awareness', creditHours: 8, weekNumber: 1 },
  { id: 'm14', trade: 'Electricity', code: 'ELEC-02', name: 'Basic Circuits & Wiring', description: 'Series, parallel circuits, and domestic wiring principles', creditHours: 10, weekNumber: 2 },
  { id: 'm15', trade: 'Entrepreneurship', code: 'ENTREP-01', name: 'Business Planning', description: 'Business model canvas, cash flow, and market research', creditHours: 8, weekNumber: 1 },
];

export const SEED_COMPETENCY_ASSESSMENTS: CompetencyAssessment[] = [
  { id: 'ca01', traineeId: '20000000-0000-4000-8000-000000000013', moduleId: 'm01', level: 4, score: 92, assessmentDate: '2025-02-14', assessorName: 'Mr. Byamugisha Ronald', feedback: 'Excellent tool handling and safety awareness from day one.' },
  { id: 'ca02', traineeId: '20000000-0000-4000-8000-000000000013', moduleId: 'm02', level: 3, score: 78, assessmentDate: '2025-02-21', assessorName: 'Mr. Byamugisha Ronald', feedback: 'Good measurement accuracy; needs practice with moisture identification.' },
  { id: 'ca03', traineeId: '20000000-0000-4000-8000-000000000013', moduleId: 'm03', level: 3, score: 75, assessmentDate: '2025-03-01', assessorName: 'Mr. Byamugisha Ronald', feedback: 'Mortise joints are clean; dovetail still needs work.' },
  { id: 'ca04', traineeId: '20000000-0000-4000-8000-000000000014', moduleId: 'm01', level: 3, score: 74, assessmentDate: '2025-02-14', assessorName: 'Mr. Byamugisha Ronald', feedback: 'Safe tool handling demonstrated. Needs confidence with chiselling.' },
  { id: 'ca05', traineeId: '20000000-0000-4000-8000-000000000014', moduleId: 'm02', level: 2, score: 61, assessmentDate: '2025-02-21', assessorName: 'Mr. Byamugisha Ronald', feedback: 'Measurement reading improving. Still struggles with conversions.' },
  { id: 'ca06', traineeId: '20000000-0000-4000-8000-000000000015', moduleId: 'm01', level: 4, score: 95, assessmentDate: '2025-02-14', assessorName: 'Mr. Byamugisha Ronald', feedback: 'Outstanding — could already assist other trainees.' },
  { id: 'ca07', traineeId: '20000000-0000-4000-8000-000000000015', moduleId: 'm02', level: 4, score: 89, assessmentDate: '2025-02-21', assessorName: 'Mr. Byamugisha Ronald', feedback: 'Very precise measurements and excellent wood type knowledge.' },
  { id: 'ca08', traineeId: '20000000-0000-4000-8000-000000000015', moduleId: 'm03', level: 3, score: 80, assessmentDate: '2025-03-01', assessorName: 'Mr. Byamugisha Ronald', feedback: 'All joint types satisfactorily completed.' },
  { id: 'ca09', traineeId: '20000000-0000-4000-8000-000000000016', moduleId: 'm01', level: 2, score: 58, assessmentDate: '2025-02-14', assessorName: 'Mr. Byamugisha Ronald', feedback: 'Needs supervision with sharp tools. Safety protocol reviewed.' },
  { id: 'ca10', traineeId: '20000000-0000-4000-8000-000000000017', moduleId: 'm01', level: 3, score: 76, assessmentDate: '2025-02-14', assessorName: 'Mr. Byamugisha Ronald', feedback: 'Good progression in first week.' },
  { id: 'ca11', traineeId: '20000000-0000-4000-8000-000000000017', moduleId: 'm02', level: 3, score: 72, assessmentDate: '2025-02-21', assessorName: 'Mr. Byamugisha Ronald', feedback: 'Steady improvement; working well independently.' },
  { id: 'ca12', traineeId: '20000000-0000-4000-8000-000000000018', moduleId: 'm01', level: 2, score: 62, assessmentDate: '2025-02-14', assessorName: 'Mr. Byamugisha Ronald', feedback: 'Cautious but needs to build confidence with tools.' },
];

const today = new Date();
const dateStr = (daysAgo: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
};

export const SEED_ATTENDANCE: AttendanceRecord[] = [
  ...['20000000-0000-4000-8000-000000000013','20000000-0000-4000-8000-000000000014','20000000-0000-4000-8000-000000000015','20000000-0000-4000-8000-000000000016','20000000-0000-4000-8000-000000000017','20000000-0000-4000-8000-000000000018','20000000-0000-4000-8000-000000000019','20000000-0000-4000-8000-000000000020'].flatMap((tid, i) => [
    { id: `att-0-${tid}`, traineeId: tid, date: dateStr(0), status: ['present','present','present','absent','present','present','late','present'][i] as AttendanceRecord['status'], notes: '' },
    { id: `att-1-${tid}`, traineeId: tid, date: dateStr(1), status: ['present','late','present','present','present','absent','present','present'][i] as AttendanceRecord['status'], notes: '' },
    { id: `att-2-${tid}`, traineeId: tid, date: dateStr(2), status: ['present','present','present','present','absent','present','present','late'][i] as AttendanceRecord['status'], notes: '' },
    { id: `att-3-${tid}`, traineeId: tid, date: dateStr(3), status: 'present' as AttendanceRecord['status'], notes: '' },
    { id: `att-4-${tid}`, traineeId: tid, date: dateStr(4), status: 'present' as AttendanceRecord['status'], notes: '' },
    { id: `att-5-${tid}`, traineeId: tid, date: dateStr(5), status: ['present','present','absent','present','present','present','present','present'][i] as AttendanceRecord['status'], notes: '' },
    { id: `att-6-${tid}`, traineeId: tid, date: dateStr(6), status: 'present' as AttendanceRecord['status'], notes: '' },
  ]),
];

export const SEED_CASE_NOTES: CaseNote[] = [
  { id: 'cn01', traineeId: '20000000-0000-4000-8000-000000000013', category: 'mentorship', content: 'Emmanuel is showing excellent leadership traits. Encouraged him to support peer learners during practical sessions.', isCritical: false, followUpRequired: false, followUpDate: null, authorName: 'Ms. Nabukenya Ruth', createdAt: dateStr(5) },
  { id: 'cn02', traineeId: '20000000-0000-4000-8000-000000000013', category: 'trauma_healing', content: 'Conducted individual session on grief processing. Emmanuel opened up about losing both parents. Referred to group healing circle.', isCritical: false, followUpRequired: true, followUpDate: dateStr(-7), authorName: 'Mr. Atuhaire Joseph', createdAt: dateStr(12) },
  { id: 'cn03', traineeId: '20000000-0000-4000-8000-000000000015', category: 'safeguarding', content: 'Brian disclosed he was pressured by older boys at his previous shelter. Incident documented. Welfare officer notified. Moved to safer accommodation.', isCritical: true, followUpRequired: true, followUpDate: dateStr(-3), authorName: 'Ms. Nabukenya Ruth', createdAt: dateStr(8) },
  { id: 'cn04', traineeId: '20000000-0000-4000-8000-000000000015', category: 'mentorship', content: 'Follow-up after safeguarding incident. Brian is settling well in new accommodation. More focused in class.', isCritical: false, followUpRequired: false, followUpDate: null, authorName: 'Mr. Atuhaire Joseph', createdAt: dateStr(3) },
  { id: 'cn05', traineeId: '20000000-0000-4000-8000-000000000016', category: 'home_visit', content: 'Conducted home visit at Lydia\'s family residence in Biharwe. Family supportive of training. Meals still a challenge — referred to food support programme.', isCritical: false, followUpRequired: true, followUpDate: dateStr(-14), authorName: 'Ms. Nabukenya Ruth', createdAt: dateStr(18) },
  { id: 'cn06', traineeId: '20000000-0000-4000-8000-000000000019', category: 'medical', content: 'Patrick reported difficulty in verbal communication exercises. Referred to speech therapist at Ishaka Adventist Hospital. Appointment confirmed.', isCritical: false, followUpRequired: true, followUpDate: dateStr(-5), authorName: 'Mr. Atuhaire Joseph', createdAt: dateStr(10) },
];

export const SEED_INVENTORY_ITEMS: InventoryItem[] = [
  { id: 'inv01', name: 'Carpentry Hammer', category: 'Tool', unit: 'pcs', quantityOnHand: 14, reorderLevel: 6, unitCost: 15000, tradeRelevance: ['Carpentry'] },
  { id: 'inv02', name: 'Wood Saw (Hand)', category: 'Tool', unit: 'pcs', quantityOnHand: 8, reorderLevel: 5, unitCost: 22000, tradeRelevance: ['Carpentry'] },
  { id: 'inv03', name: 'Timber — Pine 4x2 (m)', category: 'Material', unit: 'm', quantityOnHand: 3, reorderLevel: 15, unitCost: 18000, tradeRelevance: ['Carpentry'] },
  { id: 'inv04', name: 'Wood Glue (liters)', category: 'Material', unit: 'liters', quantityOnHand: 6.5, reorderLevel: 3, unitCost: 12000, tradeRelevance: ['Carpentry'] },
  { id: 'inv05', name: 'Sandpaper — Coarse (sheets)', category: 'Material', unit: 'sheets', quantityOnHand: 45, reorderLevel: 20, unitCost: 2000, tradeRelevance: ['Carpentry'] },
  { id: 'inv06', name: 'Varnish (liters)', category: 'Material', unit: 'liters', quantityOnHand: 4, reorderLevel: 5, unitCost: 35000, tradeRelevance: ['Carpentry'] },
  { id: 'inv07', name: 'Chisel Set (6-piece)', category: 'Tool', unit: 'sets', quantityOnHand: 7, reorderLevel: 4, unitCost: 45000, tradeRelevance: ['Carpentry'] },
  { id: 'inv08', name: 'Safety Goggles', category: 'Safety', unit: 'pcs', quantityOnHand: 16, reorderLevel: 10, unitCost: 8000, tradeRelevance: ['Carpentry', 'Masonry', 'Electricity'] },
  { id: 'inv09', name: 'Measuring Tape (5m)', category: 'Tool', unit: 'pcs', quantityOnHand: 12, reorderLevel: 6, unitCost: 6000, tradeRelevance: ['Carpentry', 'Masonry', 'Tailoring'] },
  { id: 'inv10', name: 'Work Gloves (pairs)', category: 'Safety', unit: 'pairs', quantityOnHand: 20, reorderLevel: 10, unitCost: 5000, tradeRelevance: ['Carpentry', 'Masonry', 'Electricity'] },
];

export const SEED_INVENTORY_USAGE: InventoryUsage[] = [
  { id: 'iu01', itemId: 'inv03', batchId: '10000000-0000-4000-8000-000000000005', traineeId: null, quantityUsed: 8, usageDate: dateStr(14), purpose: 'Module 3 — Basic Wood Joints practicals' },
  { id: 'iu02', itemId: 'inv04', batchId: '10000000-0000-4000-8000-000000000005', traineeId: null, quantityUsed: 1.5, usageDate: dateStr(14), purpose: 'Module 3 — Wood Joints practicals' },
  { id: 'iu03', itemId: 'inv05', batchId: '10000000-0000-4000-8000-000000000005', traineeId: null, quantityUsed: 20, usageDate: dateStr(7), purpose: 'Module 5 — Surface finishing demo' },
  { id: 'iu04', itemId: 'inv06', batchId: '10000000-0000-4000-8000-000000000005', traineeId: null, quantityUsed: 2, usageDate: dateStr(7), purpose: 'Module 5 — Varnishing practicals' },
];

export const SEED_PROCUREMENT_REQUESTS: ProcurementRequest[] = [
  { id: 'pr01', itemId: 'inv03', itemName: 'Timber — Pine 4x2 (m)', quantityRequested: 30, estimatedCost: 540000, status: 'approved', requestedBy: 'Mr. Byamugisha Ronald', createdAt: dateStr(10) },
  { id: 'pr02', itemId: 'inv06', itemName: 'Varnish (liters)', quantityRequested: 10, estimatedCost: 350000, status: 'pending', requestedBy: 'Mr. Byamugisha Ronald', createdAt: dateStr(3) },
  { id: 'pr03', itemId: 'inv08', itemName: 'Safety Goggles', quantityRequested: 8, estimatedCost: 64000, status: 'purchased', requestedBy: 'Ms. Kyomuhangi Grace', createdAt: dateStr(20) },
];

export const SEED_PRODUCTION_LOGS: ProductionLog[] = [
  { id: 'pl01', batchId: '10000000-0000-4000-8000-000000000005', itemProduced: 'Dining Chair (4-legged)', quantity: 3, dateProduced: dateStr(20), estimatedValue: 180000 },
  { id: 'pl02', batchId: '10000000-0000-4000-8000-000000000005', itemProduced: 'Study Table', quantity: 2, dateProduced: dateStr(15), estimatedValue: 280000 },
  { id: 'pl03', batchId: '10000000-0000-4000-8000-000000000005', itemProduced: 'Storage Shelf Unit', quantity: 1, dateProduced: dateStr(8), estimatedValue: 150000 },
];

export const SEED_SALES: Sale[] = [
  { id: 'sl01', batchId: '10000000-0000-4000-8000-000000000005', description: '2x Dining Chairs sold to KIU-WC staff', amount: 140000, saleDate: dateStr(18), customerContact: 'KIU Procurement Office', paymentStatus: 'paid' },
  { id: 'sl02', batchId: '10000000-0000-4000-8000-000000000005', description: '1x Study Table — Ishaka Adventist Hospital', amount: 160000, saleDate: dateStr(12), customerContact: 'Dr. Atuhaire, IAH', paymentStatus: 'paid' },
];

export const SEED_FINANCIALS: FinancialTransaction[] = [
  // Batch 5 income
  { id: 'ft01', batchId: '10000000-0000-4000-8000-000000000005', category: 'Donor Grant', type: 'income', amount: 3500000, description: 'Q1 Grant — Tearfund Uganda', date: '2025-02-01', donorName: 'Tearfund Uganda' },
  { id: 'ft02', batchId: '10000000-0000-4000-8000-000000000005', category: 'Donor Grant', type: 'income', amount: 2000000, description: 'Church Mission Fund contribution', date: '2025-02-05', donorName: 'Diocese of Ruwenzori' },
  { id: 'ft03', batchId: '10000000-0000-4000-8000-000000000005', category: 'Production Sales', type: 'income', amount: 300000, description: 'Furniture sales — batch 5 production unit', date: dateStr(12), donorName: '' },
  // Batch 5 expenses
  { id: 'ft04', batchId: '10000000-0000-4000-8000-000000000005', category: 'Training Materials', type: 'expense', amount: 1240000, description: 'Timber, hand tools, and consumables for modules 1-4', date: '2025-02-10', donorName: '' },
  { id: 'ft05', batchId: '10000000-0000-4000-8000-000000000005', category: 'Trainee Stipends', type: 'expense', amount: 960000, description: 'March stipends — 8 trainees @ UGX 120,000', date: '2025-03-01', donorName: '' },
  { id: 'ft06', batchId: '10000000-0000-4000-8000-000000000005', category: 'Trainer Fees', type: 'expense', amount: 700000, description: 'Lead trainer and assistant trainer — Feb/March fees', date: '2025-03-05', donorName: '' },
  { id: 'ft07', batchId: '10000000-0000-4000-8000-000000000005', category: 'Administration', type: 'expense', amount: 180000, description: 'Stationery, printing, and transport for outreach', date: '2025-02-20', donorName: '' },
  { id: 'ft08', batchId: '10000000-0000-4000-8000-000000000005', category: 'Utilities', type: 'expense', amount: 95000, description: 'Water and electricity — Feb/March', date: '2025-03-08', donorName: '' },
  { id: 'ft09', batchId: '10000000-0000-4000-8000-000000000005', category: 'Outreach & Mobilization', type: 'expense', amount: 210000, description: 'Community mobilization transport and materials', date: '2025-01-28', donorName: '' },
  // Historical batches summary income
  { id: 'ft10', batchId: '10000000-0000-4000-8000-000000000004', category: 'Donor Grant', type: 'income', amount: 4800000, description: 'Full batch grant — Caritas Uganda', date: '2024-02-01', donorName: 'Caritas Uganda' },
  { id: 'ft11', batchId: '10000000-0000-4000-8000-000000000003', category: 'Donor Grant', type: 'income', amount: 5100000, description: 'Full batch grant — Irish Aid', date: '2023-01-15', donorName: 'Irish Aid' },
];

export const SEED_STARTER_KITS: StarterKit[] = [
  { id: 'sk01', traineeId: '20000000-0000-4000-8000-000000000001', description: 'Hammer, hand saw, chisels (3-piece), measuring tape, sandpaper (20 sheets), tool bag', issuedDate: '2021-07-30', totalValue: 185000, status: 'in_use' },
  { id: 'sk02', traineeId: '20000000-0000-4000-8000-000000000002', description: 'Hammer, hand saw, chisels (3-piece), measuring tape, tool bag', issuedDate: '2021-07-30', totalValue: 165000, status: 'in_use' },
  { id: 'sk03', traineeId: '20000000-0000-4000-8000-000000000003', description: 'Full carpentry starter kit', issuedDate: '2021-07-30', totalValue: 190000, status: 'in_use' },
  { id: 'sk04', traineeId: '20000000-0000-4000-8000-000000000007', description: '2x Trowels, spirit level, rubber mallet, measuring tape, safety gloves', issuedDate: '2023-07-14', totalValue: 148000, status: 'in_use' },
  { id: 'sk05', traineeId: '20000000-0000-4000-8000-000000000008', description: 'Full masonry starter kit', issuedDate: '2023-07-14', totalValue: 160000, status: 'in_use' },
  { id: 'sk06', traineeId: '20000000-0000-4000-8000-000000000010', description: 'Multimeter, wire stripper, screwdriver set, electrical tape (5 rolls), circuit tester', issuedDate: '2024-07-26', totalValue: 195000, status: 'in_use' },
  { id: 'sk07', traineeId: '20000000-0000-4000-8000-000000000011', description: 'Electrician starter kit — standard', issuedDate: '2024-07-26', totalValue: 175000, status: 'damaged' },
  { id: 'sk08', traineeId: '20000000-0000-4000-8000-000000000012', description: 'Full electrician starter kit', issuedDate: '2024-07-26', totalValue: 200000, status: 'in_use' },
];

export const SEED_ALUMNI_FOLLOWUPS: AlumniFollowUp[] = [
  { id: 'af01', traineeId: '20000000-0000-4000-8000-000000000001', followUpDate: '2025-01-15', employmentStatus: 'self_employed', currentEmployer: 'Self — Mugisha Wood Works, Ishaka', monthlyIncome: 350000, starterKitStatus: 'in_use', notes: 'Running a small workshop from home. Has hired 1 apprentice. Thriving.' },
  { id: 'af02', traineeId: '20000000-0000-4000-8000-000000000002', followUpDate: '2025-01-20', employmentStatus: 'employed', currentEmployer: 'Nyakasharara Furniture Ltd', monthlyIncome: 280000, starterKitStatus: 'in_use', notes: 'Employed as a junior carpenter. Stable income. Happy with the training.' },
  { id: 'af03', traineeId: '20000000-0000-4000-8000-000000000007', followUpDate: '2025-02-10', employmentStatus: 'self_employed', currentEmployer: 'Self — Tumusiime Construction', monthlyIncome: 420000, starterKitStatus: 'in_use', notes: 'Has a contract to build a 3-room house in Ishaka. Very successful.' },
  { id: 'af04', traineeId: '20000000-0000-4000-8000-000000000010', followUpDate: '2025-03-01', employmentStatus: 'employed', currentEmployer: 'Bushenyi Electrical Services Ltd', monthlyIncome: 390000, starterKitStatus: 'in_use', notes: 'Working as domestic electrician. Employer very satisfied with skills.' },
  { id: 'af05', traineeId: '20000000-0000-4000-8000-000000000012', followUpDate: '2025-03-05', employmentStatus: 'self_employed', currentEmployer: 'Self — Bigiriwe Electrical, Ishaka', monthlyIncome: 460000, starterKitStatus: 'in_use', notes: 'Started own electrical contracting business. Has 2 regular clients.' },
];

export const SEED_JOB_PLACEMENTS: JobPlacement[] = [
  { id: 'jp01', traineeId: '20000000-0000-4000-8000-000000000002', employerName: 'Nyakasharara Furniture Ltd', position: 'Junior Carpenter', startDate: '2021-09-01', contactPerson: 'Mr. Owomugisha', contactPhone: '+256 782 001 002' },
  { id: 'jp02', traineeId: '20000000-0000-4000-8000-000000000010', employerName: 'Bushenyi Electrical Services Ltd', position: 'Domestic Electrician', startDate: '2024-09-15', contactPerson: 'Ms. Akello Janet', contactPhone: '+256 782 003 004' },
  { id: 'jp03', traineeId: '20000000-0000-4000-8000-000000000011', employerName: 'Ishaka Technical Institute', position: 'Lab Assistant (Electrical)', startDate: '2024-10-01', contactPerson: 'Mr. Tumusiime', contactPhone: '+256 782 005 006' },
];
