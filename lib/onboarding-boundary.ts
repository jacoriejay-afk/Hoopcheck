export type OnboardingRole = "player"|"coach"|"scout"|"agent"|"fan"|"manager";
const roles: ReadonlySet<string> = new Set(["player","coach","scout","agent","fan","manager"]);
export function isOnboardingRole(value: unknown): value is OnboardingRole {
 return typeof value === "string" && roles.has(value);
}
// Accept only a same-origin relative route, not a protocol-relative URL,
// escaped path separator, control character, or login loop.
export function safeOnboardingReturn(value: string|null, origin: string): string {
 if(!value||!value.startsWith("/")||value.startsWith("//")||/[\\\s\u0000-\u001f\u007f]/.test(value)||/%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(value))return "";
 try {
  const target=new URL(value,origin);
  if(target.origin!==origin||target.username||target.password||target.pathname==="/login"||target.pathname.startsWith("/login/")||target.pathname.startsWith("//"))return "";
  return target.pathname+target.search+target.hash;
 }catch{return "";}
}
