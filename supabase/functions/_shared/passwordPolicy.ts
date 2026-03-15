const SPECIAL_CHARS_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePasswordPolicy(
  password: string,
  email?: string,
  username?: string
): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 12) errors.push('Minimum 12 characters');
  if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('At least one lowercase letter');
  if (!/\d/.test(password)) errors.push('At least one number');
  if (!SPECIAL_CHARS_REGEX.test(password)) errors.push('At least one special character');

  if (email) {
    const emailLocal = email.split('@')[0].toLowerCase();
    if (emailLocal.length >= 3 && password.toLowerCase().includes(emailLocal)) {
      errors.push('Password must not contain your email');
    }
  }

  if (username && username.length >= 3) {
    if (password.toLowerCase().includes(username.toLowerCase())) {
      errors.push('Password must not contain your username');
    }
  }

  return { valid: errors.length === 0, errors };
}

export async function hashPasswordForHistory(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function savePasswordToHistory(
  supabaseAdmin: any,
  userId: string,
  passwordHash: string
): Promise<void> {
  await supabaseAdmin.from('password_history').insert({
    user_id: userId,
    password_hash: passwordHash,
  });
}

export async function isPasswordInHistory(
  supabaseAdmin: any,
  userId: string,
  password: string,
  limit = 5
): Promise<boolean> {
  const hash = await hashPasswordForHistory(password);
  const { data } = await supabaseAdmin
    .from('password_history')
    .select('password_hash')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!data) return false;
  return data.some((row: any) => row.password_hash === hash);
}
