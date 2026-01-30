import pandas as pd
import os
import json

def prepare_mock_data():
    booking_dir = 'booking_file'
    all_data = []
    
    if not os.path.exists(booking_dir):
        print(f"Directory {booking_dir} not found.")
        return

    files = [f for f in os.listdir(booking_dir) if f.endswith('.xlsx')]
    print(f"Found {len(files)} files.")

    for filename in files:
        filepath = os.path.join(booking_dir, filename)
        try:
            # Header is at row 4 (index 3)
            df = pd.read_excel(filepath, header=3)
            
            # Helper to get column using fuzzy match (ignore case/whitespace/newlines)
            def get_col_fuzzy(df, targets):
                cols = { "".join(str(c).lower().split()): c for c in df.columns }
                for target in targets:
                    target_clean = "".join(target.lower().split())
                    if target_clean in cols:
                        return cols[target_clean]
                    # Also try partial match
                    for c_clean, c_orig in cols.items():
                        if target_clean in c_clean:
                            return c_orig
                return None

            # File metadata
            upload_date = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')

            # Robust mapping with priority
            cont_out_col = get_col_fuzzy(df, ['Container Out 1', 'Container Out'])
            cont_in_col = get_col_fuzzy(df, ['Container In 1', 'Container In No.', 'Container In', 'Container No.'])
            ts_col = get_col_fuzzy(df, ['TRUCK / Size **', 'TRUCK / SIZE', 'Truck Size'])
            cs_col = get_col_fuzzy(df, ['CONTAINER / SIZE*', 'CONTAINER / SIZE', 'Container Size'])
            rem_col = get_col_fuzzy(df, ['Remark', 'REMARK'])

            for _, row in df.iterrows():
                truck = str(row.get('Truck In No.', '')).strip()
                if truck and truck != 'nan' and truck != 'None':
                    
                    def clean(val):
                        s = str(val).strip()
                        return '-' if s.lower() in ['nan', 'none', '', 'null'] else s

                    # Priority: Out 1 > In 1/Others
                    cont_val = clean(row.get(cont_out_col, '-')) if cont_out_col else '-'
                    if cont_val == '-':
                        cont_val = clean(row.get(cont_in_col, '-')) if cont_in_col else '-'

                    entry_id = f"{truck}_{clean(row.get(get_col_fuzzy(df, ['Job  No.', 'JobNo']), 'NOJOB'))}".replace(' ', '_')

                    all_data.append({
                        'id': entry_id,
                        'job': clean(row.get(get_col_fuzzy(df, ['Job  No.', 'JobNo']), '-')),
                        'truck': truck,
                        'trailer': clean(row.get(get_col_fuzzy(df, ['Trailer In No.', 'Trailer No.']), '-')),
                        'container': cont_val,
                        'truckSize': clean(row.get(ts_col, '-')) if ts_col else '-',
                        'containerSize': clean(row.get(cs_col, '-')) if cs_col else '-',
                        'remark': clean(row.get(rem_col, '-')) if rem_col else '-',
                        'customer': clean(row.get(get_col_fuzzy(df, ['Customer Name', 'Customer']), '-')),
                        'status': 'Pending',
                        'uDate': '2026-01-30',
                        'uTime': '08:00',
                        'uploadedDate': upload_date,
                        'gateOut': '-',
                        'isBL': False,
                        'timestamp': 1738200000000
                    })
        except Exception as e:
            print(f"Error processing {filename}: {e}")

    # Generate mockData.js as a plain script
    js_content = f"window.MOCK_DATA = {json.dumps(all_data, ensure_ascii=False, indent=2)};\n"
    
    with open('mockData.js', 'w', encoding='utf-8') as f:
        f.write(js_content)
    
    print(f"Successfully generated mockData.js with {len(all_data)} entries.")

if __name__ == "__main__":
    prepare_mock_data()
