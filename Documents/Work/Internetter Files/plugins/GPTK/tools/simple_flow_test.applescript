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

  -- Switch to albums, refresh, select first album, then click AI Describe
  execute gpTab javascript "document.getElementById('albums')?.click();"
  delay 0.5
  execute gpTab javascript "document.querySelector('.refresh-albums')?.click();"
  delay 3

  set albumInfo to execute gpTab javascript "
    (function() {
      const sel = document.getElementById('existingAlbum');
      if (!sel) return 'no album select';
      const opts = Array.from(sel.options).filter(o => o.value !== '');
      if (opts.length > 0) {
        sel.value = opts[0].value;
        sel.dispatchEvent(new Event('change', {bubbles: true}));
        return 'selected: ' + opts[0].text + ' (' + opts.length + ' total)';
      }
      return 'no albums found, opts: ' + sel.options.length;
    })()
  "

  execute gpTab javascript "document.getElementById('aiDescribe')?.click();"
  delay 1

  set modalInfo to execute gpTab javascript "
    (function() {
      const backdrop = document.querySelector('.gptk-confirm-backdrop');
      const log = document.getElementById('logArea')?.innerText?.slice(-300) || '';
      return JSON.stringify({modal: !!backdrop, log});
    })()
  "

  return "Albums: " & albumInfo & " | Result: " & modalInfo
end tell
