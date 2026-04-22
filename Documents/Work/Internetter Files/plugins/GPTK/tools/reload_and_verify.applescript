tell application "Google Chrome"
  -- Find the extensions page and reload the extension
  set extTab to null
  set gpTab to null
  repeat with w in windows
    repeat with tab_ in tabs of w
      if URL of tab_ contains "chrome://extensions" then
        set extTab to tab_
      end if
      if URL of tab_ contains "photos.google.com/" and URL of tab_ does not contain "serviceworker" then
        set gpTab to tab_
      end if
    end repeat
  end repeat

  -- Reload the extension via the extensions page
  if extTab is not null then
    set active tab of (window 1) to extTab
    execute extTab javascript "
      (async function() {
        const ext = Array.from(document.querySelectorAll('extensions-item')).find(el => el.shadowRoot?.querySelector('.name')?.textContent?.includes('Deduper') || el.shadowRoot?.querySelector('.name')?.textContent?.includes('GPTK') || el.shadowRoot?.querySelector('.name')?.textContent?.includes('Photos'));
        if (ext) {
          const reloadBtn = ext.shadowRoot?.querySelector('#dev-reload-button') || ext.shadowRoot?.querySelector('[id*=reload]');
          if (reloadBtn) { reloadBtn.click(); return 'reloaded'; }
          return 'reload btn not found, ext found: ' + (ext.shadowRoot?.querySelector('.name')?.textContent);
        }
        return 'extension not found';
      })()
    "
  end if

  -- Hard reload the Google Photos tab
  if gpTab is not null then
    delay 1
    set active tab of (window 1) to gpTab
    reload gpTab
    delay 3
    -- Check if GPTK loaded
    set checkResult to execute gpTab javascript "JSON.stringify({panel: !!document.getElementById('gptk'), aiBtn: !!document.getElementById('aiDescribe')})"
    return "After reload: " & checkResult
  end if

  return "Could not find tabs"
end tell
