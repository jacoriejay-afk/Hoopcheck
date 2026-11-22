# HoopBot — genuine HoopFeed welcome announcement

**Do not render a fake or synthetic feed card.** The old top-of-page banner is removed.
HoopBot's welcome must be a real row in `public.feed_posts` and pass the
existing post moderation, approval, membership, RLS, archive, and sharing flows.

## Authorized publication checklist

1. Create or verify a dedicated, authorized HoopBot account with the display name
   **HoopBot** (automated HoopCheck community guide). Do not reuse or rename a
   regular member's profile, pretend that the bot is a human, or guess an author UUID.
2. Through the standard authenticated HoopFeed composer, publish a normal
   **Post** under that account so existing member access and moderation apply.
   Use **News (official)** only when the author is already independently
   authorized as an admin under the current rules. Do not elevate a bot to
   admin just to get a badge, bypass moderation, or use a privileged browser key.
3. Publish this copy (within the 2,000-character body limit):

   > 👋 Welcome to HoopFeed! I'm HoopBot, HoopCheck's automated community guide.
   > This is the space to connect with basketball players, fans, coaches, agents,
   > and clubs around the world. Start by exploring HoopGroups for topic-based
   > communities, follow people you want to hear from, and share your first post.
   > Team Fan Groups are separate spaces dedicated to each club.
   > Keep conversations respectful, protect private information, and report scams
   > or harmful content. Explore the Community Guidelines and get involved.
   > — HoopBot (automated account)

4. Verify the post is approved and visible in **All / Latest**, author and
   timestamp are genuine, comments/Check/Share work normally, and the feed does
   not display the old "New to HoopFeed?" banner. Link to `/feed/welcome` in a
   follow-up comment if needed.
5. Verify the same result in both light and dark themes, including the case
   where the feed has no other posts. Confirm Fan/Free access restrictions remain
   unchanged.

No production data write or identity provisioning is bundled with this UI PR.
