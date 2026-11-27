export const supportTopics = {
  scam: { subject: "Report a suspicious basketball offer", category: "security" },
  compromised: { subject: "Report a compromised account", category: "security" },
  billing: { subject: "Membership billing or cancellation", category: "billing" },
  verification: { subject: "Agent verification", category: "verification" },
  copyright: { subject: "Copyright report", category: "general" },
} as const;

export type SupportTopic = keyof typeof supportTopics;

export function supportTopic(value: unknown): SupportTopic | null {
  return typeof value === "string" && Object.hasOwn(supportTopics, value) ? value as SupportTopic : null;
}
