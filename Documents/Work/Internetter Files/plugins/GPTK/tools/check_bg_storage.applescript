tell application "Google Chrome"
  -- Check storage from background service worker (has full chrome API access)
  set bgTabId to "B673A13ED367E44D21DA"
  
  repeat with w in windows
    repeat with tab_ in tabs of w
      -- Check from app.html tab which has chrome.storage access
      if URL of tab_ contains "onogdoichnabfchbihghdpbbnfpmhege" and URL of tab_ contains "app.html" then
        -- Use a callback-based approach stored in window
        execute tab_ javascript "window.__storageResult = null; chrome.storage.local.get(null, function(all){ window.__storageResult = JSON.stringify({keys: Object.keys(all), apiSettings: all.apiSettings ? {hasKey: !!(all.apiSettings.geminiApiKey), keyLen: (all.apiSettings.geminiApiKey||'').length, delayMs: all.apiSettings.geminiDelayMs} : null}); });"
        delay 1
        set r to execute tab_ javascript "window.__storageResult || 'not ready'"
        return r
      end if
    end repeat
  end repeat
  return "no app tab"
end tell
