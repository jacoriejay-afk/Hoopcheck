import type { MeasurementSystem } from "./preferenceStore";

/** Only convert explicitly labelled measurements. Never guess units for legacy strings. */
export function heightPreview(input: string, system: MeasurementSystem): string | null {
  const value = input.trim();
  const metric = value.match(/^(\d{1,3}(?:\.\d{1,2})?)\s*(cm|m)$/i);
  const imperial = value.match(/^(\d{1,2})\s*(?:ft|['′])\s*(\d{1,2}(?:\.\d{1,2})?)\s*(?:in|["″])?$/i);
  let cm: number;
  if (metric) cm = Number(metric[1]) * (metric[2].toLowerCase() === "m" ? 100 : 1);
  else if (imperial && Number(imperial[2]) < 12) cm = (Number(imperial[1]) * 12 + Number(imperial[2])) * 2.54;
  else return null;
  if (!Number.isFinite(cm) || cm <= 0 || cm > 300) return null;
  if (system === "metric") return Math.round(cm * 10) / 10 + " cm";
  const inches = Math.round(cm / 2.54);
  return Math.floor(inches / 12) + " ft " + inches % 12 + " in";
}
