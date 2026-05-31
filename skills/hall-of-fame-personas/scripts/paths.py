#!/usr/bin/env python3
"""Shared path constants for Hall of Fame persona pipelines."""

from __future__ import annotations

from pathlib import Path


SKILL_DIR = Path(__file__).resolve().parents[1]

SOURCE_DIR = SKILL_DIR / "source"
SOURCE_PERSONAS_DIR = SOURCE_DIR / "personas"

BUILD_DIR = SKILL_DIR / "build"
BUILD_MINDFRAME_DIR = BUILD_DIR / "mindframe"
BUILD_NUWA_STAGING_DIR = BUILD_DIR / "nuwa_staging"
BUILD_REGISTRY_PATH = BUILD_DIR / "personas.json"
BUILD_INDEX_PATH = BUILD_DIR / "persona-index.json"
BUILD_MANIFEST_PATH = BUILD_DIR / "manifest.json"
BUILD_REPORTS_DIR = BUILD_DIR / "reports"

DIST_DIR = SKILL_DIR / "dist"
DIST_SKILLS_DIR = DIST_DIR / "skills"
DIST_BUNDLE_DIR = DIST_DIR / "bundle"

# Legacy compatibility paths (read/write while old integrations remain).
LEGACY_PERSONAS_DIR = SKILL_DIR / "personas"
LEGACY_GENERATED_DIR = SKILL_DIR / "generated"
LEGACY_GENERATED_REGISTRY_PATH = LEGACY_GENERATED_DIR / "personas.json"
LEGACY_GENERATED_INDEX_PATH = LEGACY_GENERATED_DIR / "persona-index.json"
LEGACY_REFERENCES_REGISTRY_PATH = SKILL_DIR / "references" / "personas.json"

# External nuwa-skill toolkit (local clone, not shipped in dist).
REPO_ROOT = SKILL_DIR.parents[1]
NUWA_SKILL_ROOT = REPO_ROOT / "tools" / "nuwa-skill"
NUWA_EXAMPLES_DIR = NUWA_SKILL_ROOT / "examples"
NUWA_QUALITY_CHECK = NUWA_SKILL_ROOT / "scripts" / "quality_check.py"
