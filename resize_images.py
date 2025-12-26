#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageOps

INPUT_DIR = Path("content/images")
YAML_FILES = [Path("content/blog.yaml")]
MAX_PX = 2048
QUALITY = 85
METHOD = 6
SUPPORTED = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp"}


def update_yaml_references(old_path: Path, new_path: Path) -> int:
    """Replace image references in YAML files. Returns count of replacements."""
    replacements = 0
    old_str = str(old_path)
    new_str = str(new_path)
    
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
        if not src.is_file() or src.suffix.lower() not in SUPPORTED:
            continue

        dst = src.with_suffix(".webp")

        # skip if output exists and is newer/equal
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

    print(f"\nSummary: converted={converted} resized={resized} skipped={skipped} errors={errors} yaml_updates={yaml_updates}")
    return 0 if errors == 0 else 2

if __name__ == "__main__":
    raise SystemExit(main())

