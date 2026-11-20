// Shared by Node regressions and the injected browser audit. No app/runtime code.
export function makeThemeColorMath() {
  const clamp = value => Math.min(1, Math.max(0, value));
  const alpha = value => value == null ? 1 : clamp(value.endsWith('%') ? parseFloat(value) / 100 : Number(value));
  function parse(value) {
    if (typeof value !== 'string') return null;
    const srgb = /^color\(srgb\s+([^)]*)\)$/i.exec(value.trim());
    if (srgb) {
      const [channels, opacity] = srgb[1].split('/');
      const values = channels.trim().split(/\s+/).map(value => clamp(value.endsWith('%') ? parseFloat(value) / 100 : Number(value)) * 255);
      return values.length === 3 && values.every(Number.isFinite) ? [...values, alpha(opacity?.trim())] : null;
    }
    const rgb = /^rgba?\(([^)]*)\)$/i.exec(value.trim());
    if (!rgb) return null;
    const values = rgb[1].trim().split(/[\s,/]+/);
    const channels = values.slice(0, 3).map(value => value.endsWith('%') ? clamp(parseFloat(value) / 100) * 255 : Math.min(255, Math.max(0, Number(value))));
    return values.length >= 3 && values.length <= 4 && channels.every(Number.isFinite) ? [...channels, alpha(values[3])] : null;
  }
  function composite(front, back) {
    const opacity = front[3] + back[3] * (1 - front[3]);
    if (!opacity) return [0, 0, 0, 0];
    return [...front.slice(0, 3).map((value, index) => (value * front[3] + back[index] * back[3] * (1 - front[3])) / opacity), opacity];
  }
  function luminance(color) {
    return color.slice(0, 3).map(value => { const channel = value / 255; return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4; }).reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
  }
  function contrast(foreground, background) {
    const back = composite(background, [255, 255, 255, 1]);
    const front = composite(foreground, back);
    const values = [luminance(front), luminance(back)];
    return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
  }
  function background(element, styles = globalThis.getComputedStyle) {
    const layers = [];
    for (let node = element; node; node = node.parentElement) {
      const candidate = parse(styles(node).backgroundColor);
      if (candidate && candidate[3] > 0) { layers.push(candidate); if (candidate[3] === 1) break; }
    }
    return layers.reverse().reduce((back, front) => composite(front, back), [255, 255, 255, 1]);
  }
  return { parse, composite, luminance, contrast, background };
}
