import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface IntraySuperUserFilterProps {
  selectedUserId: string;
  onUserChange: (userId: string) => void;
}

export function IntraySuperUserFilter({ selectedUserId, onUserChange }: IntraySuperUserFilterProps) {
  const { t } = useTranslation();

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users-list-intray'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_users_list');
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        <span>{t('intray.superUser.label')}</span>
      </div>
      <Select value={selectedUserId} onValueChange={onUserChange}>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder={t('intray.superUser.allUsers')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('intray.superUser.allUsers')}</SelectItem>
          {users.map((u) => (
            <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
