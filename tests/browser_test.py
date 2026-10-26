"""End-to-end checks. Run python3 tests/browser_test.py; a temporary static server starts automatically.
Discord is intercepted in the browser; these tests never send to a live webhook.
"""
import json
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:4174/'
KEY = 'java-passo-passo-v1'

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        context = browser.new_context(viewport={'width':1440, 'height':1000}, device_scale_factor=1)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        deliveries = []
        first_error_failed = [False]
        def mock_discord(route):
            req = route.request
            headers = {'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'content-type', 'Access-Control-Allow-Methods':'POST, OPTIONS'}
            if req.method == 'OPTIONS':
                route.fulfill(status=204, headers=headers)
                return
            body = req.post_data_buffer.decode('utf-8',errors='replace')
            content_type = req.headers.get('content-type','')
            deliveries.append({'body':body,'type':content_type, 'url':req.url})
            if content_type.startswith('application/json') and not first_error_failed[0]:
                first_error_failed[0] = True
                route.fulfill(status=500, content_type='application/json', body='{"error":"test failure"}', headers=headers)
            else:
                route.fulfill(status=200, content_type='application/json', body='{"id":"mock-message"}', headers=headers)
        context.route('https://*.discord.com/api/webhooks/**', mock_discord)
        context.route('https://discord.com/api/webhooks/**', mock_discord)
        page.goto(BASE)
        expect(page.locator('.topic-card')).to_have_count(3)
        assert page.evaluate('window.JAVA_TOPICS.reduce((n,t)=>n+t.questions.length,0)') == 1000
        page.screenshot(path='/tmp/java-desktop.png', full_page=True)
        print('PASS dashboard: ten topics, 1000 questions')

        page.goto(BASE+'#studio')
        expect(page.locator('.topic-card')).to_have_count(10)
        page.goto(BASE+'#lezione/fondamenti')
        expect(page.locator('.lesson-card h2')).to_be_visible()
        for _ in range(10):
            done = page.locator('[data-action="lesson-done"]')
            if done.count():
                done.click()
                break
            page.get_by_role('button',name='Continua',exact=False).click()
        expect(page.locator('#quiz-form')).to_be_visible()
        assert page.locator('input[name="topic"]:checked').count() == 1
        assert 'fondamenti' in page.evaluate(f'JSON.parse(localStorage.getItem("{KEY}")).lessons')
        page.locator('input[name="minutes"][value="5"]').check()
        expect(page.locator('#planned-count')).to_have_text('4')
        print('PASS theory navigation, completion and single-topic setup')

        page.locator('[data-action="settings"]').first.click()
        page.locator('#nickname').fill('Studente test')
        page.locator('#webhook').fill('https://canary.discord.com/api/webhooks/123/test')
        page.locator('#discord-enabled').check()
        page.locator('#settings-form button[type="submit"]').click()
        page.locator('#begin-quiz').click()
        expect(page.locator('.answer-option')).to_have_count(4)
        def answer(correct):
            data=page.evaluate(f'''() => {{const s=JSON.parse(localStorage.getItem('{KEY}-active'));const id=s.deck[s.index].id;return window.JAVA_TOPICS.flatMap(t=>t.questions).find(q=>q.id===id);}}''')
            idx=data['answer'] if correct else (data['answer']+1)%4
            page.locator(f'[data-action="answer"][data-answer="{idx}"]').click()
            return data
        answer(True)
        expect(page.locator('.feedback.correct')).to_be_visible()
        expect(page.locator('.timer-wrap small')).to_have_text('in pausa')
        paused=page.locator('#timer').inner_text()
        page.wait_for_timeout(1300)
        assert page.locator('#timer').inner_text()==paused
        page.locator('[data-action="next"]').click()
        wrong=answer(False)
        expect(page.locator('.feedback.incorrect')).to_be_visible()
        expect(page.locator('.why-box')).to_be_visible()
        expect(page.locator('.explanation-steps').first).to_be_visible()
        page.wait_for_timeout(800)
        assert len(deliveries)==1
        payload=json.loads(deliveries[0]['body'])
        assert wrong['id'] in payload['content']
        assert 'Risultato provvisorio' in payload['content']
        assert payload['allowed_mentions']=={'parse':[]}
        assert page.evaluate(f'JSON.parse(sessionStorage.getItem("{KEY}-outbox"))[0].status')=='failed'
        page.locator('[data-action="next"]').click()
        page.locator('[data-action="skip"]').click()
        expect(page.get_by_role('heading',name='L’hai lasciata in bianco.',exact=False)).to_be_visible()
        page.once('dialog', lambda dialog:dialog.accept())
        page.locator('[data-action="end-quiz"]').click()
        expect(page.locator('.grade')).to_contain_text('2,5')
        report=page.evaluate(f'JSON.parse(localStorage.getItem("{KEY}")).history.at(-1)')
        assert (report['correct'],report['wrong'],report['omitted'],report['total'])==(1,1,2,4)
        expect(page.locator('.review-question')).to_have_count(4)
        page.locator('.review-question').nth(1).locator(':scope > summary').click()
        expect(page.locator('.review-question').nth(1).locator('.why-box')).to_be_visible()
        page.wait_for_timeout(800)
        assert any('multipart/form-data' in d['type'] for d in deliveries)
        multipart=next(d['body'] for d in deliveries if 'multipart/form-data' in d['type'])
        assert 'java-p1-resoconto.json' in multipart and wrong['id'] in multipart and 'Studente test' in multipart
        page.locator('[data-action="retry-discord"]').click()
        page.wait_for_function(f'JSON.parse(sessionStorage.getItem("{KEY}-outbox")).every(n=>n.status==="sent")')
        assert len(deliveries)==3
        assert deliveries[0]['body']==deliveries[-1]['body']
        page.screenshot(path='/tmp/java-results.png',full_page=True)
        print('PASS correct/wrong/skip, detailed feedback, timer pause, grading, omissions and review')
        print('PASS mocked Discord error payload, failed request, final multipart report and retry')
        with page.expect_download() as download_info:
            page.locator('[data-action="download"]').click()
        download=download_info.value
        download.save_as('/tmp/java-report.txt')
        text=Path('/tmp/java-report.txt').read_text()
        assert 'Studente test' in text and 'RESOCONTO' in text
        assert 'Voto: 2.5/10' in text
        page.goto(BASE+'#progressi')
        expect(page.locator('.history-row')).to_have_count(1)
        page.reload()
        expect(page.locator('.history-row')).to_have_count(1)
        print('PASS downloadable report and history persistence after reload')
        page.goto(BASE+'#materiali')
        for href in page.locator('.material-card a[download]').evaluate_all('(links)=>links.map(a=>a.href)'):
            response=page.request.get(href)
            assert response.status==200 and response.body().startswith(b'%PDF-')
        print('PASS both original PDFs return valid PDF responses')

        # A 15 minute mixed quiz has 12 questions and covers all 10 modules.
        page.goto(BASE+'#quiz')
        page.locator('[data-action="select-all"]').click()
        if page.locator('input[name="topic"]:checked').count()==0:
            page.locator('[data-action="select-all"]').click()
        page.locator('input[name="minutes"][value="15"]').check()
        expect(page.locator('#planned-count')).to_have_text('12')
        assert page.locator('input[name="topic"]:checked').count()==10
        page.locator('#begin-quiz').click()
        active=page.evaluate(f'JSON.parse(localStorage.getItem("{KEY}-active"))')
        assert len(active['deck'])==12
        ids=page.evaluate(f'''()=>{{const d=JSON.parse(localStorage.getItem('{KEY}-active')).deck;return d.map(x=>window.JAVA_TOPICS.find(t=>t.questions.some(q=>q.id===x.id)).id)}}''')
        assert len(set(ids))==10
        # Resume is retained after reload; expiration generates omitted results.
        page.reload()
        expect(page.locator('.answer-option')).to_have_count(4)
        page.add_init_script(f'''const k='{KEY}-active',s=JSON.parse(localStorage.getItem(k));if(s){{s.deadline=Date.now()-1000;localStorage.setItem(k,JSON.stringify(s));}}''')
        page.reload()
        expect(page.locator('.grade')).to_be_visible(timeout=5000)
        expired=page.evaluate(f'JSON.parse(localStorage.getItem("{KEY}")).history.at(-1)')
        assert expired['reason']=='tempo scaduto' and expired['omitted']==12 and expired['grade']==1
        print('PASS mixed quiz coverage, active-session reload and timer expiry')

        for width in (390,360):
            page.set_viewport_size({'width':width,'height':844})
            for route in ('#home','#studio','#lezione/fondamenti','#quiz','#progressi','#materiali','#risultato/'+report['id']):
                page.goto(BASE+route)
                page.wait_for_timeout(100)
                dimensions=page.evaluate('({scroll:document.documentElement.scrollWidth,width:innerWidth})')
                assert dimensions['scroll']<=dimensions['width'], (width,route,dimensions)
            page.goto(BASE+'#quiz')
            page.locator('#begin-quiz').click()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            answer(True)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.once('dialog', lambda dialog:dialog.accept())
            page.locator('[data-action="end-quiz"]').click()
            page.goto(BASE+'#home')
            page.screenshot(path=f'/tmp/java-mobile-{width}.png',full_page=True)
        # Queue a final result during the 600ms gap after a successful error delivery.
        page.set_viewport_size({'width':390,'height':844})
        page.goto(BASE+'#quiz')
        page.locator('input[name="minutes"][value="5"]').check()
        page.locator('#begin-quiz').click()
        answer(False)
        page.wait_for_function(f'JSON.parse(sessionStorage.getItem("{KEY}-outbox")).at(-1).status==="sent"')
        page.once('dialog', lambda dialog:dialog.accept())
        page.locator('[data-action="end-quiz"]').click()
        page.wait_for_function(f'JSON.parse(sessionStorage.getItem("{KEY}-outbox")).every(n=>n.status==="sent")')
        print('PASS Discord queue: result queued during delivery pause is delivered')
        assert not errors, errors
        print('PASS mobile 390px/360px: all main screens without horizontal page overflow')
        print('PASS no uncaught JavaScript errors')
        browser.close()

if __name__=='__main__':
    class QuietHandler(SimpleHTTPRequestHandler):
        def log_message(self, *_args):
            pass
    root = Path(__file__).resolve().parents[1]
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(root)))
    BASE = f'http://127.0.0.1:{server.server_port}/'
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        run()
    finally:
        server.shutdown()
        server.server_close()
