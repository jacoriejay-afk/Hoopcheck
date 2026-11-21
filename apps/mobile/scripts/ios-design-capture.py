"""Capture real simulator screens, with bounded commands and content assertions."""
import json
import os
from pathlib import Path
import subprocess
import time

device = os.environ["DEVICE"]
output = Path("/tmp/phase2-ios")
output.mkdir(exist_ok=True)


def run(*args, timeout=90):
    print("RUN", *args, flush=True)
    subprocess.run(args, check=True, timeout=timeout)


run("xcrun", "simctl", "install", device,
    "/tmp/phase2-derived/Build/Products/Debug-iphonesimulator/HoopCheck.app")
run("xcrun", "simctl", "launch", device, "online.hoopcheck.app")
deadline = time.monotonic() + 180
while not Path("/tmp/phase2-ready").exists():
    if time.monotonic() > deadline:
        raise RuntimeError("Native fixture bootstrap did not reach the real navigator")
    time.sleep(2)

routes = [
    ("dashboard", "welcomejordan"),
    ("feed", "basketballcommunity"),
    ("fan-live", "thegameliveshere"),
    ("team-hub/groups", "findyourpeople"),
    ("players/11111111-1111-4111-8111-111111111111", "jordancourtside"),
]
for theme in ["light", "dark"]:
    run("xcrun", "simctl", "ui", device, "appearance", theme)
    for route, expected in routes:
        Path("/tmp/phase2-ready").unlink(missing_ok=True)
        Path("/tmp/phase2-route.json").write_text(json.dumps({"route": "/" + route}))
        time.sleep(10)
        file = output / f"{route.replace('/', '-')}-{theme}.png"
        run("xcrun", "simctl", "io", device, "screenshot", str(file))
        run("swift", "scripts/ios-design-ocr.swift", str(file), expected, timeout=60)

print("PASS: ten native screenshots show the expected real screen content", flush=True)
