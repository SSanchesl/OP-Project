import os, shutil, json

SRC_ROOTS = [
    "decoded/base/assets/game",
    "decoded/config.zh/assets",
    "decoded/config.en/assets",
    "decoded/config.mdpi/assets",
]
DEST = "extracted_readable"

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
JPG_MAGIC = b"\xff\xd8\xff"

def is_valid_png(data):
    return data.startswith(PNG_MAGIC)

def is_valid_jpg(data):
    return data.startswith(JPG_MAGIC)

def is_texty(data, sample=512):
    chunk = data[:sample]
    try:
        chunk.decode("utf-8")
    except UnicodeDecodeError:
        return False
    printable = sum(1 for b in chunk if 32 <= b < 127 or b in (9, 10, 13))
    return len(chunk) > 0 and printable / len(chunk) > 0.9

count_png = count_jpg = count_text = 0
manifest = []

for root in SRC_ROOTS:
    if not os.path.isdir(root):
        continue
    for dirpath, dirs, files in os.walk(root):
        for fn in files:
            p = os.path.join(dirpath, fn)
            try:
                with open(p, "rb") as f:
                    data = f.read()
            except Exception:
                continue
            rel = os.path.relpath(p, root)
            kind = None
            if is_valid_png(data):
                kind = "png"
                count_png += 1
            elif is_valid_jpg(data):
                kind = "jpg"
                count_jpg += 1
            elif is_texty(data):
                kind = "text"
                count_text += 1
            if kind:
                dest_dir = os.path.join(DEST, kind, os.path.basename(root.rstrip("/\\")) if root != "decoded/base/assets/game" else "game", os.path.relpath(dirpath, root))
                os.makedirs(dest_dir, exist_ok=True)
                shutil.copy2(p, os.path.join(dest_dir, fn))
                manifest.append({"kind": kind, "src": p, "size": len(data)})

with open(os.path.join(DEST, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)

print(f"PNG validos: {count_png}")
print(f"JPG validos: {count_jpg}")
print(f"Texto/JSON legivel: {count_text}")
print(f"Total copiado: {len(manifest)}")
