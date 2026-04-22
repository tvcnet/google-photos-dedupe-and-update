tell application "Google Chrome"
  repeat with w in windows
    repeat with tab_ in tabs of w
      if URL of tab_ contains "photos.google.com/" and URL of tab_ does not contain "serviceworker" then
        -- Select first option in the albumsInclude multi-select filter
        execute tab_ javascript "(function(){ const sel=document.querySelector('select[name=\"albumsInclude\"]'); if(!sel) return; const opts=Array.from(sel.options).filter(o=>o.value); if(opts.length>0){opts[0].selected=true; sel.dispatchEvent(new Event('change',{bubbles:true}));} })()"
        delay 0.5
        -- Click AI Describe
        execute tab_ javascript "document.getElementById('aiDescribe')?.click();"
        delay 1
        -- Check result
        set r to execute tab_ javascript "(function(){ return JSON.stringify({modal:!!document.querySelector('.gptk-confirm-backdrop'), filtersValid:document.querySelector('.filters-form')?.checkValidity(), log:document.getElementById('logArea')?.innerText?.slice(-300)||''}); })()"
        return r
      end if
    end repeat
  end repeat
  return "no GP tab"
end tell
