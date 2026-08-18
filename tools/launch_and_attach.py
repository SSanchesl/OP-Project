import subprocess, time, sys, os, frida

ADB = ["adb"]
OUTDIR = "../extracted_readable/captured_memory"
os.makedirs(OUTDIR, exist_ok=True)
counts = {"png": 0, "jpg": 0}

def trim_png(buf):
    # don't trust a naive search; save raw and let PIL find the real boundary later
    return buf

def trim_jpg(buf):
    # don't trust a naive search; save raw and let PIL find the real boundary later
    return buf

def sh(*args):
    return subprocess.run([*ADB, *args], capture_output=True, text=True)

print("Forcando parada do app...")
sh("shell", "am", "force-stop", "com.epi.voyage")
time.sleep(1)

print("Reabrindo o forward da porta...")
sh("forward", "tcp:27042", "tcp:27042")

print("Iniciando o app...")
sh("shell", "am", "start", "-n", "com.epi.voyage/com.zhuhuan.game.LaunchActivity")

dev = frida.get_device_manager().add_remote_device('127.0.0.1:27042')

session = None
start = time.time()
while time.time() - start < 15:
    try:
        procs = dev.enumerate_processes()
        print("Processos visiveis:", procs)
        session = dev.attach(procs[0].pid if procs else "Gadget")
        break
    except Exception as e:
        print("  ainda nao conectou:", e)
        time.sleep(0.4)

if session is None:
    print("FALHOU: nao conseguiu anexar a tempo")
    sys.exit(1)

print("CONECTADO:", session)
with open("hook_script.js", "r", encoding="utf-8") as f:
    script_src = f.read()
script = session.create_script(script_src)

def on_message(message, data):
    if message.get("type") != "send":
        print("[MSG]", message)
        return
    payload = message.get("payload", {})
    kind = payload.get("kind")
    if kind == "log":
        print("[LOG]", payload.get("msg"))
    elif kind == "open":
        print("[OPEN]", payload.get("func"), payload.get("path"), "fd=", payload.get("fd"))
    elif kind == "png" and data:
        trimmed = trim_png(data)
        counts["png"] += 1
        path = os.path.join(OUTDIR, f"dump_{counts['png']:04d}_{payload.get('address')}.png")
        with open(path, "wb") as f:
            f.write(trimmed)
        print(f"[PNG SALVO] {path} ({len(trimmed)} bytes, bruto {len(data)})")
    elif kind == "jpg" and data:
        trimmed = trim_jpg(data)
        counts["jpg"] += 1
        path = os.path.join(OUTDIR, f"dump_{counts['jpg']:04d}_{payload.get('address')}.jpg")
        with open(path, "wb") as f:
            f.write(trimmed)
        print(f"[JPG SALVO] {path} ({len(trimmed)} bytes, bruto {len(data)})")
    elif kind == "error":
        print("[ERR]", payload)

script.on("message", on_message)
script.load()
print("Script carregado. Deixando rodar por 180s (navegue no jogo se possivel)...")
time.sleep(180)
print("fim. Total capturado:", counts)
