import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validatePasswordPolicy, hashPasswordForHistory, savePasswordToHistory } from '../_shared/passwordPolicy.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminUserId = claimsData.claims.sub;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify super_user role
    const { data: isSuperUser } = await supabaseAdmin.rpc('has_role', {
      _user_id: adminUserId, _role: 'super_user',
    });
    if (!isSuperUser) {
      return new Response(JSON.stringify({ error: 'Super User access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { email, password, full_name, username, language_code = 'es',
            account_expires_at, role = 'system_administrator' } = body;

    // Validate required fields
    if (!email || !password || !full_name || !role) {
      return new Response(JSON.stringify({ error: 'email, password, full_name and role are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate role
    const validRoles = ['super_user', 'system_owner', 'system_administrator', 'business_owner', 'quality_assurance', 'it_manager'];
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: `Invalid role. Valid: ${validRoles.join(', ')}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate password policy
    const passwordValidation = validatePasswordPolicy(password, email, username);
    if (!passwordValidation.valid) {
      return new Response(JSON.stringify({
        error: 'Password does not meet security requirements',
        validation_errors: passwordValidation.errors,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Create auth user
    const { data: newAuthUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name },
    });
    if (createError || !newAuthUser.user) {
      return new Response(JSON.stringify({ error: createError?.message || 'Failed to create user' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const newUserId = newAuthUser.user.id;

    // Save password to history
    const passwordHash = await hashPasswordForHistory(password);
    await savePasswordToHistory(supabaseAdmin, newUserId, passwordHash);

    // UPDATE app_users (trigger already created the row)
    const { error: updateError } = await supabaseAdmin
      .from('app_users')
      .update({
        full_name,
        username: username || null,
        must_change_password: true,
        account_expires_at: account_expires_at || null,
        is_blocked: false,
        failed_login_attempts: 0,
      })
      .eq('id', newUserId);

    if (updateError) {
      console.error('Error updating app_users:', updateError);
    }

    // Create language preference (locked)
    await supabaseAdmin.from('user_language_preference').insert({
      user_id: newUserId,
      language_code,
      locked: true,
      locked_at: new Date().toISOString(),
    });

    // Assign role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: newUserId, role, created_by: adminUserId });
    if (roleError) console.error('Error assigning role:', roleError);

    // Audit log
    await supabaseAdmin.from('audit_log').insert({
      user_id: adminUserId,
      action: 'user_created',
      resource_type: 'user',
      resource_id: newUserId,
      details: { created_email: email, created_full_name: full_name, role, language_code, account_expires_at },
    });

    return new Response(JSON.stringify({
      success: true, user_id: newUserId, message: 'User created successfully',
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
