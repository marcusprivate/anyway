#!/usr/bin/env python3
"""
Validate and optionally apply the Anyway blog cleanup workflow.

Default mode is a dry-run report. Use --apply for mechanical image fixes.
Text edits remain a scoped review step for Codex or a human editor.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

from manage_blog_images import (
    YAML_PATH,
    get_expected_filename,
    is_correctly_named,
    parse_blog_yaml,
)


REPO_ROOT = Path(__file__).resolve().parent
IMAGES_DIR = REPO_ROOT / "content" / "images"
BLOG_YAML = REPO_ROOT / "content" / "blog.yaml"


def run(command: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        cwd=REPO_ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=check,
    )


def print_section(title: str) -> None:
    print()
    print("=" * 72)
    print(title)
    print("=" * 72)


def validate_yaml() -> bool:
    result = run(
        [
            "ruby",
            "-e",
            (
                "require 'yaml'; "
                "data = YAML.load_file('content/blog.yaml'); "
                "abort('content/blog.yaml must contain a list') unless data.is_a?(Array); "
                "puts \"YAML OK: #{data.length} entries\""
            ),
        ],
        check=False,
    )
    print(result.stdout.rstrip())
    return result.returncode == 0


def changed_blog_diff(since: str) -> tuple[str | None, str]:
    base = run(
        ["git", "rev-list", "-1", f"--before={since}", "HEAD"],
        check=False,
    ).stdout.strip()

    if not base:
        base = run(["git", "hash-object", "-t", "tree", "/dev/null"]).stdout.strip()

    diff = run(
        ["git", "diff", "--unified=0", f"{base}..HEAD", "--", "content/blog.yaml"],
        check=False,
    ).stdout
    return base, diff


def added_text_lines(diff: str) -> list[str]:
    lines: list[str] = []
    for line in diff.splitlines():
        if not line.startswith("+") or line.startswith("+++"):
            continue
        text = line[1:]
        if not text.strip():
            continue
        if re.match(r"\s*(title|date|image|link|content):", text):
            continue
        lines.append(text)
    return lines


def validate_images() -> bool:
    ok = True
    entries = parse_blog_yaml(YAML_PATH)

    missing: list[tuple[str, str]] = []
    spaces: list[tuple[str, str]] = []
    github_urls: list[tuple[str, str]] = []
    naming: list[tuple[str, str, str]] = []

    for entry in entries:
        title = entry.get("title", "")
        image = entry.get("image", "").strip()
        if not image or image == "content/images/":
            continue

        image_path = REPO_ROOT / image
        if not image_path.exists():
            missing.append((title, image))

        if re.search(r"\s", image):
            spaces.append((title, image))

        if "github.com/" in image or image.startswith("http"):
            github_urls.append((title, image))

        expected = get_expected_filename(entry.get("title", ""), entry.get("date", ""))
        if expected and not is_correctly_named(image, expected):
            naming.append((title, image, f"content/images/{expected}"))

    if missing:
        ok = False
        print(f"Missing image references: {len(missing)}")
        for title, image in missing[:20]:
            print(f"  - {title}: {image}")
    else:
        print("All active image references exist.")

    if spaces:
        ok = False
        print(f"Active image paths with spaces: {len(spaces)}")
        for title, image in spaces[:20]:
            print(f"  - {title}: {image}")
    else:
        print("No active image paths contain spaces.")

    if github_urls:
        ok = False
        print(f"GitHub/HTTP image paths: {len(github_urls)}")
        for title, image in github_urls[:20]:
            print(f"  - {title}: {image}")
    else:
        print("No active image paths use GitHub/HTTP URLs.")

    if naming:
        ok = False
        print(f"Image paths outside naming convention: {len(naming)}")
        for title, image, expected in naming[:20]:
            print(f"  - {title}: {image} -> {expected}")
    else:
        print("All active image paths match the naming convention.")

    return ok


def run_image_tools(apply: bool) -> bool:
    resize_command = ["python3", "resize_images.py"]
    if not apply:
        resize_command.append("--dry-run")

    print("$ " + " ".join(resize_command))
    resize = run(resize_command, check=False)
    print(resize.stdout.rstrip())

    manager_command = ["python3", "manage_blog_images.py"]
    if apply:
        manager_command.append("--apply")

    print("$ " + " ".join(manager_command))
    manager = run(manager_command, check=False)
    print(manager.stdout.rstrip())
    return resize.returncode == 0 and manager.returncode == 0


def run_final_checks() -> bool:
    checks = [
        ["python3", "-m", "py_compile", "blog_cleanup.py", "manage_blog_images.py", "resize_images.py"],
        ["git", "diff", "--check"],
    ]
    ok = True
    for command in checks:
        print("$ " + " ".join(command))
        result = run(command, check=False)
        if result.stdout.strip():
            print(result.stdout.rstrip())
        if result.returncode != 0:
            ok = False
    return ok


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--since", required=True, help="Date for scoped blog text review, e.g. 2026-06-12")
    parser.add_argument("--apply", action="store_true", help="Apply mechanical image fixes")
    args = parser.parse_args()

    print_section("YAML")
    yaml_ok = validate_yaml()

    print_section("Scoped Blog Diff")
    base, diff = changed_blog_diff(args.since)
    print(f"Base before {args.since}: {base or '(none)'}")
    if diff.strip():
        print(diff.rstrip())
        text_lines = added_text_lines(diff)
        if text_lines:
            print()
            print("Review these added/changed prose lines for spelling and grammar:")
            for line in text_lines[:40]:
                print(f"  {line.strip()}")
    else:
        print("No committed content/blog.yaml changes found in the scoped range.")

    print_section("Image References")
    image_ok = validate_images()

    print_section("Image Tools")
    tools_ok = run_image_tools(args.apply)

    print_section("Final Checks")
    final_ok = run_final_checks()

    print_section("Result")
    if args.apply:
        print("Apply mode completed. Review git diff before committing.")
    else:
        print("Dry run completed. Re-run with --apply to apply mechanical image fixes.")

    return 0 if yaml_ok and image_ok and tools_ok and final_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
