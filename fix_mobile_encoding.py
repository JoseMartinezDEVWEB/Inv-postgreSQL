import os

def fix_encoding(file_path):
    try:
        with open(file_path, 'rb') as f:
            content = f.read()
        
        # Mapping of broken sequences (Thai/UTF-8 mixup) back to original characters
        # These are common patterns when UTF-8 is misread as some other encoding and then saved.
        replacements = [
            (b'\xe0\xb8\xa3\xe0\xb8\x93', 'ó'.encode('utf8')), # ó
            (b'\xe0\xb8\xa3\xe0\xb8\x81', 'á'.encode('utf8')), # á
            (b'\xe0\xb8\xad\xe0\xb8\xad', 'í'.encode('utf8')), # í
            (b'\xe0\xb8\xba', 'ú'.encode('utf8')),             # ú
            (b'\xe0\xb8\xa3\xe0\xb8\xaa', 'é'.encode('utf8')), # é
            (b'\xe0\xb8\x94\xe0\xb8\xb1', 'ñ'.encode('utf8')), # ñ
            (b'\xe0\xb8\xa3\xe0\xb8\x81', 'Á'.encode('utf8')), # Á
            (b'\xe0\xb8\xa3\xe0\xb8\x93', 'Ó'.encode('utf8')), # Ó
        ]
        
        changed = False
        new_content = content
        for broken, fixed in replacements:
            if broken in new_content:
                new_content = new_content.replace(broken, fixed)
                changed = True
        
        if changed:
            with open(file_path, 'wb') as f:
                f.write(new_content)
            print(f"Fixed: {file_path}")
            return True
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
    return False

def scan_and_fix(directory):
    for root, dirs, files in os.walk(directory):
        if 'node_modules' in dirs:
            dirs.remove('node_modules')
        if '.git' in dirs:
            dirs.remove('.git')
        
        for file in files:
            if file.endswith(('.js', '.jsx', '.json', '.md')):
                fix_encoding(os.path.join(root, file))

if __name__ == "__main__":
    scan_and_fix(r'c:\Users\ASUS\Desktop\Inv-postgreSQL\frontend-mobile')
    print("Encoding fix complete.")
