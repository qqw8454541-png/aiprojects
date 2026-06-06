import os
import re

directory = '/root/aiprojects/mahjong-scorer/src'
pattern = re.compile(r"(t\([^)]*\))\s*([\'\"`]).*?\2")

for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content, count = pattern.subn(r'\1', content)
            if count > 0:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f'Updated {path} ({count} fixes)')
