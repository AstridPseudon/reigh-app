"""Bloated prop interface detection (>10 props = prop drilling signal)."""

import json
import re
import subprocess
from pathlib import Path

from ..utils import PROJECT_ROOT, c, print_table, rel


def detect_prop_interface_bloat(path: Path) -> list[dict]:
    """Find interfaces/types with >10 properties — signals need for composition or context."""
    result = subprocess.run(
        ["find", str(path), "-name", "*.ts", "-o", "-name", "*.tsx"],
        capture_output=True, text=True, cwd=PROJECT_ROOT,
    )
    entries = []
    # Match interface blocks
    interface_re = re.compile(r"(?:export\s+)?(?:interface|type)\s+(\w+Props\w*)\s*(?:=\s*)?{", re.MULTILINE)

    for filepath in result.stdout.strip().splitlines():
        if not filepath:
            continue
        try:
            p = Path(filepath) if Path(filepath).is_absolute() else PROJECT_ROOT / filepath
            content = p.read_text()
            for m in interface_re.finditer(content):
                name = m.group(1)
                start = m.end()
                # Count properties by finding the closing brace
                brace_depth = 1
                pos = start
                prop_count = 0
                while pos < len(content) and brace_depth > 0:
                    ch = content[pos]
                    if ch == "{":
                        brace_depth += 1
                    elif ch == "}":
                        brace_depth -= 1
                    elif ch == "\n" and brace_depth == 1:
                        # Count non-empty, non-comment lines as properties
                        line_start = pos + 1
                        line_end = content.find("\n", line_start)
                        if line_end == -1:
                            line_end = len(content)
                        line = content[line_start:line_end].strip()
                        if line and not line.startswith("//") and not line.startswith("*") and not line.startswith("/**") and line != "}":
                            prop_count += 1
                    pos += 1

                if prop_count > 10:
                    entries.append({
                        "file": filepath,
                        "interface": name,
                        "prop_count": prop_count,
                        "line": content[:m.start()].count("\n") + 1,
                    })
        except Exception:
            continue
    return sorted(entries, key=lambda e: -e["prop_count"])


def cmd_props(args):
    entries = detect_prop_interface_bloat(Path(args.path))
    if args.json:
        print(json.dumps({"count": len(entries), "entries": entries}, indent=2))
        return
    if not entries:
        print(c("No bloated prop interfaces found.", "green"))
        return
    print(c(f"\nBloated prop interfaces (>10 props): {len(entries)}\n", "bold"))
    rows = []
    for e in entries[:args.top]:
        rows.append([e["interface"], rel(e["file"]), str(e["prop_count"]), str(e["line"])])
    print_table(["Interface", "File", "Props", "Line"], rows, [35, 50, 6, 6])
