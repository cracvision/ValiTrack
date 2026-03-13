import { Server } from 'lucide-react';

export default function SystemProfiles() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">System Profiles</h1>
        <p className="text-sm text-muted-foreground">
          Manage validated computerized systems inventory
        </p>
      </div>
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-card p-16">
        <div className="text-center space-y-2">
          <Server className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">System Profiles CRUD — coming in Iteration 2</p>
        </div>
      </div>
    </div>
  );
}
