import importlib.util
import re
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("generate_data.py")
SPEC = importlib.util.spec_from_file_location("generate_data", MODULE_PATH)
generate_data = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(generate_data)


class ParseBodyTests(unittest.TestCase):
    def test_discards_comment_metadata_after_article_and_keeps_images(self):
        content, images = generate_data.parse_body(
            """Article text.

URL:
  - alt: Photo
  - src: photo.jpg

URL: http://profile.typekey.com/commenter/
DATE: 15 februari 2009
Visitor comment."""
        )

        self.assertEqual(content, "Article text.")
        self.assertEqual(images, [{"alt": "Photo", "sourceRef": "photo.jpg"}])

    def test_discards_comment_when_empty_url_was_merged_with_media_metadata(self):
        content, images = generate_data.parse_body(
            """Article text.

URL:
  - alt: Photo
  - src: photo.jpg

DATE: 8 juni 2010
Visitor comment."""
        )

        self.assertEqual(content, "Article text.")
        self.assertEqual(len(images), 1)

    def test_strips_known_presentational_heading_markup(self):
        content, _ = generate_data.parse_body(
            "<h1>Broadway opnieuw bijzonder festival</h1>\n<small></small>\n\nArticle text."
        )

        self.assertEqual(content, "Broadway opnieuw bijzonder festival\n\nArticle text.")

    def test_curated_improvements_cover_every_review_post(self):
        posts = generate_data.parse_posts()
        improvements = generate_data.load_improvements()

        self.assertEqual(len(posts), 41)
        self.assertEqual(set(improvements), {post["sourceId"] for post in posts})
        self.assertTrue(all(post["improvedContent"].strip() for post in posts))
        self.assertTrue(all("<h1>" not in post["improvedContent"] for post in posts))
        self.assertTrue(all(not re.search(r"[.!?][.!?]+", post["improvedContent"]) for post in posts))

    def test_improved_copy_repairs_the_known_split_word(self):
        posts = generate_data.parse_posts()
        post = next(post for post in posts if post["sourceId"] == "2008-09-13-ineke-50-jaar")

        self.assertIn("Een paar weken later", post["improvedContent"])
        self.assertNotIn("Een pa\n\nar weken", post["improvedContent"])

    def test_improved_copy_repairs_the_known_split_sentence(self):
        posts = generate_data.parse_posts()
        post = next(post for post in posts if post["sourceId"] == "2001-11-04-acapabel-jubileumconcert")

        self.assertIn("Aris van Zeijlen. Zowel voor ons als het publiek", post["improvedContent"])
        self.assertNotIn("voor ons als\n\nhet publiek", post["improvedContent"])

    def test_improved_copy_repairs_known_missing_sentence_spaces(self):
        posts = generate_data.parse_posts()
        korendag = next(post for post in posts if post["sourceId"] == "2011-05-14-korendag-oudesluis")
        broadway = next(post for post in posts if post["sourceId"] == "2008-05-09-broadway-den-hoorn")

        self.assertIn("dames onder ons. Ik had", korendag["improvedContent"])
        self.assertIn("al aandacht. Ook onze", broadway["improvedContent"])
        self.assertIn("goedkeurend gefluit. We", broadway["improvedContent"])


if __name__ == "__main__":
    unittest.main()
