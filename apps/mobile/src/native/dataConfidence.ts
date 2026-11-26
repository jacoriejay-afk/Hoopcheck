/** Presentation only: caller supplies evidence from its existing authorization/rights boundary.
 * A label cannot establish rights, verification, or promote a user assertion.
 */
export type DataEvidence =
 | { kind: "reviewed-provider"; observedAt: string; expiresAt: string }
 | { kind: "directory-record" }
 | { kind: "self-reported" }
 | { kind: "provisional" }
 | { kind: "unavailable" };
export function dataConfidence(evidence: DataEvidence, now = Date.now()) {
  switch (evidence.kind) {
    case "reviewed-provider": {
      const observed=Date.parse(evidence.observedAt), expiry=Date.parse(evidence.expiresAt);
      if (!Number.isFinite(now) || !Number.isFinite(observed) || !Number.isFinite(expiry) || observed > now || expiry <= observed)
        return {state:"unavailable",label:"Verification unavailable",detail:"Source timing could not be validated."} as const;
      if (expiry <= now) return {state:"expired",label:"Expired snapshot",detail:"Refresh before relying on these figures."} as const;
      return {state:"reviewed-provider",label:"Reviewed provider snapshot",detail:"Source and display rights were checked for this preview; this is not a guarantee of completeness."} as const;
    }
    case "directory-record": return {state:"directory-record",label:"Directory record",detail:"Listed information may be incomplete or outdated; confirm directly."} as const;
    case "self-reported": return {state:"self-reported",label:"Self-reported",detail:"Submitted information has not been independently verified."} as const;
    case "provisional": return {state:"provisional",label:"Provisional",detail:"Derived or incomplete information; not official standings."} as const;
    default: return {state:"unavailable",label:"Data unavailable",detail:"No eligible evidence to display."} as const;
  }
}
