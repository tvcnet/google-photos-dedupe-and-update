tell application "Google Chrome"
  -- Check chrome.storage.local from the extension app page
  repeat with w in windows
    repeat with tab_ in tabs of w
      if URL of tab_ contains "onogdoichnabfchbihghdpbbnfpmhege" and URL of tab_ contains "app.html" then
        set r to execute tab_ javascript "(function(){ return new Promise(resolve => { chrome.storage.local.get(['apiSettings'], (result) => { const s = result.apiSettings || {}; resolve(JSON.stringify({ hasKey: !!(s.geminiApiKey && s.geminiApiKey.length > 0), keyLen: (s.geminiApiKey||'').length, delayMs: s.geminiDelayMs, keys: Object.keys(s) })); }); }); })()"
        return r
      end if
    end repeat
  end repeat
  return "no app tab found"
end tell
