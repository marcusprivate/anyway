---
name: blog-cleanup
description: Clean and validate the Anyway website blog data in content/blog.yaml and content/images. Use when asked to review recent blog commits, fix YAML errors, verify blog image references, normalize image filenames, run manage_blog_images.py or resize_images.py, or check spelling/grammar only for changed blog entries.
---

# Blog Cleanup

## Workflow

Use this skill only from the Anyway repository root.

1. Inspect `git status --short` and preserve unrelated user changes.
2. Run the automation in dry-run mode first:

```bash
python3 blog_cleanup.py --since YYYY-MM-DD
```

3. If mechanical image fixes are needed and the user asked to apply them, run:

```bash
python3 blog_cleanup.py --since YYYY-MM-DD --apply
```

4. Review only the blog prose changed since `--since`. Fix spelling, grammar, and small paragraph breaks in those changed entries only. Do not rewrite older blog posts.
5. Finish with validation:

```bash
ruby -e "require 'yaml'; data = YAML.load_file('content/blog.yaml'); abort('not a list') unless data.is_a?(Array); puts data.length"
python3 -m py_compile blog_cleanup.py manage_blog_images.py resize_images.py
git diff --check
python3 blog_cleanup.py --since YYYY-MM-DD
```

## Blog Rules

- Treat `content/blog.yaml` as the source of blog entries.
- Treat `content/images` as the active image folder.
- Use local image paths, never GitHub blob URLs or HTTP URLs.
- Prefer `.webp` in `content/blog.yaml` when a WebP exists.
- Active blog image filenames should follow `YYYYMMDD_lowercase_words_with_underscores.webp`.
- Keep source JPG/PNG siblings when the repo already keeps them as originals.
- Report legacy unused files with spaces; do not mass-rename them unless explicitly requested.

## Text Review Scope

- Use `--since` to identify the review range.
- Edit only title/content/date/image fields introduced or changed in that range.
- Make conservative Dutch prose fixes: spelling, grammar, punctuation, spacing, and paragraph breaks.
- Add a paragraph only when it improves readability without adding new facts.
- Do not make broad style rewrites or factual additions.

## Image Automation

- `resize_images.py` converts and resizes images. It mutates by default for GitHub Actions compatibility; use `--dry-run` when previewing.
- `manage_blog_images.py` is dry-run by default and applies renames with `--apply`.
- `blog_cleanup.py` orchestrates checks and calls both scripts in the correct dry-run/apply mode.

## Delivery

Summarize changed files, validations run, and any remaining manual review items. Mention if any checks could not be run.
