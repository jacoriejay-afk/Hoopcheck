#!/usr/bin/env python3
"""Bound a genuine unsigned iOS XCTest run without replacing its assertions.

XCTest is allowed to compile, boot simulators, print a real PDF and present a
real UIKit share sheet. A stalled runner is terminated and reported as failure
with its existing xcresult/log artifacts retained by the workflow.
"""
import argparse
import os
from pathlib import Path
import signal
import subprocess
import sys
import time


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--log", required=True, type=Path)
    parser.add_argument("--timeout-seconds", type=int, default=900)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    if not command or args.timeout_seconds < 1:
        parser.error("Provide a command and a positive timeout")
    args.log.parent.mkdir(parents=True, exist_ok=True)

    print(f"PASSPORT_XCTEST_START command={command[0]} timeout={args.timeout_seconds}s "
          f"log={args.log}", flush=True)
    with args.log.open("w", encoding="utf-8", errors="replace") as log:
        process = subprocess.Popen(
            command, stdout=log, stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        deadline = time.monotonic() + args.timeout_seconds
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            try:
                returncode = process.wait(timeout=min(60, remaining))
                print(f"PASSPORT_XCTEST_EXIT code={returncode}", flush=True)
                return returncode
            except subprocess.TimeoutExpired:
                print(f"PASSPORT_XCTEST_HEARTBEAT remaining={max(0, int(deadline-time.monotonic()))}s",
                      flush=True)

        print(f"PASSPORT_XCTEST_TIMEOUT after {args.timeout_seconds}s; "
              "real simulator PDF/share test did not finish, failing closed",
              file=sys.stderr, flush=True)
        for sig in (signal.SIGTERM, signal.SIGKILL):
            try:
                os.killpg(process.pid, sig)
            except ProcessLookupError:
                break
            try:
                process.wait(timeout=10)
                break
            except subprocess.TimeoutExpired:
                continue
        return 124


if __name__ == "__main__":
    sys.exit(main())
