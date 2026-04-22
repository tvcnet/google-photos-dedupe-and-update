tell application "Google Chrome"
  repeat with w in windows
    repeat with tab_ in tabs of w
      if URL of tab_ contains "photos.google.com/" and URL of tab_ does not contain "serviceworker" then

        -- Patch fetch to capture the image URL
        execute tab_ javascript "(function(){ window.__capturedImageUrls=[]; const orig=window.fetch; window.__origFetch=orig; window.fetch=function(url,opts){ if(typeof url==='string'&&url.includes('googleusercontent')&&url.includes('=w')){ window.__capturedImageUrls.push(url); } return orig.apply(this,arguments); }; })()"
        delay 0.3

        -- Click AI Describe
        execute tab_ javascript "document.getElementById('aiDescribe')?.click();"
        delay 4

        -- Get captured URLs and test one
        set capturedInfo to execute tab_ javascript "(function(){ window.fetch=window.__origFetch||window.fetch; const urls=window.__capturedImageUrls||[]; const first=urls[0]||null; return JSON.stringify({count:urls.length,first:first}); })()"

        return capturedInfo
      end if
    end repeat
  end repeat
  return "no GP tab"
end tell
