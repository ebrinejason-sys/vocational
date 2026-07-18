import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import { resumeBatchStatus, resumeTraineeStatus, assertNoDependencies } from '../lib/lifecycle';
import { countBatchDependencies, countTraineeDependencies } from '../lib/deleteGuards';
import { friendlyError, setDisplayCurrency, type CurrencyCode } from '../lib/utils';
import { notifyFinancialChange } from '../lib/financialNotify';
import type {
  Batch, BatchStatus, BatchTradeAssignment, Trainee, Module, CompetencyAssessment, AttendanceRecord,
  CaseNote, InventoryItem, InventoryUsage, ProcurementRequest,
  ProductionLog, Sale, FinancialTransaction, StarterKit,
  AlumniFollowUp, JobPlacement, TradeType, TraineeInterview, InterviewResponses, InterviewScores,
  InterviewDecision, VulnerabilityAssessment, AppNotification,
} from '../types';
import {
  SEED_MODULES, SEED_COMPETENCY_ASSESSMENTS,
  SEED_ATTENDANCE, SEED_CASE_NOTES,
  SEED_PRODUCTION_LOGS, SEED_SALES, SEED_FINANCIALS,
  SEED_STARTER_KITS, SEED_ALUMNI_FOLLOWUPS, SEED_JOB_PLACEMENTS,
} from './seed';

const EMPTY_VULNERABILITY: VulnerabilityAssessment = {
  housingStatus: 'rented',
  foodSecurity: 'adequate',
  previousEducation: 'primary',
  familyStatus: 'both_parents',
  hasDisability: false,
  disabilityDetails: '',
  whyNeedTraining: '',
  canAttendDailySixMonths: null,
  reasonForTrade: '',
};

function normalizeVulnerabilityAssessment(
  raw: Partial<VulnerabilityAssessment> | null | undefined
): VulnerabilityAssessment {
  return {
    ...EMPTY_VULNERABILITY,
    ...(raw ?? {}),
    whyNeedTraining: raw?.whyNeedTraining ?? '',
    canAttendDailySixMonths:
      raw?.canAttendDailySixMonths === true || raw?.canAttendDailySixMonths === false
        ? raw.canAttendDailySixMonths
        : null,
    reasonForTrade: raw?.reasonForTrade ?? '',
  };
}

export function emptyInterviewResponses(): InterviewResponses {
  return {
    maritalStatus: '',
    livelihoodSource: '',
    dailyRoutine: '',
    spouseAware: '',
    trainingInterfere: null,
    interferePlan: '',
    whyAttend: '',
    whyThisTrade: '',
    startAvailability: '',
    startAvailabilityOther: '',
    canTravelDaily: null,
    vulnerabilityFlags: [],
    vulnerabilityOther: '',
    faithDevotions: '',
    openToMentorship: '',
    appearanceNotes: '',
    politenessNotes: '',
    substanceAbuseNotes: '',
    communicationNotes: '',
    overallImpressionNotes: '',
  };
}

export function emptyInterviewScores(): InterviewScores {
  return {
    vulnerability: 0,
    motivation: 0,
    availability: 0,
    ageSuitability: 0,
    opennessToFaith: 0,
    conductAttitude: 0,
    riskFlags: 0,
  };
}

export function computeInterviewTotal(scores: InterviewScores): number {
  return (
    scores.vulnerability +
    scores.motivation +
    scores.availability +
    scores.ageSuitability +
    scores.opennessToFaith +
    scores.conductAttitude +
    scores.riskFlags
  );
}

// ---- Supabase row <-> app-model mapping (batches, trainees, inventory) —
// remaining domains stay local-seeded until wired ----

interface BatchTradeRow {
  id?: string;
  trade: string;
  trainer_id: string | null;
  profiles?: { full_name: string } | null;
}

interface BatchRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  status: string;
  budget_allocated: string | number;
  target_enrollment: number;
  description: string | null;
  batch_trades?: BatchTradeRow[] | null;
}

function mapBatchTrades(rows: BatchTradeRow[] | null | undefined): BatchTradeAssignment[] {
  return (rows ?? []).map((r) => ({
    trade: r.trade as TradeType,
    trainerId: r.trainer_id,
    trainerName: r.profiles?.full_name ?? '',
  }));
}

function batchFromRow(row: BatchRow): Batch {
  return {
    id: row.id,
    name: row.name,
    trades: mapBatchTrades(row.batch_trades),
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status as Batch['status'],
    budgetAllocated: Number(row.budget_allocated),
    targetEnrollment: row.target_enrollment,
    description: row.description ?? '',
  };
}

function batchCoreToRow(b: Omit<Batch, 'id' | 'trades'>) {
  return {
    name: b.name,
    start_date: b.startDate,
    end_date: b.endDate,
    status: b.status,
    budget_allocated: b.budgetAllocated,
    target_enrollment: b.targetEnrollment,
    description: b.description,
  };
}

const BATCH_SELECT = '*, batch_trades(id, trade, trainer_id, profiles:trainer_id(full_name))';

interface TraineeRow {
  id: string; batch_id: string; trade: string | null;
  first_name: string; last_name: string; date_of_birth: string;
  gender: string; phone_number: string; address: string; emergency_contact_name: string;
  emergency_contact_phone: string; mobilization_source: string; vulnerability_score: number;
  vulnerability_assessment: Trainee['vulnerabilityAssessment'] | null;
  status: string; graduation_date: string | null;
}

