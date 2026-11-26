"use client";

import { useState } from "react";
import { contractReminderCalendar, reminderLeadDays, type ReminderLead } from "../lib/career/contract-reminder";

export default function ContractReminderExport() {
  const [date,setDate] = useState("");
  const [lead,setLead] = useState<ReminderLead>(14);
  const [message,setMessage] = useState("");
  function download() {
    setMessage("");
    try {
      const content = contractReminderCalendar(date,lead,crypto.randomUUID());
      const url = URL.createObjectURL(new Blob([content],{type:"text/calendar;charset=utf-8"}));
      const link = document.createElement("a");
      link.href=url;link.download="hoopcheck-contract-reminder.ics";
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
      setMessage("Calendar file prepared. Open or import it into your calendar and check that the alert is enabled.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Calendar file could not be prepared."); }
  }
  return <div className="hc-journey-editor">
    <h3>Contract expiration reminder</h3>
    <p className="muted">Enter the actual end date from your contract. This creates a generic private calendar event on request; HoopCheck does not save the date or send alerts. Your calendar may sync or share events according to its settings.</p>
    <label>Contract end date <input type="date" value={date} onChange={event=>{setDate(event.target.value);setMessage("");}} /></label>
    <label>Remind me before expiration <select value={lead} onChange={event=>{const value=Number(event.target.value) as ReminderLead;if(reminderLeadDays.includes(value))setLead(value);setMessage("");}}>{reminderLeadDays.map(value=><option value={value} key={value}>{value} days before</option>)}</select></label>
    <button type="button" className="btn btn-secondary" disabled={!date} onClick={download}>Export calendar reminder</button>
    {message && <p role="status">{message}</p>}
  </div>;
}
