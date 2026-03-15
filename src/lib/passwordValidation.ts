export interface PasswordCheck {
  id: string;
  passed: boolean;
  label: string;
}

export interface PasswordValidationResult {
  valid: boolean;
  checks: PasswordCheck[];
  errors: string[];
}

const SPECIAL_CHARS_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;

export function validatePasswordPolicy(
  password: string,
  email?: string,
  username?: string
): PasswordValidationResult {
  const checks: PasswordCheck[] = [
    { id: 'length', passed: password.length >= 12, label: 'Mínimo 12 caracteres' },
    { id: 'uppercase', passed: /[A-Z]/.test(password), label: 'Al menos una letra mayúscula' },
    { id: 'lowercase', passed: /[a-z]/.test(password), label: 'Al menos una letra minúscula' },
    { id: 'number', passed: /\d/.test(password), label: 'Al menos un número' },
    { id: 'special', passed: SPECIAL_CHARS_REGEX.test(password), label: 'Al menos un carácter especial' },
  ];

  if (email) {
    const emailLocal = email.split('@')[0].toLowerCase();
    const containsEmail = emailLocal.length >= 3 && password.toLowerCase().includes(emailLocal);
    checks.push({ id: 'noEmail', passed: !containsEmail, label: 'No debe contener tu email' });
  }

  if (username && username.length >= 3) {
    checks.push({
      id: 'noUsername',
      passed: !password.toLowerCase().includes(username.toLowerCase()),
      label: 'No debe contener tu nombre de usuario',
    });
  }

  const failedChecks = checks.filter(c => !c.passed);
  return { valid: failedChecks.length === 0, checks, errors: failedChecks.map(c => c.label) };
}

export function isPasswordValid(password: string, email?: string, username?: string): boolean {
  return validatePasswordPolicy(password, email, username).valid;
}
