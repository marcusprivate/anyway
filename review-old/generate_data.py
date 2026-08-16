#!/usr/bin/env python3
"""Generate the frozen legacy blog review batch.

The comparison with content/blog.yaml was completed separately. The verified
result is that every cleaned Typepad entry dated 2012 or earlier is still
missing, yielding exactly 41 posts. This generator does not inspect blog.yaml.
"""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "content" / "typepad_export_cleaned.txt"
OUTPUT = Path(__file__).resolve().parent / "blogs-data.json"
IMPROVEMENTS = Path(__file__).resolve().parent / "improved-texts.json"

MONTHS = {
    "januari": 1,
    "februari": 2,
    "maart": 3,
    "april": 4,
    "mei": 5,
    "juni": 6,
    "juli": 7,
    "augustus": 8,
    "september": 9,
    "oktober": 10,
    "november": 11,
    "december": 12,
}

COMMENT_DATE = re.compile(
    rf"DATE:\s+\d{{1,2}}\s+(?:{'|'.join(MONTHS)})\s+\d{{4}}",
    re.IGNORECASE,
)

# Locations are intentionally curated instead of inferred at runtime. Every
# value below is stated by the post itself or follows unambiguously from the
# named venue. Posts without enough evidence are left blank in the review UI.
CONFIRMED_LOCATIONS = {
    "2012-12-19-optreden-glazen-huis-texel-fm": "Texel",
    "2012-05-25-broadway": "Den Hoorn - Texel",
    "2012-01-15-paradiso-amsterdam": "Paradiso - Amsterdam",
    "2011-05-14-korendag-oudesluis": "Kerk van Oudesluis - Oudesluis",
    "2011-01-16-korendagen-paradiso-amsterdam": "Paradiso - Amsterdam",
    "2010-11-06-vrouwen-van-een-eiland": "Texel",
    "2010-10-30-anbo-beurs": "Texel",
    "2010-10-03-de-eerste-cd-opnames": "Texel",
    "2010-08-27-reactie-op-ons-optreden-bij-de-theatervloot": "De Egberdina - Oude haven van Hoorn",
    "2010-08-26-theatervloot-in-hoorn": "De Egberdina - Haven van Hoorn",
    "2010-06-06-opening-restaurant-de-luwte-den-burg-texel": "Restaurant De Luwte - Den Burg - Texel",
    "2010-05-21-broadway-den-hoorn": "Den Hoorn - Texel",
    "2010-04-23-cursus-evts-estill-voice-training-23-24-25-april-en-8-en-9-mei-op-texel": "Texel",
    "2010-04-17-met-muziek-op-pad": "Grote Kerk - Den Burg - Texel",
    "2010-01-23-paradiso-korendagen": "Paradiso - Amsterdam",
    "2009-11-15-eenakterfestival-klif-12-texel": "Klif 12 - Den Hoorn - Texel",
    "2009-09-06-zomerdromen-den-helder": "Den Helder",
    "2009-01-17-korendagen-in-paradiso": "Paradiso - Amsterdam",
    "2008-09-13-ineke-50-jaar": "Delft",
    "2008-06-14-castricum-balkfestival": "Castricum",
    "2008-05-09-broadway-den-hoorn": "Den Hoorn - Texel",
    "2007-09-17-trouwerij-in-carre": "Koninklijk Theater Carré - Amsterdam",
    "2007-01-06-galadiner-hotel-opduin": "Hotel Opduin - De Koog - Texel",
    "2006-11-05-totaal-vokaal-east-event-festival": "Goor",
    "2006-10-01-koffieconcert-de-waal": "Kerk - De Waal - Texel",
    "2006-06-02-broadway-den-hoorn": "Den Hoorn - Texel",
    "2005-07-02-totaal-vokaal-festival-amsterdam": "Pleintheater - Amsterdam",
    "2005-02-04-klif-12-open-podium": "Klif 12 - Den Hoorn - Texel",
    "2004-12-24-kerst-hotel-opduin": "Hotel Opduin - De Koog - Texel",
    "2004-07-03-pleintheater-amsterdam": "Pleintheater - Amsterdam",
    "2004-05-28-broadway-den-hoorn": "Den Hoorn - Texel",
    "2003-08-14-klif-12-cabaret-sketches-en-muziek": "Klif 12 - Den Hoorn - Texel",
    "2002-08-29-klif-12-cabaret-sketches-muziek": "Klif 12 - Den Hoorn - Texel",
    "2002-05-17-broadway-den-hoorn": "Den Hoorn - Texel",
    "2001-06-24-maartenhuis-het-begin": "Maartenhuis - Texel",
}

