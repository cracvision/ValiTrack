import { Check, X } from "lucide-react";
import { validatePasswordPolicy, type PasswordCheck } from "@/lib/passwordValidation";

interface PasswordRequirementsProps {
  password: string;
  email?: string;
  username?: string;
}

export function PasswordRequirements({ password, email, username }: PasswordRequirementsProps) {
  const { checks } = validatePasswordPolicy(password, email, username);

  return (
    <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">Requisitos de contraseña</p>
      <ul className="space-y-1">
        {checks.map((check: PasswordCheck) => (
          <li key={check.id} className="flex items-center gap-2 text-xs">
            {check.passed
              ? <Check className="h-3.5 w-3.5 text-primary shrink-0" />
              : <X className="h-3.5 w-3.5 text-destructive shrink-0" />}
            <span className={check.passed ? "text-muted-foreground" : "text-foreground"}>
              {check.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