function traineeFromRow(row: TraineeRow): Trainee {
  return {
    id: row.id,
    batchId: row.batch_id,
    trade: (row.trade ?? 'Carpentry') as TradeType,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    gender: row.gender as Trainee['gender'],
    phone: row.phone_number,
    address: row.address,
    emergencyContact: row.emergency_contact_name,
    emergencyPhone: row.emergency_contact_phone,
    mobilizationSource: row.mobilization_source,
    vulnerabilityScore: row.vulnerability_score,
    vulnerabilityAssessment: normalizeVulnerabilityAssessment(row.vulnerability_assessment),
    status: row.status as Trainee['status'],
    graduationDate: row.graduation_date,
    photo: null,
  };
}

/** PostgREST rejects "" for uuid/date columns with HTTP 400 — coerce blanks to null. */
function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function traineeToRow(t: Omit<Trainee, 'id' | 'photo'>) {
  return {
    batch_id: emptyToNull(t.batchId),
    trade: t.trade,
    first_name: t.firstName,
    last_name: t.lastName,
    date_of_birth: emptyToNull(t.dateOfBirth),
    gender: t.gender,
    phone_number: t.phone,
    address: t.address,
    emergency_contact_name: t.emergencyContact,
    emergency_contact_phone: t.emergencyPhone,
    mobilization_source: t.mobilizationSource,
    vulnerability_score: t.vulnerabilityScore,
    vulnerability_assessment: t.vulnerabilityAssessment,
    status: t.status,
    graduation_date: emptyToNull(t.graduationDate),
  };
}

interface InventoryItemRow {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  quantity_on_hand: string | number;
  reorder_level: string | number;
  unit_cost: string | number | null;
  trade_relevance?: string[] | null;
}

function inventoryItemFromRow(row: InventoryItemRow): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    category: (row.category ?? 'Material') as InventoryItem['category'],
    unit: row.unit,
    quantityOnHand: Number(row.quantity_on_hand),
    reorderLevel: Number(row.reorder_level),
    unitCost: Number(row.unit_cost ?? 0),
    tradeRelevance: (row.trade_relevance ?? []) as TradeType[],
  };
}

function inventoryItemToRow(item: Omit<InventoryItem, 'id'>) {
  return {
    name: item.name,
    category: item.category,
    unit: item.unit,
    quantity_on_hand: item.quantityOnHand,
    reorder_level: item.reorderLevel,
    unit_cost: item.unitCost,
    trade_relevance: item.tradeRelevance,
  };
}

interface InventoryUsageRow {
  id: string;
  item_id: string;
  batch_id: string | null;
  trainee_id: string | null;
  quantity_used: string | number;
  usage_date: string;
  purpose: string | null;
}

function inventoryUsageFromRow(row: InventoryUsageRow): InventoryUsage {
  return {
    id: row.id,
    itemId: row.item_id,
    batchId: row.batch_id ?? '',
    traineeId: row.trainee_id,
    quantityUsed: Number(row.quantity_used),
    usageDate: row.usage_date,
    purpose: row.purpose ?? '',
  };
}

interface ProcurementRequestRow {
  id: string;
  item_id: string;
  quantity_requested: string | number;
  estimated_cost: string | number | null;
  status: string;
  requested_by: string | null;
  created_at: string;
  inventory_items?: { name: string } | { name: string }[] | null;
}

/** Avoid profiles!…fkey embeds — those 400 until the migration FKs exist. */
const PROCUREMENT_SELECT =
  'id, item_id, quantity_requested, estimated_cost, status, requested_by, created_at, inventory_items(name)';

function embedOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function profileNamesById(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return new Map();
  const { data, error } = await supabase.from('profiles').select('id, full_name').in('id', unique);
  if (error) {
    console.warn('Could not resolve profile names', error);
    return new Map();
  }
  return new Map((data ?? []).map((p) => [p.id as string, (p.full_name as string) || 'Staff']));
}

function procurementFromRow(
  row: ProcurementRequestRow,
  nameById: Map<string, string> = new Map()
): ProcurementRequest {
  const item = embedOne(row.inventory_items);
  return {
    id: row.id,
    itemId: row.item_id,
    itemName: item?.name ?? 'Unknown item',
    quantityRequested: Number(row.quantity_requested),
    estimatedCost: Number(row.estimated_cost ?? 0),
    status: row.status as ProcurementRequest['status'],
    requestedBy: (row.requested_by && nameById.get(row.requested_by)) || 'Staff',
    createdAt: row.created_at.slice(0, 10),
  };
}

async function mapProcurementRows(rows: ProcurementRequestRow[]): Promise<ProcurementRequest[]> {
  const nameById = await profileNamesById(rows.map((r) => r.requested_by));
  return rows.map((r) => procurementFromRow(r, nameById));
}

interface TraineeInterviewRow {
  id: string;
  trainee_id: string;
  batch_id: string | null;
  interview_date: string;
  responses: InterviewResponses | null;
  scores: InterviewScores | null;
  total_score: number;
  panel_notes: string | null;
  panelist_names: string | null;
  decision: string;
  created_by: string | null;
  created_at: string;
}

