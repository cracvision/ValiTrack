import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
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
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
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
  validation_date: z.string().min(1, 'Validation date is required'),
  review_period_months: z.coerce.number().min(1, 'Must be at least 1 month').max(120, 'Cannot exceed 120 months'),
  system_owner_id: z.string().min(1, 'System Owner is required'),
  system_admin_id: z.string().min(1, 'System Administrator is required'),
  qa_id: z.string().min(1, 'Quality Assurance is required'),
  it_manager_id: z.string().optional().default(''),
}).refine((data) => data.system_owner_id !== data.qa_id, {
  message: 'System Owner and QA cannot be the same person (separation of duties)',
  path: ['qa_id'],
});

type FormValues = z.infer<typeof formSchema>;

function calculateNextReviewDate(validationDate: string, periodMonths: number): string {
  const date = new Date(validationDate);
  date.setMonth(date.getMonth() + periodMonths);
  return date.toISOString().split('T')[0];
}

function formatUserLabel(user: RoleUser): string {
  return user.username ? `${user.full_name} (@${user.username})` : user.full_name;
}

interface RoleSelectFieldProps {
  form: ReturnType<typeof useForm<FormValues>>;
  name: 'system_owner_id' | 'system_admin_id' | 'qa_id' | 'it_manager_id';
  label: string;
  users: RoleUser[];
  loading: boolean;
  required?: boolean;
}

