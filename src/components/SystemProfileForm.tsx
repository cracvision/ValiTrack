import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemWithDescription,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useRoleUsers, type RoleUser } from '@/hooks/useRoleUsers';
import {
  GXP_OPTIONS,
  getReviewPeriod,
  SYSTEM_ENVIRONMENT_OPTIONS,
  GAMP_CATEGORY_OPTIONS,
  suggestReviewLevel,
} from '@/lib/gxpClassifications';
import type { SystemProfile, SystemEnvironment, GxPClassification, RiskLevel, SystemStatus, GampCategory } from '@/types';

const riskLevels: RiskLevel[] = ['High', 'Medium', 'Low'];
const systemStatuses: SystemStatus[] = ['Active', 'Retired', 'Under Validation'];

const gxpValues = GXP_OPTIONS.map((o) => o.value) as [string, ...string[]];

const formSchema = z.object({
  name: z.string().trim().min(1, 'System name is required').max(200),
  system_identifier: z.string().trim().min(1, 'System identifier is required').max(50),
  system_environment: z.enum(['manufacturing', 'laboratory', 'quality', 'enterprise', 'clinical', 'infrastructure']),
  description: z.string().trim().max(1000).optional().default(''),
  intended_use: z.string().trim().min(1, 'Intended use is required').max(2000),
  gxp_classification: z.enum(gxpValues) as z.ZodEnum<[GxPClassification, ...GxPClassification[]]>,
  risk_level: z.enum(['High', 'Medium', 'Low']),
  gamp_category: z.enum(['1', '3', '4', '5']),
  status: z.enum(['Active', 'Retired', 'Under Validation']),
  vendor_name: z.string().trim().min(1, 'Vendor name is required').max(200),
  vendor_contact: z.string().trim().max(200).optional().default(''),
  vendor_contract_ref: z.string().trim().max(100).optional().default(''),
  initial_validation_date: z.string().min(1, 'Validation date is required'),
  last_review_period_end: z.string().optional().default(''),
  review_period_months: z.coerce.number().min(1, 'Must be at least 1 month').max(120, 'Cannot exceed 120 months'),
  completion_window_days: z.coerce.number().min(30, 'Minimum 30 days').max(180, 'Maximum 180 days').default(90),
  system_owner_id: z.string().min(1, 'System Owner is required'),
  system_admin_id: z.string().min(1, 'System Administrator is required'),
  qa_id: z.string().min(1, 'Quality Assurance is required'),
  it_manager_id: z.string().optional().default(''),
  business_owner_id: z.string().optional().default(''),
}).refine((data) => data.system_owner_id !== data.qa_id, {
  message: 'System Owner and QA cannot be the same person (separation of duties)',
  path: ['qa_id'],
});

type FormValues = z.infer<typeof formSchema>;

function calculateNextReviewDate(initialValidationDate: string, periodMonths: number, lastReviewPeriodEnd?: string | null): string {
  const anchor = lastReviewPeriodEnd || initialValidationDate;
  const date = new Date(anchor);
  date.setMonth(date.getMonth() + periodMonths);
  return date.toISOString().split('T')[0];
}

function formatUserLabel(user: RoleUser): string {
  return user.username ? `${user.full_name} (@${user.username})` : user.full_name;
}

interface RoleSelectFieldProps {
  form: ReturnType<typeof useForm<FormValues>>;
  name: 'system_owner_id' | 'system_admin_id' | 'qa_id' | 'business_owner_id' | 'it_manager_id';
  label: string;
  users: RoleUser[];
  loading: boolean;
  required?: boolean;
  loadingText: string;
  noUsersText: string;
  selectText: string;
}

function RoleSelectField({ form, name, label, users, loading, required, loadingText, noUsersText, selectText }: RoleSelectFieldProps) {
  const hasUsers = users.length > 0;
  return (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}{required ? ' *' : ''}</FormLabel>
        <Select
          onValueChange={field.onChange}
          value={field.value || undefined}
          disabled={loading || !hasUsers}
        >
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder={loading ? loadingText : !hasUsers ? noUsersText : selectText} />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            {!required && hasUsers && (
              <SelectItem value="__none__">— None —</SelectItem>
            )}
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {formatUserLabel(user)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )} />
  );
}

