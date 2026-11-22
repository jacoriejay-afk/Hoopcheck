import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../supabase/candidates/build9_public_follow_avatar_mask_review_only.sql",import.meta.url),"utf8");
for(const re of [/^BEGIN;$/m,/^ROLLBACK;\s*$/m,/557d85a6abf873e47ffc1f4ae283debd/,
 /STABLE SECURITY DEFINER/,/SET search_path TO ''/,/get_public_follow_list\(p_mode text, p_target_type text DEFAULT NULL::text/,
 /RETURNS TABLE\(id uuid, target_type text, target_id uuid, display_name text, avatar_url text, account_type text, player_verified boolean\)/i,
 /follower\.avatar_moderation_status IS NULL\s+OR follower\.avatar_moderation_status = 'approved'/,
 /target_profile\.avatar_moderation_status IS NULL\s+OR target_profile\.avatar_moderation_status = 'approved'/,
 /WHEN fr\.target_type='team' THEN coalesce\(team\.logo_url,womens_team\.logo_url\)/,
 /auth\.uid\(\)/,/p_mode='followers' AND follower\.profile_visibility='public'/,
 /requested\.profile_visibility='public'/,/ORDER BY fr\.created_at DESC/]) assert.match(sql,re);
assert.doesNotMatch(sql,/^COMMIT;$/m);
assert.equal((sql.match(/^ROLLBACK;$/gm)||[]).length,1);
console.log("PASS: review-only follow avatar mask preserves visibility, legacy-null behavior, team crests, owner and ROLLBACK");
