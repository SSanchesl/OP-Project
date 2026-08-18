import os, sys, json, zipfile, io
sys.path.insert(0, os.path.dirname(__file__))
from decrypt_onepiece_xxtea import process as xxtea_process

SRC_ROOTS = [
    "decoded/base/assets/game",
]
OUT_RAW = "decrypted_all/raw"          # every decrypted file, flat-ish, by original obfuscated path
OUT_FINAL = "decrypted_all/named"      # reorganized using the real path mapping, when known
MANIFEST_PATH = "decrypted_all/manifest.json"

MAGIC_MAP = [
    (b"\x89PNG\r\n\x1a\n", "png"),
    (b"\xff\xd8\xff", "jpg"),
    (b"OggS", "ogg"),
    (b"ID3", "mp3"),
    (b"RIFF", "wav"),
    (b"PK\x03\x04", "zip"),
    (b"{", "json"),
    (b"[", "json"),
]

def sniff(data):
    for magic, kind in MAGIC_MAP:
        if data[:len(magic)] == magic:
            return kind
    # mp3 frames often start with 0xFFFB / 0xFFF3 etc (no ID3 tag)
    if len(data) > 2 and data[0] == 0xFF and (data[1] & 0xE0) == 0xE0:
        return "mp3"
    return "bin"

def main():
    os.makedirs(OUT_RAW, exist_ok=True)
    os.makedirs(OUT_FINAL, exist_ok=True)

    manifest = []
    name_map = {}  # obfuscated relative path (as referenced in mapping json) -> real path
    all_files = []
    for root in SRC_ROOTS:
        for dirpath, dirs, files in os.walk(root):
            for fn in files:
                p = os.path.join(dirpath, fn)
                all_files.append(p)

    print(f"Total de arquivos a processar: {len(all_files)}")

    results = {"ok": 0, "fail": 0, "by_kind": {}}
    decrypted_cache = {}  # path -> (data, kind)

    for p in all_files:
        try:
            raw = open(p, "rb").read()
        except Exception as e:
            continue
        dec = xxtea_process(raw)
        if dec is None:
            results["fail"] += 1
            continue
        kind = sniff(dec)
        results["ok"] += 1
        results["by_kind"][kind] = results["by_kind"].get(kind, 0) + 1
        decrypted_cache[p] = (dec, kind)

        rel = os.path.relpath(p, "decoded/base/assets/game")
        out_path = os.path.join(OUT_RAW, rel) + "." + kind
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with open(out_path, "wb") as f:
            f.write(dec)
        manifest.append({"src": p, "kind": kind, "size": len(dec)})

        if kind == "json":
            try:
                obj = json.loads(dec.decode("utf-8"))
                if isinstance(obj, dict):
                    # this looks like a real_path -> obfuscated_path map
                    added = 0
                    for real_path, obf_path in obj.items():
                        if isinstance(obf_path, str) and obf_path.startswith("/"):
                            name_map[obf_path.lstrip("/")] = real_path.lstrip("/")
                            added += 1
                    if added:
                        print(f"  mapping table found in {p}: +{added} entries")
            except Exception:
                pass

    print(f"\nDescriptografados: {results['ok']} / falharam: {results['fail']}")
    print("Por tipo:", results["by_kind"])
    print(f"Tabela de nomes reais coletada: {len(name_map)} entradas")

    # second pass: reorganize using name_map
    renamed = 0
    for p, (dec, kind) in decrypted_cache.items():
        rel = os.path.relpath(p, "decoded/base/assets/game").replace("\\", "/")
        # the mapping keys are like "rock_safety_tamers/xxx.png" (no leading resource/assets/)
        candidates = [rel]
        if rel.startswith("resource/assets/"):
            candidates.append(rel[len("resource/assets/"):])
        real_path = None
        for c in candidates:
            if c in name_map:
                real_path = name_map[c]
                break
        if real_path:
            out_path = os.path.join(OUT_FINAL, real_path.lstrip("/"))
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            with open(out_path, "wb") as f:
                f.write(dec)
            renamed += 1

    print(f"Reorganizados com nome real: {renamed}")

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump({"files": manifest, "name_map_size": len(name_map), "stats": results}, f, indent=2, ensure_ascii=False)

    with open("decrypted_all/name_map.json", "w", encoding="utf-8") as f:
        json.dump(name_map, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    main()
