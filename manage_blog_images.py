#!/usr/bin/env python3
"""
Blog Image Manager - Manage and organize blog images.

This script reads blog.yaml and automatically:
1. Detects images that don't follow the naming convention (YYYYMMDD_title.webp)
2. Renames image files to follow the convention
3. Updates blog.yaml with the new paths
4. Finds and cleans up duplicate files (MD5 exact matches)
5. Lists unused images not referenced in blog.yaml
6. Detects visual duplicates using perceptual hashing

Usage:
    python manage_blog_images.py           # Dry run (show what would be changed)
    python manage_blog_images.py --apply   # Actually apply the changes
"""

import re
import sys
import hashlib
from pathlib import Path
from urllib.parse import unquote

# Try to import imagehash for visual duplicate detection
try:
    import imagehash
    from PIL import Image
    IMAGEHASH_AVAILABLE = True
except ImportError:
    IMAGEHASH_AVAILABLE = False

# Paths (relative to script location)
SCRIPT_DIR = Path(__file__).parent
IMAGES_DIR = SCRIPT_DIR / 'content' / 'images'
YAML_PATH = SCRIPT_DIR / 'content' / 'blog.yaml'

# Dutch month names to numbers
DUTCH_MONTHS = {
    'januari': '01',
    'februari': '02',
    'maart': '03',
    'april': '04',
    'mei': '05',
    'juni': '06',
    'juli': '07',
    'augustus': '08',
    'september': '09',
    'oktober': '10',
    'november': '11',
    'december': '12'
}

# Regex pattern for correctly named files: YYYYMMDD_name.ext
CORRECT_NAME_PATTERN = re.compile(r'^\d{8}_[a-z0-9_]+\.(webp|jpg|jpeg|png)$')

def follows_naming_convention(filename):
    """Check if a filename follows the YYYYMMDD_name.ext convention."""
    return bool(CORRECT_NAME_PATTERN.match(filename))

def get_file_hash(filepath):
    """Calculate MD5 hash of a file."""
    hash_md5 = hashlib.md5()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def parse_dutch_date(date_str):
    """Parse Dutch date string like '14 september 2025' to YYYYMMDD format."""
    # Handle dates like "17, 18 mei 2024" or "3, 4, 5 juni 2022" - take the first day
    parts = date_str.split()
    
    if len(parts) >= 3:
        year = parts[-1]
        # Validate year is a 4-digit number
        if not (year.isdigit() and len(year) == 4):
            return None
        month = DUTCH_MONTHS.get(parts[-2].lower())
        if not month:
            return None
        first_part = parts[0].rstrip(',')
        if not first_part.isdigit():
            return None
        day = first_part.zfill(2)
        return f"{year}{month}{day}"
    return None

def title_to_filename(title):
    """Convert title to a filename-friendly format."""
    title = title.lower()
    title = re.sub(r'[-–—]', '_', title)
    title = re.sub(r'[^a-z0-9_\s]', '', title)
    title = re.sub(r'\s+', '_', title)
    title = re.sub(r'_+', '_', title)
    title = title.strip('_')
    return title

