"""Coupling analysis: shared→tools imports and boundary candidates."""

import json
from pathlib import Path

from ..utils import c, get_area, print_table, rel, SRC_PATH
from .deps import build_dep_graph


def detect_coupling_violations(path: Path, graph: dict) -> list[dict]:
    """Find shared/ files that import from tools/ (backwards coupling).

    These are always wrong — shared code must not depend on tool-specific code.
    """
    entries = []
    src = str(SRC_PATH)
    shared_prefix = f"{src}/shared/"
    tools_prefix = f"{src}/tools/"

    for filepath, entry in graph.items():
        if not filepath.startswith(shared_prefix):
            continue
        for target in entry["imports"]:
            if target.startswith(tools_prefix):
                # Extract tool name from path
                remainder = target[len(tools_prefix):]
                tool = remainder.split("/")[0] if "/" in remainder else remainder
                entries.append({
                    "file": filepath,
                    "target": rel(target),
                    "tool": tool,
                    "direction": "shared→tools",
                })
    return sorted(entries, key=lambda e: (e["file"], e["target"]))


def detect_boundary_candidates(path: Path, graph: dict) -> list[dict]:
    """Find shared/ files whose importers ALL come from a single tool.

    These are candidates for moving into that tool's directory — they're
    "shared" in name only.
    """
    entries = []
    src = str(SRC_PATH)
    shared_prefix = f"{src}/shared/"
    tools_prefix = f"{src}/tools/"

    for filepath, entry in graph.items():
        if not filepath.startswith(shared_prefix):
            continue
        # Skip index files and ui/ components (intentionally shared)
        basename = Path(filepath).name
        if basename in ("index.ts", "index.tsx"):
            continue
        if f"{src}/shared/components/ui/" in filepath:
            continue
        # Skip files with zero importers (caught by other detectors)
        if entry["importer_count"] == 0:
            continue

        # Classify all importers by tool area
        tool_areas = set()
        has_non_tool_importer = False
        for imp in entry["importers"]:
            if imp.startswith(tools_prefix):
                remainder = imp[len(tools_prefix):]
                tool = remainder.split("/")[0]
                tool_areas.add(tool)
            else:
                has_non_tool_importer = True

        # Only flag if ALL importers are from a single tool
        if len(tool_areas) == 1 and not has_non_tool_importer:
            try:
                loc = len(Path(filepath).read_text().splitlines())
            except Exception:
                loc = 0
            entries.append({
                "file": filepath,
                "sole_tool": f"src/tools/{list(tool_areas)[0]}",
                "importer_count": entry["importer_count"],
                "loc": loc,
            })

    return sorted(entries, key=lambda e: -e["loc"])


def cmd_coupling(args):
    """Raw detector access: show coupling violations and boundary candidates."""
    graph = build_dep_graph(Path(args.path))

    violations = detect_coupling_violations(Path(args.path), graph)
    candidates = detect_boundary_candidates(Path(args.path), graph)

    if args.json:
        print(json.dumps({
            "violations": len(violations),
            "boundary_candidates": len(candidates),
            "coupling_violations": violations,
            "boundary_candidates_detail": [
                {**e, "file": rel(e["file"])} for e in candidates
            ],
        }, indent=2))
        return

    # Violations
    if violations:
        print(c(f"\nCoupling violations (shared → tools): {len(violations)}\n", "bold"))
        rows = []
        for e in violations[:args.top]:
            rows.append([rel(e["file"]), e["target"], e["tool"]])
        print_table(["Shared File", "Imports From", "Tool"], rows, [50, 50, 20])
    else:
        print(c("\nNo coupling violations (shared → tools).", "green"))

    # Boundary candidates
    print()
    if candidates:
        print(c(f"Boundary candidates (shared files used by 1 tool): {len(candidates)}\n", "bold"))
        rows = []
        for e in candidates[:args.top]:
            rows.append([rel(e["file"]), str(e["loc"]), e["sole_tool"],
                         str(e["importer_count"])])
        print_table(["Shared File", "LOC", "Only Used By", "Importers"], rows,
                    [50, 5, 30, 9])
    else:
        print(c("No boundary candidates found.", "green"))
    print()
