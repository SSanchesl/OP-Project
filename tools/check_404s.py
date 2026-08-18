from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 640, "height": 1136})
    bad = []
    def on_resp(r):
        if r.status >= 400:
            bad.append(f"{r.status} {r.url}")
    pg.on("response", on_resp)
    try:
        pg.goto("http://127.0.0.1:8127/index.html", timeout=8000, wait_until="commit")
    except Exception as e:
        pass
    pg.wait_for_timeout(8000)
    print(f"total bad responses: {len(bad)}")
    for b2 in bad[:30]:
        try:
            print(b2)
        except Exception:
            print(b2.encode('ascii', 'replace'))
    b.close()
