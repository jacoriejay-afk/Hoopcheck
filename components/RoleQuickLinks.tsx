import Link from "next/link";

type LinkItem = { href: string; label: string; description: string };
type Experience = { title: string; subtitle: string; links: LinkItem[] };

const experiences: Record<string, Experience> = {
  player: { title: "Player courtside", subtitle: "Your career, trust research, and player connections in one place.", links: [
    { href: "/profile", label: "My player profile", description: "Career and Passport" },
    { href: "/teams", label: "Team research", description: "Teams and reviews" },
    { href: "/notifications?tab=messages", label: "HoopChat", description: "Messages and requests" },
    { href: "/live-games", label: "Live basketball", description: "Games and chat" },
  ] },
  fan: { title: "Fan courtside", subtitle: "Follow your clubs, watch the action, and meet other fans.", links: [
    { href: "/live-games", label: "Live games", description: "Scores and game chats" },
    { href: "/team-hub/groups", label: "Team Fan Groups", description: "Your clubs' fan communities" },
    { href: "/hoopgroups", label: "HoopGroups", description: "Basketball communities" },
    { href: "/teams", label: "Discover teams", description: "Find your favorites" },
  ] },
  coach: { title: "Coaches courtside", subtitle: "Explore players, career opportunities, and your coaching network.", links: [
    { href: "/players", label: "Player directory", description: "Discover talent" },
    { href: "/coaches", label: "Coaches", description: "Professional network" },
    { href: "/leagues", label: "League directory", description: "Research leagues" },
    { href: "/notifications?tab=messages", label: "Messages", description: "Your conversations" },
  ] },
  agent: { title: "Agent courtside", subtitle: "Research talent, teams, and leagues for your next placement.", links: [
    { href: "/agents-hq", label: "Agent HQ", description: "Professional workspace" },
    { href: "/players", label: "Find players", description: "Talent research" },
    { href: "/leagues", label: "Global leagues", description: "Placement research" },
    { href: "/notifications?tab=messages", label: "HoopChat", description: "Player contact requests" },
  ] },
  club_admin: { title: "Team manager courtside", subtitle: "Manage your club presence and connect with the community.", links: [
    { href: "/team-dashboard", label: "Team dashboard", description: "Club management" },
    { href: "/team-hub/groups", label: "Team Fan Groups", description: "Club supporters" },
    { href: "/teams", label: "Team directory", description: "Club profiles" },
    { href: "/notifications", label: "Alerts", description: "Updates and messages" },
  ] },
};
experiences.scout = { ...experiences.agent, title: "Scout courtside", subtitle: "Find talent and research teams across global leagues." };
experiences.manager = experiences.club_admin;

export function getRoleExperience(role: string | null | undefined): Experience {
  return experiences[(role || "fan").toLowerCase()] || experiences.fan;
}

export default function RoleQuickLinks({ role, compact = false }: { role: string | null | undefined; compact?: boolean }) {
  const experience = getRoleExperience(role);
  return <section className={"hc-role-quick-links" + (compact ? " is-compact" : "")} aria-label="Your personalized shortcuts">
    <div className="hc-role-quick-links__heading"><div><p className="eyebrow">YOUR SPACE</p><h2>{experience.title}</h2><p className="muted">{experience.subtitle}</p></div></div>
    <nav className="hc-role-quick-links__grid" aria-label="Recommended for your account type">
      {experience.links.map(item => <Link key={item.href} href={item.href}><strong>{item.label}</strong><small>{item.description}</small></Link>)}
    </nav>
  </section>;
}