interface SystemProfileFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (system: SystemProfile) => void;
  editingSystem?: SystemProfile | null;
}

export function SystemProfileForm({ open, onOpenChange, onSubmit, editingSystem }: SystemProfileFormProps) {
  const { t } = useTranslation();
  const { users: systemOwners, loading: loadingOwners } = useRoleUsers('system_owner');
  const { users: systemAdmins, loading: loadingAdmins } = useRoleUsers('system_administrator');
  const { users: qaUsers, loading: loadingQA } = useRoleUsers('quality_assurance');
  const { users: itManagers, loading: loadingIT } = useRoleUsers('it_manager');
  const { users: businessOwners, loading: loadingBO } = useRoleUsers('business_owner');

  const [autoValue, setAutoValue] = useState<number | null>(null);
  const [flashPeriod, setFlashPeriod] = useState(false);
  const [flashReviewLevel, setFlashReviewLevel] = useState(false);
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [identifierChecking, setIdentifierChecking] = useState(false);
  const identifierTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMount = useRef(true);
  const isInitialReviewLevel = useRef(true);

  // Guard: only reset form once per open session, immune to re-renders
  const hasInitializedRef = useRef(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: editingSystem
      ? {
          name: editingSystem.name,
          system_identifier: editingSystem.system_identifier,
          system_environment: editingSystem.system_environment,
          description: editingSystem.description,
          intended_use: editingSystem.intended_use,
          gxp_classification: editingSystem.gxp_classification,
          risk_level: editingSystem.risk_level,
          gamp_category: editingSystem.gamp_category,
          status: editingSystem.status,
          vendor_name: editingSystem.vendor_name,
          vendor_contact: editingSystem.vendor_contact,
          vendor_contract_ref: editingSystem.vendor_contract_ref,
          initial_validation_date: editingSystem.initial_validation_date,
          last_review_period_end: editingSystem.last_review_period_end ?? '',
          review_period_months: editingSystem.review_period_months,
          completion_window_days: editingSystem.completion_window_days,
          system_owner_id: editingSystem.system_owner_id,
          system_admin_id: editingSystem.system_admin_id,
          qa_id: editingSystem.qa_id,
          business_owner_id: editingSystem.business_owner_id ?? '',
          it_manager_id: editingSystem.it_manager_id ?? '',
        }
      : {
          name: '',
          system_identifier: '',
          system_environment: '' as SystemEnvironment,
          description: '',
          intended_use: '',
          gxp_classification: '' as GxPClassification,
          risk_level: '' as RiskLevel,
          gamp_category: '' as GampCategory,
          status: '' as SystemStatus,
          vendor_name: '',
          vendor_contact: '',
          vendor_contract_ref: '',
          initial_validation_date: '',
          last_review_period_end: '',
          review_period_months: '' as unknown as number,
          completion_window_days: 90,
          system_owner_id: '',
          system_admin_id: '',
          qa_id: '',
          business_owner_id: '',
          it_manager_id: '',
        },
  });

  const watchClassification = form.watch('gxp_classification');
  const watchRisk = form.watch('risk_level');
  const watchGamp = form.watch('gamp_category');

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const initial = getReviewPeriod(watchClassification as GxPClassification, watchRisk as RiskLevel);
      setAutoValue(initial);
      return;
    }

    const period = getReviewPeriod(watchClassification as GxPClassification, watchRisk as RiskLevel);
    setAutoValue(period);

    if (period !== null) {
      form.setValue('review_period_months', period);
      setFlashPeriod(true);
      setTimeout(() => setFlashPeriod(false), 1000);
    }
  }, [watchClassification, watchRisk]);

  useEffect(() => {
    if (open && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      isInitialMount.current = true;
      isInitialReviewLevel.current = true;
      setFlashPeriod(false);
      setFlashReviewLevel(false);
      setIdentifierError(null);
      setIdentifierChecking(false);

      if (editingSystem) {
        form.reset({
          name: editingSystem.name,
          system_identifier: editingSystem.system_identifier,
          system_environment: editingSystem.system_environment,
          description: editingSystem.description,
          intended_use: editingSystem.intended_use,
          gxp_classification: editingSystem.gxp_classification,
          risk_level: editingSystem.risk_level,
          gamp_category: editingSystem.gamp_category,
          status: editingSystem.status,
          vendor_name: editingSystem.vendor_name,
          vendor_contact: editingSystem.vendor_contact,
          vendor_contract_ref: editingSystem.vendor_contract_ref,
          initial_validation_date: editingSystem.initial_validation_date,
          last_review_period_end: editingSystem.last_review_period_end ?? '',
          review_period_months: editingSystem.review_period_months,
          completion_window_days: editingSystem.completion_window_days,
          system_owner_id: editingSystem.system_owner_id,
          system_admin_id: editingSystem.system_admin_id,
          qa_id: editingSystem.qa_id,
          business_owner_id: editingSystem.business_owner_id ?? '',
          it_manager_id: editingSystem.it_manager_id ?? '',
        });
      } else {
        form.reset();
      }
    }
    if (!open) {
      hasInitializedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingSystem]);

  const checkIdentifierDuplicate = useCallback((value: string) => {
    if (identifierTimerRef.current) clearTimeout(identifierTimerRef.current);
    if (!value.trim()) {
      setIdentifierError(null);
      return;
    }
    setIdentifierChecking(true);
    identifierTimerRef.current = setTimeout(async () => {
      try {
        let query = supabase
          .from('system_profiles')
          .select('id, name')
          .ilike('system_identifier', value.trim())
          .eq('is_deleted', false);
        if (editingSystem?.id) {
          query = query.neq('id', editingSystem.id);
        }
        const { data } = await query.limit(1);
        if (data && data.length > 0) {
          setIdentifierError(t('systemProfiles.identifierDuplicate', { systemName: data[0].name }));
        } else {
          setIdentifierError(null);
        }
      } catch {
        setIdentifierError(null);
      } finally {
        setIdentifierChecking(false);
      }
    }, 500);
  }, [editingSystem?.id, t]);

  const reviewLevelSuggestion = (watchRisk && watchGamp)
    ? suggestReviewLevel(watchRisk as RiskLevel, watchGamp as GampCategory)
    : null;

  const handleSubmit = (values: FormValues) => {
    const now = new Date().toISOString();
    const system: SystemProfile = {
      id: editingSystem?.id ?? crypto.randomUUID(),
      name: values.name,
      system_identifier: values.system_identifier,
      system_environment: values.system_environment,
      gamp_category: values.gamp_category,
      description: values.description ?? '',
      intended_use: values.intended_use,
      gxp_classification: values.gxp_classification,
      risk_level: values.risk_level,
      status: values.status,
      vendor_name: values.vendor_name,
      vendor_contact: values.vendor_contact ?? '',
      vendor_contract_ref: values.vendor_contract_ref ?? '',
      owner_id: values.system_owner_id,
      system_owner_id: values.system_owner_id,
      system_admin_id: values.system_admin_id,
      qa_id: values.qa_id,
      it_manager_id: values.it_manager_id && values.it_manager_id !== '__none__' ? values.it_manager_id : undefined,
      business_owner_id: values.business_owner_id && values.business_owner_id !== '__none__' ? values.business_owner_id : undefined,
      initial_validation_date: values.initial_validation_date,
      last_review_period_end: values.last_review_period_end || null,
      review_period_months: values.review_period_months,
      next_review_date: calculateNextReviewDate(values.initial_validation_date, values.review_period_months, values.last_review_period_end || null),
      completion_window_days: values.completion_window_days,
      approval_status: editingSystem?.approval_status ?? 'draft',
      created_at: editingSystem?.created_at ?? now,
      updated_at: now,
    };
    onSubmit(system);
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      onOpenChange(newOpen);
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            {editingSystem ? t('systemProfiles.form.editTitle') : t('systemProfiles.form.newTitle')}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* System Information */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">{t('systemProfiles.form.systemInfo')}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('systemProfiles.form.systemName')} *</FormLabel>
                    <FormControl><Input placeholder={t('systemProfiles.form.systemNamePlaceholder')} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="system_identifier" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('systemProfiles.form.systemIdentifier')} *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('systemProfiles.form.systemIdentifierPlaceholder')}
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          checkIdentifierDuplicate(e.target.value);
                        }}
                        className={identifierError ? 'border-destructive text-destructive' : ''}
                      />
                    </FormControl>
                    {identifierError && (
                      <p className="text-sm text-destructive">{identifierError}</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="system_environment" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('systemProfiles.form.systemEnvironment')} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger><SelectValue placeholder={t('systemProfiles.form.systemEnvironmentPlaceholder')} /></SelectTrigger></FormControl>
                      <SelectContent>
                        {SYSTEM_ENVIRONMENT_OPTIONS.map((opt) => (
                          <SelectItemWithDescription key={opt.value} value={opt.value} description={opt.description}>
                            <span className="font-medium">{opt.label}</span>
                          </SelectItemWithDescription>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('systemProfiles.form.statusLabel')} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger><SelectValue placeholder={t('systemProfiles.form.statusPlaceholder')} /></SelectTrigger></FormControl>
                      <SelectContent>
                        {systemStatuses.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="mt-4">
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('systemProfiles.form.description')}</FormLabel>
                    <FormControl><Textarea placeholder={t('systemProfiles.form.descriptionPlaceholder')} rows={2} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="mt-4">
                <FormField control={form.control} name="intended_use" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('systemProfiles.form.intendedUse')} *</FormLabel>
                    <FormControl><Textarea placeholder={t('systemProfiles.form.intendedUsePlaceholder')} rows={3} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <Separator />

            {/* Classification & Risk */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">{t('systemProfiles.form.classificationRisk')}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="gxp_classification" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('systemProfiles.form.gxpClassification')} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger><SelectValue placeholder={t('systemProfiles.form.gxpPlaceholder')} /></SelectTrigger></FormControl>
                      <SelectContent>
                        {GXP_OPTIONS.map((opt) => (
                          <SelectItemWithDescription key={opt.value} value={opt.value} description={opt.description}>
                            <span className="font-medium">{opt.label}</span>
                          </SelectItemWithDescription>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="risk_level" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('systemProfiles.form.riskLevel')} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger><SelectValue placeholder={t('systemProfiles.form.riskPlaceholder')} /></SelectTrigger></FormControl>
                      <SelectContent>
                        {riskLevels.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="gamp_category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('systemProfiles.form.gampCategory')} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger><SelectValue placeholder={t('systemProfiles.form.gampPlaceholder')} /></SelectTrigger></FormControl>
                      <SelectContent>
                        {GAMP_CATEGORY_OPTIONS.map((opt) => (
                          <SelectItemWithDescription key={opt.value} value={opt.value} description={opt.description}>
                            <span className="font-medium">{opt.label}</span>
                          </SelectItemWithDescription>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <div>
                  <FormLabel className="text-sm font-medium">{t('systemProfiles.form.reviewLevel')}</FormLabel>
                  <div className={`mt-2 flex h-10 items-center rounded-md border border-input bg-muted/50 px-3 text-sm ${flashReviewLevel ? 'ring-2 ring-primary/50 bg-primary/5 transition-all duration-500' : 'transition-all duration-500'}`}>
                    {reviewLevelSuggestion ? t('common.level', { level: reviewLevelSuggestion }) : '—'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {reviewLevelSuggestion
                      ? t('systemProfiles.form.reviewLevelSuggested')
                      : t('systemProfiles.form.reviewLevelSelect')}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Vendor Information */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">{t('systemProfiles.form.vendorInfo')}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="vendor_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('systemProfiles.form.vendorName')} *</FormLabel>
                    <FormControl><Input placeholder={t('systemProfiles.form.vendorNamePlaceholder')} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="vendor_contact" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('systemProfiles.form.vendorContact')}</FormLabel>
                    <FormControl><Input placeholder={t('systemProfiles.form.vendorContactPlaceholder')} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="mt-4">
                <FormField control={form.control} name="vendor_contract_ref" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('systemProfiles.form.contractRef')}</FormLabel>
                    <FormControl><Input placeholder={t('systemProfiles.form.contractRefPlaceholder')} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <Separator />

            {/* Review Schedule */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">{t('systemProfiles.form.reviewSchedule')}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="initial_validation_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('systemProfiles.form.initialValidationDate')} *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <p className="text-xs text-muted-foreground">{t('systemProfiles.form.initialValidationDateHelp')}</p>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="last_review_period_end" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('systemProfiles.form.lastReviewPeriodEnd')}</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value || ''}
                        placeholder={t('systemProfiles.form.noPreviousReview')}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">{t('systemProfiles.form.lastReviewPeriodEndHelp')}</p>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="review_period_months" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('systemProfiles.form.reviewPeriodMonths')} *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        value={field.value || ''}
                        placeholder={t('systemProfiles.form.reviewPeriodAutoCalc')}
                        readOnly
                        className={`${flashPeriod ? 'ring-2 ring-primary/50 bg-primary/5 transition-all duration-500' : 'transition-all duration-500'} read-only:bg-muted/50 read-only:cursor-default`}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {field.value ? t('systemProfiles.form.reviewPeriodHintSet') : t('systemProfiles.form.reviewPeriodHintEmpty')}
                    </p>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="mt-4">
                <FormField control={form.control} name="completion_window_days" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('systemProfiles.form.completionWindow')}</FormLabel>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          value={field.value || 90}
                          min={30}
                          max={180}
                          className="w-24"
                        />
                      </FormControl>
                      <span className="text-sm text-muted-foreground">{t('systemProfiles.form.completionWindowDays')}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('systemProfiles.form.completionWindowHelp')}
                    </p>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <Separator />

            {/* Role Assignments */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">{t('systemProfiles.form.roleAssignments')}</h3>
              <p className="text-xs text-muted-foreground mb-3">
                {t('systemProfiles.form.roleAssignmentsDesc')}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                {t('systemProfiles.form.roleAssignmentsSoD')}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <RoleSelectField
                  form={form}
                  name="system_owner_id"
                  label={t('systemProfiles.form.systemOwner')}
                  users={systemOwners}
                  loading={loadingOwners}
                  required
                  loadingText={t('systemProfiles.form.loadingUsers')}
                  noUsersText={t('systemProfiles.form.noUsersForRole')}
                  selectText={t('systemProfiles.form.selectPlaceholder', { label: t('systemProfiles.form.systemOwner') })}
                />
                <RoleSelectField
                  form={form}
                  name="system_admin_id"
                  label={t('systemProfiles.form.systemAdministrator')}
                  users={systemAdmins}
                  loading={loadingAdmins}
                  required
                  loadingText={t('systemProfiles.form.loadingUsers')}
                  noUsersText={t('systemProfiles.form.noUsersForRole')}
                  selectText={t('systemProfiles.form.selectPlaceholder', { label: t('systemProfiles.form.systemAdministrator') })}
                />
                <RoleSelectField
                  form={form}
                  name="qa_id"
                  label={t('systemProfiles.form.qualityAssurance')}
                  users={qaUsers}
                  loading={loadingQA}
                  required
                  loadingText={t('systemProfiles.form.loadingUsers')}
                  noUsersText={t('systemProfiles.form.noUsersForRole')}
                  selectText={t('systemProfiles.form.selectPlaceholder', { label: t('systemProfiles.form.qualityAssurance') })}
                />
                <RoleSelectField
                  form={form}
                  name="it_manager_id"
                  label={t('systemProfiles.form.itManager')}
                  users={itManagers}
                  loading={loadingIT}
                  loadingText={t('systemProfiles.form.loadingUsers')}
                  noUsersText={t('systemProfiles.form.noUsersForRole')}
                  selectText={t('systemProfiles.form.selectPlaceholder', { label: t('systemProfiles.form.itManager') })}
                />
                <RoleSelectField
                  form={form}
                  name="business_owner_id"
                  label={t('systemProfiles.form.businessOwner')}
                  users={businessOwners}
                  loading={loadingBO}
                  loadingText={t('systemProfiles.form.loadingUsers')}
                  noUsersText={t('systemProfiles.form.noUsersForRole')}
                  selectText={t('systemProfiles.form.selectPlaceholder', { label: t('systemProfiles.form.businessOwner') })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => {
                onOpenChange(false);
              }}>
                {t('systemProfiles.form.cancel')}
              </Button>
              <Button type="submit" disabled={!!identifierError || identifierChecking}>
                {editingSystem ? t('systemProfiles.form.updateProfile') : t('systemProfiles.form.createProfile')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
