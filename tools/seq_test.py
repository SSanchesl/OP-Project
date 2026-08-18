from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page()
    pg.goto('http://127.0.0.1:8127/test_sequential.html')
    pg.wait_for_function('window.__done === true', timeout=10000)
    log = pg.evaluate('window.__log')
    print(log)
    b.close()
