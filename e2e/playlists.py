"""Browser e2e (mobile viewport) for playlist creation and multi-select. Run: vite preview on :4173, then python3 e2e/playlists.py"""
import re, sys
from playwright.sync_api import sync_playwright

def nav(pg, label):
    pg.click('[aria-label="Open navigation menu"]'); pg.wait_for_timeout(500)
    pg.get_by_text(label, exact=True).first.click(); pg.wait_for_timeout(700)

def count_of(pg, name):
    card = pg.locator('div.glass-panel', has=pg.get_by_text(name, exact=True)).last
    return card.inner_text()

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 360, 'height': 740}, has_touch=True, is_mobile=True)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:4173/'); pg.wait_for_timeout(1800)

    # multi-select -> create playlist inline
    pg.get_by_role('button', name='Pilih', exact=True).click()
    rows = pg.locator('button[aria-pressed]').filter(has=pg.locator('.font-outrun'))
    assert rows.count() >= 3, rows.count()
    for i in range(3): rows.nth(i).click()
    assert '3 dipilih' in pg.get_by_test_id('select-bar').inner_text()
    pg.get_by_role('button', name='Tambah ke Daftar Putar', exact=True).click(); pg.wait_for_timeout(400)
    pg.fill('#new-playlist-inline', 'Roadtrip')
    pg.get_by_role('button', name='Buat & Tambahkan').click(); pg.wait_for_timeout(600)
    assert pg.get_by_role('dialog').count() == 0, 'picker should close'

    nav(pg, 'Daftar Putar')
    assert '3 lagu' in count_of(pg, 'Roadtrip'), count_of(pg, 'Roadtrip')

    # persistence across reload
    pg.reload(); pg.wait_for_timeout(1800); nav(pg, 'Daftar Putar')
    assert pg.get_by_text('Roadtrip', exact=True).count() == 1

    # create from the playlists page
    pg.fill('input[placeholder^="Nama daftar putar"]', 'Santai')
    pg.get_by_role('button', name='Buat Daftar Putar').click(); pg.wait_for_timeout(500)
    assert pg.get_by_text('Santai', exact=True).count() == 1
    assert pg.locator('input[placeholder^="Nama daftar putar"]').input_value() == ''

    # add songs modal inside a playlist
    pg.get_by_text('Santai', exact=True).first.click(); pg.wait_for_timeout(400)
    pg.get_by_role('button', name='Tambah Lagu').click(); pg.wait_for_timeout(300)
    dlg = pg.get_by_role('dialog')
    items = dlg.locator('button[aria-pressed]')
    assert items.count() >= 2
    items.nth(0).click(); items.nth(1).click()
    assert '2 dipilih' in dlg.inner_text()
    dlg.get_by_role('button', name='Tambahkan').click(); pg.wait_for_timeout(500)
    assert '2 lagu' in pg.locator('div.glass-panel').first.inner_text() or '2 lagu' in pg.inner_text('body')
    # tracks already in the playlist are disabled when reopening
    pg.get_by_role('button', name='Tambah Lagu').click(); pg.wait_for_timeout(300)
    assert pg.get_by_role('dialog').locator('button[disabled]').count() >= 2
    print('E2E OK', errs)
    assert not errs, errs
    b.close()
