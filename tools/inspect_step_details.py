import json

with open(r'c:\Users\maste\Documents\GitHub\Piece-clon\local_preview\resource\json\tutorial.json', 'r', encoding='utf-8') as f:
    tut = json.load(f)

for sid in ['2103', '2104', '2105', '2106', '2107']:
    print(f"=== STEP {sid} ===")
    print(json.dumps(tut.get(sid), indent=2, ensure_ascii=False))
