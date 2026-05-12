const { execSync } = require('child_process');
const WebSocket = require('/usr/local/lib/node_modules/@qwen-code/qwen-code/node_modules/ws');

// Syntax check
try {
    execSync(`/usr/local/bin/node --check "../gptk/scripts/google-photos-toolkit.user.js"`);
    console.log('✅ Syntax OK');
} catch (e) {
    console.log('❌ Syntax error:', e.stderr?.toString() || e.message);
    process.exit(1);
}

// Reload extension
const tabs = JSON.parse(execSync('curl -s http://localhost:9222/json/list').toString());
const extPageTab = tabs.find(t => t.url === 'chrome://extensions/');
const ws = new WebSocket(extPageTab.webSocketDebuggerUrl);
ws.on('open', () => {
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: `(function() {
        const items = document.querySelector('extensions-manager')?.shadowRoot?.querySelector('extensions-item-list')?.shadowRoot?.querySelectorAll('extensions-item');
        for (const item of (items||[])) {
            const name = item.shadowRoot?.querySelector('#name')?.textContent;
            if (name?.includes('Google Photos Deduper')) {
                item.shadowRoot?.querySelector('#dev-reload-button')?.click();
                return 'reloaded';
            }
        }
        return 'not found';
    })()` } }));
});
ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.id === 1) { console.log('Extension reload:', msg.result?.result?.value); ws.close(); process.exit(0); }
});
setTimeout(() => { ws.close(); process.exit(0); }, 5000);
