#!/usr/bin/env python3
"""
Image Optimizer - Convert and resize images for web use.

This script:
1. Converts .jpg/.png/.tif/.bmp images to .webp format
2. Resizes images exceeding 2048px (longest edge)
3. Fixes EXIF orientation issues
4. Updates blog.yaml references to point to new .webp files

Note: Original source files (.jpg, .png, etc.) are kept after conversion.
This is intentional to preserve originals as backup. Use manage_blog_images.py
to identify and clean up unused source files after conversion.

Usage:
    python resize_images.py
"""
from pathlib import Path
from PIL import Image, ImageOps

INPUT_DIR = Path("content/images")
YAML_FILES = [Path("content/blog.yaml")]
IGNORE_FILES = {"anyway.jpg"}
MAX_PX = 2048
QUALITY = 85
METHOD = 6
# Source formats to convert to webp
SOURCE_FORMATS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp"}
# Webp files to check for resizing only
WEBP_FORMAT = {".webp"}


def update_yaml_references(old_path: Path, new_path: Path) -> int:
    """Replace image references in YAML files. Returns count of replacements."""
    replacements = 0
    # Use forward slashes for consistent path format in YAML
    old_str = str(old_path).replace("\\", "/")
    new_str = str(new_path).replace("\\", "/")
    
    for yaml_file in YAML_FILES:
        if not yaml_file.exists():
            continue
        
        content = yaml_file.read_text(encoding="utf-8")
        if old_str in content:
            updated = content.replace(old_str, new_str)
            yaml_file.write_text(updated, encoding="utf-8")
            replacements += content.count(old_str)
            print(f"  Updated {yaml_file.name}: {old_path.name} → {new_path.name}")
    
    return replacements


def main() -> int:
    if not INPUT_DIR.is_dir():
        print(f"Missing folder: {INPUT_DIR.resolve()}")
        return 2

    converted = resized = skipped = errors = yaml_updates = 0

    for src in INPUT_DIR.rglob("*"):
        if not src.is_file():
            continue
        
        suffix_lower = src.suffix.lower()
        
        # Skip ignored files
        if src.name.lower() in IGNORE_FILES:
            print(f"Skipping ignored file: {src.name}")
            continue

        # Handle source formats (convert to webp)
        if suffix_lower in SOURCE_FORMATS:
            dst = src.with_suffix(".webp")

            # Skip if webp output exists and is newer than source
            if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
                skipped += 1
                continue

            try:
                with Image.open(src) as im:
                    im = ImageOps.exif_transpose(im)  # fix orientation
                    w, h = im.size

                    if max(w, h) > MAX_PX:
                        scale = MAX_PX / max(w, h)
                        im = im.resize(
                            (round(w * scale), round(h * scale)),
                            resample=Image.Resampling.LANCZOS,
                        )
                        resized += 1

                    # ensure WebP-compatible mode (preserve alpha if present)
                    if im.mode in ("P", "LA"):
                        im = im.convert("RGBA")
                    elif im.mode not in ("RGB", "RGBA"):
                        im = im.convert("RGB")

                    im.save(dst, "WEBP", quality=QUALITY, method=METHOD)

                converted += 1
                print(f"Converted: {src.name} → {dst.name}")
                
                # Update YAML files to reference the new webp file
                yaml_updates += update_yaml_references(src, dst)

            except Exception as e:
                errors += 1
                print(f"ERROR {src}: {e}")
        
        # Handle existing webp files (resize only if too large)
        elif suffix_lower in WEBP_FORMAT:
            try:
                with Image.open(src) as im:
                    w, h = im.size
                    
                    # Skip if already within size limit
                    if max(w, h) <= MAX_PX:
                        skipped += 1
                        continue
                    
                    # Resize needed
                    im = ImageOps.exif_transpose(im)
                    scale = MAX_PX / max(w, h)
                    new_w, new_h = round(w * scale), round(h * scale)
                    im = im.resize(
                        (new_w, new_h),
                        resample=Image.Resampling.LANCZOS,
                    )
                    
                    # ensure WebP-compatible mode
                    if im.mode in ("P", "LA"):
                        im = im.convert("RGBA")
                    elif im.mode not in ("RGB", "RGBA"):
                        im = im.convert("RGB")
                    
                    # Save back to same file (overwrite)
                    im.save(src, "WEBP", quality=QUALITY, method=METHOD)
                    
                    resized += 1
                    print(f"Resized: {src.name} ({w}x{h} → {new_w}x{new_h})")
                
            except Exception as e:
                errors += 1
                print(f"ERROR {src}: {e}")

    print(f"\nSummary: converted={converted} resized={resized} skipped={skipped} errors={errors} yaml_updates={yaml_updates}")
    return 0 if errors == 0 else 2

if __name__ == "__main__":
    raise SystemExit(main())

