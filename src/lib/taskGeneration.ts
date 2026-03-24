import type { ReviewCase } from '@/types';

interface TaskTemplate {
  id: string;
  code: string;
  task_group: string;
  title: string;
  description: string;
  execution_instructions: string;
  default_assignee_role: string;
  default_approver_role: string;
  phase: string;
  execution_type: string;
  execution_phase: number;
  review_level_min: number;
  sort_order: number;
  instruction_step_count: number;
  execution_instructions_es?: string | null;
}

/**
 * Resolves a role string from a task template to the corresponding user UUID
 * from the review case. Falls back to system_owner_id for unassigned roles.
 */
export function resolveRoleToUserId(
  role: string,
  reviewCase: Pick<ReviewCase, 'system_owner_id' | 'system_admin_id' | 'qa_id' | 'business_owner_id' | 'it_manager_id'>
): string {
  const map: Record<string, string | undefined> = {
    system_owner: reviewCase.system_owner_id,
    system_administrator: reviewCase.system_admin_id,
    quality_assurance: reviewCase.qa_id,
    business_owner: reviewCase.business_owner_id,
    it_manager: reviewCase.it_manager_id,
  };

  const resolved = map[role];
  // Fallback to system_owner if the role is unassigned (null/empty)
  return resolved && resolved.trim() !== '' ? resolved : reviewCase.system_owner_id;
}

/**
 * Calculates task due_date based on phase offset from review case due date.
 * Enforces a minimum of today + 3 days — never creates already-overdue tasks.
 */
export function calculateTaskDueDate(
  phase: string,
  reviewCaseDueDate: string
): string {
  const PHASE_OFFSETS_DAYS: Record<string, number> = {
    initiation: 60,
    evidence_gathering: 30,
    ai_evaluation: 14,
    approval: 7,
  };

  const offset = PHASE_OFFSETS_DAYS[phase] ?? 14;
  const anchorDate = new Date(reviewCaseDueDate);
  const taskDate = new Date(anchorDate);
  taskDate.setDate(taskDate.getDate() - offset);

  // Minimum: today + 3 days
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 3);

  const finalDate = taskDate < minDate ? minDate : taskDate;
  return finalDate.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Builds review_tasks insert payloads from templates filtered by review level.
 * Never produces assigned_to = null (falls back to system_owner_id).
 */
export function buildTaskPayloads(
  templates: TaskTemplate[],
  reviewCase: ReviewCase,
  userId: string
) {
  const reviewLevel = parseInt(reviewCase.review_level);

  return templates
    .filter(t => t.review_level_min <= reviewLevel)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(template => ({
      review_case_id: reviewCase.id,
      template_id: template.id,
      task_group: template.task_group,
      title: template.title,
      description: template.description,
      execution_instructions: template.execution_instructions,
      execution_instructions_es: template.execution_instructions_es ?? null,
      execution_phase: template.execution_phase,
      instruction_step_count: template.instruction_step_count ?? 0,
      assigned_to: resolveRoleToUserId(template.default_assignee_role, reviewCase),
      approved_by_user: resolveRoleToUserId(template.default_approver_role, reviewCase),
      status: 'pending' as const,
      phase: template.phase,
      execution_type: template.execution_type,
      due_date: calculateTaskDueDate(template.phase, reviewCase.due_date),
      sort_order: template.sort_order,
      created_by: userId,
      updated_by: userId,
      is_deleted: false,
    }));
}
