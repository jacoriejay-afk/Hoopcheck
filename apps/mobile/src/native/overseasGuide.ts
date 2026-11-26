/** General educational guidance; no account data, external calls or country-specific legal claims. */
export const overseasGuideIntro = "Before accepting an overseas basketball offer, verify the organization, written terms and practical arrangements independently. This guide is educational, not legal, immigration, tax or medical advice.";
export const overseasGuideSections = [
  { id: "club", title: "Verify the club and competition", checks: [
    "Confirm the club's current legal name, league, division and season with the federation or league. Historical names may not identify the current organization.",
    "Confirm the person making the offer is authorized using independently obtained club contact details.",
    "Speak privately with consenting current or former players; individual reviews are experiences, not guarantees."
  ] },
  { id: "contract", title: "Review the written contract", checks: [
    "Confirm the contracting entity, dates, salary currency, gross or net amounts, payment dates, bonuses, deductions and termination terms in writing.",
    "Clarify guarantees, injury provisions, insurance, release clauses, dispute process and which language version governs.",
    "Ask an independent qualified adviser to review the agreement before signing; do not rely on verbal promises."
  ] },
  { id: "travel", title: "Check immigration and registration", checks: [
    "Use official immigration and federation sources to confirm work authorization, entry requirements, registration and international clearance for your situation.",
    "Confirm who arranges and pays for required documentation and travel; do not surrender your passport to an unauthorized person.",
    "Keep copies of documents and verify that travel arrangements match your actual authorization."
  ] },
  { id: "living", title: "Confirm housing and daily expenses", checks: [
    "Get written details on housing, utilities, transport, meals, flights and any deposits or deductions.",
    "Check health coverage, injury treatment arrangements, emergency contacts and access to local care.",
    "Plan an independent budget for local costs and a safe return journey if the arrangement ends unexpectedly."
  ] },
  { id: "payment", title: "Protect your income and records", checks: [
    "Ask how payments are made, who pays them, and how late or missing payments are handled under the agreement.",
    "Keep private copies of the signed agreement, payment records and official communications.",
    "Verify tax and reporting requirements with a qualified adviser; do not share banking credentials or pay unexpected advance fees."
  ] },
  { id: "arrival", title: "Prepare for arrival and departure", checks: [
    "Verify arrival dates, airport pickup, accommodation address and the club's emergency contact before departure.",
    "Confirm the training schedule, registration process and equipment requirements with an authorized club contact.",
    "Keep trusted contacts informed and know where to seek independent help if your safety, documents or employment are at risk."
  ] },
] as const;
export const overseasGuideNotice = "Rules vary by country, nationality, league and contract. Confirm current requirements with official authorities and independent qualified advisers before making decisions.";
