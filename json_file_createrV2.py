#!/usr/bin/env python3
import os
import re
import json

# --- Configuration ---
strip_name = 'strip15'
BASE_FOLDER = r'E:'
IMG_DIR     = os.path.join(BASE_FOLDER, strip_name)
BASE_URL    = f'https://weitefeld.cg.jku.at/{strip_name}'
# BASE_URL    = f'https://nrlhozkan.github.io/ImageViewer/{strip_name}'
COPPYFOLDER = r'C:\Users\AK127381\Desktop\ImageViewer\strips'
COPY_DIR   =  os.path.join(COPPYFOLDER, strip_name)
OUT_FILE    = os.path.join(COPY_DIR, 'index.json')

# --- Gather only .jpg/.jpeg/.png files ---
files = [
    f for f in os.listdir(IMG_DIR)
    if os.path.isfile(os.path.join(IMG_DIR, f))
       and re.search(r'\.(jpe?g|png)$', f, re.I)
]

# --- Regexes to strip off "_mask" and extension ---
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
    if m and not m.group('name').endswith('_mask'):
        groups.setdefault(m.group('name'), {})['rgb'] = fn
        continue

    print(f"⚠️  Skipping unexpected filename: {fn}")

# --- Build the JSON entries, preserving leading zeros in the ID ---
index_list = []
for name, variants in groups.items():
    if 'rgb' not in variants or 'rgb_mask' not in variants:
        print(f"⚠️  Incomplete pair for '{name}', skipping.")
        continue

    parts = name.split('_')
    if len(parts) < 2:
        print(f"⚠️  Cannot extract ID from '{name}', skipping.")
        continue

    img_id_str = parts[1]  # e.g. "02858"

    index_list.append({
        "id":       img_id_str,
        "rgb":      f"{BASE_URL}/{variants['rgb']}",
        "rgb_mask": f"{BASE_URL}/{variants['rgb_mask']}"
    })

# --- Sort by numeric value of the ID, but leave the string intact ---
index_list.sort(key=lambda e: int(e['id']))

# --- Write out ---
with open(OUT_FILE, 'w', encoding='utf-8') as fp:
    json.dump(index_list, fp, indent=2)

# --- Summary ---
if index_list:
    low, high = index_list[0]['id'], index_list[-1]['id']
    print(f"✅  Wrote {len(index_list)} entries (IDs {low}–{high}) to {OUT_FILE}")
else:
    print("⚠️  No valid image pairs found; index.json not written.")
