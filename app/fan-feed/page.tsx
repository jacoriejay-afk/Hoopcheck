import { redirect } from "next/navigation";

// HF-5: the fan feed is folded into the one community HoopFeed at /feed.
// This route stays alive so every existing link, bookmark and nav entry
// lands in the community feed instead of a dead page.
export default function FanFeedRedirect() {
  redirect("/feed");
}
