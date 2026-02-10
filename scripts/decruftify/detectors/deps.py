"""Dependency graph + coupling analysis (fan-in/fan-out)."""

import json
import re
import subprocess
from collections import defaultdict
from pathlib import Path

from ..utils import PROJECT_ROOT, SRC_PATH, c, print_table, rel, resolve_path


def build_dep_graph(path: Path) -> dict[str, dict]:
    """Build a dependency graph: for each file, who it imports and who imports it.

    Returns {resolved_path: {"imports": set[str], "importers": set[str], "import_count": int, "importer_count": int}}
    """
    # Single grep pass for all import/from lines
    result = subprocess.run(
        ["grep", "-rn", "--include=*.ts", "--include=*.tsx", "-E",
         r"from\s+['\"]", str(path)],
        capture_output=True, text=True, cwd=PROJECT_ROOT,
    )

    graph: dict[str, dict] = defaultdict(lambda: {"imports": set(), "importers": set()})
    module_re = re.compile(r"""from\s+['"]([^'"]+)['"]""")

    for line in result.stdout.splitlines():
        parts = line.split(":", 2)
        if len(parts) < 3:
            continue
        filepath, content = parts[0], parts[2]
        source_resolved = resolve_path(filepath)
        graph[source_resolved]  # ensure entry exists

        m = module_re.search(content)
        if not m:
            continue
        module_path = m.group(1)
        # Resolve relative imports to absolute paths
        if module_path.startswith("."):
            source_dir = Path(filepath).parent if Path(filepath).is_absolute() else (PROJECT_ROOT / filepath).parent
            target = (source_dir / module_path).resolve()
            # Try common extensions
            for ext in ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]:
                candidate = Path(str(target) + ext)
                if candidate.exists():
                    target_resolved = str(candidate)
                    graph[source_resolved]["imports"].add(target_resolved)
                    graph[target_resolved]["importers"].add(source_resolved)
                    break
        elif module_path.startswith("@/"):
            # Alias: @/ -> src/
            relative = module_path[2:]
            target = SRC_PATH / relative
            for ext in ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]:
                candidate = Path(str(target) + ext)
                if candidate.exists():
                    target_resolved = str(candidate)
                    graph[source_resolved]["imports"].add(target_resolved)
                    graph[target_resolved]["importers"].add(source_resolved)
                    break

    # Add counts
    for v in graph.values():
        v["import_count"] = len(v["imports"])
        v["importer_count"] = len(v["importers"])

    return dict(graph)


def get_coupling_score(filepath: str, graph: dict) -> dict:
    """Get coupling metrics for a file."""
    resolved = resolve_path(filepath)
    entry = graph.get(resolved, {"imports": set(), "importers": set(), "import_count": 0, "importer_count": 0})
    fan_in = entry["importer_count"]
    fan_out = entry["import_count"]
    # Instability metric (Robert C. Martin): I = fan_out / (fan_in + fan_out)
    instability = fan_out / (fan_in + fan_out) if (fan_in + fan_out) > 0 else 0
    return {
        "fan_in": fan_in,
        "fan_out": fan_out,
        "instability": round(instability, 2),
        "importers": [rel(p) for p in sorted(entry["importers"])],
        "imports": [rel(p) for p in sorted(entry["imports"])],
    }


def cmd_deps(args):
    """Show dependency info for a specific file or top coupled files."""
    graph = build_dep_graph(Path(args.path))

    if hasattr(args, "file") and args.file:
        # Single file mode
        resolved = resolve_path(args.file)
        coupling = get_coupling_score(args.file, graph)
        if args.json:
            print(json.dumps({"file": rel(args.file), **coupling}, indent=2))
            return
        print(c(f"\nDependency info: {rel(args.file)}\n", "bold"))
        print(f"  Fan-in (importers):  {coupling['fan_in']}")
        print(f"  Fan-out (imports):   {coupling['fan_out']}")
        print(f"  Instability:         {coupling['instability']}")
        if coupling["importers"]:
            print(c(f"\n  Imported by ({coupling['fan_in']}):", "cyan"))
            for p in coupling["importers"][:20]:
                print(f"    {p}")
        if coupling["imports"]:
            print(c(f"\n  Imports ({coupling['fan_out']}):", "cyan"))
            for p in coupling["imports"][:20]:
                print(f"    {p}")
        return

    # Top coupled files mode
    scored = []
    for filepath, entry in graph.items():
        total = entry["import_count"] + entry["importer_count"]
        if total > 5:
            scored.append({
                "file": filepath,
                "fan_in": entry["importer_count"],
                "fan_out": entry["import_count"],
                "total": total,
            })
    scored.sort(key=lambda x: -x["total"])

    if args.json:
        print(json.dumps({"count": len(scored), "entries": [
            {**s, "file": rel(s["file"])} for s in scored[:args.top]
        ]}, indent=2))
        return

    print(c(f"\nMost coupled files: {len(scored)} with >5 connections\n", "bold"))
    rows = []
    for s in scored[:args.top]:
        rows.append([rel(s["file"]), str(s["fan_in"]), str(s["fan_out"]), str(s["total"])])
    print_table(["File", "In", "Out", "Total"], rows, [60, 5, 5, 6])
