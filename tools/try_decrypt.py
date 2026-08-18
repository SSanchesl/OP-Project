import sys, hashlib
from Crypto.Cipher import AES

KEY_STR = "5ce4b0e76844477"
candidates = {
    "raw16_nullpad": (KEY_STR.encode() + b"\x00"),
    "raw15_zeropad16": (KEY_STR.encode() + b"\x00" * (16 - len(KEY_STR))),
    "md5": hashlib.md5(KEY_STR.encode()).digest(),
    "sha256": hashlib.sha256(KEY_STR.encode()).digest(),
    "sha1_first16": hashlib.sha1(KEY_STR.encode()).digest()[:16],
    "utf8_asis": KEY_STR.encode(),  # 15 bytes, invalid for AES but try anyway skip
}

MAGIC_CHECKS = [
    (b"\x89PNG", "PNG"),
    (b"\xff\xd8\xff", "JPEG"),
    (b"RIFF", "WAV/RIFF"),
    (b"OggS", "OGG"),
    (b"PK\x03\x04", "ZIP"),
    (b"\x1f\x8b", "GZIP"),
    (b"{", "JSON-ish"),
    (b"[", "JSON-array-ish"),
    (b"<?xml", "XML"),
    (b"CocosStudio", "cocos"),
]

def try_file(path):
    data = open(path, "rb").read()
    print(f"\n### {path} ({len(data)} bytes) ###")
    for name, key in candidates.items():
        if len(key) not in (16, 24, 32):
            continue
        for mode_name, mode in [("ECB", AES.MODE_ECB)]:
            try:
                cipher = AES.new(key, mode)
                n = len(data) - (len(data) % 16)
                out = cipher.decrypt(data[:n])
                matched = None
                for magic, label in MAGIC_CHECKS:
                    if out[:len(magic)] == magic:
                        matched = label
                        break
                printable_ratio = sum(1 for b in out[:200] if 32 <= b < 127 or b in (9,10,13)) / max(1, len(out[:200]))
                if matched or printable_ratio > 0.85:
                    print(f"  [KEY={name} MODE={mode_name}] MATCH={matched} printable={printable_ratio:.2f} head={out[:32]!r}")
            except Exception as e:
                pass
        # also try CBC with IV = zeros and IV = first 16 bytes of key
        for iv_name, iv in [("iv_zero", b"\x00"*16)]:
            try:
                cipher = AES.new(key, AES.MODE_CBC, iv=iv)
                n = len(data) - (len(data) % 16)
                out = cipher.decrypt(data[:n])
                matched = None
                for magic, label in MAGIC_CHECKS:
                    if out[:len(magic)] == magic:
                        matched = label
                        break
                printable_ratio = sum(1 for b in out[:200] if 32 <= b < 127 or b in (9,10,13)) / max(1, len(out[:200]))
                if matched or printable_ratio > 0.85:
                    print(f"  [KEY={name} MODE=CBC/{iv_name}] MATCH={matched} printable={printable_ratio:.2f} head={out[:32]!r}")
            except Exception as e:
                pass
    print("  (se nada foi impresso acima, nenhuma combinacao testada bateu)")

for p in sys.argv[1:]:
    try_file(p)
