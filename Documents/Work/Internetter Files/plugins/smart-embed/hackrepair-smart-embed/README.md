# The Hack Repair Guy's Smart Embed

Safely embed custom code or content anywhere on your WordPress site.

Smart Embed makes it simple to drop clean HTML, forms, or widgets anywhere you like using a shortcode. No extra bloat, no unsafe scripts—just a smarter, safer way to embed what you need.

## Why Smart Embed?
- Direct and simple: Create a block, paste a shortcode, done.
- Secure by design: Your code stays clean and under your control.
- Reusable: Manage all embeds from one place and reuse them anywhere.

## Features
- Custom post type: Smart Embeds (title + editor)
- Shortcode embed by ID or slug
- Admin list shows ready-to-copy shortcodes
- “Copy Shortcode” button in the admin list
- Gutenberg compatible (`show_in_rest` enabled)
- Responsive wrapper option with optional max‑width
- Optional wrapper CSS class for layout control
- Editor Mode toggle: single switch to enable Visual mode (defaults to Code)
- Non‑public, not directly queryable; renders via shortcode only
- Optional cleanup: delete Smart Embed data on plugin deactivation (Settings)
- Optional URL embeds: per‑embed External Script URL (defer) + global allowlist (HTTPS only)
- Canvas helper: auto‑insert a canvas placeholder (ID + width/height) with a “full width” toggle so external JS can target it easily

## Shortcodes
- `[smart_embed id="123"]`
- `[smart_embed slug="my-block-slug"]`
- Optional attributes: `responsive="true|false"`, `max_width="800"`, `class="my-wrapper"`

## Quick start
1. Go to Smart Embeds (left admin menu) and click Add New. See Author Notes for examples and tips.
2. Copy the shortcode shown in the list.
3. Optionally set Responsive, Max Width, or a Wrapper Class in the sidebar.
4. Paste the shortcode anywhere shortcodes are processed (posts, pages, widgets).

## URL Embeds (optional)
1. In Smart Embeds → Settings, enable “Enable URL embeds”.
2. Add allowed domains (one per line), e.g. `cdn.example.com`.
3. Edit a Smart Embed and enter the “External Script URL”, e.g. `https://cdn.example.com/widget.js` (loads once per page with `defer`).
4. Place the shortcode as usual.

Notes:
- HTTPS only; the URL’s host must be in the allowlist (exact match or subdomain).
- Prefer allowing only the minimum domains you trust.
- If the widget requires markup, add it into the Smart Embed content.
- What the external script file should contain:
  - Only JavaScript code. Do not include <script>…</script> tags inside the file.
  - If you include <script> tags in the .js file, the browser treats them as invalid JS and nothing runs.
 - For canvas animations, you can either add the <canvas> in the embed content, or use the Canvas Placeholder option with your preferred ID/size (full‑width available).

### Canvas auto‑fit (retina/crisp)
Add this helper to your external JS to match the drawing buffer to the element’s CSS size and devicePixelRatio, then call it on init and on resize:

```
function fitCanvas(canvas){
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const W = Math.floor(w * dpr), H = Math.floor(h * dpr);
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W; canvas.height = H;
    canvas.getContext('2d').setTransform(dpr,0,0,dpr,0,0);
  }
}
// Usage
const canvas = document.getElementById('animationCanvas');
fitCanvas(canvas);
window.addEventListener('resize', ()=>fitCanvas(canvas));
```
- On first activation, the allowlist is seeded with your site domain, `cdnjs.cloudflare.com`, and `cdn.jsdelivr.net` (you can change this later).

—
Built by Jim Walker, The Hack Repair Guy — https://HackRepair.com
