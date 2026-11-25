export function safeExternalEvidenceUrl(value: string | null): string | null {
  if (!value || value.length > 4096) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function evidenceDownloadName(path: string): string {
  const extension = /\.(pdf|jpg|jpeg|png|webp)$/i.exec(path)?.[1].toLowerCase();
  return "hoopcheck-evidence." + (extension === "jpeg" ? "jpg" : extension || "bin");
}
