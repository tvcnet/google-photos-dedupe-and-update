tell application "Google Chrome"
  repeat with w in windows
    repeat with tab_ in tabs of w
      if URL of tab_ contains "photos.google.com/" and URL of tab_ does not contain "serviceworker" then

        -- Check what the button's click handler actually does
        -- by checking if there are event listeners and what script is running
        set diagResult to execute tab_ javascript "
          (function() {
            const btn = document.getElementById('aiDescribe');
            if (!btn) return 'no aiDescribe button';
            
            // Check if the button is inside a form that might intercept the click
            const form = btn.closest('form');
            
            // Check the action bar state
            const actionBar = document.querySelector('.action-bar');
            const actionBarClasses = actionBar ? actionBar.className : 'no action bar';
            
            // Check if there's a filter form validity issue
            const filtersForm = document.querySelector('.filters-form');
            const filtersValid = filtersForm ? filtersForm.checkValidity() : null;
            
            // Check current source
            const sourceInput = document.querySelector('input[name=\"source\"]:checked');
            const source = sourceInput ? sourceInput.id : 'none';
            
            // Check album select value
            const albumSel = document.getElementById('existingAlbum');
            const albumVal = albumSel ? albumSel.value : 'no select';
            
            // Check if there's a running process
            const stopBtn = document.getElementById('stopProcess');
            const stopDisplay = stopBtn ? getComputedStyle(stopBtn).display : 'no stop btn';
            
            return JSON.stringify({
              btnDisabled: btn.disabled,
              btnInForm: !!form,
              actionBarClasses,
              filtersValid,
              source,
              albumVal,
              stopBtnDisplay: stopDisplay
            });
          })()
        "

        return diagResult
      end if
    end repeat
  end repeat
  return "no GP tab"
end tell
