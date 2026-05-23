import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Batch, Trainee, Module, CompetencyAssessment, AttendanceRecord,
  CaseNote, InventoryItem, InventoryUsage, ProcurementRequest,
  ProductionLog, Sale, FinancialTransaction, StarterKit,
  AlumniFollowUp, JobPlacement,
} from '../types';
import {
  SEED_BATCHES, SEED_TRAINEES, SEED_MODULES, SEED_COMPETENCY_ASSESSMENTS,
  SEED_ATTENDANCE, SEED_CASE_NOTES, SEED_INVENTORY_ITEMS, SEED_INVENTORY_USAGE,
  SEED_PROCUREMENT_REQUESTS, SEED_PRODUCTION_LOGS, SEED_SALES, SEED_FINANCIALS,
  SEED_STARTER_KITS, SEED_ALUMNI_FOLLOWUPS, SEED_JOB_PLACEMENTS,
} from './seed';

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

  // Actions
  setActiveBatch: (id: string) => void;
  addTrainee: (t: Trainee) => void;
  updateTrainee: (id: string, updates: Partial<Trainee>) => void;
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
  addBatch: (b: Batch) => void;
  updateBatch: (id: string, updates: Partial<Batch>) => void;
}

export const useStore = create<VTMSState>()(
  persist(
    (set) => ({
      batches: SEED_BATCHES,
      trainees: SEED_TRAINEES,
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
      activeBatchId: 'b5',

      setActiveBatch: (id) => set({ activeBatchId: id }),
      addBatch: (b) => set((s) => ({ batches: [...s.batches, b] })),
      updateBatch: (id, updates) => set((s) => ({ batches: s.batches.map((b) => b.id === id ? { ...b, ...updates } : b) })),
      addTrainee: (t) => set((s) => ({ trainees: [...s.trainees, t] })),
      updateTrainee: (id, updates) => set((s) => ({ trainees: s.trainees.map((t) => t.id === id ? { ...t, ...updates } : t) })),
      logAttendance: (records) => set((s) => {
        const existing = s.attendanceRecords.filter(
          (r) => !records.some((nr) => nr.traineeId === r.traineeId && nr.date === r.date)
        );
        return { attendanceRecords: [...existing, ...records] };
      }),
      addCompetencyAssessment: (a) => set((s) => ({ competencyAssessments: [...s.competencyAssessments, a] })),
      addCaseNote: (n) => set((s) => ({ caseNotes: [...s.caseNotes, n] })),
      updateInventoryItem: (id, updates) => set((s) => ({ inventoryItems: s.inventoryItems.map((i) => i.id === id ? { ...i, ...updates } : i) })),
      addProcurementRequest: (r) => set((s) => ({ procurementRequests: [...s.procurementRequests, r] })),
      updateProcurementRequest: (id, updates) => set((s) => ({ procurementRequests: s.procurementRequests.map((r) => r.id === id ? { ...r, ...updates } : r) })),
      addProductionLog: (l) => set((s) => ({ productionLogs: [...s.productionLogs, l] })),
      addSale: (sl) => set((s) => ({ sales: [...s.sales, sl] })),
      addFinancialTransaction: (t) => set((s) => ({ financialTransactions: [...s.financialTransactions, t] })),
      addStarterKit: (k) => set((s) => ({ starterKits: [...s.starterKits, k] })),
      addAlumniFollowUp: (f) => set((s) => ({ alumniFollowUps: [...s.alumniFollowUps, f] })),
      addJobPlacement: (p) => set((s) => ({ jobPlacements: [...s.jobPlacements, p] })),
    }),
    { name: 'vtms-store', version: 1 }
  )
);
