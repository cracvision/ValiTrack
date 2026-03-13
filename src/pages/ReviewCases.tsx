import { ClipboardCheck } from 'lucide-react';

export default function ReviewCases() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Review Cases</h1>
        <p className="text-sm text-muted-foreground">
          Periodic review workflow management
        </p>
      </div>
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-card p-16">
        <div className="text-center space-y-2">
          <ClipboardCheck className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Review Cases workflow — coming in Iteration 3</p>
        </div>
      </div>
    </div>
  );
}
