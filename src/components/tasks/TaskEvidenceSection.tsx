import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Upload, FileText, FileImage, FileSpreadsheet, File as FileIcon,
  Download, Eye, Copy, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { useTaskEvidenceFiles, suggestEvidenceCategory } from '@/hooks/useTaskEvidenceFiles';
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

interface TaskEvidenceSectionProps {
  taskId: string;
  taskGroup: string;
  taskTitle: string;
  reviewCaseId: string;
  canUpload: boolean;
  isReadOnly?: boolean;
  highlight?: boolean;
  isPending?: boolean;
}

export function TaskEvidenceSection({ taskId, taskGroup, taskTitle, reviewCaseId, canUpload, isReadOnly = false, highlight = false, isPending = false }: TaskEvidenceSectionProps) {
  const { t } = useTranslation();
  const { files, isLoading, uploadFile, getDownloadUrl } = useTaskEvidenceFiles({ taskId, reviewCaseId });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState(() => suggestEvidenceCategory(taskGroup, taskTitle));
  const [description, setDescription] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setCategory(suggestEvidenceCategory(taskGroup, taskTitle));
    setDescription('');
  }, [taskGroup, taskTitle]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleUpload = () => {
    if (!selectedFile) return;
    uploadFile.mutate(
      { file: selectedFile, category, description },
      {
        onSuccess: () => {
          setSelectedFile(null);
          setDescription('');
          if (fileInputRef.current) fileInputRef.current.value = '';
        },
      }
    );
  };

  const handleDownload = async (storagePath: string, fileName: string) => {
    const url = await getDownloadUrl(storagePath);
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.target = '_blank';
      a.click();
    }
  };

  const handlePreview = async (storagePath: string) => {
    const url = await getDownloadUrl(storagePath);
    if (url) window.open(url, '_blank');
  };

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  return (
    <div className={`space-y-3 rounded-md p-2 -m-2 transition-colors ${highlight ? 'border border-destructive bg-destructive/5' : ''}`}>
      <h4 className="text-sm font-semibold text-foreground">{t('tasks.evidence.title')}</h4>

      {/* Upload zone — only for authorized users */}
      {canUpload && (
        <div className="space-y-2">
          <div
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
              isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">{t('tasks.evidence.dragDrop')}</p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">{t('tasks.evidence.maxSize')}</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.tiff,.xlsx,.docx,.csv,.txt,.zip"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />

          {/* File selected — show category + description + upload button */}
          {selectedFile && (
            <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
              <div className="flex items-center gap-2 text-sm">
                {getMimeIcon(selectedFile.type)}
                <span className="truncate font-medium">{selectedFile.name}</span>
                <span className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">{t('tasks.evidence.category')}</Label>
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

              <div className="space-y-1.5">
                <Label className="text-xs">{t('tasks.evidence.description')}</Label>
                <Textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="min-h-[48px] text-xs"
                  rows={2}
                />
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={handleUpload} disabled={uploadFile.isPending} className="text-xs">
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  {uploadFile.isPending ? '...' : t('tasks.evidence.upload')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-xs">
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* File list */}
      {files.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{t(isPending ? 'tasks.evidence.startFirst' : isReadOnly ? 'tasks.evidence.emptyStateReadOnly' : 'tasks.evidence.emptyState')}</p>
      ) : (
        <div className="space-y-2">
          {files.map(file => (
            <EvidenceFileRow
              key={file.id}
              file={file}
              onDownload={() => handleDownload(file.storage_path, file.file_name)}
              onPreview={() => handlePreview(file.storage_path)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenceFileRow({
  file,
  onDownload,
  onPreview,
}: {
  file: TaskEvidenceFile & { created_by_name?: string };
  onDownload: () => void;
  onPreview: () => void;
}) {
  const { t } = useTranslation();
  const [hashCopied, setHashCopied] = useState(false);
  const isPreviewable = file.mime_type === 'application/pdf' || file.mime_type.startsWith('image/');

  const copyHash = () => {
    navigator.clipboard.writeText(file.sha256_hash);
    setHashCopied(true);
    toast({ title: t('tasks.evidence.hashCopied') });
    setTimeout(() => setHashCopied(false), 2000);
  };

  return (
    <div className="border rounded-md p-2.5 space-y-1.5 text-xs">
      {/* Row 1: icon + name + size + version */}
      <div className="flex items-center gap-2">
        {getMimeIcon(file.mime_type)}
        <span className="font-medium truncate flex-1">{file.file_name}</span>
        <span className="text-muted-foreground">{formatFileSize(file.file_size_bytes)}</span>
        {file.version > 1 && (
          <Badge variant="outline" className="text-[9px] px-1">v{file.version}</Badge>
        )}
      </div>

      {/* Row 2: hash + category */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[10px] text-muted-foreground">
          {t('tasks.evidence.hash')}: {file.sha256_hash.substring(0, 16)}...
        </span>
        <button
          onClick={copyHash}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title={t('tasks.evidence.copyHash')}
        >
          {hashCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
        </button>
        <Badge variant="secondary" className="text-[9px] ml-auto">
          {t(`tasks.evidence.categories.${file.evidence_category}`)}
        </Badge>
      </div>

      {/* Row 3: uploader + timestamp + actions */}
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>{(file as any).created_by_name || '—'}</span>
        <span>·</span>
        <span>{new Date(file.created_at).toLocaleString()}</span>
        <div className="ml-auto flex gap-1">
          {isPreviewable && (
            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={onPreview}>
              <Eye className="h-3 w-3 mr-0.5" /> {t('tasks.evidence.preview')}
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={onDownload}>
            <Download className="h-3 w-3 mr-0.5" /> {t('tasks.evidence.download')}
          </Button>
        </div>
      </div>

      {/* Description if present */}
      {file.description && (
        <p className="text-muted-foreground italic pl-6">{file.description}</p>
      )}
    </div>
  );
}
