# Dedicated native camera pilot (Step 2)

- SDK 54 bundled manifest specifies expo-camera ~17.0.10; exact 17.0.10 pinned. Its manifest was checked against expo/expo sdk-54; checksum cross-checked against independently published lockfiles. Local npm registry DNS unavailable: **CI npm ci and prebuild must verify the lock**.
- Opt-in `EXPO_PUBLIC_HOOPCHECK_NATIVE_CAMERA_ENABLED=true` in an isolated candidate only; default off. The normal device camera and library remain available. No production flag or EAS changes.
- Full-screen native preview, explicit photo/video modes, front/back, normalized zoom, flash and timer for photos, microphone opt-in (silent video default), tap or hold video shutter, 60s/50MB limits, request 1080p/H.264 on iOS. Device output is not a guarantee of resolution/codec.
- Preview/retake uses existing moderated composer. No automatic publishing, no Stories expiry/audience change. Temporary rejected camera outputs cleaned; selected draft remains until existing composer handling.
- Device acceptance: permission allow/deny, limited audio, mode and lens switching, timer cancel, tap and hold (including short/early release), max limits, rotation, crop, photo/video preview, safe account change/background/blur, no unintended posting, Android/iOS codec playback, private media cleanup. Physical acceptance is not yet proven.
