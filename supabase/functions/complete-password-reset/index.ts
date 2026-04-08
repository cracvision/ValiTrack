import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  validatePasswordPolicy,
  hashPasswordForHistory,
  savePasswordToHistory,
  isPasswordInHistory,
} from "../_shared/passwordPolicy.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { token, email, new_password } = await req.json();

    if (!token || !email || !new_password) {
      return new Response(
        JSON.stringify({ error: "Missing required fields." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const tokenHash = await sha256Hex(token);

    // Look up valid token
    const { data: tokenRow } = await supabase
      .from("password_reset_tokens")
      .select("id, user_id, email, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .eq("email", normalizedEmail)
      .is("used_at", null)
      .maybeSingle();

    if (!tokenRow) {
      await supabase.from("audit_log").insert({
        action: "PASSWORD_RESET_FAILED",
        resource_type: "password_reset",
        details: { email: normalizedEmail, reason: "invalid_token" },
      });
      return new Response(
        JSON.stringify({ error: "invalid_token", message: "Invalid or expired reset link. Please request a new one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiration
    if (new Date(tokenRow.expires_at) < new Date()) {
      await supabase.from("audit_log").insert({
        action: "PASSWORD_RESET_FAILED",
        resource_type: "password_reset",
        resource_id: tokenRow.id,
        user_id: tokenRow.user_id,
        details: { email: normalizedEmail, reason: "expired_token" },
      });
      return new Response(
        JSON.stringify({ error: "expired_token", message: "This reset link has expired. Please request a new one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate password policy
    const validation = validatePasswordPolicy(new_password, normalizedEmail);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: "password_policy", message: "Password does not meet requirements.", details: validation.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check password history
    const inHistory = await isPasswordInHistory(supabase, tokenRow.user_id, new_password, 5);
    if (inHistory) {
      return new Response(
        JSON.stringify({ error: "password_history", message: "This password has been used recently. Choose a different one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update password via admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(tokenRow.user_id, {
      password: new_password,
    });

    if (updateError) {
      console.error("Failed to update password:", updateError);
      return new Response(
        JSON.stringify({ error: "update_failed", message: "Failed to update password. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark token as used
    await supabase
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenRow.id);

    // Invalidate all other unused tokens for this user
    await supabase
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("user_id", tokenRow.user_id)
      .is("used_at", null);

    // Save to password history
    const passwordHash = await hashPasswordForHistory(new_password);
    await savePasswordToHistory(supabase, tokenRow.user_id, passwordHash);

    // Set must_change_password = false
    await supabase
      .from("app_users")
      .update({ must_change_password: false, updated_at: new Date().toISOString() })
      .eq("id", tokenRow.user_id);

    // Send password_changed notification
    await supabase.functions.invoke("send-notification", {
      body: {
        notification_type: "account_password_changed",
        recipient_user_id: tokenRow.user_id,
        data: { changed_at: new Date().toISOString() },
      },
    });

    // Audit log
    await supabase.from("audit_log").insert({
      action: "PASSWORD_RESET_COMPLETED",
      resource_type: "password_reset",
      resource_id: tokenRow.id,
      user_id: tokenRow.user_id,
      details: { email: normalizedEmail, token_id: tokenRow.id },
    });

    return new Response(
      JSON.stringify({ success: true, message: "Password has been reset successfully." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("complete-password-reset error:", error);
    return new Response(
      JSON.stringify({ error: "internal_error", message: "An unexpected error occurred." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
