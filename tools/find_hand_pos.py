from PIL import Image

im = Image.open(r'c:\Users\maste\Documents\GitHub\Piece-clon\tools\screenshot_after_hollow_fix.png')

# Let's find skin tone pixels (high R, medium G, low B, e.g. R > 200, 140 < G < 190, 100 < B < 150)
skin = []
for y in range(400, 800):
    for x in range(100, 700):
        r, g, b = im.getpixel((x, y))[:3]
        if r > 220 and 160 < g < 200 and 130 < b < 170:
            skin.append((x, y))

if skin:
    xs = [p[0] for p in skin]
    ys = [p[1] for p in skin]
    print(f'Skin region: x in [{min(xs)}, {max(xs)}], y in [{min(ys)}, {max(ys)}]')
    print(f'Skin center: x = {sum(xs)//len(xs)}, y = {sum(ys)//len(ys)}')
else:
    print('No skin found')
