tell application "Google Chrome"
  -- Step 1: Reload extension
  repeat with w in windows
    repeat with tab_ in tabs of w
      if URL of tab_ contains "onogdoichnabfchbihghdpbbnfpmhege" and URL of tab_ contains "app.html" then
        execute tab_ javascript "chrome.runtime.reload();"
        exit repeat
      end if
    end repeat
  end repeat
  delay 3

  -- Step 2: Reload GP tab
  repeat with w in windows
    repeat with tab_ in tabs of w
      if URL of tab_ contains "photos.google.com/" and URL of tab_ does not contain "serviceworker" then
        reload tab_
        delay 7

        -- Step 3: Switch to albums, refresh, select album and filter
        execute tab_ javascript "document.getElementById('albums')?.click();"
        delay 0.5
        execute tab_ javascript "document.querySelector('.refresh-albums')?.click();"
        delay 4

        execute tab_ javascript "(function(){ const sel=document.getElementById('existingAlbum'); const opts=Array.from(sel?.options||[]).filter(o=>o.value); if(opts[0]){sel.value=opts[0].value; sel.dispatchEvent(new Event('change',{bubbles:true}));} })()"
        delay 0.3
        execute tab_ javascript "(function(){ const sel=document.querySelector('select[name=\"albumsInclude\"]'); const opts=Array.from(sel?.options||[]).filter(o=>o.value); if(opts[0]){opts[0].selected=true; sel.dispatchEvent(new Event('change',{bubbles:true}));} })()"
        delay 0.3

        -- Step 4: Click AI Describe
        execute tab_ javascript "document.getElementById('aiDescribe')?.click();"
        delay 1

        -- Step 5: Click OK on confirm modal
        execute tab_ javascript "(function(){ const btns=document.querySelectorAll('.gptk-confirm-actions button'); btns.forEach(b=>{ if(b.textContent.trim()==='OK') b.click(); }); })()"

        -- Step 6: Wait for first item to process (up to 20 seconds)
        delay 20

        -- Step 7: Get log
        set finalLog to execute tab_ javascript "document.getElementById('logArea')?.innerText?.slice(-1000)||''"
        return finalLog
      end if
    end repeat
  end repeat
  return "no GP tab"
end tell
