// The four trades SCM's CTVET programme actually runs (per the project charter).
export type TradeType = 'Carpentry' | 'Tailoring' | 'Masonry' | 'Electricity';
export type BatchStatus = 'planned' | 'active' | 'paused' | 'completed' | 'archived';
export type TraineeStatus = 'prospect' | 'enrolled' | 'paused' | 'graduated' | 'dropped' | 'alumni';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type CompetencyLevel = 1 | 2 | 3 | 4;
export type CaseCategory = 'trauma_healing' | 'mentorship' | 'safeguarding' | 'home_visit' | 'medical';
export type EmploymentStatus = 'employed' | 'self_employed' | 'unemployed' | 'further_studies';
export type ProcurementStatus = 'pending' | 'approved' | 'purchased' | 'cancelled';
export type TransactionType = 'income' | 'expense';
export type StarterKitStatus = 'in_use' | 'sold' | 'lost' | 'damaged' | 'not_issued';
export type TraineeDocumentType =
  | 'national_id'
  | 'recommendation_letter'
  | 'birth_certificate'
  | 'signed_rules'
  | 'photo';

export const TRAINEE_DOCUMENT_LABELS: Record<TraineeDocumentType, string> = {
  national_id: 'National ID',
  recommendation_letter: 'Recommendation Letter',
  birth_certificate: 'Birth Certificate',
  signed_rules: 'Signed Rules & Regulations',
  photo: 'Trainee Photo',
};

export const TRADE_OPTIONS: TradeType[] = ['Carpentry', 'Tailoring', 'Electricity', 'Masonry'];

export interface BatchTradeAssignment {
  trade: TradeType;
  trainerId: string | null;
  trainerName: string;
}

export interface Batch {
  id: string;
  name: string;
  /** Trades offered in this cohort + assigned trainers. */
  trades: BatchTradeAssignment[];
  startDate: string;
  endDate: string | null;
  status: BatchStatus;
  budgetAllocated: number;
  targetEnrollment: number;
  description: string;
}

export interface VulnerabilityAssessment {
  housingStatus: 'street' | 'shelter' | 'rented' | 'owned';
  foodSecurity: 'none' | 'inadequate' | 'adequate';
  previousEducation: 'none' | 'primary' | 'secondary' | 'vocational';
  familyStatus: 'orphan' | 'single_parent' | 'both_parents' | 'street_connected';
  hasDisability: boolean;
  disabilityDetails: string;
  /** Why they need / want to join the training (after vulnerability). */
  whyNeedTraining: string;
  /** Can attend daily for the full ~6-month programme. */
  canAttendDailySixMonths: boolean | null;
  /** Why they chose their selected trade. */
  reasonForTrade: string;
}

export type InterviewDecision = 'pending' | 'selected' | 'waitlist' | 'rejected';

export type InterviewStartAvailability = 'immediately' | 'after_month' | 'not_sure' | 'other';

export interface InterviewScores {
  vulnerability: number; // 0–10
  motivation: number; // 0–6
  availability: number; // 0–6
  ageSuitability: number; // 0–4
  opennessToFaith: number; // 0–4
  conductAttitude: number; // 0–5
  riskFlags: number; // −5 to 0 (deduction)
}

export interface InterviewResponses {
  maritalStatus: string;
  livelihoodSource: string;
  dailyRoutine: string;
  spouseAware: string;
  trainingInterfere: boolean | null;
  interferePlan: string;
  whyAttend: string;
  whyThisTrade: string;
  startAvailability: InterviewStartAvailability | '';
  startAvailabilityOther: string;
  canTravelDaily: boolean | null;
  vulnerabilityFlags: string[];
  vulnerabilityOther: string;
  faithDevotions: 'yes' | 'no' | 'not_sure' | '';
  openToMentorship: 'yes' | 'no' | 'somewhat' | '';
  appearanceNotes: string;
  politenessNotes: string;
  substanceAbuseNotes: string;
  communicationNotes: string;
  overallImpressionNotes: string;
}

export interface TraineeInterview {
  id: string;
  traineeId: string;
  batchId: string;
  interviewDate: string;
  responses: InterviewResponses;
  scores: InterviewScores;
  totalScore: number;
  panelNotes: string;
  panelistNames: string;
  decision: InterviewDecision;
  createdBy: string | null;
  createdAt: string;
}

