import type {
  Batch, Trainee, Module, CompetencyAssessment, AttendanceRecord,
  CaseNote, InventoryItem, InventoryUsage, ProcurementRequest,
  ProductionLog, Sale, FinancialTransaction, StarterKit,
  AlumniFollowUp, JobPlacement
} from '../types';

export const SEED_BATCHES: Batch[] = [
  { id: 'b1', name: 'Batch 1 — Carpentry 2021', trade: 'Carpentry', startDate: '2021-02-01', endDate: '2021-07-30', status: 'completed', budgetAllocated: 4200000, targetEnrollment: 15, trainerName: 'Mr. Byamugisha Ronald', description: 'Foundation batch focused on furniture making and wood joinery.' },
  { id: 'b2', name: 'Batch 2 — Tailoring 2022', trade: 'Tailoring', startDate: '2022-01-10', endDate: '2022-06-30', status: 'completed', budgetAllocated: 3800000, targetEnrollment: 12, trainerName: 'Ms. Kyomuhangi Grace', description: 'Tailoring and garment construction for vulnerable young women.' },
  { id: 'b3', name: 'Batch 3 — Masonry 2023', trade: 'Masonry', startDate: '2023-01-16', endDate: '2023-07-14', status: 'completed', budgetAllocated: 5100000, targetEnrollment: 16, trainerName: 'Mr. Tumusiime Patrick', description: 'Bricklaying, plastering, and construction for street-connected youth.' },
  { id: 'b4', name: 'Batch 4 — Electricity 2024', trade: 'Electricity', startDate: '2024-02-05', endDate: '2024-07-26', status: 'completed', budgetAllocated: 4800000, targetEnrollment: 14, trainerName: 'Mr. Ruhweza Denis', description: 'Domestic and commercial wiring with safety and entrepreneurship integration.' },
  { id: 'b5', name: 'Batch 5 — Carpentry 2025', trade: 'Carpentry', startDate: '2025-02-03', endDate: null, status: 'active', budgetAllocated: 5500000, targetEnrollment: 15, trainerName: 'Mr. Byamugisha Ronald', description: 'Advanced carpentry: furniture, cabinetry, and production unit operations.' },
];

