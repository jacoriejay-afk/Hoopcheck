import { passportHtml, type Passport } from "./playerPassport.ts";
export type PassportShareIO = {
  platform: string;
  timeoutMs?: number;
  identity: () => Promise<{ id: string; accountType: string } | null>;
  current: () => boolean;
  available: () => Promise<boolean>;
  print: (html: string) => Promise<string>;
  share: (uri: string) => Promise<void>;
  remove: (uri: string) => Promise<void>;
};
/** No camera, library or tracking permission is needed to share an app-created PDF. */
export async function sharePlayerPassport(pass: Passport, owner: string, io: PassportShareIO) {
  if (!["ios", "android"].includes(io.platform)) throw Error("Passport file sharing is available in the iOS and Android app.");
  const verify = async () => {
    if (!io.current()) throw Error("Export cancelled. Reopen your Passport to try again.");
    const identity = await io.identity();
    if (!identity || identity.id !== owner || identity.accountType !== "player" || !io.current()) throw Error("Verify your player account again before exporting.");
  };
  await verify();
  let available: boolean;
  try { available = await io.available(); }
  catch { throw Error("Passport sharing is unavailable in this app version."); }
  if (!available) throw Error("File sharing is unavailable on this device.");
  if (!io.current()) throw Error("Export cancelled. Reopen your Passport to try again.");
  let uri: string | undefined;
  try {
    let printed: string;
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pending = io.print(passportHtml(pass)).then(async file => {
      if (timedOut && typeof file === "string" && file.startsWith("file:///")) { await io.remove(file); }
      return file;
    });
    try {
      printed = await Promise.race([pending, new Promise<never>((_, reject) => { timer = setTimeout(() => { timedOut = true; reject(Error("timeout")); }, io.timeoutMs ?? 30000); })]);
    } catch { throw Error("Your Passport could not be prepared. Try again."); }
    finally { clearTimeout(timer); }
    if (typeof printed !== "string" || !printed.startsWith("file:///") || printed.includes("\0")) throw Error("Your Passport could not be prepared safely.");
    uri = printed;
    await verify();
    try { await io.share(uri); }
    catch { throw Error("Sharing could not complete. Your temporary Passport will be removed."); }
  } finally {
    if (uri) {
      try { await io.remove(uri); }
      catch { throw Error("The temporary Passport could not be removed. Close the app before trying again."); }
    }
  }
}
