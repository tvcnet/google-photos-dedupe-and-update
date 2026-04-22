tell application "Google Chrome"
  repeat with w in windows
    repeat with tab_ in tabs of w
      if URL of tab_ contains "photos.google.com/" and URL of tab_ does not contain "serviceworker" then

        -- Test if gptkGetStorage still works (confirms bridge is alive and postMessage works)
        execute tab_ javascript "(function(){ window.__storageTest = 'waiting'; window.addEventListener('message', function handler(e){ if(e.data?.action==='gptkStorageData'){ window.__storageTest = JSON.stringify({received:true, hasKey: !!(e.data?.data?.geminiApiKey), keyLen: (e.data?.data?.geminiApiKey||'').length}); window.removeEventListener('message', handler); } }); window.postMessage({app:'GPD', action:'gptkGetStorage'}, '*'); })()"
        delay 3
        set storageResult to execute tab_ javascript "window.__storageTest"

        -- Also test gptkFetchImage
        execute tab_ javascript "window.__fetchTest = 'waiting'; const reqId='test-789'; window.addEventListener('message', function h(e){ if(e.data?.action==='gptkFetchImageResult' && e.data?.requestId===reqId){ window.__fetchTest=JSON.stringify({error:e.data.error||null,hasBase64:!!(e.data.base64)}); window.removeEventListener('message',h); } }); window.postMessage({app:'GPD', action:'gptkFetchImage', requestId:reqId, url:'https://lh3.googleusercontent.com/test'}, '*');"
        delay 5
        set fetchResult to execute tab_ javascript "window.__fetchTest"

        return "Storage bridge: " & storageResult & " | Fetch bridge: " & fetchResult
      end if
    end repeat
  end repeat
  return "no GP tab"
end tell
