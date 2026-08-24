import hashlib
import io
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

from PIL import Image

import process_old_blog_review
from process_old_blog_review import ReviewError, load_review, prepare_posts


def image_bytes():
    output = io.BytesIO()
    Image.new("RGB", (12, 8), "red").save(output, "PNG")
    return output.getvalue()


def review_for(data, image_path="selected-images/photo.png"):
    return {
        "kind": "anyway-old-blog-review",
        "schemaVersion": 7,
        "posts": [{
            "sourceId": "test-post",
            "decision": "approved",
            "reviewed": {
                "formattedTitle": "Test post - Texel",
                "date": "2 mei 2012",
                "content": "Goedgekeurde tekst.",
                "selectedImages": [{
                    "packagePath": image_path,
                    "sha256": hashlib.sha256(data).hexdigest(),
                    "size": len(data),
                    "width": 12,
                    "height": 8,
                    "alt": "Testafbeelding",
                }],
            },
        }],
    }


class OldBlogReviewTests(unittest.TestCase):
    def make_archive(self, review, files):
        directory = tempfile.TemporaryDirectory()
        archive_path = Path(directory.name) / "review.zip"
        with zipfile.ZipFile(archive_path, "w") as archive:
            archive.writestr("review.json", json.dumps(review))
            for path, data in files.items():
                archive.writestr(path, data)
        return directory, archive_path

    def test_valid_package_preserves_ordered_image_metadata(self):
        data = image_bytes()
        directory, archive_path = self.make_archive(review_for(data), {"selected-images/photo.png": data})
        self.addCleanup(directory.cleanup)
        archive, review, infos = load_review(archive_path)
        self.addCleanup(archive.close)
        posts = prepare_posts(review, archive, infos)
        self.assertEqual(posts[0].images[0].destination.name, "20120502_test_post_texel.webp")
        self.assertEqual(posts[0].images[0].alt, "Testafbeelding")

    def test_hash_mismatch_is_rejected_before_processing(self):
        data = image_bytes()
        review = review_for(data)
        review["posts"][0]["reviewed"]["selectedImages"][0]["sha256"] = "0" * 64
        directory, archive_path = self.make_archive(review, {"selected-images/photo.png": data})
        self.addCleanup(directory.cleanup)
        archive, parsed, infos = load_review(archive_path)
        self.addCleanup(archive.close)
        with self.assertRaisesRegex(ReviewError, "hash mismatch"):
            prepare_posts(parsed, archive, infos)

    def test_non_object_post_is_rejected_as_an_invalid_review(self):
        data = image_bytes()
        review = review_for(data)
        review["posts"] = [None]
        directory, archive_path = self.make_archive(review, {"selected-images/photo.png": data})
        self.addCleanup(directory.cleanup)
        archive, parsed, infos = load_review(archive_path)
        self.addCleanup(archive.close)

        with self.assertRaisesRegex(ReviewError, "invalid post"):
            prepare_posts(parsed, archive, infos)

    def test_impossible_reviewed_date_is_rejected(self):
        data = image_bytes()
        review = review_for(data)
        review["posts"][0]["reviewed"]["date"] = "31 februari 2012"
        directory, archive_path = self.make_archive(review, {"selected-images/photo.png": data})
        self.addCleanup(directory.cleanup)
        archive, parsed, infos = load_review(archive_path)
        self.addCleanup(archive.close)

        with self.assertRaisesRegex(ReviewError, "Unsupported reviewed date"):
            prepare_posts(parsed, archive, infos)

    def test_unsafe_zip_path_is_rejected(self):
        data = image_bytes()
        directory, archive_path = self.make_archive(review_for(data), {"../unsafe.png": data})
        self.addCleanup(directory.cleanup)
        with self.assertRaisesRegex(ReviewError, "unsafe path"):
            load_review(archive_path)

    def test_non_object_review_json_is_rejected(self):
        data = image_bytes()
        directory, archive_path = self.make_archive([review_for(data)], {"selected-images/photo.png": data})
        self.addCleanup(directory.cleanup)

        with self.assertRaisesRegex(ReviewError, "Invalid review.json"):
            load_review(archive_path)

    def test_apply_restores_existing_yaml_when_final_yaml_copy_fails(self):
        data = image_bytes()
        directory, archive_path = self.make_archive(review_for(data), {"selected-images/photo.png": data})
        self.addCleanup(directory.cleanup)
        repo = Path(directory.name) / "repo"
        images = repo / "content" / "images"
        images.mkdir(parents=True)
        blog = repo / "content" / "blog.yaml"
        original = "- title: Existing\n  date: 1 januari 2020\n"
        blog.write_text(original, encoding="utf-8")
        real_copy = process_old_blog_review.shutil.copy2

        def copy_images(source, destination, *args, **kwargs):
            return real_copy(source, destination, *args, **kwargs)

        def fail_yaml_replace(source, destination):
            self.assertEqual(Path(destination), blog)
            raise OSError("simulated YAML replace failure")

        with patch.object(process_old_blog_review, "ROOT", repo), \
             patch.object(process_old_blog_review, "BLOG_PATH", blog), \
             patch.object(process_old_blog_review, "IMAGES_DIR", images), \
             patch.object(process_old_blog_review.shutil, "copy2", side_effect=copy_images), \
             patch.object(process_old_blog_review.os, "replace", side_effect=fail_yaml_replace):
            with self.assertRaisesRegex(OSError, "simulated YAML replace failure"):
                process_old_blog_review.process(archive_path, apply=True)

        self.assertEqual(blog.read_text(encoding="utf-8"), original)
        self.assertEqual(list(images.iterdir()), [])


if __name__ == "__main__":
    unittest.main()
