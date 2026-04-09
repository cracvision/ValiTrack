import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Bot, User, Calendar, Shield, FileText } from 'lucide-react';
import { useUpdateFinding } from '@/hooks/useFindings';
import type { Finding, CapaStatus } from '@/types/findings';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  major: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  minor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  observation: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
};

interface FindingDetailPanelProps {
  finding: Finding;
  reviewCaseId: string;
  userNames: Record<string, string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
}

export function FindingDetailPanel({ finding, reviewCaseId, userNames, open, onOpenChange, canManage }: FindingDetailPanelProps) {
  const { t } = useTranslation();
  const updateFinding = useUpdateFinding();
  const [editingCapa, setEditingCapa] = useState(false);
  const [capaRef, setCapaRef] = useState(finding.capa_reference || '');
  const [capaSys, setCapaSys] = useState(finding.capa_system || '');
  const [capaStat, setCapaStat] = useState<CapaStatus>(finding.capa_status || 'pending');

  const resolveName = (id: string | null) => id ? (userNames[id] || '—') : '—';

  const handleUpdateCapa = async () => {
    await updateFinding.mutateAsync({
      findingId: finding.id,
      reviewCaseId,
      updates: {
        capa_reference: capaRef || null,
        capa_system: capaSys || null,
        capa_status: capaStat,
      } as any,
    });
    setEditingCapa(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Badge className={SEVERITY_COLORS[finding.severity]}>
              {t(`findings.severity.${finding.severity}`).toUpperCase()}
            </Badge>
            {finding.source === 'ai_identified' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          <div>
            <h3 className="font-semibold text-foreground">{finding.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{finding.description}</p>
          </div>

          <Separator />

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">{t('findings.labels.status')}</dt>
            <dd>
              <Badge variant="secondary">{t(`findings.status.${finding.status}`)}</Badge>
            </dd>
            <dt className="text-muted-foreground">{t('findings.labels.category')}</dt>
            <dd>{t(`findings.category.${finding.category}`)}</dd>
            <dt className="text-muted-foreground">{t('findings.labels.source')}</dt>
            <dd>{t(`findings.source.${finding.source}`)}</dd>
            {finding.regulation_reference && (
              <>
                <dt className="text-muted-foreground flex items-center gap-1"><Shield className="h-3 w-3" /> {t('findings.labels.regulationReference')}</dt>
                <dd>{finding.regulation_reference}</dd>
              </>
            )}
            {finding.sop_reference && (
              <>
                <dt className="text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" /> {t('findings.labels.sopReference')}</dt>
                <dd>{finding.sop_reference}</dd>
              </>
            )}
          </dl>

          {/* Risk */}
          {(finding.risk_probability || finding.risk_impact || finding.risk_level) && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">{t('findings.labels.riskAssessment')}</h4>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">{t('findings.labels.riskProbability')}</dt>
                    <dd>{finding.risk_probability ? t(`findings.risk.${finding.risk_probability}`) : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t('findings.labels.riskImpact')}</dt>
                    <dd>{finding.risk_impact ? t(`findings.risk.${finding.risk_impact}`) : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t('findings.labels.riskLevel')}</dt>
                    <dd className="font-medium">{finding.risk_level ? t(`findings.risk.${finding.risk_level}`) : '—'}</dd>
                  </div>
                </dl>
              </div>
            </>
          )}

          {/* Action */}
          {finding.action_description && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">{t('findings.labels.correctiveAction')}</h4>
                <p className="text-sm">{finding.action_description}</p>
                {finding.action_due_date && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {t('findings.labels.actionDueDate')}: {finding.action_due_date}
                  </p>
                )}
              </div>
            </>
          )}

          {/* CAPA */}
          {finding.capa_required && (
            <>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">{t('findings.labels.capaReference')}</h4>
                  {canManage && !editingCapa && (
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setEditingCapa(true)}>
                      {t('findings.actions.updateCapa')}
                    </Button>
                  )}
                </div>
                {editingCapa ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{t('findings.labels.capaReference')}</Label>
                      <Input value={capaRef} onChange={e => setCapaRef(e.target.value)} className="h-8" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('findings.labels.capaSystem')}</Label>
                      <Input value={capaSys} onChange={e => setCapaSys(e.target.value)} className="h-8" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('findings.labels.capaStatus')}</Label>
                      <Select value={capaStat} onValueChange={(v) => setCapaStat(v as CapaStatus)}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(['pending', 'open', 'closed', 'verified', 'not_required'] as const).map(s => (
                            <SelectItem key={s} value={s}>{t(`findings.capaStatus.${s}`)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs" onClick={handleUpdateCapa} disabled={updateFinding.isPending}>
                        {t('common.save')}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingCapa(false)}>
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <dt className="text-muted-foreground">{t('findings.labels.capaReference')}</dt>
                    <dd>{finding.capa_reference || '—'}</dd>
                    <dt className="text-muted-foreground">{t('findings.labels.capaSystem')}</dt>
                    <dd>{finding.capa_system || '—'}</dd>
                    <dt className="text-muted-foreground">{t('findings.labels.capaStatus')}</dt>
                    <dd>{finding.capa_status ? t(`findings.capaStatus.${finding.capa_status}`) : '—'}</dd>
                  </dl>
                )}
              </div>
            </>
          )}

          {/* Resolution */}
          {finding.resolution_notes && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">{t('findings.labels.resolution')}</h4>
                <p className="text-sm">{finding.resolution_notes}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {resolveName(finding.resolved_by)} · {finding.resolved_at ? new Date(finding.resolved_at).toLocaleDateString() : ''}
                </p>
              </div>
            </>
          )}

          {/* Dismissal */}
          {finding.dismissal_justification && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">{t('findings.labels.dismissalJustification')}</h4>
                <p className="text-sm italic">{finding.dismissal_justification}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {resolveName(finding.dismissed_by)} · {finding.dismissed_at ? new Date(finding.dismissed_at).toLocaleDateString() : ''}
                </p>
              </div>
            </>
          )}

          {/* Timestamps */}
          <Separator />
          <dl className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
            <dt>{t('findings.labels.created')}</dt>
            <dd>{new Date(finding.created_at).toLocaleString()}</dd>
            {finding.confirmed_at && (
              <>
                <dt>{t('findings.labels.confirmedAt')}</dt>
                <dd>{new Date(finding.confirmed_at).toLocaleString()} — {resolveName(finding.confirmed_by)}</dd>
              </>
            )}
            <dt>{t('findings.labels.lastUpdated')}</dt>
            <dd>{new Date(finding.updated_at).toLocaleString()}</dd>
          </dl>
        </div>
      </SheetContent>
    </Sheet>
  );
}
