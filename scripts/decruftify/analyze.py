"""Agent-ready analysis: file profiling, cruft collection, manifest generation."""

import json
import sys
from collections import defaultdict
from pathlib import Path

from .utils import PROJECT_ROOT, c, print_table, rel, resolve_path
from .detectors.logs import detect_logs
from .detectors.unused import detect_unused
from .detectors.exports import detect_dead_exports
from .detectors.deprecated import detect_deprecated
from .detectors.complexity import detect_complexity
from .detectors.gods import detect_god_components
from .detectors.concerns import detect_mixed_concerns
from .detectors.props import detect_prop_interface_bloat
from .detectors.single_use import detect_single_use_abstractions
from .detectors.deps import build_dep_graph, get_coupling_score


def collect_all_cruft(path: Path, graph: dict) -> dict[str, dict]:
    """Run all detectors and index results by file (resolved path)."""
    cruft: dict[str, dict] = defaultdict(lambda: {})

    print(c("  Collecting logs...", "dim"), file=sys.stderr)
    for e in detect_logs(path):
        r = resolve_path(e["file"])
        cruft[r].setdefault("log_count", 0)
        cruft[r]["log_count"] += 1

    print(c("  Running tsc...", "dim"), file=sys.stderr)
    for e in detect_unused(path):
        r = resolve_path(e["file"])
        cruft[r].setdefault("unused_count", 0)
        cruft[r]["unused_count"] += 1
        cruft[r].setdefault("unused_names", [])
        cruft[r]["unused_names"].append(e["name"])

    print(c("  Scanning exports...", "dim"), file=sys.stderr)
    for e in detect_dead_exports(path):
        r = resolve_path(e["file"])
        cruft[r].setdefault("dead_exports", [])
        cruft[r]["dead_exports"].append(e["name"])

    for e in detect_deprecated(path):
        r = resolve_path(e["file"])
        cruft[r].setdefault("deprecated", [])
        cruft[r]["deprecated"].append(e["symbol"])

    print(c("  Analyzing components...", "dim"), file=sys.stderr)
    for e in detect_god_components(path):
        r = resolve_path(e["file"])
        cruft[r]["god_component"] = e["reasons"]

    for e in detect_complexity(path):
        r = resolve_path(e["file"])
        cruft[r]["complexity_signals"] = e["signals"]
        cruft[r]["complexity_score"] = e["score"]

    for e in detect_mixed_concerns(path):
        r = resolve_path(e["file"])
        cruft[r]["mixed_concerns"] = e["concerns"]

    for e in detect_prop_interface_bloat(path):
        r = resolve_path(e["file"])
        cruft[r].setdefault("bloated_props", [])
        cruft[r]["bloated_props"].append(f"{e['interface']}({e['prop_count']})")
        cruft[r].setdefault("bloated_prop_details", [])
        cruft[r]["bloated_prop_details"].append(e)

    for e in detect_single_use_abstractions(path, graph):
        r = resolve_path(e["file"])
        cruft[r]["single_use_importer"] = e["sole_importer"]

    return dict(cruft)


def build_file_profile(filepath: str, graph: dict, all_cruft: dict) -> dict:
    """Build a comprehensive profile of a file for agent analysis."""
    p = Path(filepath) if Path(filepath).is_absolute() else PROJECT_ROOT / filepath
    try:
        content = p.read_text()
        lines = content.splitlines()
    except Exception:
        content = ""
        lines = []

    coupling = get_coupling_score(filepath, graph)

    resolved = resolve_path(filepath)
    file_cruft = all_cruft.get(resolved, {})

    prompt_parts = [
        f"Analyze this file for refactoring opportunities.",
        f"File: {rel(filepath)} ({len(lines)} lines)",
    ]

    if file_cruft.get("log_count", 0) > 0:
        prompt_parts.append(f"- Has {file_cruft['log_count']} tagged debug logs to remove")
    if file_cruft.get("unused_count", 0) > 0:
        prompt_parts.append(f"- Has {file_cruft['unused_count']} unused declarations")
    if file_cruft.get("dead_exports"):
        prompt_parts.append(f"- Dead exports: {', '.join(file_cruft['dead_exports'])}")
    if file_cruft.get("complexity_signals"):
        prompt_parts.append(f"- Complexity: {', '.join(file_cruft['complexity_signals'])}")
    if file_cruft.get("god_component"):
        prompt_parts.append(f"- God component: {', '.join(file_cruft['god_component'])}")
    if file_cruft.get("mixed_concerns"):
        prompt_parts.append(f"- Mixed concerns: {', '.join(file_cruft['mixed_concerns'])}")
    if file_cruft.get("bloated_props"):
        prompt_parts.append(f"- Bloated interfaces: {', '.join(file_cruft['bloated_props'])}")
    if coupling["fan_in"] > 10:
        prompt_parts.append(f"- High fan-in ({coupling['fan_in']} importers) — changes here affect many files")
    if file_cruft.get("single_use_importer"):
        prompt_parts.append(f"- Only imported by {file_cruft['single_use_importer']} — consider inlining")

    prompt_parts.extend([
        "",
        "Questions to answer:",
        "1. What are the distinct responsibilities in this file? Could it be split?",
        "2. Are there abstractions that exist for only one caller? Should they be inlined?",
        "3. Is there prop drilling that should use context instead?",
        "4. Are there patterns here that differ from the rest of the codebase?",
        "5. What's the minimal set of changes to improve this file meaningfully?",
        "",
        "Provide a specific, actionable refactoring plan — not generic advice.",
    ])

    excerpt = "\n".join(lines[:150])
    if len(lines) > 150:
        excerpt += f"\n... ({len(lines) - 150} more lines)"

    return {
        "file": rel(filepath),
        "loc": len(lines),
        "coupling": coupling,
        "cruft": file_cruft,
        "cruft_score": sum([
            file_cruft.get("log_count", 0),
            file_cruft.get("unused_count", 0) * 2,
            len(file_cruft.get("dead_exports", [])) * 2,
            10 if file_cruft.get("god_component") else 0,
            8 if file_cruft.get("mixed_concerns") else 0,
            5 if file_cruft.get("single_use_importer") else 0,
            sum(p for p in [e.get("prop_count", 0) - 10 for e in (file_cruft.get("bloated_prop_details", []))] if p > 0),
        ]),
        "analysis_prompt": "\n".join(prompt_parts),
        "excerpt": excerpt,
    }


