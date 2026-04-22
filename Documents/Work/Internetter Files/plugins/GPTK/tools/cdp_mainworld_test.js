const { execSync } = require('child_process');
const WebSocket = require('/usr/local/lib/node_modules/@qwen-code/qwen-code/node_modules/ws');

const tabs = JSON.parse(execSync('curl -s http://localhost:9222/json/list').toString());
const gpTab = tabs.find(t => t.url === 'https://photos.google.com/');
if (!gpTab) { console.log('No GP tab found'); process.exit(1); }

const ws = new WebSocket(gpTab.webSocketDebuggerUrl);
let msgId = 1;
const pending = {};

ws.on('open', () => {
    console.log('Connected to CDP');
    send('Runtime.enable', {});

    setTimeout(() => {
        // Inject a <script> tag into the page — this runs in the MAIN world
        // and can interact with the bridge via window.postMessage
        const injectMainWorldScript = `
        (function() {
            const script = document.createElement('script');
            script.textContent = \`
                (async function() {
                    // Get a real thumbnail URL from the page
                    const imgs = Array.from(document.querySelectorAll('img[src*="lh3.googleusercontent.com"]'));
                    const thumbUrl = imgs[0]?.src?.split('=')[0] + '=w512-h512-k-no';
                    console.log('MAINWORLD_TEST: Testing bridge fetch with URL:', thumbUrl?.slice(-50));
                    
                    // Send gptkFetchImage and wait for response
                    const result = await new Promise((resolve) => {
                        const reqId = 'mainworld-test-001';
                        const timer = setTimeout(() => resolve({error: 'timeout'}), 10000);
                        window.addEventListener('message', function handler(e) {
                            if (e.data?.action === 'gptkFetchImageResult' && e.data?.requestId === reqId) {
                                clearTimeout(timer);
                                window.removeEventListener('message', handler);
                                resolve(e.data);
                            }
                        });
                        window.postMessage({app: 'GPD', action: 'gptkFetchImage', requestId: reqId, url: thumbUrl}, '*');
                    });
                    
                    console.log('MAINWORLD_TEST: Bridge fetch result:', JSON.stringify({
                        error: result.error || null,
                        hasBase64: !!(result.base64),
                        base64Len: (result.base64 || '').length,
                        mimeType: result.mimeType
                    }));
                })();
            \`;
            document.head.appendChild(script);
            return 'script injected';
        })()
        `;

        send('Runtime.evaluate', { expression: injectMainWorldScript }, (r) => {
            console.log('Main world script injection result:', JSON.stringify(r));
        });

    }, 1000);

    setTimeout(() => {
        console.log('Done');
        ws.close();
        process.exit(0);
    }, 15000);
});

ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.id && pending[msg.id]) {
        pending[msg.id](msg.result);
        delete pending[msg.id];
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
        const args = msg.params.args.map(a => a.value || a.description || '').join(' ');
        if (args.includes('GPD') || args.includes('MAINWORLD') || args.includes('Bridge') || args.includes('fetch')) {
            console.log('[CONSOLE]', args.slice(0, 300));
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
