import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validatePasswordPolicy, hashPasswordForHistory, savePasswordToHistory } from '../_shared/passwordPolicy.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: "Invalid token" }, 401);
    }

    const callerId = claimsData.claims.sub as string;
    const admin = createClient(supabaseUrl, serviceKey);

    // Verify super_user
    const { data: hasRole } = await admin.rpc("has_role", {
      _user_id: callerId,
      _role: "super_user",
    });
    if (!hasRole) {
      return json({ error: "Forbidden: super_user role required" }, 403);
    }

    const { action, ...payload } = await req.json();

    switch (action) {
      // ───────── LIST USERS ─────────
      case "list_users": {
        const { data, error } = await admin.rpc("get_admin_users_list" as any);
        if (error) return json({ error: error.message }, 500);
        return json({ users: data });
      }

      // ───────── DELETE USER ─────────
      case "delete_user": {
        const { user_id } = payload;
        if (!user_id) return json({ error: "user_id is required" }, 400);
        if (user_id === callerId) return json({ error: "Cannot delete your own account" }, 400);

        const { error: delError } = await admin.auth.admin.deleteUser(user_id);
        if (delError) return json({ error: delError.message }, 400);

        // Audit
        await admin.from("audit_log").insert({
          user_id: callerId,
          action: "user_deleted",
          resource_type: "user",
          resource_id: user_id,
          details: { deleted_by: callerId },
        });

        return json({ success: true });
      }

      // ───────── UNBLOCK USER ─────────
      case "unblock_user": {
        const { user_id } = payload;
        if (!user_id) return json({ error: "user_id is required" }, 400);

        // Unban in auth
        await admin.auth.admin.updateUserById(user_id, { ban_duration: "none" });

        // Update app_users
        const { error: updErr } = await admin
          .from("app_users")
          .update({
            is_blocked: false,
            blocked_at: null,
            blocked_reason: null,
            failed_login_attempts: 0,
            first_failed_login_at: null,
          })
          .eq("id", user_id);

        if (updErr) return json({ error: updErr.message }, 500);

        await admin.from("audit_log").insert({
          user_id: callerId,
          action: "user_unblocked",
          resource_type: "user",
          resource_id: user_id,
        });

        return json({ success: true });
      }

      // ───────── BLOCK USER ─────────
      case "block_user": {
        const { user_id, reason } = payload;
        if (!user_id) return json({ error: "user_id is required" }, 400);
        if (user_id === callerId) return json({ error: "Cannot block your own account" }, 400);

        await admin.auth.admin.updateUserById(user_id, { ban_duration: "876600h" });

        await admin
          .from("app_users")
          .update({
            is_blocked: true,
            blocked_at: new Date().toISOString(),
            blocked_reason: reason || "Blocked by administrator",
          })
          .eq("id", user_id);

        await admin.from("audit_log").insert({
          user_id: callerId,
          action: "user_blocked",
          resource_type: "user",
          resource_id: user_id,
          details: { reason },
        });

        return json({ success: true });
      }

      // ───────── UPDATE USER ─────────
      case "update_user": {
        const { user_id, full_name, username, email, role, account_expires_at, password } = payload;
        if (!user_id) return json({ error: "user_id is required" }, 400);

        // Update app_users fields
        const updateFields: Record<string, any> = {};
        if (full_name !== undefined) updateFields.full_name = full_name;
        if (username !== undefined) updateFields.username = username || null;
        if (account_expires_at !== undefined) updateFields.account_expires_at = account_expires_at || null;

        if (Object.keys(updateFields).length > 0) {
          const { error } = await admin.from("app_users").update(updateFields).eq("id", user_id);
          if (error) return json({ error: error.message }, 500);
        }

        // Update email in auth if changed
        if (email) {
          await admin.auth.admin.updateUserById(user_id, { email, email_confirm: true });
          await admin.from("app_users").update({ email }).eq("id", user_id);
        }

        // Update password if provided
        if (password) {
          const validation = validatePasswordPolicy(password, email, username);
          if (!validation.valid) {
            return json({ error: "Password does not meet requirements", validation_errors: validation.errors }, 400);
          }
          await admin.auth.admin.updateUserById(user_id, { password });
          await admin.from("app_users").update({ must_change_password: true }).eq("id", user_id);
          const hash = await hashPasswordForHistory(password);
          await savePasswordToHistory(admin, user_id, hash);
        }

        // Update role if provided
        if (role) {
          const validRoles = ['super_user', 'system_owner', 'system_administrator', 'business_owner', 'quality_assurance', 'it_manager'];
          if (!validRoles.includes(role)) return json({ error: "Invalid role" }, 400);

          await admin.from("user_roles").delete().eq("user_id", user_id);
          await admin.from("user_roles").insert({ user_id, role, created_by: callerId });
        }

        await admin.from("audit_log").insert({
          user_id: callerId,
          action: "user_updated",
          resource_type: "user",
          resource_id: user_id,
          details: { updated_fields: Object.keys({ ...updateFields, ...(email ? { email } : {}), ...(role ? { role } : {}), ...(password ? { password: "***" } : {}) }) },
        });

        return json({ success: true });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err: any) {
    console.error("admin-manage-users error:", err);
    return json({ error: err.message || "Internal server error" }, 500);
  }
});
