#!/usr/bin/env python3
import os
import re
import json

# --- Configuration ---
strip_name = 'strip4'
BASE_FOLDER = r'C:\Users\AK127381\Desktop\ImageViewer'
IMG_DIR     = os.path.join(BASE_FOLDER, strip_name)
# BASE_URL    = f'https://weitefeld.cg.jku.at/{strip_name}'
BASE_URL    = f'https://nrlhozkan.github.io/ImageViewer/{strip_name}'
COPY_DIR   = IMG_DIR
OUT_FILE    = os.path.join(COPY_DIR, 'index.json')

# --- Gather only .jpg/.jpeg/.png files ---
files = [
    f for f in os.listdir(IMG_DIR)
    if os.path.isfile(os.path.join(IMG_DIR, f))
       and re.search(r'\.(jpe?g|png)$', f, re.I)
]

# --- Regexes to split out “name” (without extension or “_mask”) ---
rgb_mask_re = re.compile(r'^(?P<name>.+?)_mask\.(?:jpe?g|png)$', re.I)
rgb_re      = re.compile(r'^(?P<name>.+?)\.(?:jpe?g|png)$',  re.I)

# --- Group rgb + mask by base name ---
groups = {}
for fn in files:
    m = rgb_mask_re.match(fn)
    if m:
        groups.setdefault(m.group('name'), {})['rgb_mask'] = fn
        continue

    m = rgb_re.match(fn)
    if m and not m.group(1).endswith('_mask'):
        groups.setdefault(m.group('name'), {})['rgb'] = fn
        continue

    print(f"⚠️  Skipping unexpected filename: {fn}")

# --- Build the JSON entries, pulling the numeric ID from each “name” ---
index_list = []
for name, variants in groups.items():
    if 'rgb' not in variants or 'rgb_mask' not in variants:
        print(f"⚠️  Incomplete pair for '{name}', skipping.")
        continue

    parts = name.split('_')
    try:
        img_id = int(parts[1])
    except (IndexError, ValueError):
        print(f"⚠️  Cannot parse integer ID from '{name}', skipping.")
        continue

    index_list.append({
        "id":       img_id,
        "rgb":      f"{BASE_URL}/{variants['rgb']}",
        "rgb_mask": f"{BASE_URL}/{variants['rgb_mask']}"
    })

# --- Sort by numeric ID and write out ---
index_list.sort(key=lambda e: e['id'])

with open(OUT_FILE, 'w', encoding='utf-8') as fp:
    json.dump(index_list, fp, indent=2)

if index_list:
    low, high = index_list[0]['id'], index_list[-1]['id']
    print(f"✅  Wrote {len(index_list)} entries (IDs {low}–{high}) to {OUT_FILE}")
else:
    print("⚠️  No valid image pairs found; index.json not written.")
