import { AlertTriangle } from 'lucide-react';

export default function FindingsActions() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Findings & Actions</h1>
        <p className="text-sm text-muted-foreground">
          Track findings, CAPAs, and corrective actions
        </p>
      </div>
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-card p-16">
        <div className="text-center space-y-2">
          <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Findings & Actions — coming in Iteration 5</p>
        </div>
      </div>
    </div>
  );
}
