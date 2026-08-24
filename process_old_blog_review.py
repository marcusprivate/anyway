#!/usr/bin/env python3
"""Safely import an approved Anyway legacy-blog review ZIP.

The default is a dry run.  Pass --apply only after reviewing its report.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import shutil
import sys
import tempfile
import zipfile
from dataclasses import dataclass
from datetime import date as calendar_date
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parent
BLOG_PATH = ROOT / "content" / "blog.yaml"
IMAGES_DIR = ROOT / "content" / "images"
MAX_PX = 2048
WEBP_QUALITY = 85
WEBP_METHOD = 6
EXPECTED_KIND = "anyway-old-blog-review"


class ReviewError(ValueError):
    pass


@dataclass(frozen=True)
class PreparedImage:
    destination: Path
    source_path: str
    alt: str
    width: int
    height: int


@dataclass(frozen=True)
class PreparedPost:
    source_id: str
    title: str
    date: str
    content: str
    images: tuple[PreparedImage, ...]


def slug(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[-–—]", "_", value)
    value = re.sub(r"[^a-z0-9_\s]", "", value)
    value = re.sub(r"\s+", "_", value)
    return re.sub(r"_+", "_", value).strip("_")


MONTHS = {
    "januari": "01", "februari": "02", "maart": "03", "april": "04",
    "mei": "05", "juni": "06", "juli": "07", "augustus": "08",
    "september": "09", "oktober": "10", "november": "11", "december": "12",
}


def date_prefix(value: str) -> str:
    match = re.fullmatch(r"(\d{1,2})\s+([a-z]+)\s+(\d{4})", value.strip().lower())
    if not match or match.group(2) not in MONTHS:
        raise ReviewError(f"Unsupported reviewed date: {value!r}")
    year, month, day = int(match.group(3)), int(MONTHS[match.group(2)]), int(match.group(1))
    try:
        calendar_date(year, month, day)
    except ValueError as error:
        raise ReviewError(f"Unsupported reviewed date: {value!r}") from error
    return f"{year:04d}{month:02d}{day:02d}"


def safe_package_path(path: object) -> str:
    if not isinstance(path, str) or not path.startswith("selected-images/"):
        raise ReviewError(f"Invalid image package path: {path!r}")
    candidate = Path(path)
    if candidate.is_absolute() or ".." in candidate.parts or len(candidate.parts) != 2:
        raise ReviewError(f"Unsafe image package path: {path!r}")
    return path


def load_review(zip_path: Path) -> tuple[zipfile.ZipFile, dict, dict[str, zipfile.ZipInfo]]:
    archive = zipfile.ZipFile(zip_path)
    infos = {info.filename: info for info in archive.infolist() if not info.is_dir()}
    if len(infos) != len([info for info in archive.infolist() if not info.is_dir()]):
        archive.close()
        raise ReviewError("ZIP contains duplicate file paths")
    if "review.json" not in infos:
        archive.close()
        raise ReviewError("ZIP does not contain review.json")
    for name in infos:
        candidate = Path(name)
        if candidate.is_absolute() or ".." in candidate.parts:
            archive.close()
            raise ReviewError(f"ZIP contains unsafe path: {name}")
    try:
        review = json.loads(archive.read("review.json"))
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        archive.close()
        raise ReviewError(f"Invalid review.json: {error}") from error
    if not isinstance(review, dict):
        archive.close()
        raise ReviewError("Invalid review.json: expected an object")
    if review.get("kind") != EXPECTED_KIND or review.get("schemaVersion") != 7:
        archive.close()
        raise ReviewError("ZIP is not an Anyway legacy-blog review package")
    return archive, review, infos


def image_bytes(archive: zipfile.ZipFile, infos: dict[str, zipfile.ZipInfo], descriptor: dict) -> bytes:
    path = safe_package_path(descriptor.get("packagePath"))
    info = infos.get(path)
    if not info:
        raise ReviewError(f"Missing selected image: {path}")
    data = archive.read(path)
    if descriptor.get("size") != len(data):
        raise ReviewError(f"Image size mismatch: {path}")
    if descriptor.get("sha256") != hashlib.sha256(data).hexdigest():
        raise ReviewError(f"Image hash mismatch: {path}")
    return data


def verify_image(data: bytes, descriptor: dict, path: str) -> tuple[int, int]:
    try:
        with Image.open(io.BytesIO(data)) as image:
            image.verify()
        with Image.open(io.BytesIO(data)) as image:
            width, height = image.size
    except Exception as error:
        raise ReviewError(f"Unreadable image {path}: {error}") from error
    if descriptor.get("width") != width or descriptor.get("height") != height:
        raise ReviewError(f"Image dimensions mismatch: {path}")
    return width, height


def output_dimensions(data: bytes) -> tuple[int, int]:
    with Image.open(io.BytesIO(data)) as image:
        image = ImageOps.exif_transpose(image)
        width, height = image.size
    if max(width, height) > MAX_PX:
        scale = MAX_PX / max(width, height)
        width, height = round(width * scale), round(height * scale)
    return width, height


def prepare_posts(review: dict, archive: zipfile.ZipFile, infos: dict[str, zipfile.ZipInfo]) -> list[PreparedPost]:
    posts = review.get("posts")
    if not isinstance(posts, list) or not posts:
        raise ReviewError("Review package has no posts")
    prepared: list[PreparedPost] = []
    seen_ids: set[str] = set()
    for post in posts:
        if not isinstance(post, dict):
            raise ReviewError("Review contains an invalid post")
        if post.get("decision") != "approved":
            raise ReviewError(f"Post {post.get('sourceId', '?')} is not approved")
        source_id = post.get("sourceId")
        reviewed = post.get("reviewed")
        if not isinstance(source_id, str) or not source_id or source_id in seen_ids or not isinstance(reviewed, dict):
            raise ReviewError("Review contains an invalid or duplicate post")
        seen_ids.add(source_id)
        title, date, content = (reviewed.get(key) for key in ("formattedTitle", "date", "content"))
        if not all(isinstance(value, str) and value.strip() for value in (title, date, content)):
            raise ReviewError(f"Post {source_id} has incomplete reviewed content")
        prefix = date_prefix(date)
        selections = reviewed.get("selectedImages", [])
        if not isinstance(selections, list):
            raise ReviewError(f"Post {source_id} has invalid selectedImages")
        images: list[PreparedImage] = []
        for index, descriptor in enumerate(selections, start=1):
            if not isinstance(descriptor, dict) or not isinstance(descriptor.get("alt"), str):
                raise ReviewError(f"Post {source_id} has an invalid image descriptor")
            package_path = safe_package_path(descriptor.get("packagePath"))
            data = image_bytes(archive, infos, descriptor)
            verify_image(data, descriptor, package_path)
            width, height = output_dimensions(data)
            suffix = "" if index == 1 else f"_{index:02d}"
            filename = f"{prefix}_{slug(title)}{suffix}.webp"
            images.append(PreparedImage(IMAGES_DIR / filename, package_path, descriptor["alt"], width, height))
        prepared.append(PreparedPost(source_id, title.strip(), date.strip(), content.rstrip(), tuple(images)))
    return prepared


def yaml_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def yaml_post(post: PreparedPost) -> str:
    lines = [f"- title: {yaml_string(post.title)}", f"  date: {yaml_string(post.date)}", '  link: ""']
    if post.images:
        lines.append("  images:")
        for image in post.images:
            relative = image.destination.relative_to(ROOT).as_posix()
            lines.extend((
                f"    - src: {yaml_string(relative)}",
                f"      alt: {yaml_string(image.alt)}",
                f"      width: {image.width}",
                f"      height: {image.height}",
            ))
    lines.append("  content: |")
    lines.extend(f"    {line}" if line else "" for line in post.content.splitlines())
    return "\n".join(lines) + "\n"


def render_updated_yaml(existing: str, posts: list[PreparedPost]) -> str:
    if not existing.endswith("\n"):
        existing += "\n"
    return existing + "\n" + "\n".join(yaml_post(post) for post in posts)


def write_webp(data: bytes, output: Path) -> tuple[int, int]:
    with Image.open(io.BytesIO(data)) as image:
        image = ImageOps.exif_transpose(image)
        if getattr(image, "is_animated", False):
            image.seek(0)
        if max(image.size) > MAX_PX:
            scale = MAX_PX / max(image.size)
            image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
        if image.mode in ("P", "LA"):
            image = image.convert("RGBA")
        elif image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGB")
        image.save(output, "WEBP", quality=WEBP_QUALITY, method=WEBP_METHOD)
        return image.size


def process(zip_path: Path, apply: bool) -> int:
    archive, review, infos = load_review(zip_path)
    try:
        posts = prepare_posts(review, archive, infos)
        destinations = [image.destination for post in posts for image in post.images]
        if len(destinations) != len(set(destinations)):
            raise ReviewError("Generated image filenames collide")
        existing = BLOG_PATH.read_text(encoding="utf-8")
        existing_ids = set(re.findall(r"^# legacy-review-source-id: (.+)$", existing, re.MULTILINE))
        overlap = existing_ids & {post.source_id for post in posts}
        if overlap:
            raise ReviewError(f"Review posts already imported: {', '.join(sorted(overlap))}")
        collisions = [path for path in destinations if path.exists()]
        if collisions:
            raise ReviewError(f"Refusing to overwrite existing images: {', '.join(str(path.name) for path in collisions[:3])}")
        print(f"Validated {len(posts)} approved posts and {len(destinations)} image placements.")
        print(f"Would append posts after the current {len(re.findall(r'^- title:', existing, re.MULTILINE))} blog entries.")
        print(f"Would create {len(destinations)} WebP files in {IMAGES_DIR.relative_to(ROOT)}.")
        if not apply:
            print("Dry run complete. Re-run with --apply to write the import.")
            return 0

        with tempfile.TemporaryDirectory(prefix="old-blog-review-", dir=ROOT) as temporary:
            staging = Path(temporary)
            staged_images = staging / "images"
            staged_images.mkdir()
            for post in posts:
                for image in post.images:
                    data = image_bytes(archive, infos, {"packagePath": image.source_path, "size": infos[image.source_path].file_size, "sha256": hashlib.sha256(archive.read(image.source_path)).hexdigest()})
                    write_webp(data, staged_images / image.destination.name)
            annotated_posts = [PreparedPost(post.source_id, post.title, post.date, post.content, post.images) for post in posts]
            additions = []
            for post in annotated_posts:
                additions.append(f"# legacy-review-source-id: {post.source_id}\n" + yaml_post(post))
            staged_yaml = staging / "blog.yaml"
            staged_yaml.write_text(existing + "\n" + "\n".join(additions), encoding="utf-8")
            # Reopen every output before changing the repository.
            for staged in staged_images.iterdir():
                with Image.open(staged) as image:
                    image.verify()
            created: list[Path] = []
            try:
                for staged in staged_images.iterdir():
                    destination = IMAGES_DIR / staged.name
                    shutil.copy2(staged, destination)
                    created.append(destination)
                os.replace(staged_yaml, BLOG_PATH)
            except Exception:
                for path in created:
                    path.unlink(missing_ok=True)
                raise
        print(f"Imported {len(posts)} posts and {len(destinations)} images.")
        return 0
    finally:
        archive.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--apply", action="store_true", help="Write the reviewed posts and converted images")
    args = parser.parse_args()
    try:
        return process(args.archive, args.apply)
    except (ReviewError, OSError, zipfile.BadZipFile) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
