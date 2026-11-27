#!/usr/bin/env python3
"""Pin the prewarmed loopback URL in the generated Debug simulator fixture.

Never run on tracked application sources or release configuration. The harness
backs up and restores the generated AppDelegate around the real XCTest run.
"""
import re
import sys
from pathlib import Path

FIXTURE_URL = "http://127.0.0.1:8081/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true&minify=false"
DEBUG_PROVIDER = re.compile(
    r'(?m)^(?P<indent>[ \t]*)return RCTBundleURLProvider\.sharedSettings\(\)'
    r'\.jsBundleURL\(forBundleRoot: "\.expo/\.virtual-metro-entry"\)[ \t]*$'
)


def pin_fixture_url(source: str) -> str:
    matches = list(DEBUG_PROVIDER.finditer(source))
    if len(matches) != 1:
        raise ValueError("Expected exactly one Expo Debug bundle provider; inspect the generated template")
    match = matches[0]
    before = source[:match.start()]
    if not re.search(r'override func bundleURL\(\) -> URL\?\s*\{\s*#if DEBUG\s*$', before):
        raise ValueError("Expected Expo bundleURL Debug branch; refusing to patch")
    if not re.match(r'\s*#else\s*return Bundle\.main\.url\(forResource: "main", withExtension: "jsbundle"\)\s*#endif', source[match.end():]):
        raise ValueError("Expected unchanged Release bundle path; refusing to patch")
    indent = match.group("indent")
    replacement = "\n".join((
        indent + "#if targetEnvironment(simulator)",
        indent + f'return URL(string: "{FIXTURE_URL}")',
        indent + "#else",
        match.group(0),
        indent + "#endif",
    ))
    return source[:match.start()] + replacement + source[match.end():]


if __name__ == "__main__":
    path = Path(sys.argv[1])
    if path.name != "AppDelegate.swift" or path.parent.name != "HoopCheck" or path.parent.parent.name != "ios":
        raise SystemExit("Expected generated ios/HoopCheck/AppDelegate.swift")
    original = path.read_text()
    path.write_text(pin_fixture_url(original))
    print("PASSPORT_SMOKE_EXPLICIT_LOOPBACK_BUNDLE_URL")
