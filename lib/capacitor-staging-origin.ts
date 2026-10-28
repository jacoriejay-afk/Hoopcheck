/**
 * Validate the remote origin used by the Capacitor staging prototype.
 * Fail closed so native builds cannot silently point at production.
 */
export function requireCapacitorStagingOrigin(
  configuredUrl: string | undefined,
): { origin: string; hostname: string } {
  const value = configuredUrl?.trim();
  if (!value) {
    throw new Error(
      "CAPACITOR_SERVER_URL is required. Set it to the dedicated HTTPS staging origin; production packaging is blocked by default.",
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("CAPACITOR_SERVER_URL must be a valid absolute HTTPS URL.");
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "CAPACITOR_SERVER_URL must be an HTTPS origin only (no credentials, path, query, or fragment).",
    );
  }

  // DNS treats a trailing dot as the same absolute hostname. Normalize it
  // before checking the production domain so a trailing-dot URL cannot bypass
  // the fail-closed staging restriction.
  const normalizedHostname = url.hostname.toLowerCase().replace(/\.$/, "");

  if (
    normalizedHostname === "hoopcheck.online" ||
    normalizedHostname.endsWith(".hoopcheck.online")
  ) {
    throw new Error(
      "Production HoopCheck hosts are blocked for the native staging prototype. Use a dedicated staging hostname outside hoopcheck.online.",
    );
  }

  return { origin: url.origin, hostname: url.hostname };
}