export interface Trainee {
  id: string;
  batchId: string;
  /** Must be one of the parent batch's trades. */
  trade: TradeType;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female';
  phone: string;
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
  mobilizationSource: string;
  vulnerabilityScore: number;
  vulnerabilityAssessment: VulnerabilityAssessment;
  status: TraineeStatus;
  graduationDate: string | null;
  photo: string | null;
}

export interface Module {
  id: string;
  trade: TradeType;
  code: string;
  name: string;
  description: string;
  creditHours: number;
  weekNumber: number;
}

export interface CompetencyAssessment {
  id: string;
  traineeId: string;
  moduleId: string;
  level: CompetencyLevel;
  score: number;
  assessmentDate: string;
  assessorName: string;
  feedback: string;
}

export interface AttendanceRecord {
  id: string;
  traineeId: string;
  date: string;
  status: AttendanceStatus;
  notes: string;
}

export interface CaseNote {
  id: string;
  traineeId: string;
  category: CaseCategory;
  content: string;
  isCritical: boolean;
  followUpRequired: boolean;
  followUpDate: string | null;
  authorName: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: 'Tool' | 'Material' | 'Equipment' | 'Safety';
  unit: string;
  quantityOnHand: number;
  reorderLevel: number;
  unitCost: number;
  tradeRelevance: TradeType[];
}

export interface InventoryUsage {
  id: string;
  itemId: string;
  batchId: string;
  traineeId: string | null;
  quantityUsed: number;
  usageDate: string;
  purpose: string;
}

export interface ProcurementRequest {
  id: string;
  itemId: string;
  itemName: string;
  quantityRequested: number;
  estimatedCost: number;
  status: ProcurementStatus;
  requestedBy: string;
  assignedToId: string | null;
  assignedToName: string;
  createdAt: string;
}

export interface TraineeDocument {
  id: string;
  traineeId: string;
  documentType: TraineeDocumentType;
  fileName: string;
  storagePath: string;
  mimeType: string | null;
  fileSize: number | null;
  uploadedAt: string;
}

export interface ProductionLog {
  id: string;
  batchId: string;
  itemProduced: string;
  quantity: number;
  dateProduced: string;
  estimatedValue: number;
}

export interface Sale {
  id: string;
  batchId: string;
  description: string;
  amount: number;
  saleDate: string;
  customerContact: string;
  paymentStatus: 'paid' | 'partial' | 'pending';
}

export interface FinancialTransaction {
  id: string;
  batchId: string;
  category: string;
  type: TransactionType;
  amount: number;
  description: string;
  date: string;
  donorName: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface StarterKit {
  id: string;
  traineeId: string;
  description: string;
  issuedDate: string;
  totalValue: number;
  status: StarterKitStatus;
}

export interface AlumniFollowUp {
  id: string;
  traineeId: string;
  followUpDate: string;
  employmentStatus: EmploymentStatus;
  currentEmployer: string;
  monthlyIncome: number;
  starterKitStatus: StarterKitStatus;
  continuingInTrade: boolean;
  notes: string;
}

export interface JobPlacement {
  id: string;
  traineeId: string;
  employerName: string;
  position: string;
  startDate: string;
  contactPerson: string;
  contactPhone: string;
}

export const COMPETENCY_LEVEL_LABELS: Record<CompetencyLevel, { label: string; description: string; color: string }> = {
  1: { label: 'Beginner', description: 'Requires constant supervision', color: 'bg-red-100 text-red-700' },
  2: { label: 'Developing', description: 'Performs with some guidance', color: 'bg-yellow-100 text-yellow-700' },
  3: { label: 'Proficient', description: 'Performs independently', color: 'bg-blue-100 text-blue-700' },
  4: { label: 'Independent', description: 'Can teach others', color: 'bg-green-100 text-green-700' },
};

export const CASE_CATEGORY_LABELS: Record<CaseCategory, string> = {
  trauma_healing: 'Trauma Healing',
  mentorship: 'Mentorship',
  safeguarding: 'Safeguarding',
  home_visit: 'Home Visit',
  medical: 'Medical',
};
