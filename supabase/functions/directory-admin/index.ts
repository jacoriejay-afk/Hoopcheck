import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const cleaned = value.trim();

  return cleaned.length > 0 ? cleaned : null;
}

function isValidUuid(value: unknown): value is string {
  if (typeof value !== "string") return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return json(
      {
        error: "POST required.",
      },
      405
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY"
  );

  if (!supabaseUrl || !serviceRoleKey) {
    return json(
      {
        error: "Server configuration is incomplete.",
      },
      500
    );
  }

  const authorization =
    req.headers.get("Authorization");

  if (!authorization) {
    return json(
      {
        error: "Authentication required.",
      },
      401
    );
  }

  const token = authorization.replace(
    /^Bearer\s+/i,
    ""
  );

  if (!token) {
    return json(
      {
        error: "Authentication token is missing.",
      },
      401
    );
  }

  /*
   * The service-role key is used only inside this
   * server-side Edge Function.
   *
   * The user's JWT is still verified before any
   * administrative operation is allowed.
   */
  const adminClient = createClient(
    supabaseUrl,
    serviceRoleKey
  );

  const {
    data: userData,
    error: userError,
  } = await adminClient.auth.getUser(token);

  if (userError || !userData.user) {
    return json(
      {
        error: "Invalid authentication.",
      },
      401
    );
  }

  const userId = userData.user.id;

  const {
    data: adminRole,
    error: roleError,
  } = await adminClient
    .from("admin_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (roleError || !adminRole) {
    return json(
      {
        error: "Admin or moderator access required.",
      },
      403
    );
  }

  const normalizedRole = String(
    adminRole.role
  )
    .trim()
    .toLowerCase();

  if (
    normalizedRole !== "admin" &&
    normalizedRole !== "moderator"
  ) {
    return json(
      {
        error: "Admin or moderator access required.",
      },
      403
    );
  }

  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return json(
      {
        error: "Invalid JSON.",
      },
      400
    );
  }

  const action = cleanString(body.action);

  if (
    !action ||
    ![
      "create_coach",
      "update_coach",
      "set_active",
    ].includes(action)
  ) {
    return json(
      {
        error:
          "Invalid action. Use create_coach, update_coach, or set_active.",
      },
      400
    );
  }

  /*
   * CREATE COACH
   */
  if (action === "create_coach") {
    const name = cleanString(body.name);

    if (!name) {
      return json(
        {
          error: "Coach name is required.",
        },
        400
      );
    }

    const externalId =
      cleanString(body.external_id);

    const sourceId =
      cleanString(body.source_id);

    const currentTeamId =
      cleanString(body.current_team_id);

    if (
      currentTeamId &&
      !isValidUuid(currentTeamId)
    ) {
      return json(
        {
          error: "Invalid current_team_id.",
        },
        400
      );
    }

    if (
      sourceId &&
      !isValidUuid(sourceId)
    ) {
      return json(
        {
          error: "Invalid source_id.",
        },
        400
      );
    }

    /*
     * If a source is supplied, it must exist and be
     * active.
     */
    let sourceName: string | null = null;

    if (sourceId) {
      const {
        data: source,
        error: sourceError,
      } = await adminClient
        .from("directory_sources")
        .select("id, name, active")
        .eq("id", sourceId)
        .maybeSingle();

      if (
        sourceError ||
        !source ||
        !source.active
      ) {
        return json(
          {
            error:
              "The selected directory source is missing or inactive.",
          },
          400
        );
      }

      sourceName = source.name;
    }

    /*
     * Validate team if supplied.
     */
    if (currentTeamId) {
      const {
        data: team,
        error: teamError,
      } = await adminClient
        .from("teams")
        .select("id")
        .eq("id", currentTeamId)
        .maybeSingle();

      if (teamError || !team) {
        return json(
          {
            error:
              "The selected team does not exist.",
          },
          400
        );
      }
    }

    /*
     * Prevent duplicate provider records.
     */
    if (sourceId && externalId) {
      const {
        data: existing,
      } = await adminClient
        .from("coaches")
        .select("id")
        .eq("source_id", sourceId)
        .eq("external_id", externalId)
        .maybeSingle();

      if (existing) {
        return json(
          {
            error:
              "A coach with this source and external ID already exists.",
            coach_id: existing.id,
          },
          409
        );
      }
    }

    const coachPayload = {
      name,
      country: cleanString(body.country),
      city: cleanString(body.city),
      external_id: externalId,
      current_team_id: currentTeamId,
      website: cleanString(body.website),
      photo_url: cleanString(body.photo_url),
      source: sourceName ?? cleanString(body.source),
      source_id: sourceId,
      last_synced_at: sourceId
        ? new Date().toISOString()
        : null,
      active:
        typeof body.active === "boolean"
          ? body.active
          : true,
    };

    const {
      data: coach,
      error: insertError,
    } = await adminClient
      .from("coaches")
      .insert(coachPayload)
      .select("*")
      .single();

    if (insertError || !coach) {
      return json(
        {
          error:
            insertError?.message ??
            "Unable to create coach.",
        },
        400
      );
    }

    /*
     * Record the administrative directory change.
     */
    if (coach.id) {
      await adminClient
        .from("directory_change_log")
        .insert({
          entity_type: "coach",
          entity_id: coach.id,
          source_id: sourceId,
          action: coach.active
            ? "created"
            : "deactivated",
        });
    }

    return json({
      success: true,
      action: "create_coach",
      coach,
    });
  }

  /*
   * UPDATE COACH
   */
  if (action === "update_coach") {
    const coachId = cleanString(body.coach_id);

    if (!coachId || !isValidUuid(coachId)) {
      return json(
        {
          error: "A valid coach_id is required.",
        },
        400
      );
    }

    const {
      data: existingCoach,
      error: existingError,
    } = await adminClient
      .from("coaches")
      .select("*")
      .eq("id", coachId)
      .maybeSingle();

    if (
      existingError ||
      !existingCoach
    ) {
      return json(
        {
          error: "Coach not found.",
        },
        404
      );
    }

    const updates: Record<
      string,
      unknown
    > = {};

    if ("name" in body) {
      const name = cleanString(body.name);

      if (!name) {
        return json(
          {
            error:
              "Coach name cannot be empty.",
          },
          400
        );
      }

      updates.name = name;
    }

    if ("country" in body) {
      updates.country =
        cleanString(body.country);
    }

    if ("city" in body) {
      updates.city =
        cleanString(body.city);
    }

    if ("website" in body) {
      updates.website =
        cleanString(body.website);
    }

    if ("photo_url" in body) {
      updates.photo_url =
        cleanString(body.photo_url);
    }

    if ("external_id" in body) {
      updates.external_id =
        cleanString(body.external_id);
    }

    if ("current_team_id" in body) {
      const teamId =
        cleanString(body.current_team_id);

      if (
        teamId &&
        !isValidUuid(teamId)
      ) {
        return json(
          {
            error:
              "Invalid current_team_id.",
          },
          400
        );
      }

      if (teamId) {
        const {
          data: team,
          error: teamError,
        } = await adminClient
          .from("teams")
          .select("id")
          .eq("id", teamId)
          .maybeSingle();

        if (teamError || !team) {
          return json(
            {
              error:
                "The selected team does not exist.",
            },
            400
          );
        }
      }

      updates.current_team_id =
        teamId;
    }

    if ("active" in body) {
      if (
        typeof body.active !== "boolean"
      ) {
        return json(
          {
            error:
              "active must be true or false.",
          },
          400
        );
      }

      updates.active = body.active;
    }

    /*
     * Source/provider changes are restricted to
     * valid active directory sources.
     */
    if ("source_id" in body) {
      const sourceId =
        cleanString(body.source_id);

      if (
        sourceId &&
        !isValidUuid(sourceId)
      ) {
        return json(
          {
            error: "Invalid source_id.",
          },
          400
        );
      }

      if (sourceId) {
        const {
          data: source,
          error: sourceError,
        } = await adminClient
          .from("directory_sources")
          .select("id, name, active")
          .eq("id", sourceId)
          .maybeSingle();

        if (
          sourceError ||
          !source ||
          !source.active
        ) {
          return json(
            {
              error:
                "The selected directory source is missing or inactive.",
            },
            400
          );
        }

        updates.source_id = sourceId;
        updates.source = source.name;
        updates.last_synced_at =
          new Date().toISOString();
      } else {
        updates.source_id = null;
        updates.source = null;
        updates.last_synced_at = null;
      }
    }

    if (
      Object.keys(updates).length === 0
    ) {
      return json(
        {
          error:
            "No coach fields were provided to update.",
        },
        400
      );
    }

    /*
     * Prevent duplicate provider records if the
     * external ID or source changes.
     */
    const resultingSourceId =
      "source_id" in updates
        ? updates.source_id
        : existingCoach.source_id;

    const resultingExternalId =
      "external_id" in updates
        ? updates.external_id
        : existingCoach.external_id;

    if (
      resultingSourceId &&
      resultingExternalId
    ) {
      const {
        data: duplicate,
      } = await adminClient
        .from("coaches")
        .select("id")
        .eq(
          "source_id",
          resultingSourceId
        )
        .eq(
          "external_id",
          resultingExternalId
        )
        .neq("id", coachId)
        .maybeSingle();

      if (duplicate) {
        return json(
          {
            error:
              "Another coach already uses this source and external ID.",
            coach_id: duplicate.id,
          },
          409
        );
      }
    }

    const {
      data: updatedCoach,
      error: updateError,
    } = await adminClient
      .from("coaches")
      .update(updates)
      .eq("id", coachId)
      .select("*")
      .single();

    if (
      updateError ||
      !updatedCoach
    ) {
      return json(
        {
          error:
            updateError?.message ??
            "Unable to update coach.",
        },
        400
      );
    }

    /*
     * Determine the appropriate audit action.
     */
    let auditAction:
      | "updated"
      | "deactivated"
      | "reactivated" = "updated";

    if (
      existingCoach.active === true &&
      updatedCoach.active === false
    ) {
      auditAction = "deactivated";
    } else if (
      existingCoach.active === false &&
      updatedCoach.active === true
    ) {
      auditAction = "reactivated";
    }

    await adminClient
      .from("directory_change_log")
      .insert({
        entity_type: "coach",
        entity_id: updatedCoach.id,
        source_id:
          updatedCoach.source_id,
        action: auditAction,
      });

    return json({
      success: true,
      action: "update_coach",
      coach: updatedCoach,
    });
  }

  /*
   * SET ACTIVE / INACTIVE
   */
  if (action === "set_active") {
    const coachId = cleanString(body.coach_id);
    const active = body.active;

    if (
      !coachId ||
      !isValidUuid(coachId)
    ) {
      return json(
        {
          error: "A valid coach_id is required.",
        },
        400
      );
    }

    if (typeof active !== "boolean") {
      return json(
        {
          error:
            "active must be true or false.",
        },
        400
      );
    }

    const {
      data: existingCoach,
      error: existingError,
    } = await adminClient
      .from("coaches")
      .select("id, active, source_id")
      .eq("id", coachId)
      .maybeSingle();

    if (
      existingError ||
      !existingCoach
    ) {
      return json(
        {
          error: "Coach not found.",
        },
        404
      );
    }

    if (existingCoach.active === active) {
      return json({
        success: true,
        action: "set_active",
        message:
          "Coach already has the requested status.",
        coach_id: coachId,
        active,
      });
    }

    const {
      data: updatedCoach,
      error: updateError,
    } = await adminClient
      .from("coaches")
      .update({
        active,
      })
      .eq("id", coachId)
      .select("*")
      .single();

    if (
      updateError ||
      !updatedCoach
    ) {
      return json(
        {
          error:
            updateError?.message ??
            "Unable to change coach status.",
        },
        400
      );
    }

    await adminClient
      .from("directory_change_log")
      .insert({
        entity_type: "coach",
        entity_id: coachId,
        source_id:
          updatedCoach.source_id,
        action: active
          ? "reactivated"
          : "deactivated",
      });

    return json({
      success: true,
      action: "set_active",
      coach: updatedCoach,
    });
  }

  return json(
    {
      error: "Unsupported action.",
    },
    400
  );
});
