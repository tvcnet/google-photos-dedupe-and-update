tell application "Google Chrome"
  -- Find the extensions tab and Google Photos tab
  set extTab to null
  set gpTab to null
  set extWin to null
  set gpWin to null

  repeat with w in windows
    repeat with tab_ in tabs of w
      if URL of tab_ contains "chrome://extensions" then
        set extTab to tab_
        set extWin to w
      end if
      if URL of tab_ contains "photos.google.com/" and URL of tab_ does not contain "serviceworker" then
        set gpTab to tab_
        set gpWin to w
      end if
    end repeat
  end repeat

  -- Step 1: Reload the extension via chrome://extensions
  if extTab is not null then
    set index of extWin to 1
    set active tab index of extWin to (tab index of extTab)
    delay 0.5
    execute extTab javascript "
      (function() {
        const manager = document.querySelector('extensions-manager');
        if (!manager) return 'no manager';
        const items = manager.shadowRoot.querySelectorAll('extensions-item');
        for (const item of items) {
          const name = item.shadowRoot.querySelector('#name')?.textContent || '';
          if (name.toLowerCase().includes('deduper') || name.toLowerCase().includes('gptk') || name.toLowerCase().includes('photo')) {
            const reloadBtn = item.shadowRoot.querySelector('#dev-reload-button');
            if (reloadBtn) { reloadBtn.click(); return 'reloaded: ' + name; }
            return 'no reload btn for: ' + name;
          }
        }
        return 'extension not found among ' + items.length + ' items';
      })()
    "
    delay 2
  end if

  -- Step 2: Reload Google Photos tab
  if gpTab is not null then
    set index of gpWin to 1
    set active tab index of gpWin to (tab index of gpTab)
    reload gpTab
    delay 5

    -- Step 3: Open GPTK panel (click the toolbar button)
    execute gpTab javascript "document.getElementById('gptk-button')?.click();"
    delay 1

    -- Step 4: Switch to Albums source
    execute gpTab javascript "document.getElementById('albums')?.click();"
    delay 0.5

    -- Step 5: Click refresh albums button
    execute gpTab javascript "document.querySelector('.refresh-albums')?.click();"
    delay 3

    -- Step 6: Check albums loaded and select first one
    set albumCheck to execute gpTab javascript "
      (function() {
        const sel = document.getElementById('existingAlbum');
        if (!sel) return JSON.stringify({error: 'no album select'});
        const opts = Array.from(sel.options).map(o => ({val: o.value, text: o.text}));
        // Select first real album (skip placeholder)
        const firstAlbum = opts.find(o => o.val && o.val !== '');
        if (firstAlbum) {
          sel.value = firstAlbum.val;
          sel.dispatchEvent(new Event('change', {bubbles: true}));
        }
        return JSON.stringify({optCount: opts.length, selected: firstAlbum, currentVal: sel.value});
      })()
    "

    -- Step 7: Click AI Describe
    execute gpTab javascript "document.getElementById('aiDescribe')?.click();"
    delay 1

    -- Step 8: Check if confirm modal appeared
    set modalCheck to execute gpTab javascript "
      (function() {
        const backdrop = document.querySelector('.gptk-confirm-backdrop');
        const logText = document.getElementById('logArea')?.innerText?.slice(-300) || '';
        return JSON.stringify({
          backdropExists: !!backdrop,
          backdropVisible: backdrop ? getComputedStyle(backdrop).display : null,
          logText
        });
      })()
    "

    return "Albums: " & albumCheck & " | Modal: " & modalCheck
  end if

  return "Could not find tabs"
end tell
