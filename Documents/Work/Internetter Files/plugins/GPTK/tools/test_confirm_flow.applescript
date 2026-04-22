tell application "Google Chrome"
  repeat with w in windows
    repeat with tab_ in tabs of w
      if URL of tab_ contains "photos.google.com/" and URL of tab_ does not contain "serviceworker" then

        -- Step 1: Switch source to albums
        execute tab_ javascript "document.getElementById('albums')?.click();"
        delay 0.5

        -- Step 2: Click AI Describe
        execute tab_ javascript "document.getElementById('aiDescribe')?.click();"
        delay 1

        -- Step 3: Check if backdrop appeared
        set result to execute tab_ javascript "
          (function() {
            const backdrop = document.querySelector('.gptk-confirm-backdrop');
            const box = document.querySelector('.gptk-confirm-box');
            const okBtn = document.querySelector('.gptk-confirm-actions .btn-primary');
            return JSON.stringify({
              backdropExists: !!backdrop,
              boxExists: !!box,
              okBtnText: okBtn ? okBtn.textContent : null,
              source: document.querySelector('input[name=\"source\"]:checked')?.id
            });
          })()
        "
        return result
      end if
    end repeat
  end repeat
  return "No Google Photos tab found"
end tell
