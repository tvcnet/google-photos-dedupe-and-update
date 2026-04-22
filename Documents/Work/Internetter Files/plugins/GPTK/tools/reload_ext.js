const http = require('http');
const WebSocket = require('ws');

const EXT_ID = 'onogdoichnabfchbihghdpbbnfpmhege';
const EXT_TAB_ID = '74AFB46534D3FC7FBCCC0F12DA9C6F6F';
const GP_TAB_PARTIAL_URL = 'photos.google.com/';

async function getWsUrl(tabId) {
    return new Promise((resolve, reject) => {
        http.get('http://localhost:9222/json/list', (res) => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                const tabs = JSON.parse(data);
                const tab = tabs.find(t => t.id === tabId || (tabId === 'gp' && t.url.includes(GP_TAB_PARTIAL_URL) && !t.url.includes('serviceworker')));
                if (tab) resolve(tab.webSocketDebuggerUrl);
                else reject(new Error('Tab not found: ' + tabId));
            });
        }).on('error', reject);
    });
}

async function cdpEval(wsUrl, expression) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        ws.on('open', () => {
            ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
        });
        ws.on('message', (data) => {
            const msg = JSON.parse(data);
            if (msg.id === 1) {
                ws.close();
                resolve(msg.result);
            }
        });
        ws.on('error', reject);
        setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 8000);
    });
}

async function main() {
    try {
        // Step 1: Reload the extension via chrome.management API from the extension's own page
        console.log('Step 1: Reloading extension...');
        const extWsUrl = await getWsUrl(EXT_TAB_ID);
        const reloadResult = await cdpEval(extWsUrl, `
            new Promise((resolve) => {
                chrome.management.get('${EXT_ID}', (info) => {
                    if (chrome.runtime.lastError) {
                        resolve('management.get error: ' + chrome.runtime.lastError.message);
                        return;
                    }
                    // Use chrome.runtime.reload() from the extension context
                    resolve('found: ' + info.name);
                });
            })
        `);
        console.log('Extension info:', JSON.stringify(reloadResult));

        // Step 2: Try reloading via the extensions page dev reload button
        const extPageWsUrl = await getWsUrl(EXT_TAB_ID);
        const devReload = await cdpEval(extPageWsUrl, `
            (function() {
                const manager = document.querySelector('extensions-manager');
                if (!manager) return 'no manager';
                const root = manager.shadowRoot;
                if (!root) return 'no shadow root';
                const items = root.querySelectorAll('extensions-item');
                for (const item of items) {
                    const sr = item.shadowRoot;
                    if (!sr) continue;
                    const nameEl = sr.querySelector('#name');
                    if (!nameEl) continue;
                    const name = nameEl.textContent.trim();
                    if (name.toLowerCase().includes('deduper') || name.toLowerCase().includes('gptk') || name.toLowerCase().includes('photo')) {
                        const reloadBtn = sr.querySelector('#dev-reload-button');
                        if (reloadBtn) {
                            reloadBtn.click();
                            return 'clicked reload for: ' + name;
                        }
                        return 'no reload btn for: ' + name + ' (enabled: ' + item.getAttribute('allow-dev-reload') + ')';
                    }
                }
                return 'not found among ' + items.length + ' items';
            })()
        `);
        console.log('Dev reload result:', JSON.stringify(devReload));

        // Step 3: Wait for reload then check GP tab
        await new Promise(r => setTimeout(r, 2000));

        // Step 4: Hard reload the GP tab
        console.log('Step 4: Reloading Google Photos tab...');
        const gpWsUrl = await getWsUrl('gp');
        const gpReload = await cdpEval(gpWsUrl, 'location.reload(); "reloading"');
        console.log('GP reload:', JSON.stringify(gpReload));

        // Step 5: Wait for page to load
        await new Promise(r => setTimeout(r, 5000));

        // Step 6: Test the confirm flow
        console.log('Step 6: Testing confirm flow...');
        const gpWsUrl2 = await getWsUrl('gp');
        
        // Switch to albums
        await cdpEval(gpWsUrl2, "document.getElementById('albums')?.click();");
        await new Promise(r => setTimeout(r, 500));
        
        // Refresh albums
        await cdpEval(gpWsUrl2, "document.querySelector('.refresh-albums')?.click();");
        await new Promise(r => setTimeout(r, 3000));
        
        // Select first album
        const albumSel = await cdpEval(gpWsUrl2, `
            (function() {
                const sel = document.getElementById('existingAlbum');
                if (!sel) return 'no select';
                const opts = Array.from(sel.options).filter(o => o.value);
                if (opts.length > 0) { sel.value = opts[0].value; sel.dispatchEvent(new Event('change', {bubbles:true})); return 'selected: ' + opts[0].text; }
                return 'no albums';
            })()
        `);
        console.log('Album selected:', JSON.stringify(albumSel));
        
        // Click AI Describe
        await cdpEval(gpWsUrl2, "document.getElementById('aiDescribe')?.click();");
        await new Promise(r => setTimeout(r, 1000));
        
        // Check modal
        const modalCheck = await cdpEval(gpWsUrl2, `
            JSON.stringify({
                modal: !!document.querySelector('.gptk-confirm-backdrop'),
                log: document.getElementById('logArea')?.innerText?.slice(-200) || ''
            })
        `);
        console.log('Modal check:', JSON.stringify(modalCheck));

    } catch (e) {
        console.error('Error:', e.message);
    }
}

main();
