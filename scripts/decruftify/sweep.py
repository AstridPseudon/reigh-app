"""LLM sweep: generate fan-out query manifests for semantic code analysis at scale.

Each query is a self-contained prompt + code excerpt that can be sent to a cheap/fast
LLM for parallel analysis. Queries are grouped by type and written to individual files.
"""

import json
from pathlib import Path

from .utils import c, rel
from .chunk import extract_chunks


# ── Query templates ──────────────────────────────────────────

QUERY_TEMPLATES = {
    "summarize": {
        "system": "You are a code reviewer. Summarize what this function does in 1-2 sentences.",
        "prompt": "Summarize this {type} in 1-2 sentences. Focus on its purpose, not implementation details.\n\n```typescript\n{body}\n```",
        "response_format": "plain text summary",
    },
    "naming": {
        "system": "You are a code reviewer focused on naming clarity.",
        "prompt": "Review the naming of this {type} and its internal variables/functions.\n\n1. Is the name `{name}` clear and accurate for what it does?\n2. Are internal variable names descriptive?\n3. Suggest better names if any are unclear.\n\n```typescript\n{body}\n```",
        "response_format": "JSON: {\"name_ok\": bool, \"suggestions\": [{\"current\": str, \"suggested\": str, \"reason\": str}]}",
    },
    "srp": {
        "system": "You are a software architect reviewing code for the Single Responsibility Principle.",
        "prompt": "Does this {type} `{name}` follow the Single Responsibility Principle?\n\n1. List the distinct responsibilities.\n2. If >1 responsibility, suggest how to split.\n3. Rate: 'clean' (1 resp), 'mixed' (2), 'god' (3+).\n\n```typescript\n{body}\n```",
        "response_format": "JSON: {\"rating\": str, \"responsibilities\": [str], \"split_suggestion\": str|null}",
    },
    "errors": {
        "system": "You are a code reviewer focused on error handling and edge cases.",
        "prompt": "Review error handling in this {type} `{name}`.\n\n1. Are errors caught and handled appropriately?\n2. Are there missing error cases?\n3. Could any operations fail silently?\n\n```typescript\n{body}\n```",
        "response_format": "JSON: {\"issues\": [{\"line\": str, \"issue\": str, \"fix\": str}]}",
    },
    "patterns": {
        "system": "You are reviewing code for consistency with React/TypeScript best practices.",
        "prompt": "Review this {type} `{name}` for pattern conformity.\n\nCheck for:\n- React anti-patterns (direct state mutation, missing deps in hooks)\n- TypeScript issues (unnecessary `as` casts, `any` types)\n- Performance issues (unnecessary re-renders, missing memoization)\n\n```typescript\n{body}\n```",
        "response_format": "JSON: {\"issues\": [{\"pattern\": str, \"severity\": str, \"fix\": str}]}",
    },
    "stale-comments": {
        "system": "You are reviewing code comments for accuracy and staleness.",
        "prompt": "Review the comments in this code. For each comment:\n1. Is it still accurate?\n2. Is it redundant (just restating the code)?\n3. Should it be updated or removed?\n\n```typescript\n{body}\n```",
        "response_format": "JSON: {\"comments\": [{\"line\": str, \"status\": \"accurate\"|\"stale\"|\"redundant\", \"suggestion\": str}]}",
    },
}


