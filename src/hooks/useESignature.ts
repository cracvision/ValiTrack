import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface VerifyAndSignParams {
  password: string;
  reason: string;
  conclusion?: string;
  comment?: string;
  transition: string;
  resourceId: string;
  resourceType: string;
  systemName: string;
  additionalDetails?: Record<string, unknown>;
}

export function useESignature() {
  const { user, profile, roles } = useAuth();

  const verifyAndSign = async ({
    password,
    reason,
    conclusion,
    comment,
    transition,
    resourceId,
    resourceType,
    systemName,
    additionalDetails,
  }: VerifyAndSignParams) => {
    if (!user || !profile) throw new Error('Not authenticated');

    // Step 1: Verify password via signInWithPassword
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password,
    });

    if (authError) {
      // Log failed attempt
      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'E_SIGNATURE_FAILED',
        resource_type: resourceType,
        resource_id: resourceId,
        details: {
          transition,
          reason: 'Password verification failed',
          signer_email: user.email,
          ...additionalDetails,
        },
      });
      throw new Error('incorrect_password');
    }

    // Step 2: Log successful e-signature
    const signerRole = roles.find(r => r === 'quality_assurance') || roles[0] || 'unknown';

    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'E_SIGNATURE',
      resource_type: resourceType,
      resource_id: resourceId,
      details: {
        transition,
        system_name: systemName,
        verified_at: new Date().toISOString(),
        reason,
        comment: comment || null,
        conclusion: conclusion || null,
        signer_name: profile.full_name,
        signer_role: signerRole,
        signer_email: user.email,
        ...additionalDetails,
      },
    });

    return { verified: true };
  };

  return { verifyAndSign };
}
