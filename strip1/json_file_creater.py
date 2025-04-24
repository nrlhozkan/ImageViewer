#!/usr/bin/env python3
import os
import re
import json

# 1) Your images folder (local)
IMG_DIR     = r'C:\Users\AK127381\Desktop\ImageViewer\images'
# 2) The base URL you want in your JSON
BASE_URL    = 'https://nrlhozkan.github.io/ImageViewer/images'
# 3) Output file
OUT_FILE    = os.path.join(IMG_DIR, 'index.json')

# 4) List only JPEG/PNG files
files = [
    f for f in os.listdir(IMG_DIR)
    if os.path.isfile(os.path.join(IMG_DIR, f))
    and re.search(r'\.(jpe?g|png)$', f, re.I)
]

# 5) Regex for AN vs primary
an_re  = re.compile(r'^(?P<name>.+?)_AN\.(?:jpe?g|png)$', re.I)
rgb_re = re.compile(r'^(?P<name>.+?)\.(?:jpe?g|png)$',  re.I)

groups = {}
for fn in files:
    m = an_re.match(fn)
    if m:
        name = m.group('name')
        groups.setdefault(name, {})['an'] = fn
        continue

    m = rgb_re.match(fn)
    # skip matching the AN file twice
    if m and not fn.upper().endswith('_AN.JPG') and not fn.upper().endswith('_AN.PNG'):
        name = m.group('name')
        groups.setdefault(name, {})['rgb'] = fn
        continue

    print(f"⚠️  Skipping unexpected filename: {fn}")

# 6) Build the JSON array with sequential numeric IDs
index_list = []
for seq, (name, vars) in enumerate(sorted(groups.items(), key=lambda x: x[0]), start=1):
    if 'rgb' not in vars or 'an' not in vars:
        print(f"⚠️  Skipping {name}: incomplete variants {list(vars)}")
        continue

    index_list.append({
        "id":  seq,
        "rgb": f"{BASE_URL}/{vars['rgb']}",
        "an":  f"{BASE_URL}/{vars['an']}"
    })

# 7) Write index.json
with open(OUT_FILE, 'w', encoding='utf-8') as fp:
    json.dump(index_list, fp, indent=2)

print(f"✅  Wrote {len(index_list)} entries (IDs 1–{len(index_list)}) to {OUT_FILE}")
