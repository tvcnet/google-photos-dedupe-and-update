const http = require('http');
const { execSync } = require('child_process');

// Get the WebSocket URL for the Google Photos tab
const tabs = JSON.parse(execSync('curl -s http://localhost:9222/json/list').toString());
const gpTab = tabs.find(t => t.url === 'https://photos.google.com/');
if (!gpTab) { console.log('No GP tab found'); process.exit(1); }

const wsUrl = gpTab.webSocketDebuggerUrl;
console.log('Connecting to:', wsUrl);

// Use ws if available, otherwise use a simple WebSocket implementation
let ws;
// Try multiple paths for ws module
const wsPaths = [
    '/usr/local/lib/node_modules/@qwen-code/qwen-code/node_modules/ws',
    '/usr/local/lib/node_modules/ws',
    'ws'
];
for (const p of wsPaths) {
    try {
        const WebSocket = require(p);
        ws = new WebSocket(wsUrl);
        console.log('Using ws from:', p);
        break;
    } catch(e) { /* try next */ }
}
if (!ws) { console.log('ws not found in any path'); process.exit(1); }

let msgId = 1;
const pending = {};

ws.on('open', () => {
    console.log('Connected to CDP');
    
    // Enable Runtime
    send('Runtime.enable', {});
    
    setTimeout(() => {
        // Send a gptkFetchImage message from the page context
        const js = `
            (function() {
                window.__cdpFetchTest = 'waiting';
                window.addEventListener('message', function cdpHandler(e) {
                    if (e.data?.action === 'gptkFetchImageResult' && e.data?.requestId === 'cdp-test-001') {
                        window.__cdpFetchTest = JSON.stringify({
                            error: e.data.error || null,
                            hasBase64: !!(e.data.base64),
                            base64Len: (e.data.base64 || '').length,
                            mimeType: e.data.mimeType
                        });
                        window.removeEventListener('message', cdpHandler);
                    }
                });
                window.postMessage({app: 'GPD', action: 'gptkFetchImage', requestId: 'cdp-test-001', url: 'https://lh3.googleusercontent.com/test-invalid'}, '*');
                return 'message sent';
            })()
        `;
        
        send('Runtime.evaluate', { expression: js, awaitPromise: false }, (result) => {
            console.log('Message sent result:', JSON.stringify(result));
        });
        
        // Wait and check result
        setTimeout(() => {
            send('Runtime.evaluate', { expression: 'window.__cdpFetchTest' }, (result) => {
                console.log('Fetch test result:', JSON.stringify(result));
                ws.close();
            });
        }, 5000);
    }, 1000);
});

ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.id && pending[msg.id]) {
        pending[msg.id](msg.result);
        delete pending[msg.id];
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
        const args = msg.params.args.map(a => a.value || a.description || '').join(' ');
        console.log('[PAGE CONSOLE]', args);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
        console.log('[PAGE ERROR]', JSON.stringify(msg.params.exceptionDetails));
    }
});

ws.on('error', (e) => console.log('WS error:', e.message));

function send(method, params, cb) {
    const id = msgId++;
    if (cb) pending[id] = cb;
    ws.send(JSON.stringify({ id, method, params }));
}
