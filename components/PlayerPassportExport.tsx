"use client";

import { useMemo, useState } from "react";
import "./PlayerPassportExport.css";

type CareerItem = {
  id: string;
  team_name: string;
  league_name: string | null;
  country: string;
  seasons: string;
  position: string | null;
  is_public: boolean;
};

/** Career entries are player-supplied. A verified profile badge is not
 * verification of each individual contract, season, statistic, or award. */
export default function PlayerPassportExport({
  playerName,
  verifiedPlayer,
  stops,
}: {
  playerName: string;
  verifiedPlayer: boolean;
  stops: CareerItem[];
}) {
  const [open, setOpen] = useState(false);
  const [includePrivate, setIncludePrivate] = useState(false);
  const [status, setStatus] = useState("");
  const visible = useMemo(
    () => stops.filter(stop => includePrivate || stop.is_public),
    [stops, includePrivate],
  );
  const privateCount = stops.filter(stop => !stop.is_public).length;

  function csvValue(value: string) {
    // Treat exports as data, never executable spreadsheet formulas.
    const safe = /^[\s]*[=+@\-]/.test(value) ? "'" + value : value;
    return '"' + safe.replace(/"/g, '""') + '"';
  }
  function saveCsv() {
    const rows = [
      ["Team", "League", "Country", "Season", "Position", "Public"],
      ...visible.map(stop => [
        stop.team_name, stop.league_name || "", stop.country,
        stop.seasons, stop.position || "", stop.is_public ? "Yes" : "No",
      ]),
    ];
    const data = "\uFEFF" + rows.map(row => row.map(csvValue).join(",")).join("\r\n");
    const blob = new Blob([data], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "HoopCheck-Career-Passport.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatus("Career data exported.");
  }

  return <section className="hc-passport-export" aria-label="Export your HoopCheck career passport">
    <div className="hc-passport-export__intro">
      <div><strong>Career Passport Export</strong><p>Share your basketball history with clubs, coaches and agents. Your private career entries stay excluded by default.</p></div>
      <button type="button" disabled={!stops.length} onClick={() => setOpen(true)} aria-expanded={open}>
        Preview & export
      </button>
    </div>
    {status && <p role="status" className="muted">{status}</p>}
    {open && <div className="hc-passport-export__overlay" role="presentation" onClick={() => setOpen(false)}>
      <section className="hc-passport-export__modal" role="dialog" aria-modal="true" aria-label="HoopCheck passport preview" onClick={event => event.stopPropagation()}>
        <div className="hc-passport-export__toolbar">
          <label><input type="checkbox" checked={includePrivate} onChange={event => setIncludePrivate(event.target.checked)} />
            Include {privateCount} private {privateCount === 1 ? "career stop" : "career stops"} in this export
          </label>
          <button type="button" onClick={() => setOpen(false)}>Close preview</button>
        </div>
        <article className="hc-passport-print" id="hoopcheck-passport-export">
          <header><div><p>HOOP<span>CHECK</span>™</p><h2>{playerName}</h2><small>PROFESSIONAL BASKETBALL CAREER PASSPORT</small></div><div className="hc-passport-print__mark"><img src="/hoopcheck-mark.svg" width="44" height="44" alt="HoopCheck" /></div></header>
          <p className={`hc-passport-print__badge${verifiedPlayer ? " hc-owner-verified-reveal" : ""}`}>{verifiedPlayer ? "HoopCheck verified player profile" : "HoopCheck player profile"}
            <span> · Career entries are self-reported, not individually verified</span></p>
          <h3>Career timeline</h3>
          {visible.length ? <ol>{visible.map(stop => <li key={stop.id}>
            <strong>{stop.team_name}</strong>
            <span>{stop.seasons}</span>
            <small>{[stop.league_name, stop.country, stop.position].filter(Boolean).join(" · ")}</small>
            {!stop.is_public && <em>Private stop — included only in this export</em>}
          </li>)}</ol> : <p>No publicly shared career stops. You can include your own private stops using the option above.</p>}
          <footer><strong>HoopCheck™</strong> · Personal career summary
            <p>Prepared from the player's saved career history. Club employment, individual seasons and achievements are not independently verified by this export. Sharing or printing this document is controlled by the player.</p></footer>
        </article>
        <nav className="hc-passport-export__actions" aria-label="Passport export actions">
          <button type="button" onClick={() => window.print()} disabled={!visible.length}>Print / save as PDF</button>
          <button type="button" onClick={saveCsv} disabled={!visible.length}>Export CSV</button>
        </nav>
      </section>
    </div>}
  </section>;
}
