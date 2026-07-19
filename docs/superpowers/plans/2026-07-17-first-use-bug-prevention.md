# First-use bug prevention plan

## Scope

Protect the first local user journey without rewriting the existing Dashboard, Manager Flow Graph, Group Chat, Meeting, Timeline, intent routing, or proof actions.

## Public verification seams

1. Browser journey: local account -> model setup -> project brief -> local workspace -> team -> kickoff lobby.
2. Local backend boundary: `/workspace/pick-folder`, `/workspace/prepare`, and startup readiness responses as rendered by the UI.
3. Release boundary: existing frontend contracts and production build.

## Tasks

1. Capture current user-visible failures and add focused regression checks.
2. Localize the Settings connection footer and keep technical details out of the primary status message.
3. Make the "configure model later" action honest while preserving the provider readiness safety gate.
4. Add visible waiting, cancellation, and failure feedback to the native folder picker.
5. Scan the adjacent first-use path for silent failures, internal error leakage, and blocked actions without explanations.
6. Run two concentrated verification commands and repeat the browser journey with screenshot evidence.

## Acceptance criteria

- Chinese first-use screens do not display raw English operations, routes, or backend status codes by default.
- Choosing to postpone model setup does not promise that a real Agent kickoff can start without a model.
- The folder picker always shows waiting, selected, cancelled, or failed feedback.
- The provider readiness gate still prevents a real kickoff until the model is configured.
- Existing Dashboard and collaboration feature contracts remain unchanged and pass their release checks.
