# Native Live Games and chat

`/fan-live` now renders current fixtures, actual provider scores, game chat and
winner predictions. It preserves the existing canonical access flags and player
exception: eligible paid members use the RLS-protected game table and chat; free
players use the existing bearer-authenticated prediction API without querying
chat. Free fans and other ineligible roles are gated. The basketball-side control
uses the existing paid-fan permission, reads the viewer's saved preference, and
saves only explicit choices to that viewer's profile. No default preference is
written automatically.

Queries retain both home and away women's fixtures, discard stale scheduled
fixtures, bound results and IN filters, select public fields, and fail closed.
Every request has a 15-second abort deadline. Data/drafts are bound to identity
and room; foreground/focus changes stop polling and unsubscribe realtime.

The existing `fan_live_chat_room_open` RPC decides room access. The client checks
it again before sending; database RLS/triggers retain final authority for room
closure, membership and slow mode. Realtime notifications trigger a debounced
RLS re-read with current blocks/mutes; raw realtime bodies are never rendered.
Failed sends retain the draft. Mute, block, restore and reports use the existing
owned tables and constraints. No presence/activity counts are invented.

Winner predictions use the existing verified API for actual picks, locking,
results and writes. A failed/malformed response disables picks; local tip-off
time additionally prevents using a stale unlocked snapshot. No payment path or
membership rule changes.

## Verification

- Eight real-Supabase-client/fetch regressions pass: side/away-team filtering,
  free-player API routing, closed rooms, controls and filtered authors, owned
  writes, slow-mode errors, prediction response validation, explicit preference
  persistence, and an unresponsive-query abort using fake timers.
- Isolated 390×844 React Native Web flows pass in light/dark: game list, saved
  side choice, retained draft after slow-mode rejection, successful send, report,
  mute, restore, block and winner pick. Free player prediction-only, free fan
  denial and paid-coach denial are verified. Websockets and all external requests
  are intercepted; no hosted records or messages are created.
- TypeScript, changed-file ESLint, native/auth contracts and local iOS Hermes
  export pass. The new browser suite is added to Mobile CI.
- Read-only production metadata confirms RLS is enabled on games/chat/presence/
  controls/reports and the deployed room function uses the existing 60-minute
  opening rule. This is not a live signed-in account or message test.

For a local fixture, export with the same synthetic public variables documented
in `native-community.md`, serve the output on localhost port 8093, and run
`node scripts/verify-live-games-browser.cjs`. CI supplies its own localhost URL.

Physical iPhone keyboard/safe-area/VoiceOver, actual authenticated RLS/realtime
delivery, expiry/reconnect and game-state transitions remain release checks.
No migration, production data, EAS build, OTA or signing changes were performed.
