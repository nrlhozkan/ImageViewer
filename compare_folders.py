import os

def compare_folders(folder1: str, folder2: str) -> dict:
    """
    Compare filenames in two folders and report how many are the same and how many differ.

    Args:
        folder1 (str): Path to the first folder.
        folder2 (str): Path to the second folder.

    Returns:
        dict: A dictionary with counts and lists of common and unique filenames.
    """
    # List files (not directories) in each folder
    files1 = set(f for f in os.listdir(folder1) if os.path.isfile(os.path.join(folder1, f)))
    files2 = set(f for f in os.listdir(folder2) if os.path.isfile(os.path.join(folder2, f)))

    # Find common and unique filenames
    common = files1.intersection(files2)
    only_in_1 = files1 - files2
    only_in_2 = files2 - files1

    result = {
        "common_count": len(common),
        "unique_count_folder1": len(only_in_1),
        "unique_count_folder2": len(only_in_2),
        "common_files": sorted(common),
        "unique_files_folder1": sorted(only_in_1),
        "unique_files_folder2": sorted(only_in_2),
    }
    return result


def save_results_to_txt(stats: dict, folder1: str, folder2: str, output_file: str) -> None:
    """
    Save comparison results to a text file.

    Args:
        stats (dict): The dictionary returned by compare_folders.
        folder1 (str): The first folder path used in the comparison.
        folder2 (str): The second folder path used in the comparison.
        output_file (str): Path to the output text file.
    """
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(f"Common files ({stats['common_count']}):\n")
        for name in stats['common_files']:
            f.write(f"    {name}\n")

        f.write(f"\nFiles only in {folder1} ({stats['unique_count_folder1']}):\n")
        for name in stats['unique_files_folder1']:
            f.write(f"   {name}\n")

        f.write(f"\nFiles only in {folder2} ({stats['unique_count_folder2']}):\n")
        for name in stats['unique_files_folder2']:
            f.write(f"   {name}\n")

if __name__ == "__main__":
    # Set your folder paths here
    folder_a = r"E:\Weitefield_data_macs\jpg\priority region\strip3"
    folder_b = r"E:\Weitefield_data_macs\jpg\other regions\strip03\strip03"
    # Set the output file path
    output_txt = r"comparison_results.txt"

    # Perform comparison
    stats = compare_folders(folder_a, folder_b)

    # Print summary to console
    print(f"Number of files in common: {stats['common_count']}")
    print(f"Number of unique files in {folder_a}: {stats['unique_count_folder1']}")
    print(f"Number of unique files in {folder_b}: {stats['unique_count_folder2']}")

    # Save detailed lists to text file
    save_results_to_txt(stats, folder_a, folder_b, output_txt)
    print(f"Detailed results saved to: {output_txt}")

