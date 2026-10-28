# Apple IAP native dependency decision

Status: implementation decision pending an actual cloud development build; this document does not claim StoreKit is integrated.

## Current app baseline

- The mobile app uses Expo SDK 54, React Native 0.81.5, and the New Architecture.
- Apple purchases require native code and a custom development build; Expo Go cannot exercise the purchase flow.
- The app's current iOS bundle identifier `com.example.hoopcheck` is a placeholder and must not be used for distribution.

## Candidate library

Use `expo-iap` as the leading candidate rather than `react-native-iap` because this app is an Expo project. Expo's official IAP guide lists both `expo-iap` and `react-native-purchases` as Expo-compatible options; OpenIAP's setup guide says `expo-iap` supports Expo SDK 53+ but identifies SDK 57 / React Native 0.86 as its validated baseline. That means SDK 54 compatibility must be proved with the pinned app's actual cloud development build before treating the integration as ready.

References:
- Expo IAP guide: https://docs.expo.dev/guides/in-app-purchases/
- OpenIAP Expo setup and SDK requirements: https://www.openiap.dev/docs/setup/expo
- Expo SDK 54 baseline: https://expo.dev/sdk/54

## Required next steps

1. Run a reproducible package installation on the feature branch and commit the generated lockfile; do not hand-edit dependency lock metadata.
2. Add the official `expo-iap` config plugin and build a cloud iOS development client. Keep Android store billing out of scope unless separately configured and tested.
3. Validate product query, purchase request, transaction finish, restore, and cancellation/error handling on a physical iOS device with App Store Connect sandbox products.
4. Do not enable purchase/restore UI until the authenticated backend verifies Apple-signed transactions, persists idempotently, reconciles server notifications, and updates effective entitlements without modifying Stripe-owned rows.
5. Replace the placeholder iOS bundle ID only after the owner confirms the permanent App Store Connect bundle identifier. Do not create product IDs until checking whether products already exist.
6. Keep `$4.99/month` Pro and `$9.99/month` Premium. These display prices are not proof of configured App Store price tiers.

## Safety gates

- No production database migration or production billing change in this phase.
- Never trust client-supplied plan, price, expiry, environment, or transaction status.
- Do not claim a cloud build or sandbox purchase passed until the actual run/device test is recorded.
- Preserve Stripe as an independent provider and keep existing web subscribers' access intact.
