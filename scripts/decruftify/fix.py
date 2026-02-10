"""Auto-fixers for mechanical cleanup tasks.

Currently supports:
- Unused imports (T1): removes unused symbols from import statements.
"""

import re
import sys
from collections import defaultdict
from pathlib import Path

from .utils import PROJECT_ROOT, c, rel


def fix_unused_imports(entries: list[dict], *, dry_run: bool = False) -> list[dict]:
    """Remove unused imports from source files.

    Args:
        entries: Output of detect_unused(), filtered to category=="imports".
        dry_run: If True, don't write files, just report what would change.

    Returns:
        List of {file, removed: [symbols], lines_removed: int} dicts.
    """
    by_file: dict[str, list[dict]] = defaultdict(list)
    for e in entries:
        if e["category"] != "imports":
            continue
        by_file[e["file"]].append(e)

    results = []
    for filepath, file_entries in sorted(by_file.items()):
        try:
            p = Path(filepath) if Path(filepath).is_absolute() else PROJECT_ROOT / filepath
            original = p.read_text()
            lines = original.splitlines(keepends=True)

            unused_symbols = {e["name"] for e in file_entries}
            unused_by_line = defaultdict(set)
            for e in file_entries:
                unused_by_line[e["line"]].append(e["name"])

            new_lines = _process_file_lines(lines, unused_symbols, unused_by_line)
            new_content = "".join(new_lines)

            if new_content != original:
                removed = [e["name"] for e in file_entries]
                lines_removed = len(lines) - len(new_lines)
                results.append({
                    "file": filepath,
                    "removed": removed,
                    "lines_removed": lines_removed,
                })
                if not dry_run:
                    p.write_text(new_content)
        except Exception as ex:
            print(c(f"  Skip {rel(filepath)}: {ex}", "yellow"), file=sys.stderr)

    return results


def _process_file_lines(lines: list[str], unused_symbols: set[str],
                        unused_by_line: dict[int, list[str]]) -> list[str]:
    """Process file lines, removing unused imports. Returns new lines."""
    result = []
    i = 0

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Check if this line starts an import
        if not stripped.startswith("import "):
            result.append(line)
            i += 1
            continue

        # Collect full import statement (may span multiple lines)
        import_lines = [line]
        import_start = i
        # Multi-line import: look for the closing semicolon or the from clause
        while not _is_import_complete("".join(import_lines)):
            i += 1
            if i >= len(lines):
                break
            import_lines.append(lines[i])

        full_import = "".join(import_lines)
        lineno = import_start + 1  # 1-indexed

        # Check if "(entire import)" is flagged for this line
        if "(entire import)" in unused_symbols and any(
            "(entire import)" in unused_by_line.get(ln, [])
            for ln in range(lineno, lineno + len(import_lines))
        ):
            # Remove entire import
            i += 1
            # Also skip trailing blank line if it would create a double blank
            if i < len(lines) and lines[i].strip() == "" and result and result[-1].strip() == "":
                i += 1
            continue

        # Check if any named symbols in this import are unused
        symbols_on_this_import = set()
        for ln in range(lineno, lineno + len(import_lines)):
            for sym in unused_by_line.get(ln, []):
                if sym != "(entire import)":
                    symbols_on_this_import.add(sym)

        if not symbols_on_this_import:
            result.extend(import_lines)
            i += 1
            continue

        # Try to remove specific symbols from this import
        cleaned = _remove_symbols_from_import(full_import, symbols_on_this_import)
        if cleaned is None:
            # All symbols removed — drop the import entirely
            i += 1
            if i < len(lines) and lines[i].strip() == "" and result and result[-1].strip() == "":
                i += 1
            continue

        result.append(cleaned)
        i += 1
        continue

    return result


def _is_import_complete(text: str) -> bool:
    """Check if an import statement is complete (has semicolon or from clause ending)."""
    stripped = text.strip()
    if stripped.endswith(";"):
        return True
    # import 'foo' (side effect, no semicolon sometimes in some configs)
    if "from " in stripped and ("'" in stripped.split("from ")[-1] or '"' in stripped.split("from ")[-1]):
        # Check if the string literal is closed
        after_from = stripped.split("from ", 1)[-1].strip()
        if (after_from.startswith("'") and after_from.count("'") >= 2) or \
           (after_from.startswith('"') and after_from.count('"') >= 2):
            return True
    return False


def _remove_symbols_from_import(import_stmt: str, symbols_to_remove: set[str]) -> str | None:
    """Remove specific symbols from an import statement.

    Returns the cleaned import string, or None if the import should be removed entirely.
    """
    # Parse the import to understand its structure
    # Match: import [Default, ] { Named1, Named2 } from 'module'
    # Or: import Default from 'module'
    # Or: import { Named } from 'module'
    # Or: import type { Named } from 'module'

    stmt = import_stmt.strip()

    # Extract the from clause
    from_match = re.search(r"""from\s+(['"].*?['"]);?\s*$""", stmt, re.DOTALL)
    if not from_match:
        return import_stmt  # Can't parse, leave alone

    from_clause = from_match.group(0).rstrip()
    if not from_clause.endswith(";"):
        from_clause += ";"
    before_from = stmt[:from_match.start()].strip()

    # Check for type keyword
    type_prefix = ""
    if before_from.startswith("import type"):
        type_prefix = "type "
        before_from = before_from[len("import type"):].strip()
    elif before_from.startswith("import"):
        before_from = before_from[len("import"):].strip()
    else:
        return import_stmt  # Can't parse

    # Split into default import and named imports
    default_import = None
    named_imports = []

    # Check for { ... } block
    brace_match = re.search(r'\{([^}]*)\}', before_from, re.DOTALL)
    if brace_match:
        named_str = brace_match.group(1)
        named_imports = [n.strip() for n in named_str.split(",") if n.strip()]
        before_brace = before_from[:brace_match.start()].strip().rstrip(",").strip()
        if before_brace:
            default_import = before_brace
    else:
        # No braces — just a default import
        default_import = before_from.strip().rstrip(",").strip()

    # Remove the specified symbols
    remove_default = default_import in symbols_to_remove if default_import else False
    remaining_named = [n for n in named_imports if n not in symbols_to_remove
                       and n.split(" as ")[0].strip() not in symbols_to_remove]

    new_default = None if remove_default else default_import
    new_named = remaining_named

    # If nothing remains, remove the entire import
    if not new_default and not new_named:
        return None

    # Reconstruct
    parts = []
    if new_default:
        parts.append(new_default)
    if new_named:
        if len(new_named) <= 3:
            parts.append("{ " + ", ".join(new_named) + " }")
        else:
            # Multi-line format for many imports
            inner = ",\n  ".join(new_named)
            parts.append("{\n  " + inner + "\n}")

    # Detect original indentation
    indent = ""
    for ch in import_stmt:
        if ch in " \t":
            indent += ch
        else:
            break

    return f"{indent}import {type_prefix}{', '.join(parts)} {from_clause}\n"
