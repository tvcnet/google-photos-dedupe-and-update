# Future Change Requests

This file tracks product changes that are intentionally deferred so they are not lost between cleanup and release work.

## Low Priority

### Remove `New Album` action from GPTK panel

- Requested: 2026-05-11
- Scope: remove the `New Album` option from the Step 3 action bar in the Google Photos panel.
- Current behavior: GPTK exposes both `Add to Album` and `New Album`.
- Rationale: `New Album` adds extra UI and another mutation path, but it is not part of the core stabilization workflow.
- Suggested implementation phase: after current Web Store readiness and core album-action stabilization work.
