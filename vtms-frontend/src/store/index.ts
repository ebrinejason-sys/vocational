import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type {
  Batch, BatchTradeAssignment, Trainee, Module, CompetencyAssessment, AttendanceRecord,
  CaseNote, InventoryItem, InventoryUsage, ProcurementRequest,
  ProductionLog, Sale, FinancialTransaction, StarterKit,
  AlumniFollowUp, JobPlacement, TradeType,
} from '../types';
import {
  SEED_MODULES, SEED_COMPETENCY_ASSESSMENTS,
  SEED_ATTENDANCE, SEED_CASE_NOTES,
  SEED_PRODUCTION_LOGS, SEED_SALES, SEED_FINANCIALS,
  SEED_STARTER_KITS, SEED_ALUMNI_FOLLOWUPS, SEED_JOB_PLACEMENTS,
} from './seed';

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
    vulnerabilityAssessment: row.vulnerability_assessment ?? {
      housingStatus: 'rented', foodSecurity: 'adequate', previousEducation: 'primary',
      familyStatus: 'both_parents', hasDisability: false, disabilityDetails: '',
    },
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
  requester?: { full_name: string } | { full_name: string }[] | null;
}

const PROCUREMENT_SELECT =
  'id, item_id, quantity_requested, estimated_cost, status, requested_by, created_at, inventory_items(name), requester:profiles!procurement_requests_requested_by_fkey(full_name)';

function embedOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function procurementFromRow(row: ProcurementRequestRow): ProcurementRequest {
  const item = embedOne(row.inventory_items);
  const requester = embedOne(row.requester);
  return {
    id: row.id,
    itemId: row.item_id,
    itemName: item?.name ?? 'Unknown item',
    quantityRequested: Number(row.quantity_requested),
    estimatedCost: Number(row.estimated_cost ?? 0),
    status: row.status as ProcurementRequest['status'],
    requestedBy: requester?.full_name ?? 'Staff',
    createdAt: row.created_at.slice(0, 10),
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
  activeBatchId: string;
  dataLoaded: boolean;

  fetchInitialData: () => Promise<void>;
  resetSessionData: () => void;
  setActiveBatch: (id: string) => void;
  addTrainee: (t: Omit<Trainee, 'id'>) => Promise<void>;
  updateTrainee: (id: string, updates: Partial<Trainee>) => Promise<void>;
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
  addFinancialTransaction: (t: FinancialTransaction) => void;
  addStarterKit: (k: StarterKit) => void;
  addAlumniFollowUp: (f: AlumniFollowUp) => void;
  addJobPlacement: (p: JobPlacement) => void;
  addBatch: (b: Omit<Batch, 'id'>) => Promise<void>;
  updateBatch: (id: string, updates: Partial<Batch>) => Promise<void>;
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
      activeBatchId: '',
      dataLoaded: false,

      fetchInitialData: async () => {
        const [batchResult, traineeResult, itemsResult, usageResult, procurementResult] = await Promise.all([
          supabase.from('batches').select(BATCH_SELECT).order('start_date', { ascending: false }),
          supabase.from('trainees').select('*'),
          supabase.from('inventory_items').select('*').order('name'),
          supabase.from('inventory_usage').select('*').order('usage_date', { ascending: false }),
          supabase.from('procurement_requests').select(PROCUREMENT_SELECT).order('created_at', { ascending: false }),
        ]);

        if (batchResult.error) throw batchResult.error;
        if (traineeResult.error) throw traineeResult.error;
        if (itemsResult.error) throw itemsResult.error;
        if (usageResult.error) throw usageResult.error;
        if (procurementResult.error) throw procurementResult.error;

        const batches = (batchResult.data ?? []).map((r) => batchFromRow(r as BatchRow));
        const trainees = (traineeResult.data ?? []).map((r) => traineeFromRow(r as TraineeRow));
        const inventoryItems = (itemsResult.data ?? []).map((r) => inventoryItemFromRow(r as InventoryItemRow));
        const inventoryUsage = (usageResult.data ?? []).map((r) => inventoryUsageFromRow(r as InventoryUsageRow));
        const procurementRequests = (procurementResult.data ?? []).map((r) =>
          procurementFromRow(r as ProcurementRequestRow)
        );
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
        const merged = { ...current, ...updates };
        const { error } = await supabase.from('batches').update(batchCoreToRow(merged)).eq('id', id);
        if (error) throw error;
        if (updates.trades) {
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

      addTrainee: async (t) => {
        if (!t.batchId?.trim()) {
          throw new Error('Select a batch before registering a trainee.');
        }
        const batch = get().batches.find((b) => b.id === t.batchId);
        if (!batch) {
          throw new Error('That batch no longer exists. Pick a current batch and try again.');
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
        const merged = { ...current, ...updates };
        const { data, error } = await supabase.from('trainees').update(traineeToRow(merged)).eq('id', id).select().single();
        if (error) throw error;
        const trainee = traineeFromRow(data as TraineeRow);
        set((s) => ({ trainees: s.trainees.map((t) => (t.id === id ? trainee : t)) }));
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
        set((s) => ({
          procurementRequests: [procurementFromRow(data as ProcurementRequestRow), ...s.procurementRequests],
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
        set((s) => ({
          procurementRequests: s.procurementRequests.map((r) =>
            r.id === id ? procurementFromRow(data as ProcurementRequestRow) : r
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

        set((s) => ({
          procurementRequests: s.procurementRequests.map((r) =>
            r.id === id ? procurementFromRow(data as ProcurementRequestRow) : r
          ),
          inventoryItems: s.inventoryItems.map((i) =>
            i.id === req.itemId ? { ...i, quantityOnHand: newQty } : i
          ),
        }));
      },

      addProductionLog: (l) => set((s) => ({ productionLogs: [...s.productionLogs, l] })),
      addSale: (sl) => set((s) => ({ sales: [...s.sales, sl] })),
      addFinancialTransaction: (t) => set((s) => ({ financialTransactions: [...s.financialTransactions, t] })),
      addStarterKit: (k) => set((s) => ({ starterKits: [...s.starterKits, k] })),
      addAlumniFollowUp: (f) => set((s) => ({ alumniFollowUps: [...s.alumniFollowUps, f] })),
      addJobPlacement: (p) => set((s) => ({ jobPlacements: [...s.jobPlacements, p] })),
    }),
    {
      name: 'vtms-store',
      // v4: inventory/procurement move to Supabase — drop local copies.
      version: 4,
      // Server-sourced domains must not linger in localStorage across users.
      partialize: (s) => {
        const {
          batches: _batches,
          trainees: _trainees,
          inventoryItems: _inventoryItems,
          inventoryUsage: _inventoryUsage,
          procurementRequests: _procurementRequests,
          dataLoaded: _dataLoaded,
          ...rest
        } = s;
        return rest;
      },
    }
  )
);
