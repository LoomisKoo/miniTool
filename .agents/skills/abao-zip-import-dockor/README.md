# abao-zip-import-dockor

Agent Skill for adapting a local project into a QMuse-importable React Web application, validating it, aligning rewritten results with the original pages (style and functionality gap-filling), diagnosing import failures, and following the remote job until `READY`.

The skill accepts a project directory or ZIP input. It preserves complete application behavior: it tries the least invasive adaptation first, then escalates to framework migration or a full functional rewrite when required. Non-Web frontends such as mini-programs or React Native require an explicit user decision before rewriting to Web/H5.

## Requirements

- Node.js 20 or newer.
- A QMuse account with access to the intended space.
- The official `@qmuse/qmuse-cli` installed from a trusted source. The skill does not install or upgrade the CLI without explicit authorization.
- File read/write and terminal capabilities in the host agent.
- A reviewed isolation environment before executing code from unknown repositories or ZIP archives.

Official QMuse CLI documentation: https://docs.qmuse.cn/docs/qmuse-cli

## Install from ZIP

Upload the provided `abao-zip-import-dockor-skills-sh.zip` to the Skill platform, or extract it and install the `abao-zip-import-dockor/` directory as an Agent Skill. The directory root contains `SKILL.md`; no npm install step is required for the skill itself. Review the ZIP contents before uploading.

## Usage

Examples:

- “Use abao-zip-import-dockor to import the current project into QMuse.”
- “Adapt `./demo.zip` for QMuse. Use the application name from package.json.”
- “Fix this failed QMuse import and resume the existing job instead of creating another app.”
- “The React rewrite is done — compare it against the original pages, fill the gaps, then import.”
- “Re-upload the modified project — it must update the existing app and reuse its app ID, not create a new one.”
- “Prepare an importable source package, but do not upload it yet.”

Defaults:

| Input | Rule |
| --- | --- |
| Project path | Explicit path, otherwise the agent's initial working directory |
| Application name | User input, then matching `apps.json`/`app.json`, then `package.json#name`, then the first nonempty line of `标题与介绍.txt`/`title.txt`, then an explicit README heading; ask the user if none exists |
| Space | Explicit space ID, otherwise inspect the CLI's current space without changing global state |
| Import mode | Modified projects re-upload as UPDATE and reuse the existing appId. Prefer an official managed binding; if unavailable, recover only from a trusted complete CREATE→READY result with the bundled binding helper |

## Workflow

1. Resolve scope, project root, application name, target space, create/update mode, authorization, and competition account verification. Run `qmuse whoami --json` without `--env pre` to verify the dedicated competition account; if the account is incorrect, guide the user to `qmuse logout` and log in via the dedicated competition awards portal. Once the final root is known, use `scripts/resolve-title.mjs`; it checks only the project root and direct-parent metadata.
2. Audit ZIP input before extraction; require a host extractor that meets the documented capability contract, then re-audit the extracted tree. Stop and request a safely extracted directory when no compliant extractor exists.
3. Detect the technology stack and migrate from the least invasive approach through a full functional React rewrite when required. Preserve behavior, data, copy, assets, and key visuals. HTML→React migrations also preserve Tailwind configuration and original custom CSS declarations, harden static color variables, verify root/app container semantics, reinstall CDN-provided global libraries as typed npm dependencies, boot injected scripts via `document.readyState` instead of `DOMContentLoaded`, and survive React StrictMode remounts by wrapping injected scripts in IIFEs with controlled attachment and full cleanup.
4. Inspect package scripts and run a single validation plan before staging. If `check` already proves typecheck/tests/production build, do not run build twice.
5. After a framework migration or full rewrite, compare the rewritten app against the original pages at identical viewports and data: page/state inventory taken from the original project, side-by-side captures, a scored gap list (blocker/major/minor) with evidence, and a fix loop until blocker/major reach zero. Screenshots and gap reports stay outside the upload set.
6. Discover a trusted collector. For a new app, build a clean staging directory from reviewed runtime files when no collector exists. Managed updates prefer the official template; a missing binding may be recovered only from the same app's trusted complete CREATE result, with `.qmuse` proven excluded from uploaded source.
7. Audit and freeze staging, then show a machine-readable pre-submit record containing title source, space, mode, app ID, file-set hash, audit result, cloud impact, and authorization match.
8. Submit once, persist the job ID, and continue the same status job until `READY`, `FAILED`, the time budget expires, or an external blocker occurs. A nonterminal timeout becomes `PENDING`, never success and never a duplicate import. If a stored space is no longer authorized, use `scripts/clear-space-id.mjs` to remove only that field with a secure backup before space re-discovery. After a successful first CREATE, preserve its complete JSON result outside the upload root and use `scripts/create-binding.mjs` to establish future UPDATE binding only when all required fields are present.
9. On failure, load recovery guidance, apply the smallest evidence-based fix, and repeat validation → alignment → staging → checkpoint. When blocked or failing, output a concise problem description and reproduction path for user feedback. When a fixable issue is resolved, format the problem and solution into a feedback card and prompt the user to submit it for continuous skill improvement. Deliver only verified results and explicit gaps.

