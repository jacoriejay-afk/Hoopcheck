"use client";

import { useState, useId } from "react";
import Link from "next/link";
import { CONTRACT_REVIEW_PROMPTS, summarizeContractReview, type ContractAnswer } from "../lib/contract-review-prompts";

const choices = [["clear","Clear to me"],["concern","Concern / missing term"],["unsure","Not sure"]] as const;

export default function ContractRedFlagCheck() {
  const [answers,setAnswers]=useState<Record<string,ContractAnswer>>({});
  const sectionId=useId();
  const summary=summarizeContractReview(answers);
  return <section className="dashboard-card" aria-labelledby={sectionId} style={{marginTop:20}}>
    <p className="eyebrow">PLAYER PROTECTION</p>
    <h2 id={sectionId}>Contract red-flag checklist</h2>
    <p>Review these prompts before signing. This is a self-assessment, not contract analysis, verification or legal advice. Do not upload or enter contract text, names, account numbers or other private information.</p>
    <p className="muted">Answers are kept only in this page's temporary memory. Reset before sharing your screen or device.</p>
    {CONTRACT_REVIEW_PROMPTS.map(item=><fieldset key={item.id} style={{margin:"12px 0",padding:12,border:"1px solid var(--hc-border, #7775)",borderRadius:12}}>
      <legend><strong>{item.title}</strong></legend>
      <p>{item.question}</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
        {choices.map(([value,label])=><label key={value} style={{display:"inline-flex",alignItems:"center",gap:6,minHeight:44}}><input type="radio" name={sectionId+"-"+item.id} value={value} checked={answers[item.id]===value} onChange={()=>setAnswers(current=>({...current,[item.id]:value}))}/>{label}</label>)}
      </div>
      {(answers[item.id]==="concern"||answers[item.id]==="unsure")&&<p><strong>Follow up:</strong> {item.followUp}</p>}
    </fieldset>)}
    <div role="status" aria-live="polite">
      <p><strong>{summary.reviewed} of {summary.total} prompts answered</strong> · {summary.concerns.length} marked concerns · {summary.unresolved.length} unanswered or uncertain</p>
      {summary.concerns.length>0||summary.unresolved.length>0?<p>Clarify outstanding questions independently before committing.</p>:<p>All prompts marked clear by you. This does not establish that the contract is safe, enforceable or legitimate.</p>}
    </div>
    <p>Consider independent advice from a qualified lawyer familiar with the relevant jurisdiction and professional basketball. For suspected fraud, use <Link href="/scam-alerts">HoopCheck Scam Alerts</Link>; do not include confidential documents or credentials.</p>
    <button type="button" className="btn dark" disabled={!summary.reviewed} onClick={()=>setAnswers({})}>Reset contract answers</button>
  </section>;
}
