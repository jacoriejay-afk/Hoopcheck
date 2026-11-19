import { getCachedSession, supabase } from "../supabase";
import { createMembershipReader } from "./client-membership-core";
const reader = createMembershipReader({ session: getCachedSession, request: (url, init) => fetch(url, init) });
let listening = false;
export function getEffectiveMembership(userId: string) {
  if (!listening && typeof window !== "undefined") {
    listening = true;
    // Auth callbacks remain synchronous and invalidate pending account proofs.
    supabase.auth.onAuthStateChange(event => { if (event !== "INITIAL_SESSION") reader.invalidate(); });
  }
  return reader.read(userId);
}
