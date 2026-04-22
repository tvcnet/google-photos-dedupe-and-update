const { execSync } = require('child_process');
const WebSocket = require('/usr/local/lib/node_modules/@qwen-code/qwen-code/node_modules/ws');

// Get the WebSocket URL for the Google Photos tab
const tabs = JSON.parse(execSync('curl -s http://localhost:9222/json/list').toString());
const gpTab = tabs.find(t => t.url === 'https://photos.google.com/');
if (!gpTab) { console.log('No GP tab found'); process.exit(1); }

const ws = new WebSocket(gpTab.webSocketDebuggerUrl);
let msgId = 1;
const pending = {};

ws.on('open', () => {
    console.log('Connected to CDP — monitoring console for 30 seconds...');
    send('Runtime.enable', {});
    
    setTimeout(() => {
        // Switch to albums, select filter, click AI Describe
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
                        document.getElementById('aiDescribe')?.click();
                        setTimeout(() => {
                            // Click OK on confirm modal
                            const btns = document.querySelectorAll('.gptk-confirm-actions button');
                            btns.forEach(b => { if(b.textContent.trim()==='OK') b.click(); });
                        }, 1000);
                    }, 4000);
                }, 500);
            }, 500);
        })()`;
        
        send('Runtime.evaluate', { expression: setupJs }, (r) => {
            console.log('Setup triggered');
        });
    }, 1000);
    
    // Close after 30 seconds
    setTimeout(() => {
        console.log('Done monitoring');
        ws.close();
    }, 30000);
});

ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.id && pending[msg.id]) {
        pending[msg.id](msg.result);
        delete pending[msg.id];
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
        const args = msg.params.args.map(a => a.value || a.description || '').join(' ');
        if (args.includes('GPD') || args.includes('GPTK') || args.includes('AI Describe') || args.includes('Bridge')) {
            console.log('[CONSOLE]', args);
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
