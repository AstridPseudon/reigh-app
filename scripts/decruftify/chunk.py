"""Code chunker: extract functions/components/hooks as self-contained units for LLM analysis."""

import json
import re
import subprocess
from pathlib import Path

from .utils import PROJECT_ROOT, c, log, print_table, rel


def extract_chunks(path: Path, min_lines: int = 5) -> list[dict]:
    """Extract all functions, components, and hooks as self-contained code chunks.

    Each chunk includes:
    - The full function/component body
    - Import context (what the function depends on)
    - Export status
    - Type: 'component', 'hook', 'function', 'util'
    """
    result = subprocess.run(
        ["find", str(path), "-name", "*.ts", "-o", "-name", "*.tsx"],
        capture_output=True, text=True, cwd=PROJECT_ROOT,
    )

    chunks = []
    for filepath in result.stdout.strip().splitlines():
        if not filepath or "node_modules" in filepath or ".d.ts" in filepath:
            continue
        try:
            p = Path(filepath) if Path(filepath).is_absolute() else PROJECT_ROOT / filepath
            content = p.read_text()
            lines = content.splitlines()
        except Exception:
            continue

        # Extract imports for context
        imports = [l for l in lines if l.strip().startswith("import ")]

        # Find function declarations
        chunks.extend(_extract_file_chunks(filepath, content, lines, imports, min_lines))

    return chunks


def _classify_chunk(name: str, body: str, filepath: str) -> str:
    """Classify a chunk as component, hook, function, or util."""
    if name.startswith("use") and name[3:4].isupper():
        return "hook"
    if name[0].isupper() and ("return" in body and ("<" in body or "jsx" in filepath.lower())):
        return "component"
    if filepath.endswith(".tsx") and name[0].isupper():
        return "component"
    return "function"


def _extract_file_chunks(filepath: str, content: str, lines: list[str],
                         imports: list[str], min_lines: int) -> list[dict]:
    """Extract chunks from a single file."""
    chunks = []

    # Pattern: function declarations, arrow functions, const assignments
    fn_re = re.compile(
        r"^(\s*)(?:export\s+)?(?:"
        r"(?:function\s+(\w+))|"
        r"(?:const\s+(\w+)\s*(?::\s*\w[^=]*)?\s*=\s*(?:React\.)?(?:memo|forwardRef)?\s*\(?(?:\s*(?:function|\()|\s*<))|"
        r"(?:const\s+(\w+)\s*(?::\s*\w[^=]*)?\s*=\s*(?:\([^)]*\)\s*=>|[a-zA-Z]\w*\s*=>))"
        r")", re.MULTILINE
    )

    for m in fn_re.finditer(content):
        indent = m.group(1)
        name = m.group(2) or m.group(3) or m.group(4)
        if not name:
            continue

        # Skip nested functions (indented > 0 from module level)
        if len(indent) > 0 and indent.strip() == "":
            # Only skip if indented (not at module level)
            if len(indent) >= 4 or "\t" in indent:
                continue

        start_offset = m.start()
        start_line = content[:start_offset].count("\n")

        # Find end of function by tracking braces
        brace_depth = 0
        found_open = False
        end_line = start_line
        for j in range(start_line, len(lines)):
            for ch in lines[j]:
                if ch == '{':
                    brace_depth += 1
                    found_open = True
                elif ch == '}':
                    brace_depth -= 1
            if found_open and brace_depth <= 0:
                end_line = j
                break

        if not found_open:
            # Arrow function might be a single expression (no braces)
            # Find the end by looking for the next top-level declaration or blank line
            for j in range(start_line + 1, min(start_line + 50, len(lines))):
                stripped = lines[j].strip()
                if not stripped or (stripped and not stripped.startswith("//") and
                                    (stripped.startswith("export ") or stripped.startswith("const ") or
                                     stripped.startswith("function ") or stripped.startswith("type ") or
                                     stripped.startswith("interface "))):
                    end_line = j - 1
                    break
            else:
                end_line = min(start_line + 20, len(lines) - 1)

        body_lines = lines[start_line:end_line + 1]
        loc = len(body_lines)
        if loc < min_lines:
            continue

        body = "\n".join(body_lines)
        is_exported = "export " in lines[start_line]
        chunk_type = _classify_chunk(name, body, filepath)

        chunks.append({
            "file": filepath,
            "name": name,
            "type": chunk_type,
            "exported": is_exported,
            "start_line": start_line + 1,
            "end_line": end_line + 1,
            "loc": loc,
            "body": body,
            "imports": imports,
        })

    return chunks


def cmd_chunk(args):
    """Extract and display code chunks."""
    path = Path(args.path)
    min_lines = getattr(args, "min_lines", 5)
    chunks = extract_chunks(path, min_lines)

    if args.json:
        # Strip body for summary, keep metadata
        summary = [{k: v for k, v in ch.items() if k != "body"} for ch in chunks]
        print(json.dumps({"count": len(summary), "chunks": summary}, indent=2))
        return

    if hasattr(args, "output") and args.output:
        output_dir = Path(args.output)
        output_dir.mkdir(parents=True, exist_ok=True)

        # Group by file
        by_file: dict[str, list] = {}
        for ch in chunks:
            by_file.setdefault(ch["file"], []).append(ch)

        manifest = []
        for filepath, file_chunks in by_file.items():
            for ch in file_chunks:
                chunk_id = f"{Path(filepath).stem}__{ch['name']}"
                chunk_file = output_dir / f"{chunk_id}.md"
                lines = [
                    f"# {ch['type'].title()}: `{ch['name']}`",
                    "",
                    f"**File:** `{rel(ch['file'])}:{ch['start_line']}-{ch['end_line']}`",
                    f"**Type:** {ch['type']} | **LOC:** {ch['loc']} | **Exported:** {ch['exported']}",
                    "",
                    "## Imports",
                    "",
                    "```typescript",
                    "\n".join(ch["imports"]),
                    "```",
                    "",
                    "## Code",
                    "",
                    "```typescript",
                    ch["body"],
                    "```",
                ]
                chunk_file.write_text("\n".join(lines))
                manifest.append({
                    "id": chunk_id,
                    "file": rel(ch["file"]),
                    "name": ch["name"],
                    "type": ch["type"],
                    "loc": ch["loc"],
                    "path": str(chunk_file),
                })

        # Write manifest index
        (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
        print(c(f"\nWrote {len(manifest)} chunks to {args.output}/", "green"))
        print(c(f"Manifest: {args.output}/manifest.json", "dim"))
        return

    # Summary output
    by_type = {}
    for ch in chunks:
        by_type.setdefault(ch["type"], []).append(ch)

    print(c(f"\nCode chunks: {len(chunks)} extracted\n", "bold"))
    rows = []
    for t in ["component", "hook", "function"]:
        items = by_type.get(t, [])
        if items:
            avg_loc = sum(ch["loc"] for ch in items) // len(items)
            largest = max(items, key=lambda ch: ch["loc"])
            rows.append([t.title(), str(len(items)), str(avg_loc),
                         f"{largest['name']} ({largest['loc']} LOC)"])
    print_table(["Type", "Count", "Avg LOC", "Largest"], rows, [12, 7, 8, 40])
