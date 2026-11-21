/* eslint-disable @typescript-eslint/no-require-imports -- Dedicated simulator fixture entry; never imported by the production entry. */
// This entry is selected only by phase2-ios-screenshots.yml in a disposable checkout.
// No hosted backend, billing operation, or real identity is used.
const uid = '11111111-1111-4111-8111-111111111111';
const id = n => `22222222-2222-4222-8222-${String(n).padStart(12, '0')}`;
const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'design@example.test', email_confirmed_at: '2026-01-01T00:00:00Z', factors: [], user_metadata: { account_type: 'player' } };
const now = new Date().toISOString();
const teams = [{ id: id(1), name: 'Courtside Club' }, { id: id(2), name: 'Metro Basketball' }];
const profile = { id: uid, display_name: 'Jordan Courtside', avatar_url: null, player_position: 'Point guard', years_pro: 4, current_team: 'Courtside Club', country: 'United States', current_country: 'Spain', player_verified: true, player_verified_at: '2026-01-01T00:00:00Z', bio: 'A pass-first guard. Building a career around the game, one season at a time.' };
const posts = [{ id: id(4), author_id: uid, body: 'The work between game days. What is one thing you are bringing to the court this week?', created_at: now, expires_at: null, post_kind: 'discussion', image_url: null, video_url: null, profiles: { display_name: 'Jordan Courtside', account_type: 'player' } }];
const game = { id: id(3), team_id: id(1), opponent_team_id: id(2), opponent_name: 'Metro Basketball', home_score: 84, away_score: 79, status: 'live', scheduled_at: now, started_at: now, ends_at: null, league_name: 'Courtside League', country: 'Spain', period_label: 'Q4' };
const nativeFetch = global.fetch;
global.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url || String(input));
  if (['localhost', '127.0.0.1'].includes(url.hostname)) return nativeFetch(input, init);
  if (!['fixture.supabase.co', 'api.test'].includes(url.hostname)) throw Error('Screenshot fixture blocked external request');
  const path = url.pathname;
  let value;
  if (path === '/auth/v1/user') value = user;
  else if (path === '/api/mobile/bootstrap') value = { user: { id: uid, displayName: 'Jordan', accountType: 'player' }, entitlements: { tier: 'premium', hasPaidMembership: true, canReadHoopFeed: true, canWriteHoopFeed: true, canUseLiveGameHub: true, canUseLiveGameChat: true, canSwitchBasketballSide: true, canUseFanGroups: true } };
  else if (path.endsWith('/get_public_player_profile')) value = [profile];
  else if (path.endsWith('/is_player_country_public')) value = true;
  else if (path.endsWith('/get_own_profile')) value = [{ ...profile, account_type: 'player', position: profile.player_position, preferred_basketball_side: 'mens' }];
  else if (path.endsWith('/get_public_follow_list')) value = teams.map(t => ({ target_id: t.id, target_type: 'team', display_name: t.name }));
  else if (path.endsWith('/get_hoopfeed_check_totals')) value = [{ post_id: id(4), checks_count: 12, checked_by_me: false }];
  else if (path.endsWith('/profiles')) value = { preferred_basketball_side: 'mens' };
  else if (path.endsWith('/fan_live_games')) value = [game];
  else if (path.endsWith('/teams')) value = teams;
  else if (path.endsWith('/team_fan_groups')) value = teams.map(t => ({ team_id: t.id, group_name: `${t.name} fans` }));
  else if (path.endsWith('/feed_posts')) value = posts;
  else if (path.endsWith('/player_career_stops')) value = [{ id: id(5), team_name: 'Courtside Club', league_name: 'Courtside League', country: 'Spain', seasons: '2025–26', position: 'PG', is_public: true }];
  else if (path.startsWith('/rest/v1/')) value = [];
  else throw Error(`Unhandled screenshot fixture: ${path}`);
  return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
async function prepare() {
  const storage = require('@react-native-async-storage/async-storage').default;
  await storage.setItem('hoopcheck:device-preferences:v1', JSON.stringify({ onboardingDone: true, appLock: false, haptics: false, theme: 'system' }));
  const { supabase } = require('../src/lib/supabase');
  const encode = value => global.btoa(JSON.stringify(value)).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');
  const token = `${encode({ alg: 'HS256' })}.${encode({ sub: uid, aud: 'authenticated', role: 'authenticated', exp: 4102444800, aal: 'aal1' })}.fixture`;
  const result = await supabase.auth.setSession({ access_token: token, refresh_token: 'fixture' });
  if (result.error) throw result.error;
 }
const React = require('react');
const { ExpoRoot } = require('expo-router');
const { registerRootComponent } = require('expo');
function ScreenshotApp() {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => { prepare().then(() => setReady(true)).catch(error => console.error('SCREENSHOT_BOOTSTRAP_FAILED', error)); }, []);
  return ready ? React.createElement(ExpoRoot, { context: require.context('../app') }) : null;
}
registerRootComponent(ScreenshotApp);
