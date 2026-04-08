import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VALITRACK_APP_URL = Deno.env.get("VALITRACK_APP_URL")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GENERIC_MESSAGE = "If an account exists with this email, you will receive reset instructions shortly.";

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

  try {
    const { email } = await req.json();

    // Validate email format
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ message: GENERIC_MESSAGE }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Look up user
    const { data: user } = await supabase
      .from("app_users")
      .select("id, full_name, email, is_blocked")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (!user || user.is_blocked) {
      // Log attempt but don't reveal account existence
      await supabase.from("audit_log").insert({
        action: "PASSWORD_RESET_REQUESTED",
        resource_type: "password_reset",
        details: { email: normalizedEmail, found: false },
      });

      return new Response(
        JSON.stringify({ message: GENERIC_MESSAGE }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limit: max 3 tokens in last 15 minutes
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("password_reset_tokens")
      .select("id", { count: "exact", head: true })
      .eq("email", normalizedEmail)
      .gte("created_at", fifteenMinAgo);

    if ((count ?? 0) >= 3) {
      // Silent rate limit
      return new Response(
        JSON.stringify({ message: GENERIC_MESSAGE }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate token
    const rawToken = crypto.randomUUID();
    const tokenHash = await sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Store token
    const { data: tokenRow } = await supabase
      .from("password_reset_tokens")
      .insert({
        user_id: user.id,
        email: normalizedEmail,
        token_hash: tokenHash,
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    // Build reset URL
    const resetUrl = `${VALITRACK_APP_URL}/reset-password?token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}`;

    // Send notification via send-notification/
    await supabase.functions.invoke("send-notification", {
      body: {
        notification_type: "password_reset",
        recipient_user_id: user.id,
        data: {
          reset_url: resetUrl,
          expires_in_en: "1 hour",
          expires_in_es: "1 hora",
        },
      },
    });

    // Audit log
    await supabase.from("audit_log").insert({
      action: "PASSWORD_RESET_REQUESTED",
      resource_type: "password_reset",
      resource_id: tokenRow?.id || null,
      user_id: user.id,
      details: { email: normalizedEmail, found: true, token_id: tokenRow?.id },
    });

    return new Response(
      JSON.stringify({ message: GENERIC_MESSAGE }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("request-password-reset error:", error);
    return new Response(
      JSON.stringify({ message: GENERIC_MESSAGE }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
