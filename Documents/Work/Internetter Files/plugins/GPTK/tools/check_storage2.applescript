tell application "Google Chrome"
  repeat with w in windows
    repeat with tab_ in tabs of w
      if URL of tab_ contains "onogdoichnabfchbihghdpbbnfpmhege" and URL of tab_ contains "app.html" then
        execute tab_ javascript "window.__storageResult = null; chrome.storage.local.get(null, function(all){ window.__storageResult = JSON.stringify({keys: Object.keys(all), apiSettings: all.apiSettings ? {hasKey: !!(all.apiSettings.geminiApiKey), keyLen: (all.apiSettings.geminiApiKey||'').length, delayMs: all.apiSettings.geminiDelayMs} : 'null'}); });"
        delay 2
        set r to execute tab_ javascript "window.__storageResult || 'still not ready'"
        return r
      end if
    end repeat
  end repeat
  return "no app tab"
end tell
