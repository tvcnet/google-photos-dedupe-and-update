const { execSync } = require('child_process');
const WebSocket = require('/usr/local/lib/node_modules/@qwen-code/qwen-code/node_modules/ws');

// Reload extension first
console.log('Reloading extension...');
execSync(`osascript -e 'tell application "Google Chrome" to repeat with w in windows \n repeat with tab_ in tabs of w \n if URL of tab_ contains "onogdoichnabfchbihghdpbbnfpmhege" and URL of tab_ contains "app.html" then \n execute tab_ javascript "chrome.runtime.reload();" \n end if \n end repeat \n end repeat'`);

// Wait for reload
setTimeout(() => {
    // Reload GP tab
    console.log('Reloading GP tab...');
    execSync(`osascript -e 'tell application "Google Chrome" to repeat with w in windows \n repeat with tab_ in tabs of w \n if URL of tab_ contains "photos.google.com/" and URL of tab_ does not contain "serviceworker" then \n reload tab_ \n end if \n end repeat \n end repeat'`);

    setTimeout(() => {
        // Get fresh tab info
        const tabs = JSON.parse(execSync('curl -s http://localhost:9222/json/list').toString());
        const gpTab = tabs.find(t => t.url === 'https://photos.google.com/');
        if (!gpTab) { console.log('No GP tab found'); process.exit(1); }

        const ws = new WebSocket(gpTab.webSocketDebuggerUrl);
        let msgId = 1;
        const pending = {};

        ws.on('open', () => {
            console.log('Connected to CDP');
            send('Runtime.enable', {});

            // Wait for page to fully load, then trigger AI Describe
            setTimeout(() => {
                const setupJs = `(function(){
                    document.getElementById('albums')?.click();
                    setTimeout(() => {
                        document.querySelector('.refresh-albums')?.click();
                        setTimeout(() => {
                            const sel = document.getElementById('existingAlbum');
                            const opts = Array.from(sel?.options||[]).filter(o=>o.value);
                            if(opts[0]){ sel.value=opts[0].value; sel.dispatchEvent(new Event('change',{bubbles:true})); }
                            const fsel = document.querySelector('select[name="albumsInclude"]');
                            const fopts = Array.from(fsel?.options||[]).filter(o=>o.value);
                            if(fopts[0]){ fopts[0].selected=true; fsel.dispatchEvent(new Event('change',{bubbles:true})); }
                            setTimeout(() => {
                                console.log('GPTK_TEST: Clicking AI Describe');
                                document.getElementById('aiDescribe')?.click();
                                setTimeout(() => {
                                    const btns = document.querySelectorAll('.gptk-confirm-actions button');
                                    console.log('GPTK_TEST: Modal buttons found:', btns.length);
                                    btns.forEach(b => { 
                                        console.log('GPTK_TEST: Button:', b.textContent.trim());
                                        if(b.textContent.trim()==='OK') b.click(); 
                                    });
                                }, 1500);
                            }, 4500);
                        }, 500);
                    }, 500);
                })()`;

                send('Runtime.evaluate', { expression: setupJs }, (r) => {
                    console.log('Setup triggered');
                });
            }, 3000);

            // Close after 35 seconds
            setTimeout(() => {
                console.log('Done monitoring');
                ws.close();
                process.exit(0);
            }, 35000);
        });

        ws.on('message', (data) => {
            const msg = JSON.parse(data);
            if (msg.id && pending[msg.id]) {
                pending[msg.id](msg.result);
                delete pending[msg.id];
            }
            if (msg.method === 'Runtime.consoleAPICalled') {
                const args = msg.params.args.map(a => a.value || a.description || '').join(' ');
                // Show all relevant logs
                if (args.includes('GPD') || args.includes('GPTK') || args.includes('AI Describe') || args.includes('Bridge') || args.includes('GPTK_TEST') || args.includes('fetch')) {
                    console.log('[CONSOLE]', new Date().toISOString().slice(11,19), args.slice(0, 200));
                }
            }
            if (msg.method === 'Runtime.exceptionThrown') {
                const det = msg.params.exceptionDetails;
                console.log('[ERROR]', det.text, det.exception?.description || '');
            }
        });

        ws.on('error', (e) => console.log('WS error:', e.message));

        function send(method, params, cb) {
            const id = msgId++;
            if (cb) pending[id] = cb;
            ws.send(JSON.stringify({ id, method, params }));
        }

    }, 8000); // Wait for GP tab to reload
}, 3000); // Wait for extension to reload
