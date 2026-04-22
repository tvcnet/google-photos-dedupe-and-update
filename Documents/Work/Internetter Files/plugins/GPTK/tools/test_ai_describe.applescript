tell application "Google Chrome"
  -- Reload extension via chrome.runtime.reload from app.html
  repeat with w in windows
    repeat with tab_ in tabs of w
      if URL of tab_ contains "onogdoichnabfchbihghdpbbnfpmhege" and URL of tab_ contains "app.html" then
        execute tab_ javascript "chrome.runtime.reload();"
        exit repeat
      end if
    end repeat
  end repeat

  delay 2

  -- Reload Google Photos tab
  repeat with w in windows
    repeat with tab_ in tabs of w
      if URL of tab_ contains "photos.google.com/" and URL of tab_ does not contain "serviceworker" then
        reload tab_
        delay 5

        -- Switch to albums source
        execute tab_ javascript "document.getElementById('albums')?.click();"
        delay 0.5

        -- Refresh albums
        execute tab_ javascript "document.querySelector('.refresh-albums')?.click();"
        delay 4

        -- Select first album in existingAlbum dropdown
        execute tab_ javascript "(function(){ const sel=document.getElementById('existingAlbum'); const opts=Array.from(sel?.options||[]).filter(o=>o.value); if(opts[0]){sel.value=opts[0].value; sel.dispatchEvent(new Event('change',{bubbles:true}));} })()"
        delay 0.5

        -- Select first album in albumsInclude filter (required for form validity)
        execute tab_ javascript "(function(){ const sel=document.querySelector('select[name=\"albumsInclude\"]'); const opts=Array.from(sel?.options||[]).filter(o=>o.value); if(opts[0]){opts[0].selected=true; sel.dispatchEvent(new Event('change',{bubbles:true}));} })()"
        delay 0.3

        -- Click AI Describe
        execute tab_ javascript "document.getElementById('aiDescribe')?.click();"
        delay 2

        -- Check for confirm modal
        set modalCheck to execute tab_ javascript "!!document.querySelector('.gptk-confirm-backdrop')"
        if modalCheck is "true" then
          -- Click OK on the confirm modal
          execute tab_ javascript "document.querySelector('.gptk-confirm-actions .btn-primary')?.click();"
          -- Wait for processing (up to 15 seconds)
          delay 15
        end if

        -- Get final log
        set finalLog to execute tab_ javascript "document.getElementById('logArea')?.innerText?.slice(-600)||''"
        return "Modal appeared: " & (modalCheck as string) & " | Log: " & finalLog
      end if
    end repeat
  end repeat
  return "no GP tab"
end tell
