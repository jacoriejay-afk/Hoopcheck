import Logo from "../../components/Logo";
import Logo from "../../../components/Logo";

export default function Loading() {
  return <main className="page-shell admin-light-shell"><div className="page-container"><section className="hero-card"><div className="admin-brand"><Logo variant="icon" size={34} /><div className="eyebrow admin-loading-brand"><Logo variant="full" size={34} /></div></div><h1>Loading admin tools…</h1><p className="muted">Preparing moderation controls.</p></section></div></main>;
}
