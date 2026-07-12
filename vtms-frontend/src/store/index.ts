import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type {
  Batch, Trainee, Module, CompetencyAssessment, AttendanceRecord,
  CaseNote, InventoryItem, InventoryUsage, ProcurementRequest,
  ProductionLog, Sale, FinancialTransaction, StarterKit,
  AlumniFollowUp, JobPlacement,
} from '../types';
import {
  SEED_MODULES, SEED_COMPETENCY_ASSESSMENTS,
  SEED_ATTENDANCE, SEED_CASE_NOTES, SEED_INVENTORY_ITEMS, SEED_INVENTORY_USAGE,
  SEED_PROCUREMENT_REQUESTS, SEED_PRODUCTION_LOGS, SEED_SALES, SEED_FINANCIALS,
  SEED_STARTER_KITS, SEED_ALUMNI_FOLLOWUPS, SEED_JOB_PLACEMENTS,
} from './seed';

// ---- Supabase row <-> app-model mapping (batches & trainees only —
// the other 12 domains stay local-seeded this phase) ----

interface BatchRow {
  id: string; name: string; trade: string; start_date: string; end_date: string | null;
  status: string; budget_allocated: string | number; target_enrollment: number;
  trainer_name: string; description: string | null;
}

function batchFromRow(row: BatchRow): Batch {
  return {
    id: row.id,
    name: row.name,
    trade: row.trade as Batch['trade'],
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status as Batch['status'],
    budgetAllocated: Number(row.budget_allocated),
    targetEnrollment: row.target_enrollment,
    trainerName: row.trainer_name,
    description: row.description ?? '',
  };
}

function batchToRow(b: Omit<Batch, 'id'>) {
  return {
    name: b.name,
    trade: b.trade,
    start_date: b.startDate,
    end_date: b.endDate,
    status: b.status,
    budget_allocated: b.budgetAllocated,
    target_enrollment: b.targetEnrollment,
    trainer_name: b.trainerName,
    description: b.description,
  };
}

interface TraineeRow {
  id: string; batch_id: string; first_name: string; last_name: string; date_of_birth: string;
  gender: string; phone_number: string; address: string; emergency_contact_name: string;
  emergency_contact_phone: string; mobilization_source: string; vulnerability_score: number;
  vulnerability_assessment: Trainee['vulnerabilityAssessment'] | null;
  status: string; graduation_date: string | null;
}

function traineeFromRow(row: TraineeRow): Trainee {
  return {
    id: row.id,
    batchId: row.batch_id,
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

function traineeToRow(t: Omit<Trainee, 'id' | 'photo'>) {
  return {
    batch_id: t.batchId,
    first_name: t.firstName,
    last_name: t.lastName,
    date_of_birth: t.dateOfBirth,
    gender: t.gender,
    phone_number: t.phone,
    address: t.address,
    emergency_contact_name: t.emergencyContact,
    emergency_contact_phone: t.emergencyPhone,
    mobilization_source: t.mobilizationSource,
    vulnerability_score: t.vulnerabilityScore,
    vulnerability_assessment: t.vulnerabilityAssessment,
    status: t.status,
    graduation_date: t.graduationDate,
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
  setActiveBatch: (id: string) => void;
  addTrainee: (t: Omit<Trainee, 'id'>) => Promise<void>;
  updateTrainee: (id: string, updates: Partial<Trainee>) => Promise<void>;
  logAttendance: (records: AttendanceRecord[]) => void;
  addCompetencyAssessment: (a: CompetencyAssessment) => void;
  addCaseNote: (n: CaseNote) => void;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => void;
  addProcurementRequest: (r: ProcurementRequest) => void;
  updateProcurementRequest: (id: string, updates: Partial<ProcurementRequest>) => void;
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
      inventoryItems: SEED_INVENTORY_ITEMS,
      inventoryUsage: SEED_INVENTORY_USAGE,
      procurementRequests: SEED_PROCUREMENT_REQUESTS,
      productionLogs: SEED_PRODUCTION_LOGS,
      sales: SEED_SALES,
      financialTransactions: SEED_FINANCIALS,
      starterKits: SEED_STARTER_KITS,
      alumniFollowUps: SEED_ALUMNI_FOLLOWUPS,
      jobPlacements: SEED_JOB_PLACEMENTS,
      activeBatchId: '',
      dataLoaded: false,

      fetchInitialData: async () => {
        const [batchResult, traineeResult] = await Promise.all([
          supabase.from('batches').select('*').order('start_date', { ascending: false }),
          supabase.from('trainees').select('*'),
        ]);

        if (batchResult.error) throw batchResult.error;
        if (traineeResult.error) throw traineeResult.error;

        const batches = (batchResult.data ?? []).map((r) => batchFromRow(r as BatchRow));
        const trainees = (traineeResult.data ?? []).map((r) => traineeFromRow(r as TraineeRow));
        const currentActive = get().activeBatchId;
        const activeBatchId = batches.some((b) => b.id === currentActive)
          ? currentActive
          : (batches[0]?.id ?? '');

        set({ batches, trainees, activeBatchId, dataLoaded: true });
      },

      setActiveBatch: (id) => set({ activeBatchId: id }),

      addBatch: async (b) => {
        const { data, error } = await supabase.from('batches').insert(batchToRow(b)).select().single();
        if (error) throw error;
        const batch = batchFromRow(data as BatchRow);
        set((s) => ({ batches: [...s.batches, batch] }));
      },

      updateBatch: async (id, updates) => {
        const current = get().batches.find((b) => b.id === id);
        if (!current) throw new Error(`Batch ${id} not found`);
        const merged = { ...current, ...updates };
        const { data, error } = await supabase.from('batches').update(batchToRow(merged)).eq('id', id).select().single();
        if (error) throw error;
        const batch = batchFromRow(data as BatchRow);
        set((s) => ({ batches: s.batches.map((b) => (b.id === id ? batch : b)) }));
      },

      addTrainee: async (t) => {
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
      updateInventoryItem: (id, updates) => set((s) => ({ inventoryItems: s.inventoryItems.map((i) => (i.id === id ? { ...i, ...updates } : i)) })),
      addProcurementRequest: (r) => set((s) => ({ procurementRequests: [...s.procurementRequests, r] })),
      updateProcurementRequest: (id, updates) => set((s) => ({ procurementRequests: s.procurementRequests.map((r) => (r.id === id ? { ...r, ...updates } : r)) })),
      addProductionLog: (l) => set((s) => ({ productionLogs: [...s.productionLogs, l] })),
      addSale: (sl) => set((s) => ({ sales: [...s.sales, sl] })),
      addFinancialTransaction: (t) => set((s) => ({ financialTransactions: [...s.financialTransactions, t] })),
      addStarterKit: (k) => set((s) => ({ starterKits: [...s.starterKits, k] })),
      addAlumniFollowUp: (f) => set((s) => ({ alumniFollowUps: [...s.alumniFollowUps, f] })),
      addJobPlacement: (p) => set((s) => ({ jobPlacements: [...s.jobPlacements, p] })),
    }),
    {
      name: 'vtms-store',
      version: 2,
      // batches/trainees are now server-sourced (per-user, RLS-scoped) —
      // caching them in localStorage risks showing a previously signed-in
      // user's data to whoever signs in next on the same browser.
      partialize: (s) => {
        const { batches: _batches, trainees: _trainees, dataLoaded: _dataLoaded, ...rest } = s;
        return rest;
      },
    }
  )
);
