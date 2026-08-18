from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 640, "height": 1136})
    reqs = []
    def on_req(r):
        reqs.append(f"{r.method} {r.url}")
    pg.on("request", on_req)
    pg.on("requestfailed", lambda r: reqs.append(f"FAILED {r.url} - {r.failure}"))
    try:
        pg.goto("http://127.0.0.1:8127/index.html", timeout=8000, wait_until="commit")
    except Exception as e:
        print("goto issue:", e)
    pg.wait_for_timeout(8000)
    print(f"total requests: {len(reqs)}")
    # show non-localhost and failed ones, plus first/last few localhost
    for r in reqs:
        if "127.0.0.1" not in r or "FAILED" in r:
            print(r)
    print("--- localhost sample ---")
    local = [r for r in reqs if "127.0.0.1" in r]
    for r in local[:5]:
        print(r)
    print("...")
    for r in local[-15:]:
        print(r)
    b.close()
