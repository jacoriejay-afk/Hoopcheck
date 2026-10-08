import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}

export async function POST() {
  const { user, error } = await getUser();
  if (error || !user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return NextResponse.json({ error: "Account deletion is not configured yet." }, { status: 503 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
