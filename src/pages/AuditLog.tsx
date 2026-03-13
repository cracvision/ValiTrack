import { ScrollText } from 'lucide-react';

export default function AuditLog() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Immutable record of all system changes (21 CFR Part 11)
        </p>
      </div>
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-card p-16">
        <div className="text-center space-y-2">
          <ScrollText className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Audit Log — coming in Iteration 7</p>
        </div>
      </div>
    </div>
  );
}
