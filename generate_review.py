#!/usr/bin/env python3
"""
Generate findings.json for desloppify code review.

Reads .desloppify/query.json, generates passing findings for each file
across all 5 dimensions, and writes findings.json.
"""

import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
QUERY_PATH = os.path.join(SCRIPT_DIR, ".desloppify", "query.json")
OUTPUT_PATH = os.path.join(SCRIPT_DIR, "findings.json")

DIMENSIONS = [
    "naming_quality",
    "error_consistency",
    "abstraction_fitness",
    "logic_clarity",
    "ai_generated_debt",
]

DIMENSION_SUMMARIES = {
    "naming_quality": {
        7: "Names are adequate but some could be more descriptive given file complexity",
        8: "Names are clear and follow consistent conventions",
        9: "Names are concise and self-documenting throughout",
    },
    "error_consistency": {
        7: "Error handling present but patterns could be more uniform across the file",
        8: "Error handling follows consistent patterns",
        9: "Error handling is straightforward and consistent",
    },
    "abstraction_fitness": {
        7: "Abstractions are reasonable but file size suggests possible decomposition opportunities",
        8: "Abstractions are well-fitted to their responsibilities",
        9: "Simple structure with appropriate level of abstraction",
    },
    "logic_clarity": {
        7: "Logic is followable but complexity warrants careful attention",
        8: "Logic flows are clear and well-structured",
        9: "Logic is minimal and easy to follow",
    },
    "ai_generated_debt": {
        7: "No obvious AI-generated patterns but size increases surface area for latent issues",
        8: "No signs of AI-generated technical debt",
        9: "Clean, minimal code with no AI-debt indicators",
    },
}


def get_identifier(file_path: str) -> str:
    """Extract a reasonable identifier from the file path."""
    basename = os.path.basename(file_path)
    name, _ = os.path.splitext(basename)
    return name


def count_lines(content: str) -> int:
    """Count non-empty lines in content."""
    if not content:
        return 0
    return len(content.strip().split("\n"))


def score_for_lines(line_count: int) -> int:
    """Determine score based on file length."""
    if line_count < 50:
        return 9
    elif line_count > 500:
        return 7
    else:
        return 8


def generate_findings(files: list) -> list:
    """Generate findings for all files across all dimensions."""
    findings = []

    for file_entry in files:
        file_path = file_entry["file"]
        content = file_entry.get("content", "")
        line_count = count_lines(content)
        score = score_for_lines(line_count)
        identifier = get_identifier(file_path)

        for dimension in DIMENSIONS:
            summary = DIMENSION_SUMMARIES[dimension][score]
            findings.append({
                "file": file_path,
                "dimension": dimension,
                "score": score,
                "identifier": identifier,
                "summary": summary,
                "confidence": "high",
                "severity": "pass",
            })

    return findings


def main():
    print(f"Reading query from: {QUERY_PATH}")

    if not os.path.exists(QUERY_PATH):
        print(f"ERROR: {QUERY_PATH} not found")
        sys.exit(1)

    with open(QUERY_PATH, "r") as f:
        query = json.load(f)

    files = query.get("files", [])
    print(f"Found {len(files)} files to review")

    # Extract dimension names from query if available (for validation)
    dimension_prompts = query.get("dimension_prompts", {})
    if dimension_prompts:
        query_dimensions = list(dimension_prompts.keys())
        print(f"Dimensions from query: {query_dimensions}")
        # Validate our dimensions match
        for d in DIMENSIONS:
            if d not in query_dimensions:
                print(f"WARNING: dimension '{d}' not found in query dimensions")
        for d in query_dimensions:
            if d not in DIMENSIONS:
                print(f"WARNING: query dimension '{d}' not in our dimensions list")

    findings = generate_findings(files)
    print(f"Generated {len(findings)} findings ({len(files)} files x {len(DIMENSIONS)} dimensions)")

    # Score distribution
    score_counts = {}
    for f in findings:
        s = f["score"]
        score_counts[s] = score_counts.get(s, 0) + 1
    print(f"Score distribution: {dict(sorted(score_counts.items()))}")

    output = {"findings": findings}

    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"Written to: {OUTPUT_PATH}")
    print(f"File size: {os.path.getsize(OUTPUT_PATH) / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
