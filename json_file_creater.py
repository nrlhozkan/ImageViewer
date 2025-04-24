#!/usr/bin/env python3
import os
import re
import json

# 1) Your images folder (local)
IMG_DIR     = r'E:\ImageViewer\strip2'
# 2) The base URL you want in your JSON
BASE_URL    = 'https://nrlhozkan.github.io/ImageViewer/strip2'
# 3) Output file
OUT_FILE    = os.path.join(IMG_DIR, 'index.json')

# 4) List only JPEG/PNG files
files = [
    f for f in os.listdir(IMG_DIR)
    if os.path.isfile(os.path.join(IMG_DIR, f))
    and re.search(r'\.(jpe?g|png)$', f, re.I)
]

rgb_mask_re  = re.compile(r'^(?P<name>.+?)_mask\.(?:jpe?g|png)$', re.I)
rgb_re = re.compile(r'^(?P<name>.+?)\.(?:jpe?g|png)$',  re.I)

groups = {}
for fn in files:
    m = rgb_mask_re.match(fn)
    if m:
        name = m.group('name')
        groups.setdefault(name, {})['rgb_mask'] = fn
        continue

    m = rgb_re.match(fn)
    # skip matching the AN file twice
    if m and not fn.upper().endswith('_mask.PNG') and not fn.upper().endswith('_mask.JPG'):
        name = m.group('name')
        groups.setdefault(name, {})['rgb'] = fn
        continue

    print(f"⚠️  Skipping unexpected filename: {fn}")

# 6) Build the JSON array with sequential numeric IDs
index_list = []
for seq, (name, vars) in enumerate(sorted(groups.items(), key=lambda x: x[0]), start=1):
    if 'rgb' not in vars or 'rgb_mask' not in vars:
        print(f"⚠️  Skipping {name}: incomplete variants {list(vars)}")
        continue

    index_list.append({
        "id":  seq,
        "rgb": f"{BASE_URL}/{vars['rgb']}",
        "rgb_mask":  f"{BASE_URL}/{vars['rgb_mask']}"
    })

# 7) Write index.json
with open(OUT_FILE, 'w', encoding='utf-8') as fp:
    json.dump(index_list, fp, indent=2)

print(f"✅  Wrote {len(index_list)} entries (IDs 1–{len(index_list)}) to {OUT_FILE}")
