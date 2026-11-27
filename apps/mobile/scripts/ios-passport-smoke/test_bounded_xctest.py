#!/usr/bin/env python3
"""Fast stdlib regression tests for the genuine XCTest runner watchdog."""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("run-bounded-xctest.py")


class BoundedXCTestTests(unittest.TestCase):
    def invoke(self, *command, timeout=3):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / "xctest.log"
            result = subprocess.run(
                [sys.executable, str(SCRIPT), "--log", str(log),
                 "--timeout-seconds", str(timeout), "--", *command],
                capture_output=True, text=True, timeout=timeout + 8,
            )
            return result, log.read_text() if log.exists() else ""

    def test_real_success_is_required(self):
        result, log = self.invoke(sys.executable, "-c", "print('XCTEST_SUCCESS')")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("XCTEST_SUCCESS", log)
        self.assertIn("PASSPORT_XCTEST_EXIT code=0", result.stdout)

    def test_real_failure_cannot_be_accepted(self):
        result, log = self.invoke(sys.executable, "-c", "import sys; print('XCTEST_FAILURE'); sys.exit(42)")
        self.assertEqual(result.returncode, 42)
        self.assertIn("XCTEST_FAILURE", log)

    def test_stuck_simulator_fails_closed_with_explicit_timeout(self):
        result, _ = self.invoke(sys.executable, "-c", "import time; time.sleep(30)", timeout=1)
        self.assertEqual(result.returncode, 124)
        self.assertIn("PASSPORT_XCTEST_TIMEOUT", result.stderr)


class PassportSimulatorHarnessTests(unittest.TestCase):
    def test_warm_bundle_and_pin_serial_execution(self):
        script = SCRIPT.with_name("run.sh").read_text()
        self.assertIn("/.expo/.virtual-metro-entry.bundle?platform=ios", script)
        self.assertIn("--max-time 180", script)
        self.assertIn("PASSPORT_SMOKE_BUNDLE_PREWARM_FAILED", script)
        self.assertLess(script.index("PASSPORT_SMOKE_BUNDLE_PREWARM_FAILED"),
                        script.index('xcodebuild "$xcode_action" -workspace'))
        self.assertIn('-destination "id=$simulator_id"', script)
        self.assertIn("-parallel-testing-enabled NO", script)
        self.assertIn("for theme in light dark; do", script)
        self.assertIn("xcode_action=test-without-building", script)
        self.assertIn("xcode_action=test\n", script)
        self.assertIn("boot_ready dark", script)
        self.assertLess(script.index("boot_ready dark"), script.index("xcode_action=test-without-building"))

    def test_failed_runtime_collects_diagnostics_without_acceptance(self):
        script = SCRIPT.with_name("run.sh").read_text()
        failure = script.split("-only-testing:PassportSmokeUITests CODE_SIGNING_ALLOWED=NO; then", 1)[1]
        failure = failure.split("tail -n 18", 1)[0]
        self.assertIn('collect_failure_diagnostics "$theme"', failure)
        self.assertIn("exit 1", failure)
        self.assertIn("xcresulttool export diagnostics", script)
        self.assertIn('Executed 1 test, with 0 failures', script)



class FixtureBundleURLTests(unittest.TestCase):
    def setUp(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "pin_fixture_bundle", SCRIPT.with_name("pin-fixture-bundle.py"))
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)
        self.template = """  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
"""

    def test_only_simulator_debug_provider_is_overridden(self):
        patched = self.module.pin_fixture_url(self.template)
        self.assertIn('#if targetEnvironment(simulator)', patched)
        self.assertIn('return URL(string: "' + self.module.FIXTURE_URL + '")', patched)
        self.assertEqual(patched.count('RCTBundleURLProvider.sharedSettings()'), 1)
        self.assertTrue(patched.endswith('#else\n    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")\n#endif\n  }\n'))

    def test_unexpected_or_duplicate_template_fails_closed(self):
        for bad in (self.template.replace("#if DEBUG", "#if RELEASE"),
                    self.template.replace("main", "different"),
                    self.template + self.template):
            with self.assertRaises(ValueError):
                self.module.pin_fixture_url(bad)

    def test_harness_restores_delegate_and_uses_same_prewarmed_url(self):
        script = SCRIPT.with_name("run.sh").read_text()
        self.assertIn(self.module.FIXTURE_URL, script)
        self.assertIn('cp "$artifact_root/AppDelegate.original.swift" "$app_delegate"', script)
        self.assertLess(script.index('trap cleanup EXIT'), script.index('pin-fixture-bundle.py'))
        self.assertLess(script.index('pin-fixture-bundle.py'), script.index('xcodebuild "$xcode_action" -workspace'))

if __name__ == "__main__":
    unittest.main()
