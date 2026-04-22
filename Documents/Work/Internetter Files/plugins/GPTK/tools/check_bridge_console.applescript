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
        delay 6

        -- Send a gptkFetchImage message with a simple URL
        execute tab_ javascript "window.postMessage({app:'GPD', action:'gptkFetchImage', requestId:'diag-001', url:'https://lh3.googleusercontent.com/test'}, '*');"
        delay 2

        -- Check if the bridge responded with an error (which would confirm it received the message)
        execute tab_ javascript "(function(){ window.__diagResult = 'no response'; window.addEventListener('message', function h(e){ if(e.data?.action==='gptkFetchImageResult' && e.data?.requestId==='diag-001'){ window.__diagResult = JSON.stringify(e.data); window.removeEventListener('message',h); } }); })()"
        delay 3

        set r to execute tab_ javascript "window.__diagResult"
        return "Bridge response: " & r
      end if
    end repeat
  end repeat
  return "no GP tab"
end tell