function RoleSelectField({ form, name, label, users, loading, required }: RoleSelectFieldProps) {
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
              <SelectValue placeholder={loading ? 'Loading...' : !hasUsers ? 'No users with this role' : `Select ${label}`} />
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
  const { users: systemOwners, loading: loadingOwners } = useRoleUsers('system_owner');
  const { users: systemAdmins, loading: loadingAdmins } = useRoleUsers('system_administrator');
  const { users: qaUsers, loading: loadingQA } = useRoleUsers('quality_assurance');
  const { users: itManagers, loading: loadingIT } = useRoleUsers('it_manager');

  const [autoValue, setAutoValue] = useState<number | null>(null);
  const [flashPeriod, setFlashPeriod] = useState(false);
  const [flashReviewLevel, setFlashReviewLevel] = useState(false);
  const isInitialMount = useRef(true);
  const isInitialReviewLevel = useRef(true);

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
          validation_date: editingSystem.validation_date,
          review_period_months: editingSystem.review_period_months,
          system_owner_id: editingSystem.system_owner_id,
          system_admin_id: editingSystem.system_admin_id,
          qa_id: editingSystem.qa_id,
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
          validation_date: '',
          review_period_months: '' as unknown as number,
          system_owner_id: '',
          system_admin_id: '',
          qa_id: '',
          it_manager_id: '',
        },
  });

  const watchClassification = form.watch('gxp_classification');
  const watchRisk = form.watch('risk_level');
  const watchGamp = form.watch('gamp_category');

  // Auto-populate review period when classification or risk changes
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

  // Reset form when editingSystem changes
  useEffect(() => {
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
        validation_date: editingSystem.validation_date,
        review_period_months: editingSystem.review_period_months,
        system_owner_id: editingSystem.system_owner_id,
        system_admin_id: editingSystem.system_admin_id,
        qa_id: editingSystem.qa_id,
        it_manager_id: editingSystem.it_manager_id ?? '',
      });
    }
  }, [editingSystem, form]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      isInitialMount.current = true;
      isInitialReviewLevel.current = true;
      setFlashPeriod(false);
      setFlashReviewLevel(false);
    }
  }, [open]);

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
      validation_date: values.validation_date,
      review_period_months: values.review_period_months,
      next_review_date: calculateNextReviewDate(values.validation_date, values.review_period_months),
      created_at: editingSystem?.created_at ?? now,
      updated_at: now,
    };
    onSubmit(system);
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            {editingSystem ? 'Edit System Profile' : 'New System Profile'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* System Information */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">System Information</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>System Name *</FormLabel>
                    <FormControl><Input placeholder="e.g. BePAS|X" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="system_identifier" render={({ field }) => (
                  <FormItem>
                    <FormLabel>System Identifier *</FormLabel>
                    <FormControl><Input placeholder="e.g. SYS-001" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="system_environment" render={({ field }) => (
                  <FormItem>
                    <FormLabel>System Environment *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select the system environment" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {SYSTEM_ENVIRONMENT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex flex-col">
                              <span className="font-medium">{opt.label}</span>
                              <span className="text-xs text-muted-foreground">{opt.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select the system status" /></SelectTrigger></FormControl>
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
                <FormField control={form.control} name="intended_use" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Intended Use *</FormLabel>
                    <FormControl><Textarea placeholder="Describe the intended use of this system..." rows={3} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="mt-4">
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea placeholder="Additional details about the system..." rows={2} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <Separator />

            {/* Classification & Risk */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Classification & Risk</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="gxp_classification" render={({ field }) => (
                  <FormItem>
                    <FormLabel>GxP Classification *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Choose the corresponding classification" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {GXP_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex flex-col">
                              <span className="font-medium">{opt.label}</span>
                              <span className="text-xs text-muted-foreground">{opt.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="risk_level" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Risk Level *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Choose the risk level" /></SelectTrigger></FormControl>
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
                    <FormLabel>GAMP Category *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select the GAMP category" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {GAMP_CATEGORY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex flex-col">
                              <span className="font-medium">{opt.label}</span>
                              <span className="text-xs text-muted-foreground">{opt.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <div>
                  <FormLabel className="text-sm font-medium">Review Level</FormLabel>
                  <div className={`mt-2 flex h-10 items-center rounded-md border border-input bg-muted/50 px-3 text-sm ${flashReviewLevel ? 'ring-2 ring-primary/50 bg-primary/5 transition-all duration-500' : 'transition-all duration-500'}`}>
                    {reviewLevelSuggestion ? `Level ${reviewLevelSuggestion}` : '—'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {reviewLevelSuggestion
                      ? 'Suggested based on risk level and GAMP category'
                      : 'Select risk level and GAMP category to calculate'}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Vendor Information */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Vendor Information</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="vendor_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor Name *</FormLabel>
                    <FormControl><Input placeholder="e.g. Körber AG" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="vendor_contact" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor Contact</FormLabel>
                    <FormControl><Input placeholder="Contact info or email" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="mt-4">
                <FormField control={form.control} name="vendor_contract_ref" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Reference</FormLabel>
                    <FormControl><Input placeholder="e.g. CTR-2024-0045" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <Separator />

            {/* Review Schedule */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Review Schedule</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="validation_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Validation Date *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="review_period_months" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Review Period (months) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        value={field.value || ''}
                        placeholder="Auto-calculated"
                        readOnly
                        className={`${flashPeriod ? 'ring-2 ring-primary/50 bg-primary/5 transition-all duration-500' : 'transition-all duration-500'} read-only:bg-muted/50 read-only:cursor-default`}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {field.value ? 'Auto-calculated based on GxP classification and risk level' : 'Select GxP classification and risk level to calculate'}
                    </p>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <Separator />

            {/* Role Assignments */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Role Assignments</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Assign users responsible for this system's periodic review process.
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                The System Owner and QA Approver must be different users to ensure separation of duties.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <RoleSelectField
                  form={form}
                  name="system_owner_id"
                  label="System Owner"
                  users={systemOwners}
                  loading={loadingOwners}
                  required
                />
                <RoleSelectField
                  form={form}
                  name="system_admin_id"
                  label="System Administrator"
                  users={systemAdmins}
                  loading={loadingAdmins}
                  required
                />
                <RoleSelectField
                  form={form}
                  name="qa_id"
                  label="Quality Assurance"
                  users={qaUsers}
                  loading={loadingQA}
                  required
                />
                <RoleSelectField
                  form={form}
                  name="it_manager_id"
                  label="IT Manager"
                  users={itManagers}
                  loading={loadingIT}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingSystem ? 'Update Profile' : 'Create Profile'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