export const SEED_TRAINEES: Trainee[] = [
  // Batch 1 — Carpentry 2021 (graduated)
  { id: 't01', batchId: 'b1', firstName: 'Mugisha', lastName: 'Samuel', dateOfBirth: '1999-04-12', gender: 'male', phone: '+256 701 234 567', address: 'Bwindi Cell, Ishaka', emergencyContact: 'Mugisha Rose', emergencyPhone: '+256 772 111 222', mobilizationSource: 'Church Outreach', vulnerabilityScore: 88, status: 'alumni', graduationDate: '2021-07-30', photo: null, vulnerabilityAssessment: { housingStatus: 'street', foodSecurity: 'none', previousEducation: 'primary', familyStatus: 'orphan', hasDisability: false, disabilityDetails: '' } },
  { id: 't02', batchId: 'b1', firstName: 'Atuhaire', lastName: 'Prossy', dateOfBirth: '2000-08-22', gender: 'female', phone: '+256 702 345 678', address: 'Kagongo, Bushenyi', emergencyContact: 'Atuhaire James', emergencyPhone: '+256 772 222 333', mobilizationSource: 'Community Leader', vulnerabilityScore: 76, status: 'alumni', graduationDate: '2021-07-30', photo: null, vulnerabilityAssessment: { housingStatus: 'shelter', foodSecurity: 'inadequate', previousEducation: 'primary', familyStatus: 'single_parent', hasDisability: false, disabilityDetails: '' } },
  { id: 't03', batchId: 'b1', firstName: 'Banturaki', lastName: 'John', dateOfBirth: '1998-11-05', gender: 'male', phone: '+256 703 456 789', address: 'Kashenyi, Bushenyi', emergencyContact: 'Banturaki Mary', emergencyPhone: '+256 772 333 444', mobilizationSource: 'Probation Office', vulnerabilityScore: 92, status: 'alumni', graduationDate: '2021-07-30', photo: null, vulnerabilityAssessment: { housingStatus: 'street', foodSecurity: 'none', previousEducation: 'none', familyStatus: 'street_connected', hasDisability: false, disabilityDetails: '' } },
  // Batch 2 — Tailoring 2022 (graduated)
  { id: 't04', batchId: 'b2', firstName: 'Natukunda', lastName: 'Allen', dateOfBirth: '2001-03-17', gender: 'female', phone: '+256 704 567 890', address: 'Biharwe, Mbarara', emergencyContact: 'Natukunda Peter', emergencyPhone: '+256 772 444 555', mobilizationSource: 'Church Outreach', vulnerabilityScore: 84, status: 'alumni', graduationDate: '2022-06-30', photo: null, vulnerabilityAssessment: { housingStatus: 'rented', foodSecurity: 'inadequate', previousEducation: 'primary', familyStatus: 'single_parent', hasDisability: false, disabilityDetails: '' } },
  { id: 't05', batchId: 'b2', firstName: 'Ampaire', lastName: 'Beatrice', dateOfBirth: '2000-06-09', gender: 'female', phone: '+256 705 678 901', address: 'Ntare, Mbarara', emergencyContact: 'Ampaire Fred', emergencyPhone: '+256 772 555 666', mobilizationSource: 'Social Worker', vulnerabilityScore: 79, status: 'alumni', graduationDate: '2022-06-30', photo: null, vulnerabilityAssessment: { housingStatus: 'shelter', foodSecurity: 'adequate', previousEducation: 'primary', familyStatus: 'orphan', hasDisability: false, disabilityDetails: '' } },
  { id: 't06', batchId: 'b2', firstName: 'Kabagambe', lastName: 'Ruth', dateOfBirth: '2002-01-28', gender: 'female', phone: '+256 706 789 012', address: 'Ruharo, Mbarara', emergencyContact: 'Kabagambe Thomas', emergencyPhone: '+256 772 666 777', mobilizationSource: 'Church Outreach', vulnerabilityScore: 72, status: 'dropped', graduationDate: null, photo: null, vulnerabilityAssessment: { housingStatus: 'rented', foodSecurity: 'inadequate', previousEducation: 'secondary', familyStatus: 'both_parents', hasDisability: true, disabilityDetails: 'Partial hearing impairment' } },
  // Batch 3 — Masonry 2023 (graduated)
  { id: 't07', batchId: 'b3', firstName: 'Tumusiime', lastName: 'Richard', dateOfBirth: '1999-09-14', gender: 'male', phone: '+256 707 890 123', address: 'Ishaka Town', emergencyContact: 'Tumusiime Grace', emergencyPhone: '+256 772 777 888', mobilizationSource: 'Community Leader', vulnerabilityScore: 81, status: 'alumni', graduationDate: '2023-07-14', photo: null, vulnerabilityAssessment: { housingStatus: 'street', foodSecurity: 'none', previousEducation: 'primary', familyStatus: 'street_connected', hasDisability: false, disabilityDetails: '' } },
  { id: 't08', batchId: 'b3', firstName: 'Rwabuhanga', lastName: 'Moses', dateOfBirth: '2001-05-30', gender: 'male', phone: '+256 708 901 234', address: 'Kyabugimbi, Bushenyi', emergencyContact: 'Rwabuhanga Janet', emergencyPhone: '+256 772 888 999', mobilizationSource: 'Probation Office', vulnerabilityScore: 94, status: 'alumni', graduationDate: '2023-07-14', photo: null, vulnerabilityAssessment: { housingStatus: 'street', foodSecurity: 'none', previousEducation: 'none', familyStatus: 'orphan', hasDisability: false, disabilityDetails: '' } },
  { id: 't09', batchId: 'b3', firstName: 'Atwine', lastName: 'Caroline', dateOfBirth: '2002-12-03', gender: 'female', phone: '+256 709 012 345', address: 'Rubirizi Town', emergencyContact: 'Atwine Paul', emergencyPhone: '+256 772 999 000', mobilizationSource: 'Church Outreach', vulnerabilityScore: 68, status: 'alumni', graduationDate: '2023-07-14', photo: null, vulnerabilityAssessment: { housingStatus: 'rented', foodSecurity: 'adequate', previousEducation: 'secondary', familyStatus: 'single_parent', hasDisability: false, disabilityDetails: '' } },
  // Batch 4 — Electricity 2024 (graduated)
  { id: 't10', batchId: 'b4', firstName: 'Kamanzi', lastName: 'Felix', dateOfBirth: '2000-07-19', gender: 'male', phone: '+256 710 123 456', address: 'Bushenyi Town', emergencyContact: 'Kamanzi Sarah', emergencyPhone: '+256 773 111 222', mobilizationSource: 'Church Outreach', vulnerabilityScore: 87, status: 'alumni', graduationDate: '2024-07-26', photo: null, vulnerabilityAssessment: { housingStatus: 'street', foodSecurity: 'none', previousEducation: 'primary', familyStatus: 'orphan', hasDisability: false, disabilityDetails: '' } },
  { id: 't11', batchId: 'b4', firstName: 'Tukamushaba', lastName: 'Sharon', dateOfBirth: '2001-10-08', gender: 'female', phone: '+256 711 234 567', address: 'Nyakabirizi, Bushenyi', emergencyContact: 'Tukamushaba David', emergencyPhone: '+256 773 222 333', mobilizationSource: 'Social Worker', vulnerabilityScore: 75, status: 'alumni', graduationDate: '2024-07-26', photo: null, vulnerabilityAssessment: { housingStatus: 'shelter', foodSecurity: 'inadequate', previousEducation: 'primary', familyStatus: 'single_parent', hasDisability: false, disabilityDetails: '' } },
  { id: 't12', batchId: 'b4', firstName: 'Bigiriwe', lastName: 'Nathan', dateOfBirth: '1999-02-25', gender: 'male', phone: '+256 712 345 678', address: 'Ishaka Town', emergencyContact: 'Bigiriwe Agnes', emergencyPhone: '+256 773 333 444', mobilizationSource: 'Probation Office', vulnerabilityScore: 91, status: 'alumni', graduationDate: '2024-07-26', photo: null, vulnerabilityAssessment: { housingStatus: 'street', foodSecurity: 'none', previousEducation: 'primary', familyStatus: 'street_connected', hasDisability: false, disabilityDetails: '' } },
  // Batch 5 — Carpentry 2025 (active)
  { id: 't13', batchId: 'b5', firstName: 'Nkurunziza', lastName: 'Emmanuel', dateOfBirth: '2003-06-11', gender: 'male', phone: '+256 713 456 789', address: 'Bwindi Cell, Ishaka', emergencyContact: 'Nkurunziza Rose', emergencyPhone: '+256 773 444 555', mobilizationSource: 'Church Outreach', vulnerabilityScore: 90, status: 'enrolled', graduationDate: null, photo: null, vulnerabilityAssessment: { housingStatus: 'street', foodSecurity: 'none', previousEducation: 'primary', familyStatus: 'orphan', hasDisability: false, disabilityDetails: '' } },
  { id: 't14', batchId: 'b5', firstName: 'Turyasingura', lastName: 'Diana', dateOfBirth: '2004-03-22', gender: 'female', phone: '+256 714 567 890', address: 'Kagongo, Bushenyi', emergencyContact: 'Turyasingura John', emergencyPhone: '+256 773 555 666', mobilizationSource: 'Community Leader', vulnerabilityScore: 83, status: 'enrolled', graduationDate: null, photo: null, vulnerabilityAssessment: { housingStatus: 'shelter', foodSecurity: 'inadequate', previousEducation: 'primary', familyStatus: 'single_parent', hasDisability: false, disabilityDetails: '' } },
  { id: 't15', batchId: 'b5', firstName: 'Mutabazi', lastName: 'Brian', dateOfBirth: '2002-09-07', gender: 'male', phone: '+256 715 678 901', address: 'Kashenyi, Bushenyi', emergencyContact: 'Mutabazi Grace', emergencyPhone: '+256 773 666 777', mobilizationSource: 'Probation Office', vulnerabilityScore: 95, status: 'enrolled', graduationDate: null, photo: null, vulnerabilityAssessment: { housingStatus: 'street', foodSecurity: 'none', previousEducation: 'none', familyStatus: 'street_connected', hasDisability: false, disabilityDetails: '' } },
  { id: 't16', batchId: 'b5', firstName: 'Kyomuhangi', lastName: 'Lydia', dateOfBirth: '2003-12-15', gender: 'female', phone: '+256 716 789 012', address: 'Biharwe, Mbarara', emergencyContact: 'Kyomuhangi Frank', emergencyPhone: '+256 773 777 888', mobilizationSource: 'Church Outreach', vulnerabilityScore: 77, status: 'enrolled', graduationDate: null, photo: null, vulnerabilityAssessment: { housingStatus: 'rented', foodSecurity: 'inadequate', previousEducation: 'secondary', familyStatus: 'both_parents', hasDisability: false, disabilityDetails: '' } },
  { id: 't17', batchId: 'b5', firstName: 'Byaruhanga', lastName: 'Ivan', dateOfBirth: '2001-04-18', gender: 'male', phone: '+256 717 890 123', address: 'Ruharo, Mbarara', emergencyContact: 'Byaruhanga Mary', emergencyPhone: '+256 773 888 999', mobilizationSource: 'Social Worker', vulnerabilityScore: 86, status: 'enrolled', graduationDate: null, photo: null, vulnerabilityAssessment: { housingStatus: 'street', foodSecurity: 'none', previousEducation: 'primary', familyStatus: 'orphan', hasDisability: false, disabilityDetails: '' } },
  { id: 't18', batchId: 'b5', firstName: 'Tumuhairwe', lastName: 'Sandra', dateOfBirth: '2004-07-29', gender: 'female', phone: '+256 718 901 234', address: 'Ishaka Town', emergencyContact: 'Tumuhairwe Peter', emergencyPhone: '+256 773 999 000', mobilizationSource: 'Church Outreach', vulnerabilityScore: 71, status: 'enrolled', graduationDate: null, photo: null, vulnerabilityAssessment: { housingStatus: 'rented', foodSecurity: 'adequate', previousEducation: 'secondary', familyStatus: 'single_parent', hasDisability: false, disabilityDetails: '' } },
  { id: 't19', batchId: 'b5', firstName: 'Nshemereirwe', lastName: 'Patrick', dateOfBirth: '2002-11-02', gender: 'male', phone: '+256 719 012 345', address: 'Kyabugimbi, Bushenyi', emergencyContact: 'Nshemereirwe Agnes', emergencyPhone: '+256 774 111 222', mobilizationSource: 'Community Leader', vulnerabilityScore: 89, status: 'enrolled', graduationDate: null, photo: null, vulnerabilityAssessment: { housingStatus: 'street', foodSecurity: 'none', previousEducation: 'primary', familyStatus: 'street_connected', hasDisability: true, disabilityDetails: 'Mild speech difficulty' } },
  { id: 't20', batchId: 'b5', firstName: 'Nyamuhanga', lastName: 'Irene', dateOfBirth: '2003-02-14', gender: 'female', phone: '+256 720 123 456', address: 'Rubirizi Town', emergencyContact: 'Nyamuhanga Robert', emergencyPhone: '+256 774 222 333', mobilizationSource: 'Church Outreach', vulnerabilityScore: 74, status: 'enrolled', graduationDate: null, photo: null, vulnerabilityAssessment: { housingStatus: 'shelter', foodSecurity: 'inadequate', previousEducation: 'primary', familyStatus: 'single_parent', hasDisability: false, disabilityDetails: '' } },
];

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
  { id: 'ca01', traineeId: 't13', moduleId: 'm01', level: 4, score: 92, assessmentDate: '2025-02-14', assessorName: 'Mr. Byamugisha Ronald', feedback: 'Excellent tool handling and safety awareness from day one.' },
  { id: 'ca02', traineeId: 't13', moduleId: 'm02', level: 3, score: 78, assessmentDate: '2025-02-21', assessorName: 'Mr. Byamugisha Ronald', feedback: 'Good measurement accuracy; needs practice with moisture identification.' },
  { id: 'ca03', traineeId: 't13', moduleId: 'm03', level: 3, score: 75, assessmentDate: '2025-03-01', assessorName: 'Mr. Byamugisha Ronald', feedback: 'Mortise joints are clean; dovetail still needs work.' },
  { id: 'ca04', traineeId: 't14', moduleId: 'm01', level: 3, score: 74, assessmentDate: '2025-02-14', assessorName: 'Mr. Byamugisha Ronald', feedback: 'Safe tool handling demonstrated. Needs confidence with chiselling.' },
  { id: 'ca05', traineeId: 't14', moduleId: 'm02', level: 2, score: 61, assessmentDate: '2025-02-21', assessorName: 'Mr. Byamugisha Ronald', feedback: 'Measurement reading improving. Still struggles with conversions.' },
  { id: 'ca06', traineeId: 't15', moduleId: 'm01', level: 4, score: 95, assessmentDate: '2025-02-14', assessorName: 'Mr. Byamugisha Ronald', feedback: 'Outstanding — could already assist other trainees.' },
  { id: 'ca07', traineeId: 't15', moduleId: 'm02', level: 4, score: 89, assessmentDate: '2025-02-21', assessorName: 'Mr. Byamugisha Ronald', feedback: 'Very precise measurements and excellent wood type knowledge.' },
  { id: 'ca08', traineeId: 't15', moduleId: 'm03', level: 3, score: 80, assessmentDate: '2025-03-01', assessorName: 'Mr. Byamugisha Ronald', feedback: 'All joint types satisfactorily completed.' },
  { id: 'ca09', traineeId: 't16', moduleId: 'm01', level: 2, score: 58, assessmentDate: '2025-02-14', assessorName: 'Mr. Byamugisha Ronald', feedback: 'Needs supervision with sharp tools. Safety protocol reviewed.' },
  { id: 'ca10', traineeId: 't17', moduleId: 'm01', level: 3, score: 76, assessmentDate: '2025-02-14', assessorName: 'Mr. Byamugisha Ronald', feedback: 'Good progression in first week.' },
  { id: 'ca11', traineeId: 't17', moduleId: 'm02', level: 3, score: 72, assessmentDate: '2025-02-21', assessorName: 'Mr. Byamugisha Ronald', feedback: 'Steady improvement; working well independently.' },
  { id: 'ca12', traineeId: 't18', moduleId: 'm01', level: 2, score: 62, assessmentDate: '2025-02-14', assessorName: 'Mr. Byamugisha Ronald', feedback: 'Cautious but needs to build confidence with tools.' },
];

