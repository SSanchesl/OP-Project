from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 640, "height": 1136})

    logs = []
    def on_console(msg):
        logs.append(f"[{msg.type}] {msg.text}")
    page.on("console", on_console)
    page.on("pageerror", lambda exc: logs.append(f"[pageerror] {exc}"))

    responses = []
    page.on("response", lambda r: responses.append(f"{r.status} {r.url}") if r.url.endswith('.js') else None)

    try:
        page.goto("http://127.0.0.1:8127/index.html", timeout=8000, wait_until="commit")
    except Exception as e:
        print("goto issue (continuing anyway):", e)
    page.wait_for_timeout(40000)

    page.screenshot(path="local_preview_screenshot.png")

    print("=== JS RESPONSES ===")
    for r in responses:
        print(r)

    print("=== CONSOLE LOGS (last 20, safe) ===")
    for l in logs[-20:]:
        try:
            print(l.encode('ascii', 'replace').decode())
        except Exception:
            pass

    browser.close()
