import { nativeDestination } from "../src/native/deepLinks";

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return nativeDestination(path);
}
