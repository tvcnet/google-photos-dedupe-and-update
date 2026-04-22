# GPTK Tools

These scripts support the live unpacked extension in `../gptk`.

## Current Runtime Target

- **Live extension:** `../gptk`
- **Current backup reference:** `../gptk 3.zip`

Use the scripts here to debug or smoke-test the live extension. Do not treat these tools as a replacement for the runtime code in `../gptk`.

## Tool Classes

### Active smoke and diagnostic helpers

Use these first when checking whether the current extension still boots and responds:

- `check_gptk.applescript`
- `check_bg_storage.applescript`
- `check_bridge_console.applescript`
- `check_state.applescript`
- `check_storage2.applescript`
- `check_version.applescript`
- `verify_storage.applescript`
- `reload_gp.applescript`
- `reload_and_test_bridge.applescript`
- `test_bridge_alive.applescript`
- `test_bridge_fetch.applescript`
- `cdp_bridge_check.js`
- `cdp_sw_test.js`
- `cdp_monitor_ai.js`

### End-to-end or flow probes

Use these when the live extension is already loaded and you want a broader behavior check:

- `e2e_test.applescript`
- `full_e2e.applescript`
- `full_flow_test.applescript`
- `simple_flow_test.applescript`
- `test_ai_describe.applescript`
- `test_with_filter.applescript`
- `run_ai_describe.applescript`
- `cdp_full_test.js`
- `cdp_mainworld_test.js`
- `reload_ext.js`
- `reload_ext_only.js`

### Older one-off probes

Keep for archaeology or narrow debugging only. Review before trusting them because some were written against earlier rebuild states:

- `test_confirm_flow.applescript`
- `test_modal.applescript`
- `test_thumb_url.applescript`
- `intercept_url.applescript`
- `trace_click.applescript`
- `cdp_no_ext_reload.js`
- `reload_and_verify.applescript`

### Backup and recovery aids

Reference only when comparing against older states:

- `google-photos-deduper-v2.1.3.zip`
- `gdupe.zip`
- `github-fork.txt`
- `social-toolkit.css`

## Guidance

- Prefer the active smoke helpers before running broad E2E probes.
- If a script assumes an open Google Photos tab or a loaded extension, make sure that state exists first.
- When a tool result conflicts with the live runtime, trust `../gptk` and the browser state over older probes.
