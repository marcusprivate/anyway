#!/usr/bin/env bash
set -euo pipefail

skill_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
repo_root="$(cd "${skill_dir}/../../.." && pwd)"

cd "${repo_root}"
exec python3 blog_cleanup.py "$@"
