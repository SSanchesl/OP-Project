import os
import sys
import gzip
import shutil

sys.path.insert(0, os.path.dirname(__file__))
from decrypt_onepiece_xxtea import process as xxtea_process

# Os 423 JSONs de configuracao em local_preview/resource/json/ (servidos ao
# cliente Egret em runtime) ainda estavam criptografados com o wrapper
# "onepieceencrypts" (a sessao anterior nao tinha de fato aplicado a
# descriptografia a esses arquivos, so a copiado). Cada um, depois de
# remover essa camada, e um blob gzip contendo o JSON real.
JSON_DIR = os.path.join(os.path.dirname(__file__), "..", "local_preview", "resource", "json")
BACKUP_DIR = os.path.join(os.path.dirname(__file__), "..", "local_preview", "resource", "json_encrypted_backup")


def main():
    os.makedirs(BACKUP_DIR, exist_ok=True)
    files = sorted(f for f in os.listdir(JSON_DIR) if f.endswith(".json"))
    ok, already_plain, failed = 0, 0, []

    for fn in files:
        path = os.path.join(JSON_DIR, fn)
        raw = open(path, "rb").read()

        is_wrapped = len(raw) >= 48 and raw[16:32] == b"onepieceencrypts"
        if not is_wrapped and raw[:1] in (b"{", b"["):
            already_plain += 1
            continue

        dec = xxtea_process(raw)
        if dec is None:
            failed.append(fn)
            continue

        if dec[:2] == b"\x1f\x8b":
            try:
                dec = gzip.decompress(dec)
            except Exception as e:
                failed.append(fn + f" (gzip error: {e})")
                continue

        if not dec[:1] in (b"{", b"["):
            failed.append(fn + " (resultado nao parece JSON)")
            continue

        shutil.copy2(path, os.path.join(BACKUP_DIR, fn))
        with open(path, "wb") as f:
            f.write(dec)
        ok += 1

    print(f"Descriptografados agora: {ok}")
    print(f"Ja estavam em texto puro: {already_plain}")
    print(f"Falharam ({len(failed)}):")
    for f in failed:
        print("  -", f)


if __name__ == "__main__":
    main()
