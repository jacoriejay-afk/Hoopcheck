// Educational prompts, not legal conclusions or a contract safety score.
export const CONTRACT_REVIEW_PROMPTS = [
  {id:"identity", title:"Club and representative", question:"Have you independently confirmed who is making the offer and their authority to sign?", followUp:"Confirm through a separately verified club contact; do not rely only on the sender."},
  {id:"pay", title:"Compensation", question:"Are salary, currency, payment dates, deductions and bonuses clearly written?", followUp:"Ask for a written breakdown, including what is guaranteed and what depends on conditions."},
  {id:"term", title:"Duration and termination", question:"Are the start date, end date, release terms and termination conditions clear?", followUp:"Ask a qualified sports-law adviser to explain exit rights and any penalties."},
  {id:"expenses", title:"Housing, travel and expenses", question:"Are housing, flights, transport and any fees allocated in writing?", followUp:"Clarify who pays each expense, when it is due and how reimbursement works."},
  {id:"health", title:"Injury and medical arrangements", question:"Are medical coverage, injury-related pay and treatment responsibilities clear?", followUp:"Request the actual coverage terms and independent advice on exclusions."},
  {id:"registration", title:"Eligibility and documentation", question:"Is responsibility for registration, work authorization and required paperwork clear?", followUp:"Confirm the process with the club and qualified local advisers; never send sensitive documents to an unverified contact."},
  {id:"dispute", title:"Dispute process and language", question:"Do you understand the governing terms, dispute process and every version of the contract?", followUp:"Ask for a reliable translation and independent legal review before signing."},
  {id:"pressure", title:"Pressure and payment requests", question:"Can you review the offer independently without pressure or unexplained advance payments?", followUp:"Pause before sending money or credentials. Verify independently and consider a confidential report if suspicious."},
] as const;
export type ContractAnswer = "clear" | "concern" | "unsure";
export function summarizeContractReview(answers: Readonly<Record<string, ContractAnswer | undefined>>) {
  const concerns = CONTRACT_REVIEW_PROMPTS.filter(item => answers[item.id] === "concern");
  const unresolved = CONTRACT_REVIEW_PROMPTS.filter(item => answers[item.id] === "unsure" || answers[item.id] !== "clear" && answers[item.id] !== "concern");
  const reviewed = CONTRACT_REVIEW_PROMPTS.filter(item => answers[item.id] === "clear" || answers[item.id] === "concern" || answers[item.id] === "unsure").length;
  return {concerns, unresolved, reviewed, total: CONTRACT_REVIEW_PROMPTS.length};
}