# Base titles used by the review UI. Location stays in its own field and is
# joined for display/export, matching the public site's "title - location"
# convention without repeating a venue or town already present in the source.
NORMALIZED_TITLES = {
    "2012-01-15-paradiso-amsterdam": "Korenfestival",
    "2011-05-14-korendag-oudesluis": "Korendag",
    "2011-01-16-korendagen-paradiso-amsterdam": "Korendagen",
    "2010-08-26-theatervloot-in-hoorn": "Theatervloot",
    "2010-06-06-opening-restaurant-de-luwte-den-burg-texel": "Opening restaurant",
    "2010-05-21-broadway-den-hoorn": "Broadway",
    "2010-04-23-cursus-evts-estill-voice-training-23-24-25-april-en-8-en-9-mei-op-texel": "Cursus EVTS (Estill Voice Training) 23, 24, 25 april en 8 en 9 mei",
    "2010-01-23-paradiso-korendagen": "Korendagen",
    "2009-11-15-eenakterfestival-klif-12-texel": "Eenakterfestival",
    "2009-09-06-zomerdromen-den-helder": "Zomerdromen",
    "2009-01-17-korendagen-in-paradiso": "Korendagen",
    "2008-06-14-castricum-balkfestival": "Balkfestival",
    "2008-05-09-broadway-den-hoorn": "Broadway",
    "2007-09-17-trouwerij-in-carre": "Trouwerij",
    "2007-01-06-galadiner-hotel-opduin": "Galadiner",
    "2006-10-01-koffieconcert-de-waal": "Koffieconcert",
    "2006-06-02-broadway-den-hoorn": "Broadway",
    "2005-07-02-totaal-vokaal-festival-amsterdam": "Totaal Vokaal Festival",
    "2005-02-04-klif-12-open-podium": "Open Podium",
    "2004-12-24-kerst-hotel-opduin": "Kerstoptreden",
    "2004-07-03-pleintheater-amsterdam": "Balkfestival",
    "2004-05-28-broadway-den-hoorn": "Broadway",
    "2003-08-14-klif-12-cabaret-sketches-en-muziek": "Cabaret, Sketches en Muziek",
    "2002-08-29-klif-12-cabaret-sketches-muziek": "Cabaret, Sketches & Muziek",
    "2002-05-17-broadway-den-hoorn": "Broadway",
    "2001-06-24-maartenhuis-het-begin": "Het begin",
}


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def iso_date(value: str) -> str:
    match = re.fullmatch(r"(\d{1,2})\s+([a-z]+)\s+(\d{4})", value.lower())
    if not match or match.group(2) not in MONTHS:
        raise ValueError(f"Unsupported date: {value}")
    return f"{int(match.group(3)):04d}-{MONTHS[match.group(2)]:02d}-{int(match.group(1)):02d}"


def parse_body(raw_body: str) -> tuple[str, list[dict[str, str]]]:
    lines = raw_body.splitlines()
    content_lines: list[str] = []
    images: list[dict[str, str]] = []
    index = 0

    while index < len(lines):
        if COMMENT_DATE.fullmatch(lines[index].strip()):
            while content_lines and not content_lines[-1].strip():
                content_lines.pop()
            if content_lines and content_lines[-1].strip().startswith("URL:"):
                content_lines.pop()
            break

        if lines[index].strip() != "URL:":
            content_lines.append(lines[index].rstrip())
            index += 1
            continue

        index += 1
        metadata: dict[str, str] = {}
        while index < len(lines):
            match = re.match(r"\s+-\s+([^:]+):\s*(.*)", lines[index])
            if not match:
                break
            metadata[match.group(1).strip()] = match.group(2).strip()
            index += 1

        if metadata.get("src"):
            images.append(
                {
                    "alt": metadata.get("alt", metadata.get("link text", "")),
                    "sourceRef": metadata["src"],
                }
            )

    content = "\n".join(content_lines).strip()
    content = re.sub(r"</?(?:h1|small)>", "", content, flags=re.IGNORECASE)
    content = re.sub(r"\n{3,}", "\n\n", content)
    return content, images


def load_improvements() -> dict[str, list[list[str]]]:
    improvements = json.loads(IMPROVEMENTS.read_text(encoding="utf-8"))
    if not isinstance(improvements, dict):
        raise ValueError("Improved-text source must be an object")
    for source_id, replacements in improvements.items():
        if not isinstance(source_id, str) or not isinstance(replacements, list):
            raise ValueError("Invalid improved-text source entry")
        for replacement in replacements:
            if (not isinstance(replacement, list) or len(replacement) != 2
                    or not all(isinstance(value, str) for value in replacement)):
                raise ValueError(f"Invalid replacement for {source_id}")
    return improvements


