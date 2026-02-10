#!/usr/bin/env python3
"""Decruftify — thin wrapper. The real code lives in scripts/decruftify/."""

import sys
from pathlib import Path

# Ensure the scripts dir is on sys.path so the package can be imported
sys.path.insert(0, str(Path(__file__).resolve().parent))

from decruftify.cli import main

main()
