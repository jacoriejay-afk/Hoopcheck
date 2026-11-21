# UX source inventory

Generated with `node scripts/inventory-ux.mjs`. 79 pages, 31 API routes, 1005 control declarations across app and shared components.

This is a source inventory, not a completed runtime audit. Dynamic destinations and conditional controls require role-specific interaction verification. Full control attributes and line references are in ux-inventory.json. Authorization remains in each existing page, API and RLS policy.

| Route | Kind | Source | Controls | Access signals |
| --- | --- | --- | ---: | --- |
| /about | page | app/about/page.tsx | 3 | Inspect parent layout / middleware / server policies |
| /account | page | app/account/page.tsx | 51 | account_type, player_verified, subscription, adminRole, entitlements, accountType, canUseRecruitingNetwork |
| /admin/analytics | page | app/admin/analytics/page.tsx | 7 | subscription |
| /admin/claims | page | app/admin/claims/page.tsx | 10 | profile_claim_requests |
| /admin/comments | page | app/admin/comments/page.tsx | 6 | Inspect parent layout / middleware / server policies |
| /admin/directory/coach-requests | page | app/admin/directory/coach-requests/page.tsx | 6 | Inspect parent layout / middleware / server policies |
| /admin/directory/coaches | page | app/admin/directory/coaches/page.tsx | 5 | subscription |
| /admin/directory/import | page | app/admin/directory/import/page.tsx | 7 | Inspect parent layout / middleware / server policies |
| /admin/directory/manage | page | app/admin/directory/manage/page.tsx | 21 | Inspect parent layout / middleware / server policies |
| /admin/directory | page | app/admin/directory/page.tsx | 4 | account_type |
| /admin/directory/providers | page | app/admin/directory/providers/page.tsx | 17 | Inspect parent layout / middleware / server policies |
| /admin/directory/relationships | page | app/admin/directory/relationships/page.tsx | 14 | Inspect parent layout / middleware / server policies |
| /admin/directory/requests | page | app/admin/directory/requests/page.tsx | 6 | Inspect parent layout / middleware / server policies |
| /admin/privacy-requests | page | app/admin/privacy-requests/page.tsx | 11 | Inspect parent layout / middleware / server policies |
| /admin/profile-reports | page | app/admin/profile-reports/page.tsx | 7 | account_type |
| /admin/reports | page | app/admin/reports/page.tsx | 6 | Inspect parent layout / middleware / server policies |
| /admin/reviews | page | app/admin/reviews/page.tsx | 18 | subscription |
| /admin/rights | page | app/admin/rights/page.tsx | 4 | Inspect parent layout / middleware / server policies |
| /admin/support | page | app/admin/support/page.tsx | 6 | Inspect parent layout / middleware / server policies |
| /admin/team-fanfeed | page | app/admin/team-fanfeed/page.tsx | 9 | Inspect parent layout / middleware / server policies |
| /admin/team-logos | page | app/admin/team-logos/page.tsx | 9 | Inspect parent layout / middleware / server policies |
| /admin/users | page | app/admin/users/page.tsx | 27 | account_type, player_verified, accountType, subscription |
| /admin/verification | page | app/admin/verification/page.tsx | 10 | player_verified |
| /agents-hq | page | app/agents-hq/page.tsx | 4 | account_type |
| /api/account/deactivate | API | app/api/account/deactivate/route.ts | 0 | Inspect parent layout / middleware / server policies |
| /api/account/delete | API | app/api/account/delete/route.ts | 0 | subscription |
| /api/admin/directory/sync/approve | API | app/api/admin/directory/sync/approve/route.ts | 0 | Inspect parent layout / middleware / server policies |
| /api/admin/directory/sync/preview | API | app/api/admin/directory/sync/preview/route.ts | 0 | Inspect parent layout / middleware / server policies |
| /api/admin/directory/sync | API | app/api/admin/directory/sync/route.ts | 0 | subscription |
| /api/admin/review-reports/[reportId] | API | app/api/admin/review-reports/[reportId]/route.ts | 0 | Inspect parent layout / middleware / server policies |
| /api/admin/reviews/[reviewId] | API | app/api/admin/reviews/[reviewId]/route.ts | 0 | player_verified |
| /api/admin/rights/transition | API | app/api/admin/rights/transition/route.ts | 0 | Inspect parent layout / middleware / server policies |
| /api/admin/team-fanfeed | API | app/api/admin/team-fanfeed/route.ts | 0 | Inspect parent layout / middleware / server policies |
| /api/admin/team-logo-candidate | API | app/api/admin/team-logo-candidate/route.ts | 0 | Inspect parent layout / middleware / server policies |
| /api/app-version | API | app/api/app-version/route.ts | 0 | Inspect parent layout / middleware / server policies |
| /api/copyright/report | API | app/api/copyright/report/route.ts | 0 | Inspect parent layout / middleware / server policies |
| /api/cron/live-basketball | API | app/api/cron/live-basketball/route.ts | 0 | Inspect parent layout / middleware / server policies |
| /api/fan-feed/moderate | API | app/api/fan-feed/moderate/route.ts | 0 | account_type, subscription, entitlements, accountType, canWriteFanFeed |
| /api/fan-groups | API | app/api/fan-groups/route.ts | 0 | account_type, entitlements, accountType, canModerateFanGroups, canUseFanGroups |
| /api/game-predictions | API | app/api/game-predictions/route.ts | 0 | account_type |
| /api/hoopfeed/moderate | API | app/api/hoopfeed/moderate/route.ts | 0 | account_type, subscription, entitlements, accountType, canWriteHoopFeed |
| /api/profile-reports | API | app/api/profile-reports/route.ts | 0 | Inspect parent layout / middleware / server policies |
| /api/review-access | API | app/api/review-access/route.ts | 0 | accountType, account_type, player_verified, subscription, entitlements, canReadFullReviews, canWrite, canWriteReviews, canReadFull |
| /api/review-reports | API | app/api/review-reports/route.ts | 0 | Inspect parent layout / middleware / server policies |
| /api/reviews/report | API | app/api/reviews/report/route.ts | 0 | Inspect parent layout / middleware / server policies |
| /api/reviews | API | app/api/reviews/route.ts | 0 | subscription, account_type, player_verified, entitlements, accountType, canWriteReviews, canReview |
| /api/stripe/cancel-subscription | API | app/api/stripe/cancel-subscription/route.ts | 0 | subscription |
| /api/stripe/create-portal | API | app/api/stripe/create-portal/route.ts | 0 | subscription |
| /api/stripe/webhook/create-checkout | API | app/api/stripe/webhook/create-checkout/route.ts | 0 | subscription, account_type |
| /api/stripe/webhook | API | app/api/stripe/webhook/route.ts | 0 | subscription, account_type, player_verified |
| /api/team-fanfeed | API | app/api/team-fanfeed/route.ts | 0 | account_type, profile_claim_requests |
| /api/team-pay-checkins | API | app/api/team-pay-checkins/route.ts | 0 | account_type, subscription, entitlements, accountType, canViewTeamPayHistory, player_verified, canSubmitPayCheckIn |
| /api/trust-score | API | app/api/trust-score/route.ts | 0 | accountType, subscription, account_type, entitlements, canViewTrustScore, player_verified |
| /api/verification/identity | API | app/api/verification/identity/route.ts | 0 | account_type, subscription, entitlements, accountType, canStartCoachIdentityVerification, player_verified |
| /api/womens-reviews | API | app/api/womens-reviews/route.ts | 0 | account_type, player_verified, subscription, entitlements, accountType, canWriteReviews |
| /choose-username | page | app/choose-username/page.tsx | 4 | Inspect parent layout / middleware / server policies |
| /coach-placement | page | app/coach-placement/page.tsx | 6 | account_type, subscription, accountType, canStartCoachIdentityVerification |
| /coaches/[id] | page | app/coaches/[id]/page.tsx | 20 | player_verified, accountType, canReadFullReviews, canWriteReviews, account_type, subscription, entitlements, canReadFull, canWrite |
| /coaches/[id]/review | page | app/coaches/[id]/review/page.tsx | 13 | account_type, player_verified, subscription |
| /coaches | page | app/coaches/page.tsx | 7 | accountType |
| /community-guidelines | page | app/community-guidelines/page.tsx | 4 | Inspect parent layout / middleware / server policies |
| /company | page | app/company/page.tsx | 4 | Inspect parent layout / middleware / server policies |
| /complete-profile | page | app/complete-profile/page.tsx | 12 | account_type |
| /connections | page | app/connections/page.tsx | 5 | account_type, player_verified, accountType, canOpen |
| /copyright | page | app/copyright/page.tsx | 1 | Inspect parent layout / middleware / server policies |
| /dashboard | page | app/dashboard/page.tsx | 28 | player_verified, account_type, subscription, entitlements, accountType, canUsePlayerFeed, canReadHoopFeed, canUseLiveGameHub |
| /directory | page | app/directory/page.tsx | 2 | account_type |
| /fan-feed | page | app/fan-feed/page.tsx | 27 | account_type, subscription, accountType, canReadFanFeed |
| /fan-live | page | app/fan-live/page.tsx | 26 | accountType, subscription, account_type, entitlements, canUseLiveGameChat |
| /fans/[id] | page | app/fans/[id]/page.tsx | 1 | account_type |
| /fans | page | app/fans/page.tsx | 1 | account_type |
| /feed | page | app/feed/page.tsx | 33 | account_type, subscription, accountType, canReadHoopFeed |
| /founder | page | app/founder/page.tsx | 2 | Inspect parent layout / middleware / server policies |
| /leagues/[id] | page | app/leagues/[id]/page.tsx | 16 | player_verified, accountType, canReadFullReviews, canWriteReviews, account_type, canReadFull, canWrite |
| /leagues/[id]/review | page | app/leagues/[id]/review/page.tsx | 11 | subscription |
| /leagues | page | app/leagues/page.tsx | 6 | Inspect parent layout / middleware / server policies |
| /live-games | page | app/live-games/page.tsx | 9 | subscription, account_type, entitlements, accountType, canUseLiveGameHub, canJoin |
| /login | page | app/login/page.tsx | 8 | Inspect parent layout / middleware / server policies |
| /membership | page | app/membership/page.tsx | 16 | subscription, accountType, account_type |
| /notifications | page | app/notifications/page.tsx | 5 | Inspect parent layout / middleware / server policies |
| /offline | page | app/offline/page.tsx | 1 | Inspect parent layout / middleware / server policies |
| /onboarding | page | app/onboarding/page.tsx | 11 | accountType, account_type |
| /onboarding/teams | page | app/onboarding/teams/page.tsx | 7 | accountType, account_type |
| / | page | app/page.tsx | 0 | Inspect parent layout / middleware / server policies |
| /partners | page | app/partners/page.tsx | 5 | Inspect parent layout / middleware / server policies |
| /players/[id] | page | app/players/[id]/page.tsx | 14 | player_verified, canManageJourney, account_type, subscription, entitlements, accountType, canUseProPassport, canManage |
| /players | page | app/players/page.tsx | 6 | player_verified, account_type |
| /pre-sign | page | app/pre-sign/page.tsx | 3 | Inspect parent layout / middleware / server policies |
| /privacy-center | page | app/privacy-center/page.tsx | 6 | Inspect parent layout / middleware / server policies |
| /privacy | page | app/privacy/page.tsx | 5 | subscription |
| /profile | page | app/profile/page.tsx | 17 | account_type, player_verified, accountType |
| /reset-password | page | app/reset-password/page.tsx | 5 | subscription |
| /reviews | page | app/reviews/page.tsx | 2 | player_verified |
| /search | page | app/search/page.tsx | 21 | player_verified, account_type |
| /settings | page | app/settings/page.tsx | 5 | account_type |
| /signup/complete | page | app/signup/complete/page.tsx | 10 | accountType, account_type |
| /signup | page | app/signup/page.tsx | 23 | accountType, account_type |
| /support | page | app/support/page.tsx | 7 | Inspect parent layout / middleware / server policies |
| /team-dashboard | page | app/team-dashboard/page.tsx | 17 | profile_claim_requests, account_type |
| /team-hub/groups/[teamId] | page | app/team-hub/groups/[teamId]/page.tsx | 20 | account_type |
| /team-hub | page | app/team-hub/page.tsx | 7 | account_type |
| /teams/[id] | page | app/teams/[id]/page.tsx | 15 | player_verified, accountType, canReadFullReviews, canWriteReviews, subscription, account_type, entitlements, canReadFull, canWrite |
| /teams/[id]/review | page | app/teams/[id]/review/page.tsx | 15 | accountType, account_type, player_verified, subscription, entitlements, canWriteReviews |
| /teams | page | app/teams/page.tsx | 18 | accountType |
| /terms | page | app/terms/page.tsx | 5 | subscription |
| /theme-card-audit | page | app/theme-card-audit/page.tsx | 1 | Inspect parent layout / middleware / server policies |
| /verification | page | app/verification/page.tsx | 13 | accountType, account_type, player_verified, subscription, canStartCoachIdentityVerification |
| /womens/[id] | page | app/womens/[id]/page.tsx | 5 | canViewReviews, canSeeRatings, canReview, accountType, canReadFull, canWrite |
| /womens/[id]/review | page | app/womens/[id]/review/page.tsx | 7 | account_type, player_verified, subscription, entitlements, accountType, canWriteReviews |
| /womens | page | app/womens/page.tsx | 6 | Inspect parent layout / middleware / server policies |
