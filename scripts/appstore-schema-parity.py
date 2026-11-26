#!/usr/bin/env python3
"""Offline catalog comparison; never connects to a database or modifies schema."""
import argparse
import json
import sys
from pathlib import Path

FIELDS = ("columns", "fk_count", "policies", "rls", "force_rls")


def index(rows):
    if not isinstance(rows, list) or not rows:
        raise ValueError("Expected nonempty catalog array")
    out = {}
    for row in rows:
        if not isinstance(row, dict) or row.get("schema") != "public":
            raise ValueError("Expected public ordinary-table metadata")
        name = row.get("name")
        if not isinstance(name, str) or not name or name in out:
            raise ValueError("Missing or duplicate table name")
        for field in FIELDS[:3]:
            if type(row.get(field)) is not int or row[field] < 0:
                raise ValueError("Invalid catalog count: " + field)
        for field in FIELDS[3:]:
            if type(row.get(field)) is not bool:
                raise ValueError("Invalid catalog flag: " + field)
        out[name] = {key: row[key] for key in FIELDS}
    return out


def compare(production, test):
    expected, actual = index(production), index(test)
    missing = sorted(expected.keys() - actual.keys())
    extra = sorted(actual.keys() - expected.keys())
    changed = [
        {"table": name, "differences": {
            key: {"production": expected[name][key], "test": actual[name][key]}
            for key in FIELDS if expected[name][key] != actual[name][key]
        }}
        for name in sorted(expected.keys() & actual.keys()) if expected[name] != actual[name]
    ]
    return {
        "production_tables": len(expected), "test_tables": len(actual),
        "missing": missing, "test_only": extra, "changed": changed,
        "structural_counts_match": not (missing or extra or changed),
        "full_schema_parity_verified": False,
        "migration_rehearsal_authorized": False,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("snapshot", type=Path)
    args = parser.parse_args()
    try:
        payload = json.loads(args.snapshot.read_text())
        if payload.get("format") != 1:
            raise ValueError("Unsupported snapshot format")
        result = compare(payload["production"], payload["test"])
    except (ValueError, KeyError, TypeError, OSError) as error:
        print("Invalid catalog snapshot: " + str(error), file=sys.stderr)
        return 2
    print(json.dumps(result, indent=2, sort_keys=True))
    # A count match is not proof of semantic equivalence. A separate full-DDL
    # comparison, isolation review and rehearsal authorization are still needed.
    return 0 if result["structural_counts_match"] else 1


if __name__ == "__main__":
    sys.exit(main())
