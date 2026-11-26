/** Non-security presentation experiment. No account identifiers, telemetry or billing gates. */
export const directoryExperimentKey="hc-directory-layout-experiment-v1";
export type DirectoryVariant="control"|"compact";
export function parseDirectoryVariant(value:unknown):DirectoryVariant|null{
 return value==="control"||value==="compact"?value:null;
}
export function assignDirectoryVariant(seed:number):DirectoryVariant{
 if(!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)return "control";
 // Uniform random input is generated only on explicit opt-in. Persist only the variant.
 return seed<0x80000000?"control":"compact";
}
export function effectiveDirectoryVariant(enabled:boolean,consented:unknown):DirectoryVariant{
 return enabled?parseDirectoryVariant(consented)??"control":"control";
}
