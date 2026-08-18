import sys, struct

MASK = 0xFFFFFFFF
DELTA = 2654435769  # 0x9E3779B9

def bytes2longs(data, pad):
    length = len(data)
    n = 2 if length < 4 else (length >> 2) + (1 if pad else 0)
    arr = [0] * n
    for i in range(length):
        i2 = i >> 2
        arr[i2] = (arr[i2] | ((data[i] & 0xFF) << ((i & 3) << 3))) & MASK
    if pad:
        i3 = length & 3
        i4 = 4 - i3
        if length < 4:
            i4 = 8 - i3
        for i5 in range(length, length + i4):
            i6 = i5 >> 2
            arr[i6] = (arr[i6] | (i4 << ((i5 & 3) << 3))) & MASK
    return arr

def longs2bytes(arr, strip):
    length = len(arr)
    n = length * 4
    out = bytearray(n)
    for i in range(length):
        j = arr[i] & MASK
        out[i*4]   = j & 0xFF
        out[i*4+1] = (j >> 8) & 0xFF
        out[i*4+2] = (j >> 16) & 0xFF
        out[i*4+3] = (j >> 24) & 0xFF
    if strip:
        cut = out[n-1]
        return bytes(out[:n - cut])
    return bytes(out)

def mx(s, y, z, p, e, key):
    part1 = ((y ^ s) & MASK)
    idx = (p & 3) ^ e
    part2 = (z ^ key[idx]) & MASK
    left = (part1 + part2) & MASK

    shr5 = (z >> 5) & MASK
    shl2 = (y << 2) & MASK
    t1 = (shr5 ^ shl2) & MASK

    shl4 = (z << 4) & MASK
    shr3 = (y >> 3) & MASK
    t2 = (shl4 ^ shr3) & MASK

    right = (t1 + t2) & MASK
    return (left ^ right) & MASK

def decrypt_int_array(v, key, rounds_param):
    n = len(v)
    floor = rounds_param if rounds_param != 0 else int((52 // n) + 6)
    s = (floor * DELTA) & MASK
    y = v[0]
    while True:
        e = (s >> 2) & 3
        p = n - 1
        z = y  # carries into the loop as "y" for mx
        cur = p
        while cur > 0:
            prevIdx = cur - 1
            z = (v[cur] - mx(s, z, v[prevIdx], cur, e, key)) & MASK
            v[cur] = z
            cur = prevIdx
        y = (v[0] - mx(s, z, v[n-1], cur, e, key)) & MASK
        v[0] = y
        s = (s - DELTA) & MASK
        floor -= 1
        if floor <= 0:
            break
    return v

def xor_with_decryptk(data16):
    key = b"onepiecedecryptk"
    return bytes(b ^ key[i % len(key)] for i, b in enumerate(data16))

def process(raw):
    if len(raw) < 48:
        return None
    magic = raw[16:32]
    if magic != b"onepieceencrypts":
        return None
    key_raw = raw[32:48]
    key_bytes = xor_with_decryptk(key_raw)
    key_longs = bytes2longs(key_bytes, False)
    data_longs = bytes2longs(raw[48:], False)
    decrypted_longs = decrypt_int_array(data_longs, key_longs, 1)
    return longs2bytes(decrypted_longs, True)

if __name__ == "__main__":
    inpath = sys.argv[1]
    outpath = sys.argv[2] if len(sys.argv) > 2 else inpath + ".dec"
    raw = open(inpath, "rb").read()
    result = process(raw)
    if result is None:
        print("Nao reconhecido como onepieceencrypts (ou arquivo pequeno demais)")
        sys.exit(1)
    with open(outpath, "wb") as f:
        f.write(result)
    print(f"OK: {len(result)} bytes -> {outpath}")
    print("head:", result[:16])
