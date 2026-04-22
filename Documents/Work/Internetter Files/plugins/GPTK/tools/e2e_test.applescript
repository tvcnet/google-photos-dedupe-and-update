tell application "Google Chrome"
  -- Step 1: Reload extension via app.html
  repeat with w in windows
    repeat with tab_ in tabs of w
      if URL of tab_ contains "onogdoichnabfchbihghdpbbnfpmhege" and URL of tab_ contains "app.html" then
        execute tab_ javascript "chrome.runtime.reload();"
        exit repeat
      end if
    end repeat
  end repeat
  delay 2

  -- Step 2: Reload Google Photos tab
  repeat with w in windows
    repeat with tab_ in tabs of w
      if URL of tab_ contains "photos.google.com/" and URL of tab_ does not contain "serviceworker" then
        reload tab_
        delay 6

        -- Step 3: Check if API key loaded into panel (race condition fix verification)
        set keyCheck to execute tab_ javascript "(function(){ const k=document.querySelector('input[name=\"geminiApiKey\"]'); return JSON.stringify({keyLen: k?k.value.length:0, keyPresent: k?k.value.length>0:false}); })()"

        -- Step 4: Switch to albums, refresh, select album and filter
        execute tab_ javascript "document.getElementById('albums')?.click();"
        delay 0.5
        execute tab_ javascript "document.querySelector('.refresh-albums')?.click();"
        delay 4

        execute tab_ javascript "(function(){ const sel=document.getElementById('existingAlbum'); const opts=Array.from(sel?.options||[]).filter(o=>o.value); if(opts[0]){sel.value=opts[0].value; sel.dispatchEvent(new Event('change',{bubbles:true}));} })()"
        delay 0.3
        execute tab_ javascript "(function(){ const sel=document.querySelector('select[name=\"albumsInclude\"]'); const opts=Array.from(sel?.options||[]).filter(o=>o.value); if(opts[0]){opts[0].selected=true; sel.dispatchEvent(new Event('change',{bubbles:true}));} })()"
        delay 0.3

        -- Step 5: Click AI Describe
        execute tab_ javascript "document.getElementById('aiDescribe')?.click();"
        delay 1

        -- Step 6: Click OK on confirm modal if it appeared
        set modalAppeared to execute tab_ javascript "!!document.querySelector('.gptk-confirm-backdrop')"
        if modalAppeared is "true" then
          execute tab_ javascript "document.querySelector('.gptk-confirm-actions .btn-primary')?.click();"
          -- Wait up to 30 seconds for processing
          delay 30
        end if

        -- Step 7: Get final log
        set finalLog to execute tab_ javascript "document.getElementById('logArea')?.innerText?.slice(-800)||''"
        return "Key check: " & keyCheck & " | Modal: " & modalAppeared & " | Log: " & finalLog
      end if
    end repeat
  end repeat
  return "no GP tab"
end tell
