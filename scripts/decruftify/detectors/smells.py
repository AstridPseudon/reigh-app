"""Code smell detection: patterns that indicate problems beyond simple cruft."""

import json
import re
import subprocess
from pathlib import Path

from ..utils import PROJECT_ROOT, c, log, print_table, rel, grep


SMELL_CHECKS = [
    {
        "id": "empty_catch",
        "label": "Empty catch blocks",
        "pattern": r"catch\s*\([^)]*\)\s*\{\s*\}",
        "severity": "high",
    },
    {
        "id": "any_type",
        "label": "Explicit `any` types",
        "pattern": r":\s*any\b",
        "severity": "medium",
    },
    {
        "id": "ts_ignore",
        "label": "@ts-ignore / @ts-expect-error",
        "pattern": r"@ts-(?:ignore|expect-error)",
        "severity": "medium",
    },
    {
        "id": "non_null_assert",
        "label": "Non-null assertions (!.)",
        "pattern": r"\w+!\.",
        "severity": "low",
    },
    {
        "id": "hardcoded_color",
        "label": "Hardcoded color values",
        "pattern": r"""(?:color|background|border|fill|stroke)\s*[:=]\s*['"]#[0-9a-fA-F]{3,8}['"]""",
        "severity": "medium",
    },
    {
        "id": "hardcoded_rgb",
        "label": "Hardcoded rgb/rgba",
        "pattern": r"rgba?\(\s*\d+",
        "severity": "medium",
    },
    {
        "id": "async_no_await",
        "label": "Async functions without await",
        # Detected separately — needs multi-line analysis
        "pattern": None,
        "severity": "medium",
    },
    {
        "id": "magic_number",
        "label": "Magic numbers (>100 in logic)",
        "pattern": r"(?:===?|!==?|>=?|<=?|[+\-*/])\s*\d{3,}",
        "severity": "low",
    },
    {
        "id": "console_error_no_throw",
        "label": "console.error without throw/return",
        # Detected separately
        "pattern": None,
        "severity": "medium",
    },
]


def detect_smells(path: Path) -> list[dict]:
    """Detect code smell patterns across the codebase."""
    result = subprocess.run(
        ["find", str(path), "-name", "*.ts", "-o", "-name", "*.tsx"],
        capture_output=True, text=True, cwd=PROJECT_ROOT,
    )

    smell_counts: dict[str, list[dict]] = {s["id"]: [] for s in SMELL_CHECKS}

    for filepath in result.stdout.strip().splitlines():
        if not filepath or "node_modules" in filepath or ".d.ts" in filepath:
            continue
        try:
            p = Path(filepath) if Path(filepath).is_absolute() else PROJECT_ROOT / filepath
            content = p.read_text()
            lines = content.splitlines()
        except Exception:
            continue

        # Regex-based smells
        for check in SMELL_CHECKS:
            if check["pattern"] is None:
                continue
            for i, line in enumerate(lines):
                if re.search(check["pattern"], line):
                    smell_counts[check["id"]].append({
                        "file": filepath,
                        "line": i + 1,
                        "content": line.strip()[:100],
                    })

        # Async without await detection
        _detect_async_no_await(filepath, content, lines, smell_counts)

        # Console.error without throw/return
        _detect_error_no_throw(filepath, lines, smell_counts)

    # Build summary entries sorted by severity then count
    severity_order = {"high": 0, "medium": 1, "low": 2}
    entries = []
    for check in SMELL_CHECKS:
        matches = smell_counts[check["id"]]
        if matches:
            entries.append({
                "id": check["id"],
                "label": check["label"],
                "severity": check["severity"],
                "count": len(matches),
                "files": len(set(m["file"] for m in matches)),
                "matches": matches[:50],  # Cap for JSON output
            })
    entries.sort(key=lambda e: (severity_order.get(e["severity"], 9), -e["count"]))
    return entries


def _detect_async_no_await(filepath: str, content: str, lines: list[str],
                           smell_counts: dict[str, list[dict]]):
    """Find async functions that don't use await."""
    # Simple heuristic: find `async function` or `async (` and check the body
    async_re = re.compile(r"(?:async\s+function\s+(\w+)|(\w+)\s*=\s*async)")
    for i, line in enumerate(lines):
        m = async_re.search(line)
        if not m:
            continue
        name = m.group(1) or m.group(2)
        # Scan the function body for `await`
        brace_depth = 0
        found_open = False
        has_await = False
        for j in range(i, min(i + 200, len(lines))):
            body_line = lines[j]
            for ch in body_line:
                if ch == '{':
                    brace_depth += 1
                    found_open = True
                elif ch == '}':
                    brace_depth -= 1
            if "await " in body_line or "await\n" in body_line:
                has_await = True
            if found_open and brace_depth <= 0:
                break

        if found_open and not has_await:
            smell_counts["async_no_await"].append({
                "file": filepath,
                "line": i + 1,
                "content": f"async {name or '(anonymous)'} has no await",
            })


def _detect_error_no_throw(filepath: str, lines: list[str],
                           smell_counts: dict[str, list[dict]]):
    """Find console.error calls not followed by throw or return."""
    for i, line in enumerate(lines):
        if "console.error" in line:
            # Check next 3 lines for throw/return
            following = "\n".join(lines[i+1:i+4])
            if not re.search(r"\b(?:throw|return)\b", following):
                smell_counts["console_error_no_throw"].append({
                    "file": filepath,
                    "line": i + 1,
                    "content": line.strip()[:100],
                })


def cmd_smells(args):
    entries = detect_smells(Path(args.path))
    if args.json:
        print(json.dumps({"entries": entries}, indent=2))
        return

    if not entries:
        print(c("No code smells detected.", "green"))
        return

    total = sum(e["count"] for e in entries)
    print(c(f"\nCode smells: {total} instances across {len(entries)} patterns\n", "bold"))

    rows = []
    for e in entries[:args.top]:
        sev_color = {"high": "red", "medium": "yellow", "low": "dim"}.get(e["severity"], "dim")
        rows.append([
            c(e["severity"].upper(), sev_color),
            e["label"],
            str(e["count"]),
            str(e["files"]),
        ])
    print_table(["Sev", "Pattern", "Count", "Files"], rows, [8, 40, 6, 6])

    # Show top instances for high-severity smells
    high = [e for e in entries if e["severity"] == "high"]
    for e in high:
        print(c(f"\n  {e['label']} ({e['count']} instances):", "red"))
        for m in e["matches"][:10]:
            print(f"    {rel(m['file'])}:{m['line']}  {m['content'][:60]}")
