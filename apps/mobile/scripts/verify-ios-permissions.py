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
projects = list(native.glob("*.xcodeproj/project.pbxproj"))
assert len(projects) == 1 and "online.hoopcheck.app" in projects[0].read_text(), "Unexpected iOS bundle ID"
print("PASS generated iOS bundle ID and photo/Face ID permissions; no camera/microphone")
