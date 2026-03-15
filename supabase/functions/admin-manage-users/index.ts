import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller identity
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub;

    // Check caller has super_user role using service client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: hasRole } = await adminClient.rpc("has_role", {
      _user_id: callerId,
      _role: "super_user",
    });

    if (!hasRole) {
      return new Response(JSON.stringify({ error: "Forbidden: super_user role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...payload } = await req.json();

    switch (action) {
      case "create_user": {
        const { email, full_name, password, roles } = payload;
        if (!email || !password || !full_name || !roles?.length) {
          return new Response(
            JSON.stringify({ error: "email, full_name, password, and roles are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Create user via admin API
        const { data: userData, error: createError } =
          await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name },
          });

        if (createError) {
          return new Response(JSON.stringify({ error: createError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Assign roles
        for (const role of roles) {
          await adminClient.from("user_roles").insert({
            user_id: userData.user.id,
            role,
          });
        }

        return new Response(
          JSON.stringify({ user: { id: userData.user.id, email, full_name, roles } }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "list_users": {
        // Get all app_users with their roles
        const { data: appUsers, error: usersError } = await adminClient
          .from("app_users")
          .select("*")
          .order("created_at", { ascending: false });

        if (usersError) {
          return new Response(JSON.stringify({ error: usersError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: allRoles, error: rolesError } = await adminClient
          .from("user_roles")
          .select("*");

        if (rolesError) {
          return new Response(JSON.stringify({ error: rolesError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const usersWithRoles = appUsers.map((u: any) => ({
          ...u,
          roles: allRoles
            .filter((r: any) => r.user_id === profile.id)
            .map((r: any) => r.role),
        }));

        return new Response(JSON.stringify({ users: usersWithRoles }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update_roles": {
        const { user_id, roles } = payload;
        if (!user_id || !roles) {
          return new Response(
            JSON.stringify({ error: "user_id and roles are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Delete existing roles
        await adminClient.from("user_roles").delete().eq("user_id", user_id);

        // Insert new roles
        for (const role of roles) {
          await adminClient.from("user_roles").insert({ user_id, role });
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "disable_user": {
        const { user_id } = payload;
        if (!user_id) {
          return new Response(
            JSON.stringify({ error: "user_id is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: banError } = await adminClient.auth.admin.updateUserById(user_id, {
          ban_duration: "876600h", // ~100 years
        });

        if (banError) {
          return new Response(JSON.stringify({ error: banError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
