export function classifyFeedPublication(status: number, allowed: unknown) {
  const ok = status >= 200 && status < 300;
  if (ok && allowed === true) return "published";
  if ((ok && allowed === false) || (status >= 400 && status < 500 && status !== 408)) return "rejected";
  return "unconfirmed";
}
