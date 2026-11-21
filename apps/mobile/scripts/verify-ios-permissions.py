"""Inspect real prebuild output; never build, sign, install, or contact a device."""
from pathlib import Path
import plistlib

native = Path(__file__).resolve().parents[1] / "ios"
plists = list(native.glob("*/Info.plist"))
assert len(plists) == 1, "Run the local iOS prebuild first"
info = plistlib.loads(plists[0].read_bytes())
assert info.get("NSPhotoLibraryUsageDescription"), "Photo selection needs a purpose description"
assert info.get("NSFaceIDUsageDescription"), "Device unlock needs a Face ID purpose description"
assert "NSCameraUsageDescription" not in info, "Library selection must not request a camera"
assert "NSMicrophoneUsageDescription" not in info, "Library selection must not request a microphone"
for key in ("NSUserTrackingUsageDescription", "NSContactsUsageDescription", "NSLocationWhenInUseUsageDescription", "NSLocationAlwaysUsageDescription", "NSLocationAlwaysAndWhenInUseUsageDescription"):
    assert key not in info, f"Passport sharing must not add {key}"
assert info.get("UIFileSharingEnabled") is not True, "Temporary Passport cache must not expose app Documents"
projects = list(native.glob("*.xcodeproj/project.pbxproj"))
assert len(projects) == 1 and "online.hoopcheck.app" in projects[0].read_text(), "Unexpected iOS bundle ID"
print("PASS generated iOS bundle ID and existing photo/Face ID permissions; no camera, microphone, tracking, contacts, location or Documents file sharing")
