/** Optional, account-associated membership feedback; not a cancellation or a billing command. */
export const exitReasons=[
  {id:"price",label:"Price or budget"},
  {id:"missing_features",label:"Missing features"},
  {id:"not_using",label:"Not using HoopCheck enough"},
  {id:"technical",label:"Technical problems"},
  {id:"season",label:"Basketball season or career change"},
  {id:"other",label:"Other / prefer not to say"},
] as const;
export type ExitReason=typeof exitReasons[number]["id"];
export const exitSurveySubject="Optional membership exit feedback";
export function membershipExitTicket(reason:unknown){
  const value=exitReasons.find(item=>item.id===reason);
  if(!value)return null;
  return {subject:exitSurveySubject,category:"billing" as const,priority:"normal" as const,description:"Optional membership feedback: "+value.label+". This is feedback only, not a cancellation request."};
}