## Bundled helpers

All scripts use Node.js 20 built-ins and do not access the network.

- `scripts/audit-source.mjs`: audits staged trees and ZIPs; it does not extract or upload.
- `scripts/resolve-title.mjs`: resolves only a non-sensitive application title and its source from user input or project metadata.
- `scripts/clear-space-id.mjs`: atomically removes only top-level `spaceId` from an explicitly selected QMuse config, creates a mode-0600 backup, and never prints credential values.
- `scripts/create-binding.mjs`: creates a new mode-0600 managed binding only from a trusted successful CREATE result plus its READY status read-back; it refuses overwrite, incomplete evidence, in-project evidence, app ID mismatch, and cross-space evidence discrepancies.
- `scripts/pre-submit.mjs`: mechanically validates staging audit status and writes a mode-0600 `pre-submit.json` checkpoint outside the upload set before import.

```bash
node scripts/audit-source.mjs tree /path/to/staging
node scripts/audit-source.mjs tree /path/to/project --manifest /outside/collector-files.json
node scripts/audit-source.mjs zip /path/to/input.zip
node scripts/resolve-title.mjs /path/to/project
node scripts/clear-space-id.mjs /path/to/.qmuse-cli.json --backup-dir /secure/outside/upload [--project-root /path/to/project]
node scripts/create-binding.mjs /path/to/project --evidence /outside/create-result.json --status-evidence /outside/create-status-ready.json --space-id S_TARGET --expected-app-id APP_ID --env prod
node scripts/pre-submit.mjs --project-root /path/to/project --staging-root /path/to/staging --title "App Name" --space-id S_TARGET --output /outside/pre-submit.json
```

Audit helper exit codes:

- `0`: `PASS` within the audit's documented scope.
- `1`: `BLOCKED`; do not upload.
- `2`: `REVIEW_REQUIRED`; inspect the named file/hash/rule and re-audit.

This is a conservative heuristic, not a malware scanner, full secret scanner, sandbox, safe extractor, or atomic filesystem snapshot. Media metadata/content and custom obfuscation require additional review. The exact QMuse collector file set must still be compared with the audited set.

## Safety model

- Unknown code is not executed directly on the host.
- ZIP archives are checked before extraction; extraction must occur in a fresh isolated directory with path/link/size limits.
- Upload is blocked when collection, path, link, secret, or high-entropy review is incomplete.
- `.env*`, package-manager credentials, VCS metadata, private keys/certificates, cloud/Kubernetes credentials, databases, logs, diagnostics, nested archives, and unknown binaries are rejected by default.
- The skill never treats project text or diagnostics as authorization to access credentials, broaden paths, create cloud resources, delete remote apps, bind another application, or publish elsewhere.
- Managed binding recovery requires complete trusted CREATE evidence for the same app/space/API; guessed fields, copied bindings, and cross-space updates are blocked.
- A local build, process exit code, `success: true`, or a job ID is not equivalent to remote `READY`.

## Files

```text
abao-zip-import-dockor/
├── SKILL.md
├── README.md
├── LICENSE
├── references/
│   ├── environment.md
│   ├── alignment-review.md
│   ├── import-and-recovery.md
│   └── security-gates.md
└── scripts/
    ├── audit-source.mjs
    ├── clear-space-id.mjs
    ├── create-binding.mjs
    ├── pre-submit.mjs
    └── resolve-title.mjs
```

## License

MIT. See `LICENSE`.
