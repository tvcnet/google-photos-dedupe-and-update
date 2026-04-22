tell application "Google Chrome"
  repeat with w in windows
    repeat with tab_ in tabs of w
      if URL of tab_ contains "photos.google.com/" and URL of tab_ does not contain "serviceworker" then
        reload tab_
        delay 4
        set checkResult to execute tab_ javascript "JSON.stringify({panel: !!document.getElementById('gptk'), aiBtn: !!document.getElementById('aiDescribe'), source: document.querySelector('input[name=\"source\"]:checked')?.id})"
        return "After reload: " & checkResult
      end if
    end repeat
  end repeat
  return "No Google Photos tab found"
end tell
