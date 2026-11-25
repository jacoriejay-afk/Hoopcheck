export const ALERT_LIST_LIMIT = 100;
export const ALERT_FILTERS = [["all","All"],["unread","Unread"],["games","Games"],["clubs","Clubs"],["reviews","Reviews"],["trust","Trust & pay"]] as const;
export type AlertFilter = typeof ALERT_FILTERS[number][0];
type AlertSearchFields = { title: string; body: string; target_type: string; notification_type: string; read_at: string | null };
const reviewTypes = new Set(["review","rating","trust_score","pay_warning"]);
export function matchesAlertFilter(n: AlertSearchFields, filter: AlertFilter): boolean {
  switch (filter) {
    case "all": return true;
    case "unread": return !n.read_at;
    case "games": return n.target_type === "game";
    case "clubs": return n.target_type !== "game" && !reviewTypes.has(n.notification_type);
    case "reviews": return reviewTypes.has(n.notification_type);
    case "trust": return n.notification_type === "trust_score" || n.notification_type === "pay_warning";
  }
}
export function matchesAlertSearch(n: AlertSearchFields, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const text = (n.title + " " + n.body).toLowerCase();
  return terms.every(term => text.includes(term));
}
