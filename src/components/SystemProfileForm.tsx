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
import type { SystemProfile, SystemCategory, GxPClassification, RiskLevel, SystemStatus } from '@/types';

const systemCategories: SystemCategory[] = ['LIMS', 'ERP', 'DCS', 'MES', 'QMS', 'DMS', 'SCADA', 'CDS', 'ELN', 'Other'];
const gxpClassifications: GxPClassification[] = ['GxP Critical', 'GxP Non-Critical', 'Non-GxP'];
const riskLevels: RiskLevel[] = ['High', 'Medium', 'Low'];
const systemStatuses: SystemStatus[] = ['Active', 'Retired', 'Under Validation'];

const formSchema = z.object({
  name: z.string().trim().min(1, 'System name is required').max(200),
  system_identifier: z.string().trim().min(1, 'System identifier is required').max(50),
  system_category: z.enum(['LIMS', 'ERP', 'DCS', 'MES', 'QMS', 'DMS', 'SCADA', 'CDS', 'ELN', 'Other']),
  description: z.string().trim().max(1000).optional().default(''),
  intended_use: z.string().trim().min(1, 'Intended use is required').max(2000),
  gxp_classification: z.enum(['GxP Critical', 'GxP Non-Critical', 'Non-GxP']),
  risk_level: z.enum(['High', 'Medium', 'Low']),
  status: z.enum(['Active', 'Retired', 'Under Validation']),
  vendor_name: z.string().trim().min(1, 'Vendor name is required').max(200),
  vendor_contact: z.string().trim().max(200).optional().default(''),
  vendor_contract_ref: z.string().trim().max(100).optional().default(''),
  owner_name: z.string().trim().min(1, 'Owner name is required').max(200),
  validation_date: z.string().min(1, 'Validation date is required'),
  review_period_months: z.coerce.number().min(1, 'Must be at least 1 month').max(120, 'Cannot exceed 120 months'),
});

type FormValues = z.infer<typeof formSchema>;

function calculateNextReviewDate(validationDate: string, periodMonths: number): string {
  const date = new Date(validationDate);
  date.setMonth(date.getMonth() + periodMonths);
  return date.toISOString().split('T')[0];
}

interface SystemProfileFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (system: SystemProfile) => void;
  editingSystem?: SystemProfile | null;
}

export function SystemProfileForm({ open, onOpenChange, onSubmit, editingSystem }: SystemProfileFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: editingSystem
      ? {
          name: editingSystem.name,
          system_identifier: editingSystem.system_identifier,
          system_category: editingSystem.system_category,
          description: editingSystem.description,
          intended_use: editingSystem.intended_use,
          gxp_classification: editingSystem.gxp_classification,
          risk_level: editingSystem.risk_level,
          status: editingSystem.status,
          vendor_name: editingSystem.vendor_name,
          vendor_contact: editingSystem.vendor_contact,
          vendor_contract_ref: editingSystem.vendor_contract_ref,
          owner_name: editingSystem.owner_name,
          validation_date: editingSystem.validation_date,
          review_period_months: editingSystem.review_period_months,
        }
      : {
          name: '',
          system_identifier: '',
          system_category: 'Other' as SystemCategory,
          description: '',
          intended_use: '',
          gxp_classification: 'GxP Critical' as GxPClassification,
          risk_level: 'Medium' as RiskLevel,
          status: 'Active' as SystemStatus,
          vendor_name: '',
          vendor_contact: '',
          vendor_contract_ref: '',
          owner_name: '',
          validation_date: '',
          review_period_months: 12,
        },
  });

  const handleSubmit = (values: FormValues) => {
    const now = new Date().toISOString();
    const system: SystemProfile = {
      id: editingSystem?.id ?? crypto.randomUUID(),
      name: values.name,
      system_identifier: values.system_identifier,
      system_category: values.system_category,
      description: values.description ?? '',
      intended_use: values.intended_use,
      gxp_classification: values.gxp_classification,
      risk_level: values.risk_level,
      status: values.status,
      vendor_name: values.vendor_name,
      vendor_contact: values.vendor_contact ?? '',
      vendor_contract_ref: values.vendor_contract_ref ?? '',
      owner_id: editingSystem?.owner_id ?? crypto.randomUUID(),
      owner_name: values.owner_name,
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
                <FormField control={form.control} name="system_category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {systemCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {gxpClassifications.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="risk_level" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Risk Level *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {riskLevels.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
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
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField control={form.control} name="owner_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>System Owner *</FormLabel>
                    <FormControl><Input placeholder="Owner name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
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
                    <FormControl><Input type="number" min={1} max={120} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
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
