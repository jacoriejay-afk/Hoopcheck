export function validateSupabaseUrl(value: string | undefined): string | null {
  if (!value) return "Supabase URL is missing from this build.";
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(value)) {
    return "Supabase URL must be the HTTPS project base URL without a path or query.";
  }
  return null;
}
