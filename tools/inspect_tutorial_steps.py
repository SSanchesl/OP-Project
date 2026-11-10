import json

with open(r'c:\Users\maste\Documents\GitHub\Piece-clon\local_preview\resource\json\tutorial.json', 'r', encoding='utf-8') as f:
    tut = json.load(f)

for step_id in range(2101, 2704):
    s = tut.get(str(step_id))
    if s:
        name = s.get('name')
        how = s.get('howToNext')
        s1 = s.get('showType1')
        s2 = s.get('showType2')
        dtext = s.get('dialogText')
        print(f"[{step_id}] ({name}) how={how} show1={s1} show2={s2} dialog={dtext}")

