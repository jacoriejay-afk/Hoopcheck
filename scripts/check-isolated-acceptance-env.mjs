#!/usr/bin/env node
// Offline local-only preflight. No network calls, file loads, or process launches.
// Not proof of deployed isolation; does not authorize privileged/write journeys.
function validate(env) {
  const failures=[];
  const expected="https://vcprqpjkyubzzcjatdpx.supabase.co";
  const has=k=>typeof env[k]==="string"&&env[k].length>0;
  if(env.HOOPCHECK_ACCEPTANCE_MODE!=="isolated-local") failures.push("HOOPCHECK_ACCEPTANCE_MODE must be isolated-local");
  if(env.NEXT_PUBLIC_SUPABASE_URL!==expected) failures.push("NEXT_PUBLIC_SUPABASE_URL must be the exact isolated project origin");
  for(const k of ["SUPABASE_URL","EXPO_PUBLIC_SUPABASE_URL","HOOPCHECK_STRIPE_TEST_SUPABASE_URL"]) if(has(k)&&env[k]!==expected) failures.push(k+" must match the isolated project");
  const k=env.HOOPCHECK_ACCEPTANCE_EXPECTED_PUBLISHABLE_KEY;
  if(typeof k!=="string"||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(k)) failures.push("Provide the isolated project's independently verified modern publishable key");
  if(!has("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")||env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!==k) failures.push("Public web key must equal independently verified test key");
  for(const alias of ["SUPABASE_PUBLISHABLE_KEY","EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]) if(has(alias)&&env[alias]!==k) failures.push(alias+" must match test key");
  if(!/^http:\/\/(?:127\.0\.0\.1|localhost):[0-9]{1,5}$/.test(env.NEXT_PUBLIC_SITE_URL??"")) failures.push("NEXT_PUBLIC_SITE_URL must be a local HTTP origin with an explicit port");
  if(env.STRIPE_CHECKOUT_ENABLED!=="false") failures.push("STRIPE_CHECKOUT_ENABLED must be false");
  if(has("STRIPE_CHECKOUT_MODE")&&env.STRIPE_CHECKOUT_MODE!=="test") failures.push("STRIPE_CHECKOUT_MODE must not be live");
  for(const name of Object.keys(env)) {
    if(!has(name)) continue;
    if(/^(?:NEXT_PUBLIC_|EXPO_PUBLIC_)?(?:SUPABASE_(?:SERVICE_ROLE_KEY|SECRET_KEY|JWT_SECRET|ANON_KEY)|(?:DATABASE|POSTGRES|DIRECT)_URL|STRIPE_(?:SECRET_KEY|WEBHOOK_SECRET|PRO_PRICE_ID|PREMIUM_PRICE_ID)|MUX_(?:TOKEN_ID|TOKEN_SECRET|SIGNING_PRIVATE_KEY|SIGNING_KEY_ID)|OPENAI_API_KEY|API_SPORTS_BASKETBALL_KEY|BALLDONTLIE_API_KEY|APPLE_.*(?:KEY|SECRET|PASSWORD)|RESEND_API_KEY|SMTP_PASSWORD)$/.test(name)) failures.push("Disallowed credential present: "+name);
    if(/^(?:NEXT_PUBLIC_|EXPO_PUBLIC_)?(?:HOOPGROUPS_CHANNELS_ENABLED|HOOPGROUPS_CHANNELS_SERVER_ENABLED|HOOPREELS_PUBLIC_UPLOADS_ENABLED)$/.test(name)&&env[name]!=="false") failures.push("Feature activation not allowed during baseline: "+name);
  }
  if(has("VERCEL_ENV")||has("VERCEL")||env.NODE_ENV==="production") failures.push("Local-only preflight rejects hosted/production process");
  return failures;
}
function selfTest() {
 const sample={HOOPCHECK_ACCEPTANCE_MODE:"isolated-local",NEXT_PUBLIC_SUPABASE_URL:"https://vcprqpjkyubzzcjatdpx.supabase.co",HOOPCHECK_ACCEPTANCE_EXPECTED_PUBLISHABLE_KEY:"sb_publishable_fixture",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_fixture",NEXT_PUBLIC_SITE_URL:"http://localhost:3000",STRIPE_CHECKOUT_ENABLED:"false",STRIPE_CHECKOUT_MODE:"test"};
 if(validate(sample).length) throw Error("valid fixture rejected");
 const cases=[
 {HOOPCHECK_ACCEPTANCE_MODE:""}, {NEXT_PUBLIC_SUPABASE_URL:"https://ucbdceaieyenljcwlhnj.supabase.co"}, {NEXT_PUBLIC_SUPABASE_URL:"https://vcprqpjkyubzzcjatdpx.supabase.co/path"}, {SUPABASE_URL:"https://ucbdceaieyenljcwlhnj.supabase.co"}, {NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_wrong"}, {HOOPCHECK_ACCEPTANCE_EXPECTED_PUBLISHABLE_KEY:"sb_secret_fixture"}, {NEXT_PUBLIC_SITE_URL:"https://hoopcheck.online"}, {STRIPE_CHECKOUT_ENABLED:"true"}, {STRIPE_CHECKOUT_MODE:"live"}, {SUPABASE_SERVICE_ROLE_KEY:"fixture"}, {MUX_TOKEN_SECRET:"fixture"}, {STRIPE_SECRET_KEY:"fixture"}, {APPLE_PRIVATE_KEY:"fixture"}, {DATABASE_URL:"fixture"}, {NEXT_PUBLIC_HOOPGROUPS_CHANNELS_ENABLED:"true"}, {VERCEL_ENV:"preview"}, {NODE_ENV:"production"}, {EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_wrong"}];
 for(const patch of cases) {const issues=validate({...sample,...patch});if(!issues.length||issues.some(s=>s.includes("sb_publishable_wrong")||s.includes("sb_secret_fixture"))) throw Error("negative case failed: "+Object.keys(patch).join(","));}
 return cases.length+1;
}
if(process.argv.includes("--self-test")) {
  console.log("PASS "+selfTest()+" offline isolated-environment cases");
} else {
  const issues=validate(process.env);
  if(issues.length) {
    for(const issue of issues) console.error("HOLD "+issue);
    process.exitCode=1;
  } else {
    console.log("PASS local environment preflight only; schema, signed Auth, browser/runtime isolation, and release gates remain separate.");
  }
}
