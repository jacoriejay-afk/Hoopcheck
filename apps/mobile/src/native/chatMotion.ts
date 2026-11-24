// Presentation-only: never infer peer presence, authorization, or delivery from an animation.
export type ConfirmedMessage = { id: string; created_at: string };
export type MessageMotionSnapshot = { scope: string; watermark: number; fresh: Set<string> };
export function confirmedMessageMotion(previous: MessageMotionSnapshot | null, scope: string, rows: readonly ConfirmedMessage[], active: boolean): MessageMotionSnapshot | null {
  if (!active || !scope) return null;
  const baseline = previous?.scope === scope ? previous.watermark : null;
  const fresh = new Set<string>();
  let watermark = baseline ?? 0;
  for (const row of rows) {
    const timestamp = Date.parse(row.created_at);
    if (!row.id || !Number.isFinite(timestamp)) continue;
    // Older history revealed after a block/mute change stays static.
    if (baseline !== null && timestamp > baseline) fresh.add(row.id);
    watermark = Math.max(watermark, timestamp);
  }
  return { scope, watermark, fresh };
}
