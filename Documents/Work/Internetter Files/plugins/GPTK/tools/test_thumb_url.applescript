tell application "Google Chrome"
  repeat with w in windows
    repeat with tab_ in tabs of w
      if URL of tab_ contains "photos.google.com/" and URL of tab_ does not contain "serviceworker" then

        -- Fire async fetch tests and store results in globals
        execute tab_ javascript "(async function(){ window.__thumbTest = 'running'; try { const imgs = Array.from(document.querySelectorAll('img[src*=\"lh3.googleusercontent\"]')); if(!imgs.length){ window.__thumbTest = JSON.stringify({error:'no imgs on page'}); return; } const base = imgs[0].src.split('=')[0]; const formats = ['=w512-h512', '=w512-h512-k-no', '=w512-h512-k-no-nd', '=w512-h512-rj']; const results = []; for(const fmt of formats){ try{ const r = await fetch(base+fmt, {credentials:'include'}); results.push({fmt, status:r.status}); }catch(e){ results.push({fmt, error:e.message}); } } window.__thumbTest = JSON.stringify({base: base.slice(-60), results}); }catch(e){ window.__thumbTest = JSON.stringify({error:e.message}); } })()"

        -- Wait for async to complete
        delay 5

        -- Read result
        set r to execute tab_ javascript "window.__thumbTest || 'still running'"
        return r
      end if
    end repeat
  end repeat
  return "no GP tab"
end tell
