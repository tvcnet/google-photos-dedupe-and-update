(function(){
  function api(){ return (window.wp && wp.data && wp.data.select && wp.data.dispatch) ? wp.data : null; }
  function getClassicMode(){
    var wrap = document.getElementById('wp-content-wrap');
    if (!wrap) return null;
    if (wrap.classList.contains('tmce-active')) return 'visual';
    if (wrap.classList.contains('html-active')) return 'text';
    return null;
  }
  function getMode(){
    var d=api();
    try { if (d) { var m = d.select('core/edit-post').getEditorMode(); if (m) return m; } } catch(e){}
    return getClassicMode();
  }
  function setClassicMode(desired){
    try {
      var btnHtml = document.getElementById('content-html');
      var btnTmce = document.getElementById('content-tmce');
      if (desired === 'text' && btnHtml) { btnHtml.click(); return true; }
      if (desired === 'visual' && btnTmce) { btnTmce.click(); return true; }
    } catch(e){}
    return false;
  }
  function setMode(desired){
    var d=api();
    // Try Gutenberg first
    try {
      if (d && d.dispatch('core/edit-post')){
        var current = getMode();
        if (current !== desired){
          if (d.dispatch('core/edit-post').setEditorMode) {
            d.dispatch('core/edit-post').setEditorMode(desired);
          } else {
            d.dispatch('core/edit-post').toggleEditorMode();
          }
        }
        return;
      }
    } catch(e){}
    // Fallback to Classic Editor
    setClassicMode(desired);
  }
  function whenEditPostReady(cb){
    var tries = 0;
    var timer = setInterval(function(){
      var d = api();
      try {
        if (d && d.select('core/edit-post') && d.dispatch('core/edit-post')) {
          clearInterval(timer);
          cb();
        }
      } catch(e){}
      if (++tries > 60) { clearInterval(timer); }
    }, 100);
  }
  function isNewPost(){
    if (!(window.wp && wp.data)) return false;
    try { return (wp.data.select('core/editor').getEditedPostAttribute('status') === 'auto-draft'); } catch(e){ return false; }
  }
  function updateUI(toggle, label){
    var mode = getMode();
    if (!mode) return;
    if (toggle) toggle.checked = (mode === 'visual');
    if (label)  label.textContent = toggle.checked ? 'ON' : '';
  }
  function init(){
    var toggle = document.getElementById('hrgse_editor_toggle');
    var label  = document.getElementById('hrgse-editor-toggle-label');
    if (!toggle || !label) return;
    // Ensure stores are ready, then initialize behavior and default
    whenEditPostReady(function(){
      // Default new Smart Embeds to Code editor
      if (window.hrgse_editor_i18n && hrgse_editor_i18n.default_to_code && isNewPost()) {
        setMode('text');
      }
      updateUI(toggle, label);
    });
    // Toggle handler
    toggle.addEventListener('change', function(){
      var desired = this.checked ? 'visual' : 'text';
      whenEditPostReady(function(){
        setMode(desired);
        setTimeout(function(){ updateUI(toggle, label); }, 150);
      });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
