import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
test("system integrations expose only three fixed public navigation categories",()=>{
 const swift=read("../modules/hoopcheck-icons/ios/HoopcheckPublicLinksModule.swift");
 const entries=swift.slice(swift.indexOf("private let entries"),swift.indexOf("private func featureEnabled"));
 assert.deepEqual([...entries.matchAll(/"(\/[^"]+)"/g)].map(x=>x[1]),["/teams","/womens","/leagues"]);
 assert.match(swift,/CSSearchableItemActionType/);
 assert.match(swift,/domain \+ "\." \+ \$0.id == identifier/);
 assert.match(swift,/deleteSearchableItems\(withDomainIdentifiers: \[domain\]\)/);
 assert.match(swift,/timeIntervalSince\(pending.1\) <= 120/);
 assert.match(swift,/featureEnabled\(\) && UserDefaults.standard.bool/);
 assert.match(swift,/guard allow && featureEnabled\(\)/);
 assert.doesNotMatch(swift,/URLSession|supabase|accessToken|user_id/);
});
test("native system links honor feature flag and existing authentication navigation",()=>{
 const config=JSON.parse(read("../modules/hoopcheck-icons/expo-module.config.json"));
 assert.ok(config.apple.modules.includes("HoopcheckPublicLinksModule"));
 assert.ok(config.apple.appDelegateSubscribers.includes("HoopcheckPublicLinkSubscriber"));
 assert.match(read("../app.config.js"),/HoopcheckPublicSystemLinksEnabled: process.env.EXPO_PUBLIC_HOOPCHECK_SYSTEM_LINKS_ENABLED === "true"/);
 const ui=read("../components/PublicSystemLinks.tsx");
 assert.match(ui,/rememberDestination\(route\);router.replace\("\/sign-in"\)/);
 assert.match(ui,/!ready\|\|blocked/);
 assert.match(ui,/publicSystemPath\(await/);
 assert.match(read("../app/_layout.tsx"),/PublicSystemNavigation ready=\{sessionReady && !session.error\}/);
 assert.match(read("../app/settings.tsx"),/<PublicSystemLinksSetting \/>/);
});
