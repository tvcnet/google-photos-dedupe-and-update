tell application "Google Chrome"
  -- Reload extension
  repeat with w in windows
    repeat with tab_ in tabs of w
      if URL of tab_ contains "onogdoichnabfchbihghdpbbnfpmhege" and URL of tab_ contains "app.html" then
        execute tab_ javascript "chrome.runtime.reload();"
        exit repeat
      end if
    end repeat
  end repeat
  delay 3

  -- Reload GP tab
  repeat with w in windows
    repeat with tab_ in tabs of w
      if URL of tab_ contains "photos.google.com/" and URL of tab_ does not contain "serviceworker" then
        reload tab_
        delay 7

        -- Get a real thumbnail URL
        execute tab_ javascript "window.__testThumbUrl = (Array.from(document.querySelectorAll('img[src*=\"lh3.googleusercontent\"]'))[0]?.src||'').split('=')[0] + '=w512-h512-k-no';"
        delay 0.3

        -- Test bridge fetch
        execute tab_ javascript "(function(){ window.__bridgeFetchResult = 'waiting'; const reqId = 'test-456'; window.addEventListener('message', function handler(e){ if(e.data?.action==='gptkFetchImageResult' && e.data?.requestId===reqId){ window.__bridgeFetchResult = JSON.stringify({error: e.data.error||null, hasBase64: !!(e.data.base64), base64Len: (e.data.base64||'').length, mimeType: e.data.mimeType}); window.removeEventListener('message', handler); } }); window.postMessage({app:'GPD', action:'gptkFetchImage', requestId:reqId, url:window.__testThumbUrl}, '*'); })()"

        -- Wait for bridge to respond
        delay 8

        set r to execute tab_ javascript "JSON.stringify({thumbUrl: (window.__testThumbUrl||'').slice(-60), result: window.__bridgeFetchResult})"
        return r
      end if
    end repeat
  end repeat
  return "no GP tab"
end tell