function interviewFromRow(row: TraineeInterviewRow): TraineeInterview {
  return {
    id: row.id,
    traineeId: row.trainee_id,
    batchId: row.batch_id ?? '',
    interviewDate: row.interview_date,
    responses: { ...emptyInterviewResponses(), ...(row.responses ?? {}) },
    scores: { ...emptyInterviewScores(), ...(row.scores ?? {}) },
    totalScore: row.total_score ?? 0,
    panelNotes: row.panel_notes ?? '',
    panelistNames: row.panelist_names ?? '',
    decision: row.decision as InterviewDecision,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function interviewToRow(
  input: Omit<TraineeInterview, 'id' | 'createdAt'> & { id?: string }
) {
  const scores = input.scores;
  return {
    trainee_id: input.traineeId,
    batch_id: emptyToNull(input.batchId),
    interview_date: input.interviewDate,
    responses: input.responses,
    scores,
    total_score: computeInterviewTotal(scores),
    panel_notes: input.panelNotes,
    panelist_names: input.panelistNames,
    decision: input.decision,
    created_by: emptyToNull(input.createdBy),
  };
}

interface FinancialTransactionRow {
  id: string;
  batch_id: string | null;
  category: string;
  transaction_type: string;
  amount: number | string;
  description: string | null;
  transaction_date: string | null;
  donor_id: string | null;
  recorded_by: string | null;
}

function financialFromRow(row: FinancialTransactionRow): FinancialTransaction {
  return {
    id: row.id,
    batchId: row.batch_id ?? '',
    category: row.category,
    type: row.transaction_type === 'expense' ? 'expense' : 'income',
    amount: Number(row.amount) || 0,
    description: row.description ?? '',
    date: row.transaction_date ?? '',
    donorName: row.donor_id ?? '',
  };
}

function financialToRow(t: Omit<FinancialTransaction, 'id'> & { id?: string }, recordedBy?: string | null) {
  return {
    ...(t.id ? { id: t.id } : {}),
    batch_id: emptyToNull(t.batchId),
    category: t.category,
    transaction_type: t.type,
    amount: t.amount,
    description: t.description || null,
    transaction_date: emptyToNull(t.date),
    donor_id: emptyToNull(t.donorName),
    ...(recordedBy !== undefined ? { recorded_by: emptyToNull(recordedBy) } : {}),
  };
}

interface NotificationRow {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

function notificationFromRow(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    title: row.title,
    body: row.body ?? '',
    entityType: row.entity_type,
    entityId: row.entity_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

interface VTMSState {
  batches: Batch[];
  trainees: Trainee[];
  modules: Module[];
  competencyAssessments: CompetencyAssessment[];
  attendanceRecords: AttendanceRecord[];
  caseNotes: CaseNote[];
  inventoryItems: InventoryItem[];
  inventoryUsage: InventoryUsage[];
  procurementRequests: ProcurementRequest[];
  productionLogs: ProductionLog[];
  sales: Sale[];
  financialTransactions: FinancialTransaction[];
  starterKits: StarterKit[];
  alumniFollowUps: AlumniFollowUp[];
  jobPlacements: JobPlacement[];
  traineeInterviews: TraineeInterview[];
  currencyCode: CurrencyCode;
  notifications: AppNotification[];
  activeBatchId: string;
  dataLoaded: boolean;

  fetchInitialData: () => Promise<void>;
  resetSessionData: () => void;
  setActiveBatch: (id: string) => void;
  addTrainee: (t: Omit<Trainee, 'id'>) => Promise<void>;
  updateTrainee: (id: string, updates: Partial<Trainee>) => Promise<void>;
  pauseTrainee: (id: string) => Promise<void>;
  resumeTrainee: (id: string) => Promise<void>;
  deleteTrainee: (id: string) => Promise<void>;
  logAttendance: (records: AttendanceRecord[]) => void;
  addCompetencyAssessment: (a: CompetencyAssessment) => void;
  addCaseNote: (n: CaseNote) => void;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  addInventoryItem: (item: Omit<InventoryItem, 'id'>) => Promise<void>;
  logInventoryUsage: (usage: Omit<InventoryUsage, 'id'>) => Promise<void>;
  addProcurementRequest: (input: {
    itemId: string;
    quantityRequested: number;
    estimatedCost: number;
  }) => Promise<void>;
  updateProcurementRequest: (id: string, updates: Partial<Pick<ProcurementRequest, 'status'>>) => Promise<void>;
  /** Mark purchased and add the requested quantity into on-hand stock. */
  fulfillProcurementRequest: (id: string) => Promise<void>;
  addProductionLog: (l: ProductionLog) => void;
  addSale: (s: Sale) => void;
  addFinancialTransaction: (t: Omit<FinancialTransaction, 'id'>) => Promise<void>;
  updateFinancialTransaction: (
    id: string,
    updates: Partial<Omit<FinancialTransaction, 'id'>>,
    reason: string
  ) => Promise<{ emailWarning?: string }>;
  deleteFinancialTransaction: (id: string, reason: string) => Promise<{ emailWarning?: string }>;
  updateCurrencyCode: (code: CurrencyCode, reason: string) => Promise<{ emailWarning?: string }>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  addStarterKit: (k: StarterKit) => void;
  addAlumniFollowUp: (f: AlumniFollowUp) => void;
  addJobPlacement: (p: JobPlacement) => void;
  addTraineeInterview: (
    input: Omit<TraineeInterview, 'id' | 'createdAt' | 'totalScore'>
  ) => Promise<TraineeInterview>;
  updateTraineeInterview: (
    id: string,
    updates: Partial<Omit<TraineeInterview, 'id' | 'createdAt'>>
  ) => Promise<void>;
  deleteTraineeInterview: (id: string) => Promise<void>;
  addBatch: (b: Omit<Batch, 'id'>) => Promise<void>;
  updateBatch: (id: string, updates: Partial<Batch>) => Promise<void>;
  pauseBatch: (id: string) => Promise<void>;
  resumeBatch: (id: string) => Promise<void>;
  deleteBatch: (id: string) => Promise<void>;
}

export const useStore = create<VTMSState>()(
  persist(
    (set, get) => ({
      batches: [],
      trainees: [],
      modules: SEED_MODULES,
      competencyAssessments: SEED_COMPETENCY_ASSESSMENTS,
      attendanceRecords: SEED_ATTENDANCE,
      caseNotes: SEED_CASE_NOTES,
      inventoryItems: [],
      inventoryUsage: [],
      procurementRequests: [],
      productionLogs: SEED_PRODUCTION_LOGS,
      sales: SEED_SALES,
      financialTransactions: SEED_FINANCIALS,
      starterKits: SEED_STARTER_KITS,
      alumniFollowUps: SEED_ALUMNI_FOLLOWUPS,
      jobPlacements: SEED_JOB_PLACEMENTS,
      traineeInterviews: [],
      currencyCode: 'USD',
      notifications: [],
      activeBatchId: '',
      dataLoaded: false,

      fetchInitialData: async () => {
        const [
          batchResult,
          traineeResult,
          itemsResult,
          usageResult,
          procurementResult,
          interviewResult,
          financialResult,
          settingsResult,
          notificationsResult,
        ] = await Promise.all([
          supabase.from('batches').select(BATCH_SELECT).order('start_date', { ascending: false }),
          supabase.from('trainees').select('*'),
          supabase.from('inventory_items').select('*').order('name'),
          supabase.from('inventory_usage').select('*').order('usage_date', { ascending: false }),
          supabase.from('procurement_requests').select(PROCUREMENT_SELECT).order('created_at', { ascending: false }),
          supabase.from('trainee_interviews').select('*').order('interview_date', { ascending: false }),
          supabase.from('financial_transactions').select('*').order('transaction_date', { ascending: false }),
          supabase.from('app_settings').select('currency_code').eq('id', 'org').maybeSingle(),
          supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
        ]);

        // Batches/trainees are required; inventory/procurement soft-fail so a
        // missing column/FK never leaves the shell stuck on the preloader.
        if (batchResult.error) throw batchResult.error;
        if (traineeResult.error) throw traineeResult.error;
        if (itemsResult.error) console.warn('inventory_items load failed', itemsResult.error);
        if (usageResult.error) console.warn('inventory_usage load failed', usageResult.error);
        if (procurementResult.error) console.warn('procurement_requests load failed', procurementResult.error);
        if (interviewResult.error) console.warn('trainee_interviews load failed', interviewResult.error);
        if (financialResult.error) console.warn('financial_transactions load failed', financialResult.error);
        if (settingsResult.error) console.warn('app_settings load failed', settingsResult.error);
        if (notificationsResult.error) console.warn('notifications load failed', notificationsResult.error);

        const batches = (batchResult.data ?? []).map((r) => batchFromRow(r as BatchRow));
        const trainees = (traineeResult.data ?? []).map((r) => traineeFromRow(r as TraineeRow));
        const inventoryItems = itemsResult.error
          ? []
          : (itemsResult.data ?? []).map((r) => inventoryItemFromRow(r as InventoryItemRow));
        const inventoryUsage = usageResult.error
          ? []
          : (usageResult.data ?? []).map((r) => inventoryUsageFromRow(r as InventoryUsageRow));
        const procurementRequests = procurementResult.error
          ? []
          : await mapProcurementRows((procurementResult.data ?? []) as ProcurementRequestRow[]);
        const traineeInterviews = interviewResult.error
          ? []
          : (interviewResult.data ?? []).map((r) => interviewFromRow(r as TraineeInterviewRow));
        const financialTransactions = financialResult.error
          ? []
          : (financialResult.data ?? []).map((r) => financialFromRow(r as FinancialTransactionRow));
        const currencyCode = (settingsResult.data?.currency_code as CurrencyCode | undefined) ?? 'USD';
        setDisplayCurrency(currencyCode);
        const notifications = notificationsResult.error
          ? []
          : (notificationsResult.data ?? []).map((r) => notificationFromRow(r as NotificationRow));
        const currentActive = get().activeBatchId;
        const activeBatchId = batches.some((b) => b.id === currentActive)
          ? currentActive
          : (batches[0]?.id ?? '');

        set({
          batches,
          trainees,
          inventoryItems,
          inventoryUsage,
          procurementRequests,
          traineeInterviews,
          financialTransactions,
          currencyCode,
          notifications,
          activeBatchId,
          dataLoaded: true,
        });
      },

      resetSessionData: () => set({
        batches: [],
        trainees: [],
        inventoryItems: [],
        inventoryUsage: [],
        procurementRequests: [],
        traineeInterviews: [],
        financialTransactions: [],
        currencyCode: 'USD',
        notifications: [],
        activeBatchId: '',
        dataLoaded: false,
      }),

      setActiveBatch: (id) => set({ activeBatchId: id }),

      addBatch: async (b) => {
        if (!b.trades.length) throw new Error('Select at least one trade for the batch.');
        const { data, error } = await supabase.from('batches').insert(batchCoreToRow(b)).select('id').single();
        if (error) throw error;
        const batchId = data.id as string;
        const { error: tradesError } = await supabase.from('batch_trades').insert(
          b.trades.map((t) => ({
            batch_id: batchId,
            trade: t.trade,
            trainer_id: emptyToNull(t.trainerId),
          }))
        );
        if (tradesError) {
          await supabase.from('batches').delete().eq('id', batchId);
          throw tradesError;
        }
        const { data: full, error: reloadError } = await supabase
          .from('batches')
          .select(BATCH_SELECT)
          .eq('id', batchId)
          .single();
        if (reloadError) throw reloadError;
        const batch = batchFromRow(full as BatchRow);
        set((s) => ({ batches: [...s.batches, batch] }));
      },

      updateBatch: async (id, updates) => {
        const current = get().batches.find((b) => b.id === id);
        if (!current) throw new Error(`Batch ${id} not found`);
        const merged: Batch = {
          ...current,
          ...updates,
          ...(updates.status !== undefined ? { status: updates.status as BatchStatus } : {}),
        };
        const { error } = await supabase.from('batches').update(batchCoreToRow(merged)).eq('id', id);
        if (error) throw error;
        if (updates.trades !== undefined) {
          try {
            const { error: delError } = await supabase.from('batch_trades').delete().eq('batch_id', id);
            if (delError) throw delError;
            if (updates.trades.length) {
              const { error: insError } = await supabase.from('batch_trades').insert(
                updates.trades.map((t) => ({
                  batch_id: id,
                  trade: t.trade,
                  trainer_id: emptyToNull(t.trainerId),
                }))
              );
              if (insError) throw insError;
            }
          } catch (err) {
            throw new Error(`Failed to update batch trades: ${friendlyError(err, 'Update failed')}`);
          }
        }
        const { data: full, error: reloadError } = await supabase
          .from('batches')
          .select(BATCH_SELECT)
          .eq('id', id)
          .single();
        if (reloadError) throw reloadError;
        const batch = batchFromRow(full as BatchRow);
        set((s) => ({ batches: s.batches.map((b) => (b.id === id ? batch : b)) }));
      },

      pauseBatch: async (id) => {
        const { error } = await supabase.from('batches').update({ status: 'paused' }).eq('id', id);
        if (error) throw error;
        set((s) => ({
          batches: s.batches.map((b) => (b.id === id ? { ...b, status: 'paused' as const } : b)),
        }));
      },

      resumeBatch: async (id) => {
        const current = get().batches.find((b) => b.id === id);
        if (!current) throw new Error(`Batch ${id} not found`);
        const status = resumeBatchStatus(current.startDate);
        const { error } = await supabase.from('batches').update({ status }).eq('id', id);
        if (error) throw error;
        set((s) => ({
          batches: s.batches.map((b) => (b.id === id ? { ...b, status } : b)),
        }));
      },

      deleteBatch: async (id) => {
        const current = get().batches.find((b) => b.id === id);
        if (!current) throw new Error(`Batch ${id} not found`);
        const counts = await countBatchDependencies(id);
        assertNoDependencies(current.name, counts);
        const { error: tradesErr } = await supabase.from('batch_trades').delete().eq('batch_id', id);
        if (tradesErr) throw tradesErr;
        const { error } = await supabase.from('batches').delete().eq('id', id);
        if (error) throw error;
        set((s) => ({
          batches: s.batches.filter((b) => b.id !== id),
          activeBatchId: s.activeBatchId === id ? (s.batches.find((b) => b.id !== id)?.id ?? '') : s.activeBatchId,
        }));
      },

      addTrainee: async (t) => {
        if (!t.batchId?.trim()) {
          throw new Error('Select a batch before registering a trainee.');
        }
        const batch = get().batches.find((b) => b.id === t.batchId);
        if (!batch) {
          throw new Error('That batch no longer exists. Pick a current batch and try again.');
        }
        if (batch.status === 'paused') {
          throw new Error('This batch is paused. Resume it before registering new trainees.');
        }
        if (batch.status === 'completed' || batch.status === 'archived') {
          throw new Error('Cannot register trainees into a completed or archived batch.');
        }
        if (!t.trade || !batch.trades.some((x) => x.trade === t.trade)) {
          throw new Error('Select a trade offered in this batch.');
        }
        if (!t.dateOfBirth?.trim()) {
          throw new Error('Date of birth is required.');
        }
        const { data, error } = await supabase.from('trainees').insert(traineeToRow(t)).select().single();
        if (error) throw error;
        const trainee = traineeFromRow(data as TraineeRow);
        set((s) => ({ trainees: [...s.trainees, trainee] }));
      },

      updateTrainee: async (id, updates) => {
        const current = get().trainees.find((t) => t.id === id);
        if (!current) throw new Error(`Trainee ${id} not found`);
        if (current.status === 'paused' && updates.batchId && updates.batchId !== current.batchId) {
          throw new Error('Resume this trainee before moving them to another batch.');
        }
        const merged = { ...current, ...updates };
        const { data, error } = await supabase.from('trainees').update(traineeToRow(merged)).eq('id', id).select().single();
        if (error) throw error;
        const trainee = traineeFromRow(data as TraineeRow);
        set((s) => ({ trainees: s.trainees.map((t) => (t.id === id ? trainee : t)) }));
      },

      pauseTrainee: async (id) => {
        const { data, error } = await supabase.from('trainees').update({ status: 'paused' }).eq('id', id).select().single();
        if (error) throw error;
        const trainee = traineeFromRow(data as TraineeRow);
        set((s) => ({ trainees: s.trainees.map((t) => (t.id === id ? trainee : t)) }));
      },

      resumeTrainee: async (id) => {
        const current = get().trainees.find((t) => t.id === id);
        if (!current) throw new Error(`Trainee ${id} not found`);
        const status = resumeTraineeStatus(Boolean(current.batchId?.trim()));
        const { data, error } = await supabase.from('trainees').update({ status }).eq('id', id).select().single();
        if (error) throw error;
        const trainee = traineeFromRow(data as TraineeRow);
        set((s) => ({ trainees: s.trainees.map((t) => (t.id === id ? trainee : t)) }));
      },

      deleteTrainee: async (id) => {
        const current = get().trainees.find((t) => t.id === id);
        if (!current) throw new Error(`Trainee ${id} not found`);
        const counts = await countTraineeDependencies(id);
        assertNoDependencies(`${current.firstName} ${current.lastName}`, counts);
        const { error } = await supabase.from('trainees').delete().eq('id', id);
        if (error) throw error;
        set((s) => ({ trainees: s.trainees.filter((t) => t.id !== id) }));
      },

      logAttendance: (records) => set((s) => {
        const existing = s.attendanceRecords.filter(
          (r) => !records.some((nr) => nr.traineeId === r.traineeId && nr.date === r.date)
        );
        return { attendanceRecords: [...existing, ...records] };
      }),
      addCompetencyAssessment: (a) => set((s) => ({ competencyAssessments: [...s.competencyAssessments, a] })),
      addCaseNote: (n) => set((s) => ({ caseNotes: [...s.caseNotes, n] })),

      addInventoryItem: async (item) => {
        const { data, error } = await supabase
          .from('inventory_items')
          .insert(inventoryItemToRow(item))
          .select()
          .single();
        if (error) throw error;
        set((s) => ({ inventoryItems: [...s.inventoryItems, inventoryItemFromRow(data as InventoryItemRow)] }));
      },

      updateInventoryItem: async (id, updates) => {
        const current = get().inventoryItems.find((i) => i.id === id);
        if (!current) throw new Error(`Inventory item ${id} not found`);
        const merged = { ...current, ...updates };
        const { data, error } = await supabase
          .from('inventory_items')
          .update(inventoryItemToRow(merged))
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        set((s) => ({
          inventoryItems: s.inventoryItems.map((i) =>
            i.id === id ? inventoryItemFromRow(data as InventoryItemRow) : i
          ),
        }));
      },

      logInventoryUsage: async (usage) => {
        const item = get().inventoryItems.find((i) => i.id === usage.itemId);
        if (!item) throw new Error('Inventory item not found');
        if (usage.quantityUsed > item.quantityOnHand) {
          throw new Error(`Only ${item.quantityOnHand} ${item.unit} available`);
        }
        const newQty = item.quantityOnHand - usage.quantityUsed;
        const { error: stockError } = await supabase
          .from('inventory_items')
          .update({ quantity_on_hand: newQty })
          .eq('id', usage.itemId);
        if (stockError) throw stockError;

        const { data, error } = await supabase
          .from('inventory_usage')
          .insert({
            item_id: usage.itemId,
            batch_id: emptyToNull(usage.batchId),
            trainee_id: emptyToNull(usage.traineeId),
            quantity_used: usage.quantityUsed,
            usage_date: usage.usageDate,
            purpose: usage.purpose,
          })
          .select()
          .single();
        if (error) {
          await supabase
            .from('inventory_items')
            .update({ quantity_on_hand: item.quantityOnHand })
            .eq('id', usage.itemId);
          throw error;
        }

        set((s) => ({
          inventoryItems: s.inventoryItems.map((i) =>
            i.id === usage.itemId ? { ...i, quantityOnHand: newQty } : i
          ),
          inventoryUsage: [inventoryUsageFromRow(data as InventoryUsageRow), ...s.inventoryUsage],
        }));
      },

      addProcurementRequest: async (input) => {
        const item = get().inventoryItems.find((i) => i.id === input.itemId);
        if (!item) throw new Error('Inventory item not found');
        const { data: auth } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from('procurement_requests')
          .insert({
            item_id: input.itemId,
            quantity_requested: input.quantityRequested,
            estimated_cost: input.estimatedCost,
            status: 'pending',
            requested_by: auth.user?.id ?? null,
          })
          .select(PROCUREMENT_SELECT)
          .single();
        if (error) throw error;
        const [mapped] = await mapProcurementRows([data as ProcurementRequestRow]);
        set((s) => ({
          procurementRequests: [mapped, ...s.procurementRequests],
        }));
      },

      updateProcurementRequest: async (id, updates) => {
        const current = get().procurementRequests.find((r) => r.id === id);
        if (!current) throw new Error(`Procurement request ${id} not found`);
        const row: Record<string, unknown> = {};
        if (updates.status) row.status = updates.status;
        if (updates.status === 'approved') {
          const { data: auth } = await supabase.auth.getUser();
          row.approved_by = auth.user?.id ?? null;
        }
        const { data, error } = await supabase
          .from('procurement_requests')
          .update(row)
          .eq('id', id)
          .select(PROCUREMENT_SELECT)
          .single();
        if (error) throw error;
        const [mapped] = await mapProcurementRows([data as ProcurementRequestRow]);
        set((s) => ({
          procurementRequests: s.procurementRequests.map((r) =>
            r.id === id ? mapped : r
          ),
        }));
      },

      fulfillProcurementRequest: async (id) => {
        const req = get().procurementRequests.find((r) => r.id === id);
        if (!req) throw new Error(`Procurement request ${id} not found`);
        if (req.status === 'purchased' || req.status === 'cancelled') {
          throw new Error('This request can no longer be marked purchased.');
        }
        const item = get().inventoryItems.find((i) => i.id === req.itemId);
        if (!item) throw new Error('Linked inventory item not found');

        const newQty = item.quantityOnHand + req.quantityRequested;
        const { error: stockError } = await supabase
          .from('inventory_items')
          .update({ quantity_on_hand: newQty })
          .eq('id', req.itemId);
        if (stockError) throw stockError;

        const { data: auth } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from('procurement_requests')
          .update({
            status: 'purchased',
            approved_by: auth.user?.id ?? null,
          })
          .eq('id', id)
          .select(PROCUREMENT_SELECT)
          .single();
        if (error) {
          await supabase
            .from('inventory_items')
            .update({ quantity_on_hand: item.quantityOnHand })
            .eq('id', req.itemId);
          throw error;
        }

        const [mapped] = await mapProcurementRows([data as ProcurementRequestRow]);
        set((s) => ({
          procurementRequests: s.procurementRequests.map((r) =>
            r.id === id ? mapped : r
          ),
          inventoryItems: s.inventoryItems.map((i) =>
            i.id === req.itemId ? { ...i, quantityOnHand: newQty } : i
          ),
        }));
      },

      addProductionLog: (l) => set((s) => ({ productionLogs: [...s.productionLogs, l] })),
      addSale: (sl) => set((s) => ({ sales: [...s.sales, sl] })),
      addFinancialTransaction: async (t) => {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from('financial_transactions')
          .insert(financialToRow(t, user?.id ?? null))
          .select('*')
          .single();
        if (error) throw error;
        const created = financialFromRow(data as FinancialTransactionRow);
        set((s) => ({ financialTransactions: [created, ...s.financialTransactions] }));
      },

      updateFinancialTransaction: async (id, updates, reason) => {
        const trimmed = reason.trim();
        if (!trimmed) throw new Error('A reason is required to change a transaction.');
        const current = get().financialTransactions.find((t) => t.id === id);
        if (!current) throw new Error('Transaction not found.');
        const merged: FinancialTransaction = { ...current, ...updates, id };
        const { data: { user } } = await supabase.auth.getUser();
        const row = financialToRow({
          batchId: merged.batchId,
          category: merged.category,
          type: merged.type,
          amount: merged.amount,
          description: merged.description,
          date: merged.date,
          donorName: merged.donorName,
        });
        const { data, error } = await supabase
          .from('financial_transactions')
          .update({
            ...row,
            updated_at: new Date().toISOString(),
            updated_by: user?.id ?? null,
          })
          .eq('id', id)
          .select('*')
          .single();
        if (error) throw error;
        const updated = financialFromRow(data as FinancialTransactionRow);
        const { error: logError } = await supabase.from('financial_change_log').insert({
          action: 'transaction_update',
          entity_type: 'financial_transaction',
          entity_id: id,
          old_values: current,
          new_values: updated,
          reason: trimmed,
          changed_by: user?.id ?? null,
        });
        if (logError) throw logError;
        set((s) => ({
          financialTransactions: s.financialTransactions.map((t) => (t.id === id ? updated : t)),
        }));
        const notify = await notifyFinancialChange({
          action: 'transaction_update',
          reason: trimmed,
          title: 'Financial transaction updated',
          body: `${updated.type} · ${updated.category} · ${updated.amount} (was ${current.amount})`,
          entityType: 'financial_transaction',
          entityId: id,
          oldValues: current as unknown as Record<string, unknown>,
          newValues: updated as unknown as Record<string, unknown>,
        });
        await get().refreshNotifications();
        return { emailWarning: notify.emailWarning };
      },

      deleteFinancialTransaction: async (id, reason) => {
        const trimmed = reason.trim();
        if (!trimmed) throw new Error('A reason is required to delete a transaction.');
        const current = get().financialTransactions.find((t) => t.id === id);
        if (!current) throw new Error('Transaction not found.');
        const { data: { user } } = await supabase.auth.getUser();
        const { error: logError } = await supabase.from('financial_change_log').insert({
          action: 'transaction_delete',
          entity_type: 'financial_transaction',
          entity_id: id,
          old_values: current,
          new_values: null,
          reason: trimmed,
          changed_by: user?.id ?? null,
        });
        if (logError) throw logError;
        const { error } = await supabase.from('financial_transactions').delete().eq('id', id);
        if (error) throw error;
        set((s) => ({
          financialTransactions: s.financialTransactions.filter((t) => t.id !== id),
        }));
        const notify = await notifyFinancialChange({
          action: 'transaction_delete',
          reason: trimmed,
          title: 'Financial transaction deleted',
          body: `${current.type} · ${current.category} · ${current.amount}`,
          entityType: 'financial_transaction',
          entityId: id,
          oldValues: current as unknown as Record<string, unknown>,
          newValues: null,
        });
        await get().refreshNotifications();
        return { emailWarning: notify.emailWarning };
      },

      updateCurrencyCode: async (code, reason) => {
        const trimmed = reason.trim();
        if (!trimmed) throw new Error('A reason is required to change currency.');
        const previous = get().currencyCode;
        if (previous === code) throw new Error('Currency is already set to that value.');
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
          .from('app_settings')
          .update({
            currency_code: code,
            updated_at: new Date().toISOString(),
            updated_by: user?.id ?? null,
          })
          .eq('id', 'org');
        if (error) throw error;
        const { error: logError } = await supabase.from('financial_change_log').insert({
          action: 'currency_change',
          entity_type: 'app_settings',
          entity_id: 'org',
          old_values: { currency_code: previous },
          new_values: { currency_code: code },
          reason: trimmed,
          changed_by: user?.id ?? null,
        });
        if (logError) throw logError;
        setDisplayCurrency(code);
        set({ currencyCode: code });
        const notify = await notifyFinancialChange({
          action: 'currency_change',
          reason: trimmed,
          title: 'Organisation currency changed',
          body: `Currency changed from ${previous} to ${code}. Historical amounts were not converted.`,
          entityType: 'app_settings',
          entityId: 'org',
          oldValues: { currency_code: previous },
          newValues: { currency_code: code },
        });
        await get().refreshNotifications();
        return { emailWarning: notify.emailWarning };
      },

      refreshNotifications: async () => {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) {
          console.warn('notifications refresh failed', error);
          return;
        }
        set({
          notifications: (data ?? []).map((r) => notificationFromRow(r as NotificationRow)),
        });
      },

      markNotificationRead: async (id) => {
        const { error } = await supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, readAt: new Date().toISOString() } : n
          ),
        }));
      },

      markAllNotificationsRead: async () => {
        const unread = get().notifications.filter((n) => !n.readAt).map((n) => n.id);
        if (!unread.length) return;
        const { error } = await supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .in('id', unread);
        if (error) throw error;
        const now = new Date().toISOString();
        set((s) => ({
          notifications: s.notifications.map((n) => (n.readAt ? n : { ...n, readAt: now })),
        }));
      },
      addStarterKit: (k) => set((s) => ({ starterKits: [...s.starterKits, k] })),
      addAlumniFollowUp: (f) => set((s) => ({ alumniFollowUps: [...s.alumniFollowUps, f] })),
      addJobPlacement: (p) => set((s) => ({ jobPlacements: [...s.jobPlacements, p] })),

      addTraineeInterview: async (input) => {
        const payload = interviewToRow(input);
        const { data, error } = await supabase
          .from('trainee_interviews')
          .insert(payload)
          .select('*')
          .single();
        if (error) throw error;
        const interview = interviewFromRow(data as TraineeInterviewRow);
        set((s) => ({ traineeInterviews: [interview, ...s.traineeInterviews] }));
        return interview;
      },

      updateTraineeInterview: async (id, updates) => {
        const current = get().traineeInterviews.find((i) => i.id === id);
        if (!current) throw new Error(`Interview ${id} not found`);
        const merged: TraineeInterview = {
          ...current,
          ...updates,
          responses: updates.responses
            ? { ...emptyInterviewResponses(), ...updates.responses }
            : current.responses,
          scores: updates.scores
            ? { ...emptyInterviewScores(), ...updates.scores }
            : current.scores,
        };
        merged.totalScore = computeInterviewTotal(merged.scores);
        const { data, error } = await supabase
          .from('trainee_interviews')
          .update(interviewToRow(merged))
          .eq('id', id)
          .select('*')
          .single();
        if (error) throw error;
        const interview = interviewFromRow(data as TraineeInterviewRow);
        set((s) => ({
          traineeInterviews: s.traineeInterviews.map((i) => (i.id === id ? interview : i)),
        }));
      },

      deleteTraineeInterview: async (id) => {
        const { error } = await supabase.from('trainee_interviews').delete().eq('id', id);
        if (error) throw error;
        set((s) => ({
          traineeInterviews: s.traineeInterviews.filter((i) => i.id !== id),
        }));
      },
    }),
    {
      name: 'vtms-store',
      // v6: financials + currency + notifications on Supabase.
      version: 6,
      migrate: (persisted) => {
        if (persisted && typeof persisted === 'object') {
          const state = persisted as Record<string, unknown>;
          delete state.batches;
          delete state.trainees;
          delete state.inventoryItems;
          delete state.inventoryUsage;
          delete state.procurementRequests;
          delete state.traineeInterviews;
          delete state.financialTransactions;
          delete state.currencyCode;
          delete state.notifications;
          delete state.dataLoaded;
        }
        return persisted as VTMSState;
      },
      // Server-sourced domains must not linger in localStorage across users.
      partialize: (s) => {
        const {
          batches: _batches,
          trainees: _trainees,
          inventoryItems: _inventoryItems,
          inventoryUsage: _inventoryUsage,
          procurementRequests: _procurementRequests,
          traineeInterviews: _traineeInterviews,
          financialTransactions: _financialTransactions,
          currencyCode: _currencyCode,
          notifications: _notifications,
          dataLoaded: _dataLoaded,
          ...rest
        } = s;
        return rest;
      },
    }
  )
);