def parse_blog_yaml(yaml_path):
    """Parse blog.yaml and extract entries with title, date, and image."""
    entries = []
    current_entry = {}
    
    with open(yaml_path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.startswith('- title:'):
                if current_entry and 'title' in current_entry:
                    entries.append(current_entry)
                current_entry = {'title': line.split(':', 1)[1].strip()}
            elif line.strip().startswith('date:') and 'title' in current_entry:
                current_entry['date'] = line.split(':', 1)[1].strip()
            elif line.strip().startswith('image:') and not line.strip().startswith('#') and 'title' in current_entry:
                image_path = line.split(':', 1)[1].strip()
                current_entry['image'] = image_path
    
    if current_entry and 'title' in current_entry:
        entries.append(current_entry)
    
    return entries

def get_expected_filename(title, date):
    """Generate the expected filename based on title and date."""
    date_prefix = parse_dutch_date(date)
    if not date_prefix:
        return None
    title_part = title_to_filename(title)
    return f"{date_prefix}_{title_part}.webp"

def is_correctly_named(current_image, expected_filename):
    """Check if the current image already follows the naming convention."""
    if not current_image or not expected_filename:
        return True  # Skip entries without images
    
    # Extract just the filename from the path
    current_filename = unquote(current_image.split('/')[-1])
    return current_filename == expected_filename

def find_duplicates_to_delete(images_dir):
    """Find duplicate files that don't follow the naming convention."""
    # Build hash map of all correctly named files
    correct_files = {}  # hash -> filepath
    all_files = {}  # hash -> [filepaths]
    
    for f in images_dir.iterdir():
        if f.is_file() and f.suffix.lower() in ['.webp', '.jpg', '.jpeg', '.png']:
            file_hash = get_file_hash(f)
            
            if file_hash not in all_files:
                all_files[file_hash] = []
            all_files[file_hash].append(f)
            
            if CORRECT_NAME_PATTERN.match(f.name):
                correct_files[file_hash] = f
    
    # Find duplicates to delete
    to_delete = []
    for file_hash, files in all_files.items():
        if len(files) > 1 and file_hash in correct_files:
            # Keep the correctly named one, mark others for deletion
            correct_file = correct_files[file_hash]
            for f in files:
                if f != correct_file:
                    to_delete.append((f, correct_file))
    
    return to_delete

# Site assets that are used elsewhere (not in blog.yaml) - exclude from unused check
IGNORED_FILES = {'anyway.jpg', 'bg.jpg', 'bg.webp', 'overlay.webp', '.DS_Store'}

def find_unused_images(images_dir, entries):
    """Find images that are not referenced in blog.yaml."""
    # Get all image filenames used in blog.yaml
    used_filenames = set()
    used_stems = set()
    
    for entry in entries:
        image = entry.get('image', '')
        if image and image != 'content/images/':
            # Extract filename and decode URL encoding
            filename = unquote(image.split('/')[-1])
            used_filenames.add(filename)
            # Also track the stem (without extension) for .webp/.jpg pair matching
            used_stems.add(Path(filename).stem)
    
    # Get all image files in the directory
    unused = []
    for f in images_dir.iterdir():
        if not f.is_file():
            continue
        if f.suffix.lower() not in ['.webp', '.jpg', '.jpeg', '.png']:
            continue
        if f.name in IGNORED_FILES:
            continue
        
        # Check if this file is directly used
        if f.name in used_filenames:
            continue
        
        # Don't report .jpg as unused if the .webp version is being used
        # (common pattern: keep source .jpg alongside optimized .webp)
        if f.suffix.lower() in ['.jpg', '.jpeg'] and f.stem in used_stems:
            continue
        
        unused.append(f)
    
    return sorted(unused, key=lambda x: x.name)

def find_visual_duplicates(images_dir):
    """Find visually similar images using perceptual hashing."""
    if not IMAGEHASH_AVAILABLE:
        return []
    
    # Calculate perceptual hash for each image
    image_hashes = {}  # hash -> [filepaths]
    
    for f in images_dir.iterdir():
        if not f.is_file():
            continue
        if f.suffix.lower() not in ['.webp', '.jpg', '.jpeg', '.png']:
            continue
        if f.name in IGNORED_FILES:
            continue
        
        try:
            with Image.open(f) as img:
                # Use average hash - good for finding similar images
                phash = str(imagehash.phash(img))
                
                if phash not in image_hashes:
                    image_hashes[phash] = []
                image_hashes[phash].append(f)
        except Exception as e:
            print(f"  WARNING: Could not process {f.name}: {e}")
    
    # Find groups of similar images (exclude .jpg/.webp pairs with same name)
    duplicates = []
    for phash, files in image_hashes.items():
        if len(files) > 1:
            # Group by stem to filter out format variants (image.jpg + image.webp)
            stems = {}
            for f in files:
                if f.stem not in stems:
                    stems[f.stem] = []
                stems[f.stem].append(f)
            
            # Only report if there are files with DIFFERENT names (true duplicates)
            if len(stems) > 1:
                duplicates.append(files)
    
    return duplicates

def main():
    dry_run = '--apply' not in sys.argv
    
    if dry_run:
        print("=" * 70)
        print("DRY RUN - No changes will be made. Use --apply to apply changes.")
        print("=" * 70 + "\n")
    else:
        print("=" * 70)
        print("APPLYING CHANGES")
        print("=" * 70 + "\n")
    
    # Parse blog.yaml
    entries = parse_blog_yaml(YAML_PATH)
    print(f"Found {len(entries)} blog entries\n")
    
    renames = []
    yaml_updates = []
    
    for entry in entries:
        title = entry.get('title', '')
        date = entry.get('date', '')
        image = entry.get('image', '')
        
        if not image or image == 'content/images/':
            continue  # Skip entries without images
        
        expected_filename = get_expected_filename(title, date)
        if not expected_filename:
            print(f"WARNING: Could not parse date for '{title}': {date}")
            continue
        
        if is_correctly_named(image, expected_filename):
            continue  # Already correctly named
        
        # Decode current filename
        current_filename = unquote(image.split('/')[-1])
        old_path = IMAGES_DIR / current_filename
        new_path = IMAGES_DIR / expected_filename
        
        # Check if source file exists
        if not old_path.exists():
            print(f"WARNING: File not found: {current_filename}")
            # Try to find with different extension
            for ext in ['.webp', '.jpg', '.jpeg', '.png']:
                alt_path = IMAGES_DIR / (Path(current_filename).stem + ext)
                if alt_path.exists():
                    old_path = alt_path
                    print(f"  Found alternative: {alt_path.name}")
                    break
            else:
                continue
        
        print(f"RENAME: {current_filename}")
        print(f"    TO: {expected_filename}")
        print()
        
        renames.append((old_path, new_path))
        yaml_updates.append({
            'old': image,
            'new': f"content/images/{expected_filename}"
        })
    
    # Find duplicate files to clean up
    print("-" * 70)
    print("Checking for duplicate files (exact MD5 matches)...")
    print("-" * 70 + "\n")
    
    duplicates = find_duplicates_to_delete(IMAGES_DIR)
    
    if duplicates:
        print(f"Found {len(duplicates)} duplicate file(s) to delete:\n")
        for dup, correct in duplicates:
            print(f"  DELETE: {dup.name}")
            print(f"   KEEPS: {correct.name}")
            print()
    else:
        print("No duplicate files found.\n")
    
    # Find unused images
    print("-" * 70)
    print("Checking for unused images...")
    print("-" * 70 + "\n")
    
    unused_images = find_unused_images(IMAGES_DIR, entries)
    
    if unused_images:
        print(f"Found {len(unused_images)} unused image(s):\n")
        for img in unused_images:
            size_kb = img.stat().st_size / 1024
            print(f"  {img.name} ({size_kb:.1f} KB)")
        print()
    else:
        print("No unused images found.\n")
    
    # Build set of used filenames for visual duplicate detection
    used_filenames = set()
    for entry in entries:
        image = entry.get('image', '')
        if image and image != 'content/images/':
            filename = unquote(image.split('/')[-1])
            used_filenames.add(filename)
    
    # Find visual duplicates (images that look the same but have different names)
    print("-" * 70)
    print("Checking for visual duplicates...")
    print("-" * 70 + "\n")
    
    visual_to_delete = []
    visual_duplicates_found = False
    
    if IMAGEHASH_AVAILABLE:
        visual_duplicates = find_visual_duplicates(IMAGES_DIR)
        
        if visual_duplicates:
            visual_duplicates_found = True
            print(f"Found {len(visual_duplicates)} group(s) of visually similar images:\n")
            
            for i, group in enumerate(visual_duplicates, 1):
                # Separate files by naming convention
                compliant = [f for f in group if follows_naming_convention(f.name)]
                non_compliant = [f for f in group if not follows_naming_convention(f.name)]
                
                print(f"  Group {i}:")
                for img in group:
                    size_kb = img.stat().st_size / 1024
                    convention_mark = "✓" if follows_naming_convention(img.name) else "✗"
                    in_yaml = "📄" if img.name in used_filenames else "  "
                    print(f"    [{convention_mark}] {in_yaml} {img.name} ({size_kb:.1f} KB)")
                
                # If there's at least one compliant and one non-compliant, offer to delete
                if compliant and non_compliant:
                    if dry_run:
                        print(f"    (Can delete {len(non_compliant)} non-compliant file(s) with --apply)")
                    else:
                        answer = input(f"  Delete {len(non_compliant)} non-compliant file(s)? [Y/n]: ").strip().lower()
                        if answer != 'n':
                            visual_to_delete.extend(non_compliant)
                            print(f"    → Marked {len(non_compliant)} file(s) for deletion")
                        else:
                            print("    → Skipped")
                else:
                    print("    (No clear compliant/non-compliant split)")
                print()
            
            print("Legend: [✓] follows naming convention, [✗] doesn't, 📄 = used in blog.yaml\n")
        else:
            print("No visual duplicates found.\n")
    else:
        print("Install 'imagehash' and 'Pillow' for visual duplicate detection.\n")
        print("  pip install imagehash Pillow\n")
    
    if renames:
        print(f"\nTotal: {len(renames)} file(s) to rename")
    if duplicates:
        print(f"Total: {len(duplicates)} duplicate file(s) to delete")
    if visual_to_delete:
        print(f"Total: {len(visual_to_delete)} visual duplicate(s) to delete")
    
    if not renames and not duplicates and not visual_to_delete and not visual_duplicates_found:
        print("All images are already correctly named and no duplicates found!")
        return
    
    print()
    
    if dry_run:
        print("Run with --apply to make these changes.")
        return
    
    # Apply renames
    successful_renames = []
    if renames:
        print("Renaming files...")
    for i, (old_path, new_path) in enumerate(renames):
        try:
            if new_path.exists():
                print(f"  SKIP (target exists): {new_path.name}")
            else:
                old_path.rename(new_path)
                print(f"  RENAMED: {old_path.name} -> {new_path.name}")
                successful_renames.append(i)
        except Exception as e:
            print(f"  ERROR: {old_path.name}: {e}")
    
    # Update blog.yaml only for successful renames
    yaml_updates = [yaml_updates[i] for i in successful_renames] if yaml_updates else []
    if yaml_updates:
        print("\nUpdating blog.yaml...")
        content = YAML_PATH.read_text(encoding='utf-8')
        
        for update in yaml_updates:
            if update['old'] in content:
                content = content.replace(update['old'], update['new'])
                print(f"  UPDATED: {update['old']} -> {update['new']}")
        
        YAML_PATH.write_text(content, encoding='utf-8')
    
    # Delete duplicates (re-scan after renames to catch newly created duplicates)
    if renames:
        # Re-scan for duplicates after renames
        duplicates = find_duplicates_to_delete(IMAGES_DIR)
    
    if duplicates:
        print("\nDeleting duplicate files...")
        for dup, correct in duplicates:
            try:
                if not dup.exists():
                    print(f"  SKIP (already deleted): {dup.name}")
                    continue
                dup.unlink()
                print(f"  DELETED: {dup.name} (duplicate of {correct.name})")
            except Exception as e:
                print(f"  ERROR deleting {dup.name}: {e}")
    
    # Delete visual duplicates that user confirmed
    if visual_to_delete:
        print("\nDeleting visual duplicate files...")
        for dup in visual_to_delete:
            try:
                if not dup.exists():
                    print(f"  SKIP (already deleted or renamed): {dup.name}")
                    continue
                dup.unlink()
                print(f"  DELETED: {dup.name}")
            except Exception as e:
                print(f"  ERROR deleting {dup.name}: {e}")
    
    print("\nDone!")

if __name__ == '__main__':
    main()
