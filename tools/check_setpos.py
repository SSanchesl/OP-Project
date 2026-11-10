with open(r'c:\Users\maste\Documents\GitHub\Piece-clon\local_preview\js\main.min_21f8f348.js', 'r', encoding='utf-8') as f:
    content = f.read()

idx = content.find('t.prototype.setPosAdaptive=function')
print(content[idx:idx+800])
