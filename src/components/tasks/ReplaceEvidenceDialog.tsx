import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FileText, FileImage, FileSpreadsheet, File as FileIcon } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { TaskEvidenceFile } from '@/types';

const EVIDENCE_CATEGORIES = [
  'incident_report', 'problem_report', 'change_control_report',
  'service_request_report', 'deviation_report', 'capa_record',
  'audit_finding', 'user_access_list', 'access_review',
  'privileged_account_doc', 'security_patch_report', 'backup_log',
  'restore_test', 'dr_bcp_plan', 'audit_trail_export',
  'system_specification', 'interface_document', 'sop',
  'training_record', 'vendor_assessment', 'sla_report',
  'validation_document', 'software_config', 'performance_report',
  'ai_analysis_output', 'other',
] as const;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMimeIcon(mime: string) {
  if (mime.startsWith('image/')) return <FileImage className="h-4 w-4 text-blue-500" />;
  if (mime === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />;
  if (mime.includes('spreadsheet') || mime === 'text/csv') return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
  return <FileIcon className="h-4 w-4 text-muted-foreground" />;
}

interface ReplaceEvidenceDialogProps {
  open: boolean;
  onClose: () => void;
  onReplace: (params: { originalFile: TaskEvidenceFile; newFile: File; reason: string; category: string }) => void;
  isReplacing: boolean;
  file: TaskEvidenceFile;
}

export function ReplaceEvidenceDialog({ open, onClose, onReplace, isReplacing, file }: ReplaceEvidenceDialogProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState(file.evidence_category);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isValid = reason.trim().length >= 10 && selectedFile !== null;

  const handleFileSelect = useCallback((f: File) => {
    setSelectedFile(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }, [handleFileSelect]);

  const handleSubmit = () => {
    if (!isValid || !selectedFile) return;
    onReplace({ originalFile: file, newFile: selectedFile, reason: reason.trim(), category });
  };

  const handleClose = () => {
    if (isReplacing) return;
    setReason('');
    setSelectedFile(null);
    setCategory(file.evidence_category);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('tasks.evidence.replace.dialogTitle')}</DialogTitle>
          <DialogDescription className="sr-only">{t('tasks.evidence.replace.dialogTitle')}</DialogDescription>
        </DialogHeader>

        {/* Current file info */}
        <div className="rounded-md border p-3 bg-muted/30 space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">{t('tasks.evidence.replace.currentFile')}</Label>
          <div className="flex items-center gap-2 text-sm">
            {getMimeIcon(file.mime_type)}
            <span className="font-medium truncate">{file.file_name}</span>
            <span className="text-xs text-muted-foreground">{formatFileSize(file.file_size_bytes)}</span>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground">
            SHA-256: {file.sha256_hash.substring(0, 32)}...
          </p>
        </div>

        {/* Reason */}
        <div className="space-y-1.5">
          <Label className="text-xs">{t('tasks.evidence.replace.reasonLabel')} *</Label>
          <Textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={t('tasks.evidence.replace.reasonPlaceholder')}
            className="min-h-[64px] text-xs"
            rows={3}
          />
          {reason.length > 0 && reason.trim().length < 10 && (
            <p className="text-[10px] text-destructive">{t('tasks.evidence.replace.reasonMinLength')}</p>
          )}
          <p className="text-[10px] text-muted-foreground text-right">{reason.trim().length}/10 min</p>
        </div>

        {/* New file upload */}
        <div className="space-y-1.5">
          <Label className="text-xs">{t('tasks.evidence.replace.newFile')}</Label>
          <div
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
              isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {selectedFile ? (
              <div className="flex items-center gap-2 justify-center text-sm">
                {getMimeIcon(selectedFile.type)}
                <span className="font-medium truncate">{selectedFile.name}</span>
                <span className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</span>
              </div>
            ) : (
              <>
                <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">{t('tasks.evidence.dragDrop')}</p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.tiff,.xlsx,.docx,.csv,.txt,.zip"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
            }}
          />
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <Label className="text-xs">{t('tasks.evidence.replace.categoryLabel')}</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVIDENCE_CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat} className="text-xs">
                  {t(`tasks.evidence.categories.${cat}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isReplacing} className="text-xs">
            {t('tasks.evidence.replace.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isReplacing} className="text-xs">
            {isReplacing ? t('tasks.evidence.replace.replacing') : t('tasks.evidence.replace.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
