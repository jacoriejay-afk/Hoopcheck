import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createAuthClient(canSetCookies = false) {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll(cookiesToSet) {
          if (canSetCookies) {
            for (const { name, value, options } of cookiesToSet) store.set(name, value, options);
          }
        },
      },
    },
  );
}
