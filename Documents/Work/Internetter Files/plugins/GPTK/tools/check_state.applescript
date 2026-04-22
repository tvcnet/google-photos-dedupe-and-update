tell application "Google Chrome"
  repeat with w in windows
    repeat with tab_ in tabs of w
      if URL of tab_ contains "photos.google.com/" and URL of tab_ does not contain "serviceworker" then
        set r to execute tab_ javascript "(function(){ const log=document.getElementById('logArea')?.innerText?.slice(-800)||''; const apiKeyField=document.querySelector('input[name=\"geminiApiKey\"]'); const apiKeyVal=apiKeyField?apiKeyField.value:'no field'; const delayField=document.querySelector('input[name=\"geminiDelayMs\"]'); const delayVal=delayField?delayField.value:'no field'; return JSON.stringify({log, apiKeyPresent: apiKeyVal.length > 0, apiKeyLen: apiKeyVal.length, delayMs: delayVal}); })()"
        return r
      end if
    end repeat
  end repeat
  return "no GP tab"
end tell
