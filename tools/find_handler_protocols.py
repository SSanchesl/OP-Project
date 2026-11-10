import re

with open(r'c:\Users\maste\Documents\GitHub\Piece-clon\local_preview\js\main.min_21f8f348.js', 'r', encoding='utf-8') as f:
    content = f.read()

targets = [
    ('hangup', 'gain'),
    ('backpack', 'useItem'),
    ('weapon', 'wear'),
    ('weapon', 'upgrade'),
    ('superSkill', 'activeSuperSkill'),
    ('task', 'getReward'),
    ('task', 'queryTask')
]

for t, a in targets:
    pattern = rf'type\s*:\s*["\']{t}["\']\s*,\s*action\s*:\s*["\']{a}["\']'
    matches = [m.start() for m in re.finditer(pattern, content)]
    print(f"\n=== {t}:{a} (matches: {len(matches)}) ===")
    for idx in matches[:2]:
        start = max(0, idx - 150)
        end = min(len(content), idx + 350)
        snippet = content[start:end]
        print(f"--- snippet at {idx} ---\n{snippet}\n")

