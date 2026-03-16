import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import type { SystemProfile } from '@/types';

interface UseSystemProfilesReturn {
  systems: SystemProfile[];
  loading: boolean;
  addSystem: (system: SystemProfile) => Promise<boolean>;
  updateSystem: (system: SystemProfile) => Promise<boolean>;
  deleteSystem: (id: string) => Promise<boolean>;
  refetch: () => void;
}

function rowToSystemProfile(row: any): SystemProfile {
  return {
    id: row.id,
    name: row.name,
    system_identifier: row.system_identifier,
    system_environment: row.system_environment,
    gamp_category: row.gamp_category,
    description: row.description ?? '',
    intended_use: row.intended_use ?? '',
    gxp_classification: row.gxp_classification,
    risk_level: row.risk_level,
    status: row.status,
    vendor_name: row.vendor_name ?? '',
    vendor_contact: row.vendor_contact ?? '',
    vendor_contract_ref: row.vendor_contract_ref ?? '',
    owner_id: row.owner_id ?? '',
    system_owner_id: row.system_owner_id ?? '',
    system_admin_id: row.system_admin_id ?? '',
    qa_id: row.qa_id ?? '',
    it_manager_id: row.it_manager_id ?? undefined,
    validation_date: row.validation_date,
    review_period_months: row.review_period_months,
    next_review_date: row.next_review_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function useSystemProfiles(): UseSystemProfilesReturn {
  const { user } = useAuth();
  const [systems, setSystems] = useState<SystemProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const fetchSystems = useCallback(async () => {
    if (!user) {
      setSystems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('system_profiles')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSystems((data ?? []).map(rowToSystemProfile));
    } catch (err: any) {
      console.error('Failed to fetch system profiles:', err);
      toastRef.current({
        title: 'Error loading systems',
        description: err.message ?? 'Could not load system profiles.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSystems();
  }, [fetchSystems]);

  const addSystem = useCallback(async (system: SystemProfile): Promise<boolean> => {
    if (!user) return false;
    try {
      const { error } = await supabase.from('system_profiles').insert({
        id: system.id,
        name: system.name,
        system_identifier: system.system_identifier,
        system_environment: system.system_environment,
        gamp_category: system.gamp_category,
        description: system.description,
        intended_use: system.intended_use,
        gxp_classification: system.gxp_classification,
        risk_level: system.risk_level,
        status: system.status,
        vendor_name: system.vendor_name,
        vendor_contact: system.vendor_contact,
        vendor_contract_ref: system.vendor_contract_ref,
        owner_id: system.owner_id,
        system_owner_id: system.system_owner_id,
        system_admin_id: system.system_admin_id,
        qa_id: system.qa_id,
        it_manager_id: system.it_manager_id ?? null,
        validation_date: system.validation_date,
        review_period_months: system.review_period_months,
        next_review_date: system.next_review_date,
        created_by: user.id,
      });
      if (error) throw error;
      await fetchSystems();
      return true;
    } catch (err: any) {
      console.error('Failed to create system profile:', err);
      toastRef.current({
        title: 'Error creating system',
        description: err.message ?? 'Could not save the system profile.',
        variant: 'destructive',
      });
      return false;
    }
  }, [user, fetchSystems]);

  const updateSystem = useCallback(async (system: SystemProfile): Promise<boolean> => {
    if (!user) return false;
    try {
      const { error } = await supabase.from('system_profiles').update({
        name: system.name,
        system_identifier: system.system_identifier,
        system_environment: system.system_environment,
        gamp_category: system.gamp_category,
        description: system.description,
        intended_use: system.intended_use,
        gxp_classification: system.gxp_classification,
        risk_level: system.risk_level,
        status: system.status,
        vendor_name: system.vendor_name,
        vendor_contact: system.vendor_contact,
        vendor_contract_ref: system.vendor_contract_ref,
        owner_id: system.owner_id,
        system_owner_id: system.system_owner_id,
        system_admin_id: system.system_admin_id,
        qa_id: system.qa_id,
        it_manager_id: system.it_manager_id ?? null,
        validation_date: system.validation_date,
        review_period_months: system.review_period_months,
        next_review_date: system.next_review_date,
        updated_by: user.id,
      }).eq('id', system.id);
      if (error) throw error;
      await fetchSystems();
      return true;
    } catch (err: any) {
      console.error('Failed to update system profile:', err);
      toastRef.current({
        title: 'Error updating system',
        description: err.message ?? 'Could not update the system profile.',
        variant: 'destructive',
      });
      return false;
    }
  }, [user, fetchSystems]);

  const deleteSystem = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const { error } = await supabase.from('system_profiles').update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
      }).eq('id', id);
      if (error) throw error;
      await fetchSystems();
      return true;
    } catch (err: any) {
      console.error('Failed to delete system profile:', err);
      toastRef.current({
        title: 'Error deleting system',
        description: err.message ?? 'Could not delete the system profile.',
        variant: 'destructive',
      });
      return false;
    }
  }, [user, fetchSystems]);

  return { systems, loading, addSystem, updateSystem, deleteSystem, refetch: fetchSystems };
}