const today = new Date();
const dateStr = (daysAgo: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
};

export const SEED_ATTENDANCE: AttendanceRecord[] = [
  ...['t13','t14','t15','t16','t17','t18','t19','t20'].flatMap((tid, i) => [
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
  { id: 'cn01', traineeId: 't13', category: 'mentorship', content: 'Emmanuel is showing excellent leadership traits. Encouraged him to support peer learners during practical sessions.', isCritical: false, followUpRequired: false, followUpDate: null, authorName: 'Ms. Nabukenya Ruth', createdAt: dateStr(5) },
  { id: 'cn02', traineeId: 't13', category: 'trauma_healing', content: 'Conducted individual session on grief processing. Emmanuel opened up about losing both parents. Referred to group healing circle.', isCritical: false, followUpRequired: true, followUpDate: dateStr(-7), authorName: 'Mr. Atuhaire Joseph', createdAt: dateStr(12) },
  { id: 'cn03', traineeId: 't15', category: 'safeguarding', content: 'Brian disclosed he was pressured by older boys at his previous shelter. Incident documented. Welfare officer notified. Moved to safer accommodation.', isCritical: true, followUpRequired: true, followUpDate: dateStr(-3), authorName: 'Ms. Nabukenya Ruth', createdAt: dateStr(8) },
  { id: 'cn04', traineeId: 't15', category: 'mentorship', content: 'Follow-up after safeguarding incident. Brian is settling well in new accommodation. More focused in class.', isCritical: false, followUpRequired: false, followUpDate: null, authorName: 'Mr. Atuhaire Joseph', createdAt: dateStr(3) },
  { id: 'cn05', traineeId: 't16', category: 'home_visit', content: 'Conducted home visit at Lydia\'s family residence in Biharwe. Family supportive of training. Meals still a challenge — referred to food support programme.', isCritical: false, followUpRequired: true, followUpDate: dateStr(-14), authorName: 'Ms. Nabukenya Ruth', createdAt: dateStr(18) },
  { id: 'cn06', traineeId: 't19', category: 'medical', content: 'Patrick reported difficulty in verbal communication exercises. Referred to speech therapist at Ishaka Adventist Hospital. Appointment confirmed.', isCritical: false, followUpRequired: true, followUpDate: dateStr(-5), authorName: 'Mr. Atuhaire Joseph', createdAt: dateStr(10) },
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
  { id: 'iu01', itemId: 'inv03', batchId: 'b5', traineeId: null, quantityUsed: 8, usageDate: dateStr(14), purpose: 'Module 3 — Basic Wood Joints practicals' },
  { id: 'iu02', itemId: 'inv04', batchId: 'b5', traineeId: null, quantityUsed: 1.5, usageDate: dateStr(14), purpose: 'Module 3 — Wood Joints practicals' },
  { id: 'iu03', itemId: 'inv05', batchId: 'b5', traineeId: null, quantityUsed: 20, usageDate: dateStr(7), purpose: 'Module 5 — Surface finishing demo' },
  { id: 'iu04', itemId: 'inv06', batchId: 'b5', traineeId: null, quantityUsed: 2, usageDate: dateStr(7), purpose: 'Module 5 — Varnishing practicals' },
];

export const SEED_PROCUREMENT_REQUESTS: ProcurementRequest[] = [
  { id: 'pr01', itemId: 'inv03', itemName: 'Timber — Pine 4x2 (m)', quantityRequested: 30, estimatedCost: 540000, status: 'approved', requestedBy: 'Mr. Byamugisha Ronald', createdAt: dateStr(10) },
  { id: 'pr02', itemId: 'inv06', itemName: 'Varnish (liters)', quantityRequested: 10, estimatedCost: 350000, status: 'pending', requestedBy: 'Mr. Byamugisha Ronald', createdAt: dateStr(3) },
  { id: 'pr03', itemId: 'inv08', itemName: 'Safety Goggles', quantityRequested: 8, estimatedCost: 64000, status: 'purchased', requestedBy: 'Ms. Kyomuhangi Grace', createdAt: dateStr(20) },
];

export const SEED_PRODUCTION_LOGS: ProductionLog[] = [
  { id: 'pl01', batchId: 'b5', itemProduced: 'Dining Chair (4-legged)', quantity: 3, dateProduced: dateStr(20), estimatedValue: 180000 },
  { id: 'pl02', batchId: 'b5', itemProduced: 'Study Table', quantity: 2, dateProduced: dateStr(15), estimatedValue: 280000 },
  { id: 'pl03', batchId: 'b5', itemProduced: 'Storage Shelf Unit', quantity: 1, dateProduced: dateStr(8), estimatedValue: 150000 },
];

export const SEED_SALES: Sale[] = [
  { id: 'sl01', batchId: 'b5', description: '2x Dining Chairs sold to KIU-WC staff', amount: 140000, saleDate: dateStr(18), customerContact: 'KIU Procurement Office', paymentStatus: 'paid' },
  { id: 'sl02', batchId: 'b5', description: '1x Study Table — Ishaka Adventist Hospital', amount: 160000, saleDate: dateStr(12), customerContact: 'Dr. Atuhaire, IAH', paymentStatus: 'paid' },
];

export const SEED_FINANCIALS: FinancialTransaction[] = [
  // Batch 5 income
  { id: 'ft01', batchId: 'b5', category: 'Donor Grant', type: 'income', amount: 3500000, description: 'Q1 Grant — Tearfund Uganda', date: '2025-02-01', donorName: 'Tearfund Uganda' },
  { id: 'ft02', batchId: 'b5', category: 'Donor Grant', type: 'income', amount: 2000000, description: 'Church Mission Fund contribution', date: '2025-02-05', donorName: 'Diocese of Ruwenzori' },
  { id: 'ft03', batchId: 'b5', category: 'Production Sales', type: 'income', amount: 300000, description: 'Furniture sales — batch 5 production unit', date: dateStr(12), donorName: '' },
  // Batch 5 expenses
  { id: 'ft04', batchId: 'b5', category: 'Training Materials', type: 'expense', amount: 1240000, description: 'Timber, hand tools, and consumables for modules 1-4', date: '2025-02-10', donorName: '' },
  { id: 'ft05', batchId: 'b5', category: 'Trainee Stipends', type: 'expense', amount: 960000, description: 'March stipends — 8 trainees @ UGX 120,000', date: '2025-03-01', donorName: '' },
  { id: 'ft06', batchId: 'b5', category: 'Trainer Fees', type: 'expense', amount: 700000, description: 'Lead trainer and assistant trainer — Feb/March fees', date: '2025-03-05', donorName: '' },
  { id: 'ft07', batchId: 'b5', category: 'Administration', type: 'expense', amount: 180000, description: 'Stationery, printing, and transport for outreach', date: '2025-02-20', donorName: '' },
  { id: 'ft08', batchId: 'b5', category: 'Utilities', type: 'expense', amount: 95000, description: 'Water and electricity — Feb/March', date: '2025-03-08', donorName: '' },
  { id: 'ft09', batchId: 'b5', category: 'Outreach & Mobilization', type: 'expense', amount: 210000, description: 'Community mobilization transport and materials', date: '2025-01-28', donorName: '' },
  // Historical batches summary income
  { id: 'ft10', batchId: 'b4', category: 'Donor Grant', type: 'income', amount: 4800000, description: 'Full batch grant — Caritas Uganda', date: '2024-02-01', donorName: 'Caritas Uganda' },
  { id: 'ft11', batchId: 'b3', category: 'Donor Grant', type: 'income', amount: 5100000, description: 'Full batch grant — Irish Aid', date: '2023-01-15', donorName: 'Irish Aid' },
];

export const SEED_STARTER_KITS: StarterKit[] = [
  { id: 'sk01', traineeId: 't01', description: 'Hammer, hand saw, chisels (3-piece), measuring tape, sandpaper (20 sheets), tool bag', issuedDate: '2021-07-30', totalValue: 185000, status: 'in_use' },
  { id: 'sk02', traineeId: 't02', description: 'Hammer, hand saw, chisels (3-piece), measuring tape, tool bag', issuedDate: '2021-07-30', totalValue: 165000, status: 'in_use' },
  { id: 'sk03', traineeId: 't03', description: 'Full carpentry starter kit', issuedDate: '2021-07-30', totalValue: 190000, status: 'in_use' },
  { id: 'sk04', traineeId: 't07', description: '2x Trowels, spirit level, rubber mallet, measuring tape, safety gloves', issuedDate: '2023-07-14', totalValue: 148000, status: 'in_use' },
  { id: 'sk05', traineeId: 't08', description: 'Full masonry starter kit', issuedDate: '2023-07-14', totalValue: 160000, status: 'in_use' },
  { id: 'sk06', traineeId: 't10', description: 'Multimeter, wire stripper, screwdriver set, electrical tape (5 rolls), circuit tester', issuedDate: '2024-07-26', totalValue: 195000, status: 'in_use' },
  { id: 'sk07', traineeId: 't11', description: 'Electrician starter kit — standard', issuedDate: '2024-07-26', totalValue: 175000, status: 'damaged' },
  { id: 'sk08', traineeId: 't12', description: 'Full electrician starter kit', issuedDate: '2024-07-26', totalValue: 200000, status: 'in_use' },
];

export const SEED_ALUMNI_FOLLOWUPS: AlumniFollowUp[] = [
  { id: 'af01', traineeId: 't01', followUpDate: '2025-01-15', employmentStatus: 'self_employed', currentEmployer: 'Self — Mugisha Wood Works, Ishaka', monthlyIncome: 350000, starterKitStatus: 'in_use', notes: 'Running a small workshop from home. Has hired 1 apprentice. Thriving.' },
  { id: 'af02', traineeId: 't02', followUpDate: '2025-01-20', employmentStatus: 'employed', currentEmployer: 'Nyakasharara Furniture Ltd', monthlyIncome: 280000, starterKitStatus: 'in_use', notes: 'Employed as a junior carpenter. Stable income. Happy with the training.' },
  { id: 'af03', traineeId: 't07', followUpDate: '2025-02-10', employmentStatus: 'self_employed', currentEmployer: 'Self — Tumusiime Construction', monthlyIncome: 420000, starterKitStatus: 'in_use', notes: 'Has a contract to build a 3-room house in Ishaka. Very successful.' },
  { id: 'af04', traineeId: 't10', followUpDate: '2025-03-01', employmentStatus: 'employed', currentEmployer: 'Bushenyi Electrical Services Ltd', monthlyIncome: 390000, starterKitStatus: 'in_use', notes: 'Working as domestic electrician. Employer very satisfied with skills.' },
  { id: 'af05', traineeId: 't12', followUpDate: '2025-03-05', employmentStatus: 'self_employed', currentEmployer: 'Self — Bigiriwe Electrical, Ishaka', monthlyIncome: 460000, starterKitStatus: 'in_use', notes: 'Started own electrical contracting business. Has 2 regular clients.' },
];

export const SEED_JOB_PLACEMENTS: JobPlacement[] = [
  { id: 'jp01', traineeId: 't02', employerName: 'Nyakasharara Furniture Ltd', position: 'Junior Carpenter', startDate: '2021-09-01', contactPerson: 'Mr. Owomugisha', contactPhone: '+256 782 001 002' },
  { id: 'jp02', traineeId: 't10', employerName: 'Bushenyi Electrical Services Ltd', position: 'Domestic Electrician', startDate: '2024-09-15', contactPerson: 'Ms. Akello Janet', contactPhone: '+256 782 003 004' },
  { id: 'jp03', traineeId: 't11', employerName: 'Ishaka Technical Institute', position: 'Lab Assistant (Electrical)', startDate: '2024-10-01', contactPerson: 'Mr. Tumusiime', contactPhone: '+256 782 005 006' },
];
