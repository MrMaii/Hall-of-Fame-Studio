# Local User Quickstart

This guide is the shortest supported path from a clean checkout to a real, restart-safe local project. It is intended for people who want to use Hall of Fame Studio, not only inspect the sample fixture or debug the code.

## What this path supports

- One local installation on a trusted computer
- Local accounts and project membership
- A local or remote OpenAI-compatible model
- Real kickoff meetings, project creation, Agent work, transcripts, timeline, and event evidence
- Project state and workspace files that survive a browser refresh or app restart

It does not make the current build safe for an unattended public SaaS deployment. Managed secrets, managed persistence, queues, centralized observability, incident response, provider governance, and public-production policy gates remain required.

This repository also has no open-source license yet. Until the maintainer selects and adds one, the code is source-available, not legally open source.

## Requirements

- Node.js 20 or newer
- npm
- A model endpoint reachable from this computer
- A modern browser

## Install and start

```bash
git clone https://github.com/MrMaii/Hall-of-Fame-Studio.git
cd Hall-of-Fame-Studio
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. The one `npm run dev` process supervises both the local backend on port `8787` and the UI on port `5173`.

For a clean-machine startup check before opening the product:

```bash
npm run local:verify
```

## Complete the first run

1. Create the first local administrator. Use a password you can keep on this computer; the product does not provide cloud password recovery.
2. Open the model setup shown by first run.
3. Select the provider and model, run **Test model**, then use **Check and save model**.
4. Enter the project name, a concrete goal, and the expected first output.
5. Keep the default workspace under `./projects`, or choose another writable local folder.
6. Select a Leader, a Reviewer, and at least one execution member.
7. Complete the kickoff meeting. Give the team a direct instruction, wait for the Agent turns, then end the meeting.
8. Review the team and first actions, then choose **Create project and open dashboard**.
9. Refresh the browser once. The same project dashboard should recover automatically.

Do not use **Load Sample Fixture** to judge the real workflow. It only loads demonstration data.

## Model field examples

For a no-key local OpenAI-compatible server, the repository defaults are:

| Field | Example |
| --- | --- |
| Provider | Custom / OpenAI-compatible |
| Base URL | `http://127.0.0.1:11434/v1` |
| Model name | `llama3.2` or the exact model ID served locally |
| Model key | Leave blank |
| No-key option | Enabled |

The model server must already be running and must expose an OpenAI-compatible chat-completions API. Search is optional for the first kickoff; configure it only when the project needs external evidence search.

For a provider that requires an API key, enable the local encrypted vault before starting the app. Keep the same vault key across restarts and never commit it.

PowerShell:

```powershell
$env:SECRET_VAULT_ENABLED='true'
$env:SECRET_VAULT_KEY='replace-with-a-long-local-secret'
npm run dev
```

macOS or Linux:

```bash
export SECRET_VAULT_ENABLED=true
export SECRET_VAULT_KEY='replace-with-a-long-local-secret'
npm run dev
```

Then enter the provider key in the product. The browser keeps it only as a transient draft; the local backend seals it.

## Common recovery steps

| Symptom | Action |
| --- | --- |
| Port `5173` or `8787` is already in use | Stop the older Hall of Fame Studio process, then run `npm run dev` again. |
| Model test cannot connect | Confirm the model process is running, the Base URL includes `/v1` when required, and the model ID is exact. |
| A local model asks for a key | Enable the no-key option only for a loopback endpoint such as `127.0.0.1` or `localhost`. |
| Local session expired | Open Settings, sign in again under Local account, then return to model or project setup. |
| Workspace creation fails | Choose a writable folder owned by the current user; avoid a drive root or protected system folder. |
| Dashboard synchronization is slow | Wait up to 12 seconds. The UI will leave the blocking loader and keep the current console usable; use **Retry sync** if the warning remains. |

Create a recovery backup before testing risky changes:

```bash
npm run local:backup
```

Validate the restore procedure in an isolated drill:

```bash
npm run local:recovery:drill
```

## Maintainer verification

Before sharing a revision with local users, run:

```bash
npm test
npm run build
npm run skills:check
npm run skills:blend
npm run agents:scenario:contract
npm run agents:product-team:research-sample
npm run ui:real-user-zero-to-autonomy
npm run launch:local-mvp:check
```

These checks cover code contracts and the local product path. They are not approval for public production.
