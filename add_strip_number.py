import os

def rename_images(folder_path: str, prefix: str):
    """
    Rename all image files in `folder_path` by adding `prefix_` in front of their names,
    skipping any files that are already correctly prefixed.
    """
    # normalize and verify
    folder_path = os.path.normpath(folder_path)
    if not os.path.isdir(folder_path):
        raise ValueError(f"Not a valid directory: {folder_path}")

    # image extensions to process
    exts = {'.jpg', '.jpeg', '.png', '.bmp', '.tif', '.tiff', '.gif'}
    prefix_token = f"{prefix}_"

    for fname in os.listdir(folder_path):
        src = os.path.join(folder_path, fname)
        if not os.path.isfile(src):
            continue

        name, ext = os.path.splitext(fname)
        if ext.lower() not in exts:
            continue

        # skip if already has the prefix
        if fname.startswith(prefix_token):
            continue

        new_name = prefix_token + fname
        dst = os.path.join(folder_path, new_name)
        os.rename(src, dst)
        # print(f"Renamed: {fname} → {new_name}")

if __name__ == "__main__":
    # ==== USER CONFIGURATION ====
    # 1) Path to your image folder:
    folder_path = r"E:\Weitefield_data_macs\jpg\other regions\strip03\strip03"
    # 2) The prefix you want to add (e.g. folder number "1", or any string):
    prefix = "3"
    # ============================

    rename_images(folder_path, prefix)