def improve_content(source_id: str, content: str, improvements: dict[str, list[list[str]]]) -> str:
    improved = content.replace("\u00a0", " ")
    improved = "\n".join(line.rstrip() for line in improved.splitlines())
    improved = re.sub(r"[ \t]{2,}", " ", improved)
    improved = re.sub(r"\n{3,}", "\n\n", improved).strip()
    improved = re.sub(r"\s+([,.;:!?])", r"\1", improved)
    # Long runs of punctuation were a common Typepad-era writing habit rather
    # than meaningful ellipses. In the suggested copy they become one normal
    # sentence-ending mark, with a properly spaced next sentence.
    def normalize_repeated_punctuation(match: re.Match[str]) -> str:
        punctuation = match.group(1)
        next_character = match.group(2).upper()
        return f"{punctuation} {next_character}"

    improved = re.sub(r"([.!?])[.!?]{1,}\s*([a-zà-ÿ])", normalize_repeated_punctuation, improved)
    improved = re.sub(r"([.!?])[.!?]{1,}(?=[A-ZÀ-Ý])", r"\1 ", improved)
    improved = re.sub(r"([.!?])[.!?]{1,}", r"\1", improved)
    improved = re.sub(r"\baccapella\b", "a capella", improved, flags=re.IGNORECASE)
    improved = re.sub(r"\bacapella\b", "a capella", improved, flags=re.IGNORECASE)
    for old, new in improvements[source_id]:
        # The source has a few inconsistent whitespace variants. A curated
        # replacement that no longer applies after whitespace cleanup is safe
        # to skip; it must never be guessed or applied fuzzily.
        if old in improved:
            improved = improved.replace(old, new)
    return improved


def resolve_image(source_ref: str) -> str:
    stem = Path(source_ref).stem
    candidates: list[Path] = []
    for directory in (ROOT / "content" / "images", ROOT / "content" / "images_oud"):
        candidates.extend(path for path in directory.iterdir() if path.is_file() and stem in path.name)

    if not candidates:
        raise FileNotFoundError(f"No local image found for {source_ref}")

    def preference(path: Path) -> tuple[int, int, str]:
        return (
            0 if path.suffix.lower() == ".webp" else 1,
            0 if path.parent.name == "images" else 1,
            path.name,
        )

    selected = sorted(candidates, key=preference)[0]
    return selected.relative_to(ROOT).as_posix()


def parse_posts() -> list[dict[str, object]]:
    posts: list[dict[str, object]] = []
    improvements = load_improvements()
    blocks = re.split(r"\n\n-----\n", SOURCE.read_text(encoding="utf-8"))

    for block in blocks:
        match = re.search(r"TITLE: (.*?)\nDATE: (.*?)\nBODY:\n(.*)", block, re.DOTALL)
        if not match:
            continue

        title = match.group(1).strip()
        date = match.group(2).strip()
        year_match = re.search(r"\b(\d{4})\b", date)
        if not year_match or int(year_match.group(1)) > 2012:
            continue

        content, images = parse_body(match.group(3))
        if not title or not content:
            raise ValueError(f"Incomplete source post: {date} — {title}")
        if re.search(r"(?m)^(?:TITLE|DATE|BODY|CATEGORY|URL):", content):
            raise ValueError(f"Structural Typepad fields leaked into body: {date} — {title}")
        if re.search(r"</?(?:h1|small)>", content, flags=re.IGNORECASE):
            raise ValueError(f"Presentational HTML leaked into body: {date} — {title}")

        for image in images:
            image["path"] = resolve_image(image["sourceRef"])

        source_id = f"{iso_date(date)}-{slugify(title)}"
        posts.append(
            {
                "sourceId": source_id,
                "sourceTitle": title,
                "title": NORMALIZED_TITLES.get(source_id, title),
                "date": date,
                "location": CONFIRMED_LOCATIONS.get(source_id, ""),
                "content": content,
                "improvedContent": improve_content(source_id, content, improvements),
                "images": images,
            }
        )

    if len(posts) != 41:
        raise ValueError(f"Expected 41 verified missing posts, found {len(posts)}")
    if len({post["sourceId"] for post in posts}) != len(posts):
        raise ValueError("Generated source IDs are not unique")
    image_count = sum(len(post["images"]) for post in posts)
    if image_count != 58:
        raise ValueError(f"Expected 58 legacy image references, found {image_count}")
    source_ids = {post["sourceId"] for post in posts}
    if set(improvements) != source_ids:
        raise ValueError("Improved-text source must cover exactly the 41 review posts")
    if any(not post["improvedContent"].strip() for post in posts):
        raise ValueError("Every improved review text must be non-empty")

    return posts


def main() -> None:
    payload = {
        "schemaVersion": 3,
        "kind": "anyway-old-blog-review-source",
        "generatedFrom": "content/typepad_export_cleaned.txt",
        "posts": parse_posts(),
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(payload['posts'])} posts in {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
