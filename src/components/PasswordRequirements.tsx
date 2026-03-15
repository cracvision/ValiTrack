import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { validatePasswordPolicy, type PasswordCheck } from "@/lib/passwordValidation";

interface PasswordRequirementsProps {
  password: string;
  email?: string;
  username?: string;
}

export function PasswordRequirements({ password, email, username }: PasswordRequirementsProps) {
  const { t } = useTranslation();
  const { checks } = validatePasswordPolicy(password, email, username);

  const labelMap: Record<string, string> = {
    length: t('password.minLength'),
    uppercase: t('password.uppercase'),
    lowercase: t('password.lowercase'),
    number: t('password.number'),
    special: t('password.special'),
    noEmail: t('password.noEmail'),
    noUsername: t('password.noUsername'),
  };

  return (
    <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">{t('password.requirementsTitle')}</p>
      <ul className="space-y-1">
        {checks.map((check: PasswordCheck) => (
          <li key={check.id} className="flex items-center gap-2 text-xs">
            {check.passed
              ? <Check className="h-3.5 w-3.5 text-primary shrink-0" />
              : <X className="h-3.5 w-3.5 text-destructive shrink-0" />}
            <span className={check.passed ? "text-muted-foreground" : "text-foreground"}>
              {labelMap[check.id] ?? check.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
