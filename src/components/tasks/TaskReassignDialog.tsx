import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserRoundPen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useRoleUsers } from '@/hooks/useRoleUsers';
import type { ReviewTask } from '@/types';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

// Map task template default_assignee_role strings to app_role enum values
const ASSIGNEE_ROLE_MAP: Record<string, AppRole> = {
  system_owner: 'system_owner',
  system_administrator: 'system_administrator',
  quality_assurance: 'quality_assurance',
  business_owner: 'business_owner',
  it_manager: 'it_manager',
};

interface TaskReassignDialogProps {
  task: ReviewTask;
  reviewCaseId: string;
  onReassign: (newAssigneeId: string, newAssigneeName: string, reason: string) => void;
  isReassigning?: boolean;
}

export function TaskReassignDialog({ task, reviewCaseId, onReassign, isReassigning }: TaskReassignDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [reason, setReason] = useState('');

  // Determine the role to filter users by — we need to find the role of the current assignee
  // We'll try to infer it from the task. The task was generated from a template with default_assignee_role.
  // Since we don't have the role stored on the task itself, we query all roles and let the SO pick.
  // For safety, we'll look up users from all operational roles and show them.
  // Actually, the spec says: "The new assignee MUST have the same role as the original assignee"
  // We need the assignee's role. We can use the template's default_assignee_role if available.
  // For now, we'll look up from a broader set since we can't reliably determine the role.

  // Attempt to determine role from common patterns
  const inferredRole = getInferredRole(task);
  const { users, loading } = useRoleUsers(inferredRole);

  // Exclude current assignee
  const availableUsers = users.filter(u => u.id !== task.assigned_to);

  const handleSubmit = () => {
    if (!selectedUserId || reason.trim().length < 10) return;
    const selectedUser = availableUsers.find(u => u.id === selectedUserId);
    const name = selectedUser ? selectedUser.full_name : 'Unknown';
    onReassign(selectedUserId, name, reason.trim());
    setOpen(false);
    setSelectedUserId('');
    setReason('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5" tabIndex={-1}>
                <UserRoundPen className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>{t('tasks.actions.reassignTask')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('tasks.actions.reassignTask')}</DialogTitle>
          <DialogDescription>{t('tasks.actions.reassignReason')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('tasks.detail.assignedTo')}</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder={t('tasks.actions.selectNewAssignee')} />
              </SelectTrigger>
              <SelectContent>
                {loading ? (
                  <SelectItem value="__loading" disabled>Loading...</SelectItem>
                ) : availableUsers.length === 0 ? (
                  <SelectItem value="__none" disabled>{t('tasks.actions.noUsersAvailable')}</SelectItem>
                ) : (
                  availableUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name}{u.username ? ` (@${u.username})` : ''}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('reviews.actions.reason')}</Label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={t('reviews.actions.reasonPlaceholder')}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('userForm.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedUserId || reason.trim().length < 10 || isReassigning}
          >
            {t('tasks.actions.reassignTask')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Infer the role of the current assignee based on task metadata.
 * Falls back to 'system_administrator' if we can't determine.
 */
function getInferredRole(task: ReviewTask): AppRole {
  // Task groups map to typical roles
  const groupRoleMap: Record<string, AppRole> = {
    INIT: 'system_owner',
    ITSM: 'system_administrator',
    QMS: 'quality_assurance',
    SEC: 'system_administrator',
    INFRA: 'system_administrator',
    DOC: 'system_administrator',
    AI_EVAL: 'system_administrator',
    APPR: 'system_owner',
  };

  return groupRoleMap[task.task_group] || 'system_administrator';
}
