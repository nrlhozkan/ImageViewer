import os

def find_continuity_and_gaps(folder_path):
    # 1. List all files and extract the integer image‐number (second underscore‐separated field)
    image_nums = []
    for fn in os.listdir(folder_path):
        parts = fn.split('_')
        if len(parts) > 1 and parts[1].isdigit():
            image_nums.append(int(parts[1]))
    image_nums = sorted(set(image_nums))

    if not image_nums:
        return [], [(0, 0)]  # nothing found

    # 2. Build list of continuous “present” segments
    present = []
    seg_start = prev = image_nums[0]
    for num in image_nums[1:]:
        if num == prev + 1:
            prev = num
        else:
            present.append((seg_start, prev))
            seg_start = prev = num
    present.append((seg_start, prev))

    # 3. From those, infer the gaps
    gaps = []
    for (a, b), (c, d) in zip(present, present[1:]):
        if c - b > 1:
            gaps.append((b + 1, c - 1))

    return present, gaps


if __name__ == '__main__':
    saving_loc = r"C:\Users\AK127381\Desktop\ImageViewer"
    folder     = r"E:\Weitefield_data_macs\jpg\other regions\strip01\strip01"
    present_ranges, missing_ranges = find_continuity_and_gaps(folder)

    # write a txt file with the results, using UTF-8
    output_file = os.path.join(saving_loc, "gaps.txt")
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("Present (continuous) segments:\n")
        for start, end in present_ranges:
            f.write(f"   • 0{start} → 0{end}\n")

        f.write("\nMissing (gap) segments:\n")
        for start, end in missing_ranges:
            f.write(f"   • {start} → {end}\n")

    print(f"Results written to {output_file}")
            
    