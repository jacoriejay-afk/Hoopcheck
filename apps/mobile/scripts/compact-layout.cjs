/* eslint-disable @typescript-eslint/no-require-imports -- Local browser regression utility. */
const assert = require('node:assert/strict');
exports.viewport = { width: Number(process.env.NATIVE_TEST_WIDTH || 320), height: 812 };
exports.capture = async (page, options) => {
  const overflow = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return [...document.querySelectorAll('[role="button"], [role="tab"], input, textarea, [role="heading"]')]
      .filter(node => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && (rect.left < -1 || rect.right > width + 1);
      }).map(node => node.getAttribute('aria-label') || node.textContent?.slice(0, 80));
  });
  assert.deepEqual(overflow, [], 'Required controls and headings must fit the small iPhone viewport');
  return page.screenshot(options);
};
