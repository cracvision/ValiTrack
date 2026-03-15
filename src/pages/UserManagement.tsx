import { useAuth } from '@/hooks/useAuth';
import { UserManagement } from '@/components/admin/UserManagement';

export default function UserManagementPage() {
  const { user } = useAuth();

  if (!user) return null;

  return <UserManagement currentUserId={user.id} />;
}