def generate_sweep(path: Path, output_dir: Path, query_types: list[str],
                   min_lines: int = 10) -> dict:
    """Generate LLM sweep manifests.

    Returns summary stats. Writes individual query files to output_dir.
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    # Get all code chunks
    chunks = extract_chunks(path, min_lines=min_lines)

    if "all" in query_types:
        query_types = list(QUERY_TEMPLATES.keys())

    stats = {"total_queries": 0, "by_type": {}, "chunks": len(chunks)}
    all_queries = []

    for query_type in query_types:
        template = QUERY_TEMPLATES.get(query_type)
        if not template:
            continue

        queries = []
        for chunk in chunks:
            query_id = f"{query_type}__{Path(chunk['file']).stem}__{chunk['name']}"
            query = {
                "id": query_id,
                "type": query_type,
                "chunk": {
                    "file": rel(chunk["file"]),
                    "name": chunk["name"],
                    "chunk_type": chunk["type"],
                    "start_line": chunk["start_line"],
                    "end_line": chunk["end_line"],
                    "loc": chunk["loc"],
                },
                "system_prompt": template["system"],
                "user_prompt": template["prompt"].format(
                    type=chunk["type"],
                    name=chunk["name"],
                    body=chunk["body"],
                ),
                "expected_format": template["response_format"],
            }
            queries.append(query)

        # Write queries for this type
        type_dir = output_dir / query_type
        type_dir.mkdir(parents=True, exist_ok=True)

        for q in queries:
            query_file = type_dir / f"{q['id']}.json"
            query_file.write_text(json.dumps(q, indent=2))

        # Write batch file (all queries of this type in one file)
        batch_file = output_dir / f"batch_{query_type}.jsonl"
        with open(batch_file, "w") as f:
            for q in queries:
                f.write(json.dumps(q) + "\n")

        stats["by_type"][query_type] = len(queries)
        stats["total_queries"] += len(queries)
        all_queries.extend(queries)

    # Write master manifest
    manifest = {
        "stats": stats,
        "query_types": query_types,
        "templates": {k: {kk: vv for kk, vv in v.items() if kk != "prompt"}
                      for k, v in QUERY_TEMPLATES.items() if k in query_types},
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))

    # Write runner script
    runner = _generate_runner_script(output_dir, query_types)
    runner_path = output_dir / "run_sweep.sh"
    runner_path.write_text(runner)
    runner_path.chmod(0o755)

    return stats


def _generate_runner_script(output_dir: Path, query_types: list[str]) -> str:
    """Generate a bash script to run the sweep with the Anthropic API."""
    return f"""#!/bin/bash
# LLM Sweep Runner — generated by decruftify
# Reads queries from JSONL batch files and fans out to the Anthropic API.
#
# Prerequisites:
#   export ANTHROPIC_API_KEY=your-key
#
# Usage:
#   ./run_sweep.sh [query_type]   # Run specific type, or all if omitted
#
# Each query is sent individually. Results are written to results/<query_id>.json.
# For production use, use the Anthropic Batch API for higher throughput.

set -euo pipefail

SWEEP_DIR="{output_dir}"
RESULTS_DIR="$SWEEP_DIR/results"
MODEL="${{MODEL:-claude-haiku-4-5-20251001}}"
mkdir -p "$RESULTS_DIR"

run_query() {{
    local query_file="$1"
    local id=$(jq -r '.id' "$query_file")
    local system=$(jq -r '.system_prompt' "$query_file")
    local prompt=$(jq -r '.user_prompt' "$query_file")

    echo "  Running: $id"
    curl -s https://api.anthropic.com/v1/messages \\
        -H "x-api-key: $ANTHROPIC_API_KEY" \\
        -H "anthropic-version: 2023-06-01" \\
        -H "content-type: application/json" \\
        -d "$(jq -n --arg model "$MODEL" --arg system "$system" --arg prompt "$prompt" '{{
            "model": $model,
            "max_tokens": 1024,
            "system": $system,
            "messages": [{{"role": "user", "content": $prompt}}]
        }}')" > "$RESULTS_DIR/$id.json"
}}

QUERY_TYPE="${{1:-all}}"
if [ "$QUERY_TYPE" = "all" ]; then
    for batch in "$SWEEP_DIR"/batch_*.jsonl; do
        echo "Processing: $(basename $batch)"
        while IFS= read -r line; do
            echo "$line" > /tmp/sweep_query.json
            run_query /tmp/sweep_query.json
            sleep 0.1  # Rate limiting
        done < "$batch"
    done
else
    echo "Processing: $QUERY_TYPE"
    for query in "$SWEEP_DIR/$QUERY_TYPE"/*.json; do
        run_query "$query"
        sleep 0.1
    done
fi

echo "Done. Results in $RESULTS_DIR/"
"""


def cmd_sweep(args):
    """Generate LLM sweep manifests."""
    path = Path(args.path)
    output_dir = Path(args.output)
    query_types = args.queries if hasattr(args, "queries") else ["all"]

    print(c("Extracting code chunks...", "dim"))
    stats = generate_sweep(path, output_dir, query_types)

    print(c(f"\nSweep manifests generated:", "bold"))
    print(f"  Chunks extracted: {stats['chunks']}")
    print(f"  Total queries:    {stats['total_queries']}")
    print()
    for qtype, count in stats["by_type"].items():
        print(f"  {qtype:20s} {count:5d} queries")
    print()
    print(c(f"Output: {args.output}/", "green"))
    print(c(f"Manifest: {args.output}/manifest.json", "dim"))
    print(c(f"Runner: {args.output}/run_sweep.sh", "dim"))
    print()
    print("To run with Anthropic API:")
    print(f"  export ANTHROPIC_API_KEY=your-key")
    print(f"  ./{args.output}/run_sweep.sh")
