"""Regression tests for the offline App Store catalog parity checker."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/appstore-schema-parity.py"
spec = importlib.util.spec_from_file_location("parity", SCRIPT)
parity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parity)


def table(name="profiles", **changes):
    return dict(schema="public", name=name, columns=2, fk_count=1,
                policies=2, rls=True, force_rls=False) | changes


class ParityTests(unittest.TestCase):
    def test_matching_counts_are_not_full_parity(self):
        result = parity.compare([table()], [table()])
        self.assertTrue(result["structural_counts_match"])
        self.assertFalse(result["full_schema_parity_verified"])
        self.assertFalse(result["migration_rehearsal_authorized"])

    def test_missing_extra_and_security_drift(self):
        result = parity.compare(
            [table(), table("reviews")],
            [table(rls=False, fk_count=0), table("fixture_only")],
        )
        self.assertEqual(result["missing"], ["reviews"])
        self.assertEqual(result["test_only"], ["fixture_only"])
        self.assertEqual(set(result["changed"][0]["differences"]), {"rls", "fk_count"})
        self.assertFalse(result["structural_counts_match"])

    def test_invalid_catalog_fails_closed(self):
        for invalid in ([], [table(), table()], [table(columns=True)],
                        [table(rls="true")], [table(schema="auth")]):
            with self.subTest(invalid=invalid):
                with self.assertRaises(ValueError):
                    parity.compare([table()], invalid)

    def test_observed_snapshot_reports_drift(self):
        path = ROOT / "docs/appstore-schema-parity-snapshot.json"
        payload = json.loads(path.read_text())
        result = parity.compare(payload["production"], payload["test"])
        self.assertEqual(result["production_tables"], 108)
        self.assertEqual(result["test_tables"], 46)
        self.assertEqual(len(result["missing"]), 67)
        self.assertEqual(len(result["test_only"]), 5)
        self.assertEqual(len(result["changed"]), 13)
        run = subprocess.run([sys.executable, str(SCRIPT), str(path)],
                             capture_output=True, text=True, check=False)
        self.assertEqual(run.returncode, 1)
        self.assertEqual(json.loads(run.stdout), result)

    def test_malformed_snapshot_exit_code(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bad.json"
            path.write_text('{"format": 99}')
            result = subprocess.run([sys.executable, str(SCRIPT), str(path)],
                                    capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 2)


if __name__ == "__main__":
    unittest.main()
