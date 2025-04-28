#!/usr/bin/env python3
import os
import re
import json

# 1) Your images folder (local)
IMG_DIR     = r'C:\Users\AK127381\Desktop\ImageViewer\strip3'
# 2) The base URL you want in your JSON
BASE_URL    = 'https://nrlhozkan.github.io/ImageViewer/strip3'
# 3) Output file
OUT_FILE    = os.path.join(IMG_DIR, 'index.json')

# 4) List only JPEG/PNG files
files = [
    f for f in os.listdir(IMG_DIR)
    if os.path.isfile(os.path.join(IMG_DIR, f))
    and re.search(r'\.(jpe?g|png)$', f, re.I)
]

rgb_mask_re  = re.compile(r'^(?P<name>.+?)_mask\.(?P<ext>jpe?g|png)$', re.I)
rgb_re       = re.compile(r'^(?P<name>.+?)\.(?P<ext>jpe?g|png)$',    re.I)

# Group by the “base” name before extension or “_mask”
groups = {}
for fn in files:
    # mask?
    m = rgb_mask_re.match(fn)
    if m:
        name, ext = m.group('name'), m.group('ext')
        groups.setdefault(name, {})['mask'] = (fn, ext)
        continue

    # rgb?
    m = rgb_re.match(fn)
    if m and not fn.upper().endswith('_MASK.JPG') and not fn.upper().endswith('_MASK.PNG'):
        name, ext = m.group('name'), m.group('ext')
        groups.setdefault(name, {})['rgb'] = (fn, ext)
        continue

    print(f"⚠️  Skipping unexpected filename: {fn}")

# 6) Build the JSON array with sequential numeric IDs, rename files as we go
index_list = []
for seq, (name, variants) in enumerate(sorted(groups.items()), start=1):
    if 'rgb' not in variants or 'mask' not in variants:
        print(f"⚠️  Skipping {name}: incomplete variants {list(variants)}")
        continue

    rgb_fn, rgb_ext  = variants['rgb']
    mask_fn, mask_ext = variants['mask']

    # Construct new filenames
    new_rgb_fn  = f"{seq}.{rgb_ext}"
    new_mask_fn = f"{seq}_mask.{mask_ext}"

    # Full paths
    old_rgb_path  = os.path.join(IMG_DIR, rgb_fn)
    old_mask_path = os.path.join(IMG_DIR, mask_fn)
    new_rgb_path  = os.path.join(IMG_DIR, new_rgb_fn)
    new_mask_path = os.path.join(IMG_DIR, new_mask_fn)

    # Rename on disk
    os.rename(old_rgb_path, new_rgb_path)
    os.rename(old_mask_path, new_mask_path)

    # Add entry to index
    index_list.append({
        "id":      seq,
        "rgb":     f"{BASE_URL}/{new_rgb_fn}",
        "rgb_mask": f"{BASE_URL}/{new_mask_fn}"
    })

# 7) Write index.json
with open(OUT_FILE, 'w', encoding='utf-8') as fp:
    json.dump(index_list, fp, indent=2)

print(f"✅  Renamed and wrote {len(index_list)} entries (IDs 1–{len(index_list)}) to {OUT_FILE}")
