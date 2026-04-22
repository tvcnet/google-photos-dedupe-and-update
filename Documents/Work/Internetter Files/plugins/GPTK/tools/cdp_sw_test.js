const { execSync } = require('child_process');
const WebSocket = require('/usr/local/lib/node_modules/@qwen-code/qwen-code/node_modules/ws');

console.log('Reloading extension...');
execSync(`osascript -e 'tell application "Google Chrome" to repeat with w in windows \n repeat with tab_ in tabs of w \n if URL of tab_ contains "onogdoichnabfchbihghdpbbnfpmhege" and URL of tab_ contains "app.html" then \n execute tab_ javascript "chrome.runtime.reload();" \n end if \n end repeat \n end repeat'`);

setTimeout(() => {
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
            console.log('Connected to CDP — monitoring for 45 seconds...');
            send('Runtime.enable', {});

            // Wait for page to load, then set up and click AI Describe
            setTimeout(() => {
                // Use Runtime.evaluate with world: 'MAIN' to run in MAIN world
                // This ensures filter state is set correctly for GPTK
                send('Runtime.evaluate', {
                    expression: `(function(){
                        document.getElementById('albums')?.click();
                    })()`,
                    contextId: undefined
                }, () => {});
                
                setTimeout(() => {
                    send('Runtime.evaluate', {
                        expression: `(function(){
                            document.querySelector('.refresh-albums')?.click();
                        })()`,
                    }, () => {});
                    
                    setTimeout(() => {
                        send('Runtime.evaluate', {
                            expression: `(function(){
                                const sel = document.getElementById('existingAlbum');
                                const opts = Array.from(sel?.options||[]).filter(o=>o.value);
                                if(opts[0]){ sel.value=opts[0].value; sel.dispatchEvent(new Event('change',{bubbles:true})); }
                                const fsel = document.querySelector('select[name="albumsInclude"]');
                                const fopts = Array.from(fsel?.options||[]).filter(o=>o.value);
                                if(fopts[0]){ fopts[0].selected=true; fsel.dispatchEvent(new Event('change',{bubbles:true})); }
                                console.log('GPTK_TEST: Filter set, albumsInclude options:', fopts.length);
                                return 'filters set';
                            })()`,
                        }, (r) => { console.log('Filters:', JSON.stringify(r)); });
                        
                        setTimeout(() => {
                            send('Runtime.evaluate', {
                                expression: `(function(){
                                    const btn = document.getElementById('aiDescribe');
                                    console.log('GPTK_TEST: AI Describe button disabled:', btn?.disabled, 'class:', btn?.className);
                                    btn?.click();
                                    return 'clicked';
                                })()`,
                            }, (r) => { console.log('AI Describe click:', JSON.stringify(r)); });
                            
                            setTimeout(() => {
                                send('Runtime.evaluate', {
                                    expression: `(function(){
                                        const btns = document.querySelectorAll('.gptk-confirm-actions button');
                                        console.log('GPTK_TEST: Modal buttons:', btns.length, Array.from(btns).map(b=>b.textContent.trim()).join(','));
                                        btns.forEach(b => { if(b.textContent.trim()==='OK') b.click(); });
                                        return btns.length;
                                    })()`,
                                }, (r) => { console.log('Modal OK click result:', JSON.stringify(r)); });
                            }, 1500);
                        }, 500);
                    }, 4500);
                }, 500);
            }, 3000);
        });

        setTimeout(() => {
            // Get final log
            send('Runtime.evaluate', {
                expression: `document.getElementById('logArea')?.innerText?.slice(-1500)||''`,
            }, (r) => {
                console.log('\n=== FINAL LOG ===\n', r?.result?.value || '');
                ws.close();
                process.exit(0);
            });
        }, 45000);

        ws.on('message', (data) => {
            const msg = JSON.parse(data);
            if (msg.id && pending[msg.id]) {
                pending[msg.id](msg.result);
                delete pending[msg.id];
            }
            if (msg.method === 'Runtime.consoleAPICalled') {
                const args = msg.params.args.map(a => a.value || a.description || '').join(' ');
                if (args.includes('GPD') || args.includes('GPTK') || args.includes('AI Describe') || args.includes('Bridge') || args.includes('GPTK_TEST') || args.includes('fetch') || args.includes('image')) {
                    console.log('[CONSOLE]', new Date().toISOString().slice(11,19), args.slice(0, 300));
                }
            }
            if (msg.method === 'Runtime.exceptionThrown') {
                const det = msg.params.exceptionDetails;
                console.log('[ERROR]', det.text, det.exception?.description?.slice(0,200) || '');
            }
        });

        ws.on('error', (e) => console.log('WS error:', e.message));

        function send(method, params, cb) {
            const id = msgId++;
            if (cb) pending[id] = cb;
            ws.send(JSON.stringify({ id, method, params }));
        }

    }, 9000);
}, 3000);
