import { Redirect } from "expo-router";

/** Legacy bookmarked welcome URLs now go to HoopFeed; no automated bot surface. */
export default function FeedWelcome() {
  return <Redirect href="/feed" />;
}
