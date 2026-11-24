"""Inspect real prebuild output; never build, sign, install, or contact a device."""
from pathlib import Path
import plistlib

native = Path(__file__).resolve().parents[1] / "ios"
plists = list(native.glob("*/Info.plist"))
assert len(plists) == 1, "Run the local iOS prebuild first"
info = plistlib.loads(plists[0].read_bytes())
assert info.get("NSPhotoLibraryUsageDescription"), "Photo selection needs a purpose description"
assert info.get("NSFaceIDUsageDescription"), "Device unlock needs a Face ID purpose description"
assert info.get("NSCameraUsageDescription") == "Allow HoopCheck to take basketball photos and record videos when you choose to capture media.", "User-triggered native capture needs an explicit camera purpose"
assert info.get("NSMicrophoneUsageDescription") == "Allow HoopCheck to record audio with videos you choose to capture.", "Video capture needs an explicit microphone purpose"
for key in ("NSUserTrackingUsageDescription", "NSContactsUsageDescription", "NSLocationWhenInUseUsageDescription", "NSLocationAlwaysUsageDescription", "NSLocationAlwaysAndWhenInUseUsageDescription"):
    assert key not in info, f"Passport sharing must not add {key}"
assert info.get("UIFileSharingEnabled") is not True, "Temporary Passport cache must not expose app Documents"
projects = list(native.glob("*.xcodeproj/project.pbxproj"))
assert len(projects) == 1 and "online.hoopcheck.app" in projects[0].read_text(), "Unexpected iOS bundle ID"
print("PASS generated iOS bundle ID and photo/Face ID and explicit capture permissions; no tracking, contacts, location or Documents file sharing")
