import re

with open(r'c:\Users\maste\Documents\GitHub\Piece-clon\local_preview\js\main.min_21f8f348.js', 'r', encoding='utf-8') as f:
    content = f.read()

hp = re.findall(r'type\s*:\s*["\']([^"\']+)["\']\s*,\s*action\s*:\s*["\']([^"\']+)["\']', content)
unique_actions = sorted(list(set(hp)))
for t in ['weapon', 'backpack', 'hangup']:
    print(f'\n--- {t} ---')
    for p in unique_actions:
        if p[0] == t:
            print(f'  {p[1]}')
