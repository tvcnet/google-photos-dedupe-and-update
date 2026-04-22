tell application "Google Chrome"
  repeat with w in windows
    repeat with tab_ in tabs of w
      if URL of tab_ contains "photos.google.com/" and URL of tab_ does not contain "serviceworker" then

        -- Switch to albums
        execute tab_ javascript "document.getElementById('albums')?.click();"
        delay 0.5

        -- Refresh albums
        execute tab_ javascript "document.querySelector('.refresh-albums')?.click();"
        delay 4

        -- Select first album in action target dropdown
        execute tab_ javascript "(function(){ const sel=document.getElementById('existingAlbum'); const opts=Array.from(sel?.options||[]).filter(o=>o.value); if(opts[0]){sel.value=opts[0].value; sel.dispatchEvent(new Event('change',{bubbles:true}));} })()"
        delay 0.3

        -- Select first album in albumsInclude filter
        execute tab_ javascript "(function(){ const sel=document.querySelector('select[name=\"albumsInclude\"]'); const opts=Array.from(sel?.options||[]).filter(o=>o.value); if(opts[0]){opts[0].selected=true; sel.dispatchEvent(new Event('change',{bubbles:true}));} })()"
        delay 0.3

        -- Click AI Describe
        execute tab_ javascript "document.getElementById('aiDescribe')?.click();"
        delay 1

        -- Click OK on confirm modal
        execute tab_ javascript "(function(){ const btns=document.querySelectorAll('.gptk-confirm-actions button'); btns.forEach(b=>{ if(b.textContent.trim()==='OK') b.click(); }); })()"
        delay 2

        -- Check log immediately after click
        set earlyLog to execute tab_ javascript "document.getElementById('logArea')?.innerText?.slice(-400)||''"
        return "Early log: " & earlyLog
      end if
    end repeat
  end repeat
  return "no GP tab"
end tell
