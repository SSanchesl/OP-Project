from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 640, "height": 1136})
    logs = []
    pg.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
    pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
    try:
        pg.goto("http://127.0.0.1:8127/index.html", timeout=8000, wait_until="commit")
    except Exception as e:
        print("goto issue (continuing anyway):", e)
    pg.wait_for_timeout(6000)

    html = pg.evaluate("document.getElementById('gameDiv').innerHTML")
    print("=== gameDiv innerHTML (first 2000 chars) ===")
    print(html[:2000])
    print()
    print("=== typeof egret / stage ===")
    print(pg.evaluate("typeof egret"))
    print(pg.evaluate("try { JSON.stringify(Object.keys(window).filter(k=>k.toLowerCase().includes('main')||k.toLowerCase().includes('game'))) } catch(e){ 'err:'+e }"))
    print("=== console/errors ===")
    for l in logs[-40:]:
        print(l)
    b.close()
