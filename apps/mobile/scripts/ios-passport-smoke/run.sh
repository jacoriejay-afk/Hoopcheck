#!/usr/bin/env bash
set -euo pipefail
artifact_root=/tmp/hoopcheck-passport-simulator
mkdir -p "$artifact_root"
cp package.json "$artifact_root/package.original.json"
cleanup() {
  cp "$artifact_root/package.original.json" package.json
  if [[ -n "${metro_pid:-}" ]]; then kill "$metro_pid" 2>/dev/null || true; fi
}
trap cleanup EXIT
node - <<'JS'
const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json','utf8'));
p.main='./scripts/ios-passport-smoke/entry.tsx'; fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');
JS
ruby scripts/ios-passport-smoke/add-ui-test.rb
npx --no-install expo start --localhost --port 8081 > "$artifact_root/metro.log" 2>&1 &
metro_pid=$!
python3 - <<'PY'
import time,urllib.request
for attempt in range(60):
 try:
  with urllib.request.urlopen('http://127.0.0.1:8081/status',timeout=2) as response:
   if 'running' in response.read().decode():break
 except Exception:pass
 time.sleep(2)
else:raise RuntimeError('Local Metro server did not become ready')
PY
xcrun simctl list devices available --json > "$artifact_root/devices.json"
simulator_id=$(python3 - <<'PY'
import json
all_devices=json.load(open('/tmp/hoopcheck-passport-simulator/devices.json'))['devices']
phones=[d for devices in all_devices.values() for d in devices if d.get('isAvailable') and d['name'].startswith('iPhone')]
if not phones:raise RuntimeError('No available iPhone simulator runtime; no EAS fallback is allowed')
print(phones[0]['udid'])
PY
)
state=$(xcrun simctl list devices available --json | python3 -c 'import sys,json; d=json.load(sys.stdin); print(next(x["state"] for a in d["devices"].values() for x in a if x["udid"]==sys.argv[1]))' "$simulator_id")
boot_ready() {
  local theme="$1"
  echo "PASSPORT_SMOKE_SIM_BOOT_WAIT theme=$theme id=$simulator_id"
  if ! python3 scripts/ios-passport-smoke/run-bounded-xctest.py \
    --log "$artifact_root/$theme-boot.log" --timeout-seconds 480 -- \
    xcrun simctl bootstatus "$simulator_id" -b; then
    tail -n 100 "$artifact_root/$theme-boot.log" || true
    xcrun simctl list devices available || true
    echo "PASSPORT_SMOKE_BOOT_FAILED theme=$theme; real XCTest not accepted" >&2
    return 1
  fi
}
if [[ "$state" != "Booted" ]]; then xcrun simctl boot "$simulator_id"; fi
boot_ready light
for theme in light dark; do
  if [[ "$theme" == "dark" ]]; then
    # Test both themes on real simulator boot sessions. Reusing the warm WebKit
    # print helper from the light test can stall the dark-mode Expo Print PDF.
    # Do NOT omit the dark test or treat a timed-out PDF as a pass.
    if ! python3 scripts/ios-passport-smoke/run-bounded-xctest.py \
      --log "$artifact_root/dark-shutdown.log" --timeout-seconds 120 -- \
      xcrun simctl shutdown "$simulator_id"; then
      tail -n 100 "$artifact_root/dark-shutdown.log" || true
      echo "PASSPORT_SMOKE_SHUTDOWN_FAILED; dark theme was not tested" >&2
      exit 1
    fi
    for attempt in $(seq 1 30); do
      state=$(xcrun simctl list devices available --json | python3 -c 'import sys,json; d=json.load(sys.stdin); print(next(x["state"] for a in d["devices"].values() for x in a if x["udid"]==sys.argv[1]))' "$simulator_id")
      if [[ "$state" == "Shutdown" ]]; then break; fi
      sleep 1
    done
    if [[ "$state" != "Shutdown" ]]; then echo "Simulator did not shut down before dark Passport test" >&2; exit 1; fi
    xcrun simctl boot "$simulator_id"
    boot_ready dark
  fi
  xcrun simctl ui "$simulator_id" appearance "$theme"
  # RN 0.81 Debug can resolve a nil bundle URL on headless CI simulators even
  # when host Metro's /status is healthy. The app is a synthetic test fixture
  # without expo-dev-client, so pin the Debug-only packager address explicitly
  # on THIS simulator; no production app config, provisioning or credentials.
  xcrun simctl spawn "$simulator_id" defaults write online.hoopcheck.app RCT_jsLocation -string "127.0.0.1:8081"
  metro_location=$(xcrun simctl spawn "$simulator_id" defaults read online.hoopcheck.app RCT_jsLocation)
  if [[ "$metro_location" != "127.0.0.1:8081" ]]; then
    echo "Simulator JS bundle location was not persisted; refusing to run an unconfigured smoke test" >&2
    exit 1
  fi
  # Cold light-mode xcodebuild must compile the real UI-test runner before XCTest
  # begins. A measured run spent ~14 minutes building and only 18 seconds in
  # XCTest before its prior 900s budget expired. Keep finite, per-theme budgets
  # and always require passing assertions in both themes.
  xctest_timeout_seconds=900
  if [[ "$theme" == "light" ]]; then xctest_timeout_seconds=1500; fi
  echo "PASSPORT_SMOKE_THEME=$theme: executing real unsigned Passport PDF/share XCTest (budget=${xctest_timeout_seconds}s)"
  # Cold simulator runs can hang indefinitely inside UIKit/Expo Print.
  # Fail closed with a useful log and xcresult instead of hitting the outer
  # workflow timeout without diagnostic evidence. Never skip either theme.
  if ! python3 scripts/ios-passport-smoke/run-bounded-xctest.py \
    --log "$artifact_root/$theme-test.log" --timeout-seconds "$xctest_timeout_seconds" -- \
    xcodebuild test -workspace ios/HoopCheck.xcworkspace -scheme HoopCheck \
    -configuration Debug -sdk iphonesimulator -destination "id=$simulator_id" \
    -derivedDataPath /tmp/hoopcheck-ios-derived \
    -resultBundlePath "$artifact_root/$theme.xcresult" \
    -only-testing:PassportSmokeUITests CODE_SIGNING_ALLOWED=NO; then
    tail -n 140 "$artifact_root/$theme-test.log"
    echo "=== Tail of synthetic local Metro log (no production auth) ==="
    tail -n 100 "$artifact_root/metro.log" || true
    if [[ -d "$artifact_root/$theme.xcresult" ]]; then xcrun xcresulttool export attachments --path "$artifact_root/$theme.xcresult" --output-path "$artifact_root/$theme-screenshots" || true; fi
    exit 1
  fi
  tail -n 18 "$artifact_root/$theme-test.log"
  python3 - "$artifact_root/$theme-test.log" <<'CHECK'
import re,sys
from pathlib import Path
if not re.search(r'Executed 1 test, with 0 failures', Path(sys.argv[1]).read_text()):
 raise RuntimeError('Expected one executed, passing native UI test; zero tests cannot establish acceptance')
CHECK
  xcrun xcresulttool export attachments --path "$artifact_root/$theme.xcresult" --output-path "$artifact_root/$theme-screenshots"
done
python3 - <<'PY'
import json,subprocess
from pathlib import Path
Path('/tmp/hoopcheck-passport-simulator/result.json').write_text(json.dumps({'head':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'evidence':'iOS simulator runtime','identity':'synthetic fixture; no production auth or data','themes':['light','dark'],'checks':['real Expo Print PDF signature/pages/bytes','real Expo Sharing UIKit activity sheet','dismiss without recipient','original PDF removed'],'physical_device':False},indent=2)+'\n')
PY
