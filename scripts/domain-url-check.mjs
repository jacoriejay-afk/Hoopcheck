import assert from "node:assert/strict";
const baseURL = process.env.THEME_TEST_BASE_URL || "http://127.0.0.1:3000";
const oldHost = ["hoopcheck", "com"].join(".");
let ready = false;
for (let attempt = 0; attempt < 60; attempt += 1) {
  try { const response = await fetch(baseURL); if (response.ok) { ready = true; break; } } catch {}
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
assert.ok(ready, "Next production server did not become ready.");
const [sitemapResponse, robotsResponse] = await Promise.all([fetch(baseURL + "/sitemap.xml"), fetch(baseURL + "/robots.txt")]);
assert.equal(sitemapResponse.status, 200, "sitemap.xml did not return 200");
assert.equal(robotsResponse.status, 200, "robots.txt did not return 200");
const xml = await sitemapResponse.text();
const robotsText = await robotsResponse.text();
const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1].trim());
assert.ok(urls.length >= 5, "Sitemap contains fewer than five URLs.");
const firstFive = urls.slice(0, 5);
for (const url of firstFive) {
  assert.equal(new URL(url).origin, "https://hoopcheck.online", "Wrong canonical origin in sitemap: " + url);
  assert.ok(!url.includes(oldHost), "Legacy host found in sitemap: " + url);
}
assert.ok(robotsText.includes("https://hoopcheck.online/sitemap.xml"), "robots.txt points to the wrong sitemap host.");
assert.ok(!robotsText.includes(oldHost), "Legacy host found in robots.txt.");
console.log("SITEMAP_FIRST_5_URLS=" + JSON.stringify(firstFive, null, 2));
console.log("ROBOTS_SITEMAP_URL=https://hoopcheck.online/sitemap.xml");
