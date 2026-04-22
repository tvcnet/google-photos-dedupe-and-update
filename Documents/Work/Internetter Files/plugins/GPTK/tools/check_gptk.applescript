tell application "Google Chrome"
  set gpTab to null
  repeat with w in windows
    repeat with tab_ in tabs of w
      if URL of tab_ contains "photos.google.com/" and URL of tab_ does not contain "serviceworker" then
        set gpTab to tab_
        exit repeat
      end if
    end repeat
    if gpTab is not null then exit repeat
  end repeat
  if gpTab is null then return "ERROR: no GP tab"

  set logContent to execute gpTab javascript "document.getElementById('logArea')?.innerText?.slice(-500) || 'empty'"

  set confirmTest to execute gpTab javascript "(function(){ try { const p = document.getElementById('gptk'); if(!p) return 'no panel'; const d = document.createElement('div'); d.style.cssText='position:absolute;inset:0;z-index:700;background:rgba(255,0,0,0.3);display:flex;align-items:center;justify-content:center;'; d.innerHTML='<div style=\"background:#0f1f36;padding:20px;border-radius:8px;color:white;\">TEST MODAL</div>'; p.appendChild(d); return 'probe injected'; } catch(e) { return 'ERROR: ' + e.message; } })()"

  return "LOG: " & logContent & " | PROBE: " & confirmTest
end tell
