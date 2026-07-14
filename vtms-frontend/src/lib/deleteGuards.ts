import { supabase } from './supabase';

async function countEq(table: string, column: string, id: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(column, id);
  if (error) {
    throw error;
  }
  return count ?? 0;
}

/** Soft count: if RLS/table missing returns 0 and warns — use for optional domains. */
async function countEqSoft(table: string, column: string, id: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(column, id);
  if (error) {
    console.warn(`deleteGuards: ${table} count skipped`, error.message);
    return 0;
  }
  return count ?? 0;
}

export async function countBatchDependencies(batchId: string): Promise<Record<string, number>> {
  const [trainees, inventory_usage, production_logs, sales, financial_transactions] = await Promise.all([
    countEq('trainees', 'batch_id', batchId),
    countEqSoft('inventory_usage', 'batch_id', batchId),
    countEqSoft('production_logs', 'batch_id', batchId),
    countEqSoft('sales', 'batch_id', batchId),
    countEqSoft('financial_transactions', 'batch_id', batchId),
  ]);
  return { trainees, inventory_usage, production_logs, sales, financial_transactions };
}

export async function countTraineeDependencies(traineeId: string): Promise<Record<string, number>> {
  const [
    attendance,
    competency_assessments,
    case_notes,
    vulnerability_assessments,
    inventory_usage,
    starter_kits,
    alumni_follow_ups,
    job_placements,
  ] = await Promise.all([
    countEqSoft('attendance', 'trainee_id', traineeId),
    countEqSoft('competency_assessments', 'trainee_id', traineeId),
    countEqSoft('case_notes', 'trainee_id', traineeId),
    countEqSoft('vulnerability_assessments', 'trainee_id', traineeId),
    countEqSoft('inventory_usage', 'trainee_id', traineeId),
    countEqSoft('starter_kits', 'trainee_id', traineeId),
    countEqSoft('alumni_follow_ups', 'trainee_id', traineeId),
    countEqSoft('job_placements', 'trainee_id', traineeId),
  ]);
  return {
    attendance,
    competency_assessments,
    case_notes,
    vulnerability_assessments,
    inventory_usage,
    starter_kits,
    alumni_follow_ups,
    job_placements,
  };
}

export async function countTrainerDependencies(profileId: string): Promise<Record<string, number>> {
  const batch_assignments = await countEq('batch_trades', 'trainer_id', profileId);
  return { batch_assignments };
}
