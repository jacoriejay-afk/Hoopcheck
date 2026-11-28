#!/usr/bin/env python3
"""Offline PG17 AST comparison. Never opens a DB or writes historical SQL."""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "reports/migration-history/evidence-812bdca.json"
LOCATIONS = {"location", "stmt_location", "stmt_len"}

def clean(value):
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items()
                if not (k in LOCATIONS and isinstance(v, int))}
    if isinstance(value, list):
        return [clean(x) for x in value]
    return value

def canonical(parser, sql):
    tree = json.loads(parser.parse_sql_json(sql))
    if tree.get("version", 0) // 10000 != 17 or not isinstance(tree.get("stmts"), list):
        raise ValueError("PG17 AST required")
    if not tree["stmts"]:
        raise ValueError("Empty or comment-only SQL is not a comparison candidate")
    return clean(tree["stmts"])

def key(tree):
    return hashlib.sha256(json.dumps(tree, sort_keys=True, separators=(",", ":"),
                                    ensure_ascii=False).encode()).hexdigest()

def self_test(parser):
    if not __debug__:
        raise RuntimeError("Assertions must be enabled")
    assert canonical(parser, "select 1;") == canonical(parser, "-- note\n SELECT 1")
    assert canonical(parser, "select 1") != canonical(parser, "select 2")
    assert canonical(parser, "select 'a'") != canonical(parser, "select 'b'")
    assert canonical(parser, "select 'a'\n'b'") != canonical(parser, "select 'a'")
    assert canonical(parser, "select 1; select 2") != canonical(parser, "select 2; select 1")
    assert canonical(parser, "create function f() returns int language sql as $$select 1$$") != canonical(parser, "create function f() returns int language sql as $$select 2$$")
    assert canonical(parser, "select 1") != canonical(parser, "select 1; select 1")
    try:
        canonical(parser, "select from where")
    except Exception:
        pass
    else:
        raise AssertionError("Invalid SQL accepted")
    assert canonical(parser, "select 1 as location") != canonical(parser, "select 1 as stmt_location")
    assert canonical(parser, "select 'location'") != canonical(parser, "select 'stmt_len'")
    assert canonical(parser, "select 1 /* outer /* inner */ end */;") == canonical(parser, "select 1")
    assert canonical(parser, "create function f() returns int language sql as $select 1$") == canonical(parser, "create function f() returns int language sql as $body$select 1$body$")
    assert canonical(parser, "create function f() returns int language sql security definer as $select 1$") != canonical(parser, "create function f() returns int language sql security invoker as $select 1$")
    for empty in ("", "-- comment only", ";"):
        try:
            canonical(parser, empty)
        except ValueError:
            pass
        else:
            raise AssertionError("Empty SQL accepted")
    print("16 PG17 parser self-tests passed; no replay authorization.")

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--ledger", type=Path, help="Restricted external JSON array; exact statement_array_json text")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    from pglast import parser
    if parser.get_postgresql_version()[0] != 17:
        raise ValueError("PG17 parser required")
    if args.self_test:
        if args.ledger is not None:
            raise ValueError("Synthetic mode must not receive a ledger")
        self_test(parser)
        return 0
    if not args.ledger:
        raise ValueError("External ledger required")
    path = args.ledger.resolve(strict=True)
    if path.is_relative_to(ROOT) or not path.is_file() or path.stat().st_mode & 0o077:
        raise ValueError("Ledger must be a restricted file outside checkout")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    recorded = [r for r in manifest["rows"] if r["side"] == "production"]
    production = {r["version"]: r for r in recorded}
    if len(recorded) != len(production) or any(not re.fullmatch(r"\d{14}", v) for v in production):
        raise ValueError("Manifest version identity mismatch")
    entries = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(entries, list) or len(entries) != len(production) or len(production) != 221:
        raise ValueError("Ledger coverage mismatch")
    seen = set()
    ledger = {}
    for row in entries:
        v = row["version"]
        raw = row["statement_array_json"]
        if v not in production or v in seen or not isinstance(raw, str):
            raise ValueError("Ledger identity mismatch")
        seen.add(v)
        if hashlib.sha256(raw.encode("utf-8")).hexdigest() != production[v]["statement_array_sha256"]:
            raise ValueError("Ledger digest mismatch")
        stmts = json.loads(raw)
        if not isinstance(stmts, list) or len(stmts) != production[v]["statement_count"] or not all(isinstance(s, str) for s in stmts):
            raise ValueError("Ledger statements mismatch")
        ledger[v] = stmts
    files = manifest["repository_files"]
    directory = ROOT / "supabase/migrations"
    if len(files) != 218 or sorted(f["name"] for f in files) != sorted(p.name for p in directory.glob("*.sql")):
        raise ValueError("Repository coverage mismatch")
    index = {}
    file_errors = []
    for f in files:
        name = f["name"]
        if not re.fullmatch(r"\d{14}_[A-Za-z0-9_.-]+\.sql", name):
            raise ValueError("Unsafe repository filename")
        raw = (directory / name).read_bytes()
        blob = hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()
        if blob != f["sha"]:
            raise ValueError("Repository blob mismatch")
        try:
            digest = key(canonical(parser, raw.decode("utf-8")))
        except Exception:
            file_errors.append(name)
            continue
        index.setdefault(digest, []).append({"file": name, "blob_sha1": blob})
    results = []
    for v in sorted(ledger):
        try:
            ast = []
            for stmt in ledger[v]:
                ast.extend(canonical(parser, stmt))
            matches = index.get(key(ast), [])
            result = "ast_match_candidate_only" if len(matches) == 1 else "ambiguous_ast_match" if matches else "no_ast_match"
        except Exception:
            matches = []
            result = "parse_error"
        results.append({"version": v, "statement_array_sha256": production[v]["statement_array_sha256"],
                        "result": result, "matches": matches})
    print(json.dumps({"parser_major": 17, "rows": results, "repository_parse_errors": file_errors,
                      "replay_authorized": False, "release_authorized": False}, indent=2))
    # Nonzero is intentional for unresolved parse/coverage work; matching syntax is never release approval.
    return 1 if file_errors or any(r["result"] != "ast_match_candidate_only" for r in results) else 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        print("Offline parser preflight failed; no SQL or diagnostic literals emitted.", file=sys.stderr)
        sys.exit(2)
