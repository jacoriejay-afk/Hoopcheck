export const privacyRequestLabels = {
  access: "Access my data",
  correction: "Correct my data",
  deletion: "Request data deletion",
  export: "Export my data",
  privacy_question: "Privacy question",
} as const;
export type PrivacyRequestType = keyof typeof privacyRequestLabels;
export type PrivacyRequest = { id: string; request_type: PrivacyRequestType; status: string; details: string; created_at: string };
export function privacyRequestPayload(owner: string, type: string, details: string) {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(owner)) throw Error("Verify your account first.");
  if (!Object.prototype.hasOwnProperty.call(privacyRequestLabels, type)) throw Error("Select a valid request type.");
  const clean = details.trim();
  if (clean.length < 10 || clean.length > 5000) throw Error("Describe your request in 10–5,000 characters.");
  return { requester_id: owner, request_type: type as PrivacyRequestType, details: clean };
}
export function privacyRequestRows(input: unknown): PrivacyRequest[] {
  if (!Array.isArray(input)) throw Error("Privacy requests unavailable.");
  return input.map(value => {
    if (!value || typeof value !== "object" || typeof value.id !== "string" ||
      !Object.prototype.hasOwnProperty.call(privacyRequestLabels, value.request_type) ||
      typeof value.status !== "string" || typeof value.details !== "string" ||
      typeof value.created_at !== "string" || !Number.isFinite(Date.parse(value.created_at))) throw Error("Privacy requests unavailable.");
    return { id: value.id, request_type: value.request_type, status: value.status, details: value.details, created_at: value.created_at };
  });
}
