import re

with open(r'c:\Users\maste\Documents\GitHub\Piece-clon\local_preview\js\egret.min_d9413192.js', 'r', encoding='utf-8') as f:
    c = f.read()

matches = [m.start() for m in re.finditer(r'_pixelHitTest|pixelHitTest', c)]
for idx in matches:
    print('--- match at', idx, '---')
    print(c[idx-50:idx+250])
