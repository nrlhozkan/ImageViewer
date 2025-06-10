"""
Script to transform Excel data to TXT with specific column mapping.

Mapping:
 1. Excel column 1 (row[0]) is split into four parts -> output fields 1–4
 2. Excel column 2 (row[1]) -> output field 5
 3. Excel column 3 (row[2]) -> output field 6 (quoted)
 4. Excel column 4 (row[3]) is ignored
 5. Excel column 6 (row[5]) is split into six parts -> output fields 7–12
 6. Excel column 5 (row[4]) -> output field 13 (quoted)

Set the input/output paths and sheet name via the variables below.
"""
import pandas as pd

# --- User configuration ---
# Set the path to your input Excel file:
EXCEL_PATH = r"C:\Users\AK127381\Desktop\ImageViewer\Results.xlsx"
# Set the desired output TXT file name/path:
OUTPUT_TXT = r"C:\Users\AK127381\Desktop\ImageViewer\dumy.txt"
# Specify the sheet name or index (0-based) to read:
SHEET_NAME = 0  # e.g., "Sheet1" or 0
# --------------------------

def sanitize(cell):
    """
    Remove newlines and carriage returns from the cell and trim whitespace.
    """
    return str(cell).replace('\r', ' ').replace('\n', ' ').strip()


def transform(excel_path, output_path, sheet_name=0):
    # Read all cells as strings to preserve formatting
    df = pd.read_excel(excel_path, sheet_name=sheet_name, header=None, dtype=str)
    df = df.fillna('')

    # Skip the first row (assumed header/titles)
    data_rows = df.iloc[1:]

    with open(output_path, 'w', encoding='utf-8') as fout:
        for _, row in data_rows.iterrows():
            # 1. Split the first column into 4 sanitized parts
            col1_parts = sanitize(row[0]).split()
            if len(col1_parts) < 4:
                col1_parts += [''] * (4 - len(col1_parts))

            # 2. Excel col2 -> output field 5
            field5 = sanitize(row[1])

            # 3. Excel col3 -> output field 6 (quoted)
            field6 = f'"{sanitize(row[2])}"'

            # 4. Excel col4 is ignored

            # 5. Excel col6 -> 6 sanitized parts for output fields 7–12
            col6_parts = sanitize(row[5]).split()
            if len(col6_parts) < 6:
                col6_parts += [''] * (6 - len(col6_parts))

            # 6. Excel col5 -> output field 13 (quoted)
            if sanitize(row[4]) == '':
                field13 = 'NA'
            else:
                field13 = f'"{sanitize(row[4])}"'

            # Assemble in order
            out_fields = []
            out_fields.extend(col1_parts)        # fields 1-4
            out_fields.append(field5)            # field 5
            out_fields.append(field6)            # field 6 (quoted)
            out_fields.extend(col6_parts)        # fields 7-12
            out_fields.append(field13)           # field 13 (quoted)

            # Write as a single tab-delimited line
            fout.write(' '.join(out_fields) + '\n')

if __name__ == '__main__':
    transform(EXCEL_PATH, OUTPUT_TXT, SHEET_NAME)
