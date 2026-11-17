import Link from "next/link";
import { formatViewerLocalTime, getGameAvailability } from "../lib/game-availability";
import type { FeedWorld } from "../lib/hoopfeed-organization";

type PostLink = { id: string; body: string; author?: string | null };

export default function HoopFeedToday({ pinned, poll, world, now, onPost, canUseChat }: {
  pinned?: PostLink;
  poll?: PostLink;
  world: FeedWorld | null;
  now: number;
  canUseChat: boolean;
  onPost: (id: string) => void;
}) {
  const cards = [];
  if (pinned) cards.push(<article key={pinned.id}><small>PINNED</small>
    <button type="button" onClick={() => onPost(pinned.id)}>{pinned.body.trim().slice(0, 120) || pinned.author || "View pinned post"}</button>
  </article>);
  for (const game of world?.fixtures ?? []) {
    const availability = getGameAvailability({
      status: game.status, scheduledAt: game.scheduled_at, startedAt: game.started_at, endsAt: game.ends_at, now: new Date(now),
    });
    cards.push(<article key={game.id}><small>TODAY</small><strong>{game.home} vs {game.opponent_name}</strong>
      <span>{formatViewerLocalTime(game.scheduled_at)}</span>
      {canUseChat && availability.chatOpen && <Link href={`/fan-live?gameId=${game.id}`}>Game chat</Link>}
    </article>);
  }
  if (world?.review) cards.push(<article key="review"><small>NEW REVIEW</small>
    <Link href={world.review.href}>{world.review.name}</Link>
  </article>);
  if (poll) cards.push(<article key={`poll-${poll.id}`}><small>OPEN POLL</small>
    <button type="button" onClick={() => onPost(poll.id)}>{poll.body.trim().slice(0, 120)}</button>
  </article>);
  return cards.length ? <section className="hc-feed-today" aria-label="Today on HoopFeed">{cards.slice(0, 3)}</section> : null;
}
