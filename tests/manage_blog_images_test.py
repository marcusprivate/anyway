import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import manage_blog_images


class GalleryImageManagerTests(unittest.TestCase):
    def test_visual_duplicate_report_marks_gallery_image_as_referenced(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            images = root / "images"
            images.mkdir()
            gallery_image = images / "gallery.webp"
            sibling = images / "duplicate.webp"
            gallery_image.write_bytes(b"gallery")
            sibling.write_bytes(b"duplicate")
            yaml_path = root / "blog.yaml"
            yaml_path.write_text(
                "- title: Gallery\n  date: 1 januari 2020\n  images:\n    - src: content/images/gallery.webp\n",
                encoding="utf-8",
            )
            output = io.StringIO()
            with patch.object(manage_blog_images, "IMAGES_DIR", images), \
                 patch.object(manage_blog_images, "YAML_PATH", yaml_path), \
                 patch.object(manage_blog_images, "IMAGEHASH_AVAILABLE", True), \
                 patch.object(manage_blog_images, "find_visual_duplicates", return_value=[[gallery_image, sibling]]), \
                 patch.object(sys, "argv", ["manage_blog_images.py"]), \
                 contextlib.redirect_stdout(output):
                manage_blog_images.main()

            self.assertIn("📄 gallery.webp", output.getvalue())

    def test_apply_renames_a_gallery_image_and_updates_its_yaml_reference(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            images = root / "images"
            images.mkdir()
            old_image = images / "old.webp"
            old_image.write_bytes(b"gallery")
            yaml_path = root / "blog.yaml"
            yaml_path.write_text(
                "- title: Gallery\n  date: 1 januari 2020\n  images:\n    - src: content/images/old.webp\n",
                encoding="utf-8",
            )
            with patch.object(manage_blog_images, "IMAGES_DIR", images), \
                 patch.object(manage_blog_images, "YAML_PATH", yaml_path), \
                 patch.object(manage_blog_images, "IMAGEHASH_AVAILABLE", False), \
                 patch.object(sys, "argv", ["manage_blog_images.py", "--apply"]):
                manage_blog_images.main()

            self.assertTrue((images / "20200101_gallery.webp").exists())
            self.assertIn("content/images/20200101_gallery.webp", yaml_path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
