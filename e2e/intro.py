from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':360,'height':740},is_mobile=True)
    pg=ctx.new_page(); pg.goto('http://localhost:4173/'); pg.wait_for_timeout(700)
    assert pg.get_by_test_id('intro-splash').count()==1, 'intro should be visible at launch'
    pg.screenshot(path='/tmp/intro.png')
    pg.wait_for_timeout(2600)
    assert pg.get_by_test_id('intro-splash').count()==0, 'intro should be gone'
    assert pg.get_by_role('button',name='Open navigation menu').is_visible()
    print('INTRO OK'); b.close()
