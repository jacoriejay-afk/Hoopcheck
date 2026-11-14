"use client";

import { useState } from "react";
import styles from "./ambassador.module.css";

export default function ReferralCopy({ link }: { link: string }) {
  const [message, setMessage] = useState("");
  return (
    <>
      <div className={styles.share}>
        <input aria-label="Referral signup link" value={link} readOnly onFocus={event => event.target.select()} />
        <button type="button" className="btn" onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setMessage("Referral link copied.");
          } catch {
            setMessage("Select the referral link to copy it.");
          }
        }}>Copy link</button>
      </div>
      {message && <p role="status">{message}</p>}
    </>
  );
}
