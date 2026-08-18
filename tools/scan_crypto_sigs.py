import sys

AES_SBOX = bytes([
    0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
    0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
])

XXTEA_DELTA = (0x9E3779B9).to_bytes(4, "little")
XXTEA_DELTA_BE = (0x9E3779B9).to_bytes(4, "big")

MD5_INIT = bytes.fromhex("0123456789abcdeffedcba9876543210")  # not exact, placeholder unused

def scan(path):
    data = open(path, "rb").read()
    print(f"=== {path} ({len(data)} bytes) ===")
    hits = []
    idx = data.find(AES_SBOX)
    while idx != -1:
        hits.append(("AES S-box", idx))
        idx = data.find(AES_SBOX, idx + 1)
    idx = data.find(XXTEA_DELTA)
    while idx != -1:
        hits.append(("XXTEA delta (LE)", idx))
        idx = data.find(XXTEA_DELTA, idx + 1)
    idx = data.find(XXTEA_DELTA_BE)
    while idx != -1:
        hits.append(("XXTEA delta (BE)", idx))
        idx = data.find(XXTEA_DELTA_BE, idx + 1)
    # zlib/gzip magic occurrences (in case it's just compressed, not encrypted)
    for magic, name in [(b"\x1f\x8b", "gzip"), (b"PK\x03\x04", "zip/apk"), (b"\x78\x9c", "zlib-default"), (b"\x78\x01", "zlib-low"), (b"\x78\xda", "zlib-best")]:
        c = data.count(magic)
        if c:
            hits.append((f"{name} magic occurrences", c))
    if not hits:
        print("  nenhuma assinatura encontrada")
    for h in hits:
        print(" ", h)
    print()

for p in sys.argv[1:]:
    scan(p)
