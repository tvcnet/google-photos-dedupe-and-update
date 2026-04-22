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

  -- Test the createElement approach directly (no innerHTML)
  set probeResult to execute gpTab javascript "(function(){
    try {
      const p = document.getElementById('gptk');
      if (!p) return 'no panel';
      const backdrop = document.createElement('div');
      backdrop.className = 'gptk-confirm-backdrop';
      const box = document.createElement('div');
      box.className = 'gptk-confirm-box';
      const title = document.createElement('div');
      title.className = 'gptk-confirm-title';
      title.textContent = 'Confirm Action';
      const body = document.createElement('div');
      body.className = 'gptk-confirm-body';
      body.textContent = 'TEST: Can you see this modal?';
      const actions = document.createElement('div');
      actions.className = 'gptk-confirm-actions';
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.textContent = 'Cancel';
      const okBtn = document.createElement('button');
      okBtn.type = 'button';
      okBtn.className = 'btn-primary';
      okBtn.textContent = 'OK';
      actions.appendChild(cancelBtn);
      actions.appendChild(okBtn);
      box.appendChild(title);
      box.appendChild(body);
      box.appendChild(actions);
      backdrop.appendChild(box);
      p.appendChild(backdrop);
      return 'modal injected - check browser';
    } catch(e) {
      return 'ERROR: ' + e.message;
    }
  })()"

  return "PROBE: " & probeResult
end tell
