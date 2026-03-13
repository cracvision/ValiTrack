import { Archive } from 'lucide-react';

export default function EvidenceVault() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Evidence Vault</h1>
        <p className="text-sm text-muted-foreground">
          Secure document repository with integrity verification
        </p>
      </div>
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-card p-16">
        <div className="text-center space-y-2">
          <Archive className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Evidence Vault — coming in Iteration 4</p>
        </div>
      </div>
    </div>
  );
}
