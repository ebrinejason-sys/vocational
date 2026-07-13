import type {
  Module, CompetencyAssessment, AttendanceRecord, CaseNote,
  InventoryItem, InventoryUsage, ProcurementRequest, ProductionLog,
  Sale, FinancialTransaction, StarterKit, AlumniFollowUp, JobPlacement,
} from '../types';

// All demo/fictional data has been removed. Batches and trainees now live
// in Supabase; the domains below start empty and remain browser-local until
// each module is wired to its own Supabase table in a later phase.
// Real CBET curriculum modules will be entered per trade via the UI once
// module management ships (Phase 2 — Batch structure & setup).

export const SEED_MODULES: Module[] = [];
export const SEED_COMPETENCY_ASSESSMENTS: CompetencyAssessment[] = [];
export const SEED_ATTENDANCE: AttendanceRecord[] = [];
export const SEED_CASE_NOTES: CaseNote[] = [];
export const SEED_INVENTORY_ITEMS: InventoryItem[] = [];
export const SEED_INVENTORY_USAGE: InventoryUsage[] = [];
export const SEED_PROCUREMENT_REQUESTS: ProcurementRequest[] = [];
export const SEED_PRODUCTION_LOGS: ProductionLog[] = [];
export const SEED_SALES: Sale[] = [];
export const SEED_FINANCIALS: FinancialTransaction[] = [];
export const SEED_STARTER_KITS: StarterKit[] = [];
export const SEED_ALUMNI_FOLLOWUPS: AlumniFollowUp[] = [];
export const SEED_JOB_PLACEMENTS: JobPlacement[] = [];