def cmd_analyze(args):
    """Generate agent-ready analysis manifests."""
    path = Path(args.path)
    print(c("Building dependency graph...", "dim"), file=sys.stderr)
    graph = build_dep_graph(path)
    print(c("Running all detectors...", "dim"), file=sys.stderr)
    all_cruft = collect_all_cruft(path, graph)

    profiles = []
    for resolved_path, file_cruft in all_cruft.items():
        profile = build_file_profile(resolved_path, graph, all_cruft)
        if profile["cruft_score"] > 0:
            profiles.append(profile)
    profiles.sort(key=lambda p: -p["cruft_score"])

    top = profiles[:args.top]

    if args.json:
        for p in top:
            if not args.deep:
                del p["excerpt"]
        print(json.dumps({"count": len(profiles), "manifests": top}, indent=2))
        return

    if args.manifest:
        manifest_dir = Path(args.manifest)
        manifest_dir.mkdir(parents=True, exist_ok=True)
        for i, p in enumerate(top):
            manifest_path = manifest_dir / f"{i+1:03d}_{Path(p['file']).stem}.md"
            lines = [
                f"# Analysis Task: {p['file']}",
                "",
                f"**Cruft Score:** {p['cruft_score']} | **LOC:** {p['loc']} | "
                f"**Fan-in:** {p['coupling']['fan_in']} | **Fan-out:** {p['coupling']['fan_out']}",
                "",
                "## Cruft Findings",
                "",
            ]
            for k, v in p["cruft"].items():
                if isinstance(v, list):
                    lines.append(f"- **{k}:** {', '.join(str(x) for x in v[:10])}")
                else:
                    lines.append(f"- **{k}:** {v}")
            lines.extend([
                "",
                "## Dependency Context",
                "",
                f"**Imported by ({p['coupling']['fan_in']}):** {', '.join(p['coupling']['importers'][:10])}",
                f"**Imports ({p['coupling']['fan_out']}):** {', '.join(p['coupling']['imports'][:10])}",
                "",
                "## Analysis Prompt",
                "",
                p["analysis_prompt"],
                "",
                "## File Content",
                "",
                "```typescript",
                p["excerpt"],
                "```",
            ])
            manifest_path.write_text("\n".join(lines))
        print(c(f"\nWrote {len(top)} agent manifests to {args.manifest}/", "green"))
        return

    # Terminal output
    print(c(f"\nTop {len(top)} files by cruft score:\n", "bold"))
    rows = []
    for p in top:
        cruft_summary = []
        cr = p["cruft"]
        if cr.get("log_count"):
            cruft_summary.append(f"{cr['log_count']} logs")
        if cr.get("unused_count"):
            cruft_summary.append(f"{cr['unused_count']} unused")
        if cr.get("dead_exports"):
            cruft_summary.append(f"{len(cr['dead_exports'])} dead exp")
        if cr.get("god_component"):
            cruft_summary.append("god component")
        if cr.get("mixed_concerns"):
            cruft_summary.append("mixed concerns")
        if cr.get("bloated_props"):
            cruft_summary.append("bloated props")
        if cr.get("single_use_importer"):
            cruft_summary.append("single-use")
        rows.append([p["file"], str(p["cruft_score"]), str(p["loc"]),
                     f"{p['coupling']['fan_in']}/{p['coupling']['fan_out']}", ", ".join(cruft_summary)])
    print_table(["File", "Score", "LOC", "In/Out", "Issues"], rows, [50, 6, 5, 7, 40])
