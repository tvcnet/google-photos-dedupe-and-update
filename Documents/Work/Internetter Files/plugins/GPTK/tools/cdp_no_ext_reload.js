const { execSync } = require('child_process');
const WebSocket = require('/usr/local/lib/node_modules/@qwen-code/qwen-code/node_modules/ws');

console.log('Reloading GP tab...');
execSync(`osascript -e 'tell application "Google Chrome" to repeat with w in windows \n repeat with tab_ in tabs of w \n if URL of tab_ contains "photos.google.com/" and URL of tab_ does not contain "serviceworker" then \n reload tab_ \n end if \n end repeat \n end repeat'`);

setTimeout(() => {
    const tabs = JSON.parse(execSync('curl -s http://localhost:9222/json/list').toString());
    const gpTab = tabs.find(t => t.url === 'https://photos.google.com/');
    if (!gpTab) { console.log('No GP tab found'); process.exit(1); }

    const ws = new WebSocket(gpTab.webSocketDebuggerUrl);
    let msgId = 1;
    const pending = {};

    ws.on('open', () => {
        console.log('Connected — monitoring for 50 seconds...');
        send('Runtime.enable', {});

        setTimeout(() => {
            send('Runtime.evaluate', { expression: `document.getElementById('albums')?.click(); 'ok'` }, () => {});
            setTimeout(() => {
                send('Runtime.evaluate', { expression: `document.querySelector('.refresh-albums')?.click(); 'ok'` }, () => {});
                setTimeout(() => {
                    send('Runtime.evaluate', { expression: `(function(){
                        const sel = document.getElementById('existingAlbum');
                        const opts = Array.from(sel?.options||[]).filter(o=>o.value);
                        if(opts[0]){ sel.value=opts[0].value; sel.dispatchEvent(new Event('change',{bubbles:true})); }
                        const fsel = document.querySelector('select[name="albumsInclude"]');
                        const fopts = Array.from(fsel?.options||[]).filter(o=>o.value);
                        if(fopts[0]){ fopts[0].selected=true; fsel.dispatchEvent(new Event('change',{bubbles:true})); }
                        return 'filters:' + fopts.length;
                    })()` }, (r) => console.log('Filters:', r?.value));
                    setTimeout(() => {
                        send('Runtime.evaluate', { expression: `document.getElementById('aiDescribe')?.click(); 'clicked'` }, () => {});
                        setTimeout(() => {
                            send('Runtime.evaluate', { expression: `(function(){
                                const btns = document.querySelectorAll('.gptk-confirm-actions button');
                                btns.forEach(b => { if(b.textContent.trim()==='OK') b.click(); });
                                return 'modal btns:' + btns.length;
                            })()` }, (r) => console.log('Modal:', r?.value));
                        }, 1500);
                    }, 500);
                }, 4500);
            }, 500);
        }, 3000);
    });

    setTimeout(() => {
        send('Runtime.evaluate', { expression: `document.getElementById('logArea')?.innerText?.slice(-2000)||''` }, (r) => {
            console.log('\n=== FINAL LOG ===\n', r?.value || '(empty)');
            ws.close();
            process.exit(0);
        });
    }, 50000);

    ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.id && pending[msg.id]) { pending[msg.id](msg.result); delete pending[msg.id]; }
        if (msg.method === 'Runtime.consoleAPICalled') {
            const args = msg.params.args.map(a => a.value || a.description || '').join(' ');
            if (args.includes('GPD') || args.includes('GPTK') || args.includes('AI Describe') || args.includes('Image bridge') || args.includes('image bridge') || args.includes('fetch') || args.includes('Gemini')) {
                console.log('[LOG]', new Date().toISOString().slice(11,19), args.slice(0, 300));
            }
        }
        if (msg.method === 'Runtime.exceptionThrown') {
            const det = msg.params.exceptionDetails;
            console.log('[ERR]', det.exception?.description?.slice(0,200) || det.text);
        }
    });

    ws.on('error', e => console.log('WS error:', e.message));

    function send(method, params, cb) {
        const id = msgId++;
        if (cb) pending[id] = cb;
        ws.send(JSON.stringify({ id, method, params }));
    }

}, 7000);
