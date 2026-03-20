import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { PROFILE_APPROVAL_STATUS_CONFIG } from '@/lib/profileApprovalWorkflow';
import type { ProfileApprovalStatus } from '@/types';

interface Props {
  status: ProfileApprovalStatus;
  className?: string;
}

export function ProfileApprovalBadge({ status, className }: Props) {
  const { t } = useTranslation();
  const config = PROFILE_APPROVAL_STATUS_CONFIG[status];
  if (!config) return null;

  return (
    <Badge variant="outline" className={`${config.className} ${className ?? ''}`}>
      {t(config.labelKey, { defaultValue: config.label })}
    </Badge>
  );
}
