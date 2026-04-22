tell application "Google Chrome"
  repeat with w in windows
    repeat with tab_ in tabs of w
      if URL of tab_ contains "photos.google.com/" and URL of tab_ does not contain "serviceworker" then

        -- Check if the new createElement-based userConfirmation is loaded
        -- by looking for the comment we added
        set versionCheck to execute tab_ javascript "
          (function() {
            // Try to find the running script source via Error stack
            const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
            
            // Check what happens when we call runAction directly
            // by checking if the action bar gets disabled (which happens after confirm)
            const actionBarBefore = document.querySelector('.action-bar button:not(:disabled)') ? 'enabled' : 'disabled';
            
            // Check if there is an album selected
            const albumSelect = document.getElementById('existingAlbum') || document.querySelector('select[id*=album]');
            const albumValue = albumSelect ? albumSelect.value : 'no album select found';
            
            // Check the log area for any recent messages
            const logArea = document.getElementById('logArea');
            const logText = logArea ? logArea.innerText.slice(-400) : 'no log area';
            
            return JSON.stringify({
              actionBarBefore,
              albumValue,
              logText,
              scriptCount: scripts.length
            });
          })()
        "
        return versionCheck
      end if
    end repeat
  end repeat
  return "No Google Photos tab found"
end tell
