"""Markdown report generator for LLM-assisted cleanup."""

from collections import defaultdict
from datetime import date
from pathlib import Path

from .utils import rel
from .analyze import build_file_profile


def generate_report(
    path: Path,
    log_entries: list[dict],
    unused_entries: list[dict],
    export_entries: list[dict],
    dep_entries: list[dict],
    large_entries: list[dict],
    complexity_entries: list[dict],
    graph: dict | None = None,
    all_cruft: dict | None = None,
    god_entries: list[dict] | None = None,
    concern_entries: list[dict] | None = None,
    prop_entries: list[dict] | None = None,
    single_use_entries: list[dict] | None = None,
) -> str:
    """Generate a markdown checklist report for LLM-assisted cleanup."""
    lines = [
        f"# Cruft Cleanup Report — {date.today().isoformat()}",
        "",
        f"Scope: `{rel(str(path))}`",
        "",
        "Instructions: Work through each section. Check off items as you complete them. ",
        "For each item, verify the fix doesn't break anything before moving on.",
        "",
    ]

    # Summary
    summary_rows = [
        ("Tagged logs", len(log_entries)),
        ("Unused declarations", len(unused_entries)),
        ("Dead exports", len(export_entries)),
        ("Stale deprecated", len(dep_entries)),
        ("Large files (>500 LOC)", len(large_entries)),
        ("Complexity signals", len(complexity_entries)),
    ]
    if god_entries is not None:
        summary_rows.append(("God components", len(god_entries)))
    if concern_entries is not None:
        summary_rows.append(("Mixed concerns", len(concern_entries)))
    if prop_entries is not None:
        summary_rows.append(("Bloated prop interfaces", len(prop_entries)))
    if single_use_entries is not None:
        summary_rows.append(("Single-use abstractions", len(single_use_entries)))

    lines.extend([
        "## Summary",
        "",
        "| Category | Count |",
        "|----------|-------|",
    ])
    for label, count in summary_rows:
        lines.append(f"| {label} | {count} |")
    lines.append("")

    # Section 1: Tagged logs
    log_by_file: dict[str, list] = defaultdict(list)
    for e in log_entries:
        log_by_file[e["file"]].append(e)
    sorted_log_files = sorted(log_by_file.items(), key=lambda x: -len(x[1]))

    lines.extend([
        "---",
        "## 1. Tagged Console Logs (quick wins)",
        "",
        "Remove debug logging left behind. These are tagged `console.log('[Tag] ...')` calls.",
        "Safe to remove — they're dev-only debug output.",
        "",
    ])
    for filepath, file_entries in sorted_log_files[:30]:
        tags = set(e["tag"] for e in file_entries)
        lines.append(f"- [ ] **`{rel(filepath)}`** — {len(file_entries)} logs (tags: {', '.join(sorted(tags)[:5])})")
        for e in file_entries[:8]:
            lines.append(f"  - Line {e['line']}: `{e['content'][:80]}{'...' if len(e['content']) > 80 else ''}`")
        if len(file_entries) > 8:
            lines.append(f"  - ... and {len(file_entries) - 8} more")
    if len(sorted_log_files) > 30:
        lines.append(f"\n*Plus {len(sorted_log_files) - 30} more files with tagged logs.*")
    lines.append("")

    # Section 2: Unused declarations
    unused_by_file: dict[str, list] = defaultdict(list)
    for e in unused_entries:
        unused_by_file[e["file"]].append(e)
    sorted_unused = sorted(unused_by_file.items(), key=lambda x: -len(x[1]))

    lines.extend([
        "---",
        "## 2. Unused Declarations",
        "",
        "Reported by TypeScript compiler (TS6133). Remove unused imports and variables.",
        "After removing, re-run `npx tsc --noEmit` to confirm no new errors.",
        "",
    ])
    for filepath, file_entries in sorted_unused[:30]:
        imports = [e for e in file_entries if e["category"] == "imports"]
        vars_ = [e for e in file_entries if e["category"] == "vars"]
        lines.append(f"- [ ] **`{rel(filepath)}`** — {len(file_entries)} unused ({len(imports)} imports, {len(vars_)} vars)")
        for e in file_entries[:10]:
            lines.append(f"  - Line {e['line']}: `{e['name']}` ({e['category']})")
        if len(file_entries) > 10:
            lines.append(f"  - ... and {len(file_entries) - 10} more")
    if len(sorted_unused) > 30:
        lines.append(f"\n*Plus {len(sorted_unused) - 30} more files.*")
    lines.append("")

    # Section 3: Dead exports
    export_by_file: dict[str, list] = defaultdict(list)
    for e in export_entries:
        export_by_file[e["file"]].append(e)
    sorted_exports = sorted(export_by_file.items(), key=lambda x: -len(x[1]))

    lines.extend([
        "---",
        "## 3. Dead Exports",
        "",
        "Exports with no external importers. Either remove `export` keyword or delete entirely",
        "if the symbol is also unused internally.",
        "",
    ])
    for filepath, file_entries in sorted_exports[:30]:
        names = [e["name"] for e in file_entries]
        lines.append(f"- [ ] **`{rel(filepath)}`** — {', '.join(names[:6])}")
        if len(names) > 6:
            lines.append(f"  - ... and {len(names) - 6} more")
    if len(sorted_exports) > 30:
        lines.append(f"\n*Plus {len(sorted_exports) - 30} more files.*")
    lines.append("")

    # Section 4: Deprecated symbols
    top_level_deps = [e for e in dep_entries if e["kind"] == "top-level"]
    prop_deps = [e for e in dep_entries if e["kind"] == "property"]

    lines.extend([
        "---",
        "## 4. Deprecated Symbols",
        "",
        "Symbols marked `@deprecated`. Those with 0 importers can be deleted immediately.",
        "For those with active importers, migrate callers first.",
        "",
    ])
    if top_level_deps:
        lines.append("### Top-level (importable)")
        lines.append("")
        for e in top_level_deps:
            status = "**safe to delete**" if e["importers"] == 0 else f"{e['importers']} importers — migrate first"
            lines.append(f"- [ ] `{e['symbol']}` in `{rel(e['file'])}` — {status}")
        lines.append("")
    if prop_deps:
        lines.append("### Deprecated properties")
        lines.append("")
        for e in prop_deps[:20]:
            lines.append(f"- [ ] `{e['symbol']}` in `{rel(e['file'])}:{e['line']}`")
        if len(prop_deps) > 20:
            lines.append(f"\n*Plus {len(prop_deps) - 20} more deprecated properties.*")
        lines.append("")

    # Section 5: Large files
    lines.extend([
        "---",
        "## 5. Large Files (refactoring candidates)",
        "",
        "Files over 300 lines. Consider extracting hooks, splitting components,",
        "or moving types to dedicated files.",
        "",
    ])
    for e in large_entries[:20]:
        lines.append(f"- [ ] **`{rel(e['file'])}`** — {e['loc']} LOC, {e['imports']} imports, {e['functions']} functions")
    if len(large_entries) > 20:
        lines.append(f"\n*Plus {len(large_entries) - 20} more files.*")
    lines.append("")

    # Section 6: Complexity signals
    lines.extend([
        "---",
        "## 6. Complexity Signals (deeper refactoring)",
        "",
        "Files with structural issues that indicate need for refactoring.",
        "Address these after quick wins above.",
        "",
    ])
    for e in complexity_entries[:20]:
        sigs = ", ".join(e["signals"])
        lines.append(f"- [ ] **`{rel(e['file'])}`** ({e['loc']} LOC, score {e['score']}) — {sigs}")
    if len(complexity_entries) > 20:
        lines.append(f"\n*Plus {len(complexity_entries) - 20} more files.*")
    lines.append("")

    section = 7

    # Section 7: God components
    if god_entries:
        lines.extend([
            "---",
            f"## {section}. God Components (LLM review recommended)",
            "",
            "Components with excessive hook usage — likely doing too many things at once.",
            "Deploy an agent to read each file and identify distinct responsibilities to extract.",
            "",
        ])
        for e in god_entries[:15]:
            reasons = ", ".join(e["reasons"])
            lines.append(f"- [ ] **`{rel(e['file'])}`** ({e['loc']} LOC, {e['hook_total']} hooks) — {reasons}")
        if len(god_entries) > 15:
            lines.append(f"\n*Plus {len(god_entries) - 15} more.*")
        lines.append("")
        section += 1

    # Section 8: Mixed concerns
    if concern_entries:
        lines.extend([
            "---",
            f"## {section}. Mixed Concerns",
            "",
            "Files that combine UI rendering with data fetching, direct API calls, or heavy transforms.",
            "Each concern should live in a separate file (component, hook, service).",
            "",
        ])
        for e in concern_entries[:15]:
            lines.append(f"- [ ] **`{rel(e['file'])}`** ({e['loc']} LOC) — {', '.join(e['concerns'])}")
        if len(concern_entries) > 15:
            lines.append(f"\n*Plus {len(concern_entries) - 15} more.*")
        lines.append("")
        section += 1

    # Section 9: Bloated prop interfaces
    if prop_entries:
        lines.extend([
            "---",
            f"## {section}. Bloated Prop Interfaces (>10 props)",
            "",
            "Interfaces with many props suggest the component does too much,",
            "or needs composition (children/render props) or context instead of drilling.",
            "",
        ])
        for e in prop_entries[:20]:
            lines.append(f"- [ ] `{e['interface']}` in **`{rel(e['file'])}`** — {e['prop_count']} props (line {e['line']})")
        if len(prop_entries) > 20:
            lines.append(f"\n*Plus {len(prop_entries) - 20} more.*")
        lines.append("")
        section += 1

    # Section 10: Single-use abstractions
    if single_use_entries:
        lines.extend([
            "---",
            f"## {section}. Single-Use Abstractions",
            "",
            "Files exported but imported by exactly one other file.",
            "Consider inlining into the sole consumer to reduce indirection.",
            "",
        ])
        for e in single_use_entries[:20]:
            lines.append(f"- [ ] **`{rel(e['file'])}`** ({e['loc']} LOC) → only used by `{e['sole_importer']}`")
        if len(single_use_entries) > 20:
            lines.append(f"\n*Plus {len(single_use_entries) - 20} more.*")
        lines.append("")
        section += 1

    # Agent analysis targets
    if all_cruft and graph:
        profiles = []
        for resolved_path, file_cruft in all_cruft.items():
            profile = build_file_profile(resolved_path, graph, all_cruft)
            if profile["cruft_score"] >= 5:
                profiles.append(profile)
        profiles.sort(key=lambda p: -p["cruft_score"])

        if profiles:
            lines.extend([
                "---",
                f"## {section}. Agent Analysis Targets (top files by cruft score)",
                "",
                "These files have the highest concentration of issues. Each entry includes",
                "a pre-written analysis prompt — feed each to an agent for detailed refactoring recommendations.",
                "",
            ])
            for i, p in enumerate(profiles[:15], 1):
                cruft_summary = []
                cr = p["cruft"]
                if cr.get("log_count"):
                    cruft_summary.append(f"{cr['log_count']} logs")
                if cr.get("unused_count"):
                    cruft_summary.append(f"{cr['unused_count']} unused")
                if cr.get("dead_exports"):
                    cruft_summary.append(f"{len(cr['dead_exports'])} dead exports")
                if cr.get("god_component"):
                    cruft_summary.append("god component")
                if cr.get("mixed_concerns"):
                    cruft_summary.append("mixed concerns")
                if cr.get("single_use_importer"):
                    cruft_summary.append("single-use")

                lines.extend([
                    f"### {i}. `{p['file']}` (score {p['cruft_score']})",
                    "",
                    f"**{p['loc']} LOC** | Fan-in: {p['coupling']['fan_in']} | Fan-out: {p['coupling']['fan_out']} | {', '.join(cruft_summary)}",
                    "",
                    "<details>",
                    "<summary>Agent prompt</summary>",
                    "",
                    "```",
                    p["analysis_prompt"],
                    "```",
                    "</details>",
                    "",
                ])
            lines.append("")

    return "\n".join(lines)
