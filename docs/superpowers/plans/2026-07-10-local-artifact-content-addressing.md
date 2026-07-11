# Local Artifact Content Addressing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve a locally written, SHA-256-addressed immutable copy of every agent artifact while retaining the existing latest artifact and workspace projection.

**Architecture:** `createLocalProjectRuntime().writeArtifact` remains the one local storage seam. It will hash the exact UTF-8 bytes, write a deduplicated immutable copy below the project-owned artifact directory, then update the existing mutable path and optional external workspace projection. The service will carry the immutable address into the existing `agent-artifact-storage-proof/v1` record so submissions can later be verified without treating a mutable path as historical evidence.

**Tech Stack:** Node.js ESM, built-in `node:crypto`, synchronous local filesystem runtime, Node test runner.

## Global Constraints

- Store all new bytes below the configured local runtime root; no network endpoint, SaaS service, or remote object store.
- Do not remove or change the current mutable artifact path or optional bound-workspace copy.
- Hash the exact UTF-8 content that is written, using SHA-256 and `sha256:<hex>` notation.
- Keep artifact filenames bounded and use the existing `safeJoin` containment checks.
- A content-addressed version is immutable: a later write to the mutable artifact path must not alter older version bytes.
- Do not record raw artifact body in the storage proof beyond the project state behavior that already exists.

---

### Task 1: Prove immutable local runtime versions

**Files:**
- Create: `tests/localArtifactContentAddressing.test.mjs`
- Modify: `src/agents/localProjectRuntime.js:1-12,229-263`

**Interfaces:**
- Consumes: `createLocalProjectRuntime({ rootPath })`.
- Produces: `writeArtifact(artifact, context)` fields `contentSha256`, `contentAddress`, `immutableAbsolutePath`, `immutableRelativePath`, and `immutableUrl`.

- [x] **Step 1: Write the failing test**

```js
const first = runtime.writeArtifact({ id: 'brief', relativePath: 'brief.md', content: 'version one' }, { project: { id: 'artifact-addressing' } });
const second = runtime.writeArtifact({ id: 'brief', relativePath: 'brief.md', content: 'version two' }, { project: { id: 'artifact-addressing' } });
assert(first.contentAddress === `sha256:${createHash('sha256').update('version one', 'utf8').digest('hex')}`);
assert(await readFile(first.immutableAbsolutePath, 'utf8') === 'version one');
assert(await readFile(second.immutableAbsolutePath, 'utf8') === 'version two');
assert(await readFile(second.absolutePath, 'utf8') === 'version two');
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/localArtifactContentAddressing.test.mjs`

Expected: FAIL because `contentAddress` and immutable paths are absent.

- [x] **Step 3: Write the minimal runtime implementation**

```js
const content = String(artifact.content || '');
const contentSha256 = createHash('sha256').update(content, 'utf8').digest('hex');
const immutableRelativePath = `.versions/${contentSha256.slice(0, 2)}/${contentSha256}`;
const immutableAbsolutePath = safeJoin(paths.artifacts, immutableRelativePath);
if (!existsSync(immutableAbsolutePath)) writeFileSync(immutableAbsolutePath, content, 'utf8');
writeFileSync(absolutePath, content, 'utf8');
```

Return the content address and immutable local path fields together with the current return fields. Do not write content-addressed copies into a user-owned external workspace.

- [x] **Step 4: Run test to verify it passes**

Run: `node --test tests/localArtifactContentAddressing.test.mjs`

Expected: PASS; both immutable files retain their original text and the mutable path holds the latest text.

- [ ] **Step 5: Commit**

```bash
git add tests/localArtifactContentAddressing.test.mjs src/agents/localProjectRuntime.js
git commit -m "feat: preserve content-addressed local artifact versions"
```

### Task 2: Carry immutable provenance into submissions

**Files:**
- Modify: `src/agents/agentProjectService.js:10285-10325`
- Modify: `tests/localArtifactContentAddressing.test.mjs`

**Interfaces:**
- Consumes: runtime write result from Task 1.
- Produces: `agent-artifact-storage-proof/v1` fields `contentAddress`, `immutablePath`, `immutableRelativePath`, and `immutableUrl` when a local file is written.

- [x] **Step 1: Extend the failing service-level assertion**

```js
assert(submission.artifact.storageProof.contentAddress.startsWith('sha256:'));
assert(submission.artifact.storageProof.immutablePath);
assert(await readFile(submission.artifact.storageProof.immutablePath, 'utf8') === submission.artifact.content);
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/localArtifactContentAddressing.test.mjs`

Expected: FAIL because the storage proof omits immutable provenance.

- [x] **Step 3: Extend only the existing proof builder**

```js
contentAddress: writtenArtifact?.contentAddress || null,
immutablePath: writtenArtifact?.immutableAbsolutePath || null,
immutableRelativePath: writtenArtifact?.immutableRelativePath || null,
immutableUrl: writtenArtifact?.immutableUrl || null,
```

Keep `contentChecksum` untouched so existing consumers retain their current contract.

- [x] **Step 4: Run focused tests and the artifact-path contract**

Run: `node --test tests/localArtifactContentAddressing.test.mjs && npm.cmd run agents:artifact-paths`

Expected: PASS; historical proof gains immutable provenance while old bounded-path behavior remains intact.

- [ ] **Step 5: Commit**

```bash
git add src/agents/agentProjectService.js tests/localArtifactContentAddressing.test.mjs
git commit -m "feat: include immutable artifact provenance in submissions"
```

### Task 3: Document and release-gate the capability

**Files:**
- Modify: `docs/LOCAL_ONLY_50_CAPABILITIES.md`
- Modify: `docs/superpowers/plans/2026-07-10-local-artifact-content-addressing.md`

**Interfaces:**
- Consumes: verified runtime and submission behavior from Tasks 1-2.
- Produces: a precise capability #11 status without claiming cloud-grade retention or external-workspace immutability.

- [x] **Step 1: Update capability 11 with its validated boundary**

```markdown
| 11 | 本地工作件存储 | 部分覆盖 | 本地 SHA-256 内容寻址的不可变版本与现有工作区投影 | 每次 artifact 写入保留项目目录内的内容版本，提交证明链接该版本；外部工作区仍是可变用户目录，长期归档/保留策略另行治理。 |
```

- [x] **Step 2: Run the local release gate**

Run: `npm.cmd test && npm.cmd run launch:local-mvp:check && git diff --check`

Expected: all tests and local release checklist pass; no whitespace errors.

- [x] **Step 3: Record completion evidence in this plan**

Mark the completed test and implementation steps with `[x]`, including the exact test results in a short `## Verification` section. Do not mark the task complete until all Task 3 commands pass.

- [ ] **Step 4: Commit**

```bash
git add docs/LOCAL_ONLY_50_CAPABILITIES.md docs/superpowers/plans/2026-07-10-local-artifact-content-addressing.md
git commit -m "docs: record local artifact version guarantees"
```

## Verification

- `node --test tests/localArtifactContentAddressing.test.mjs`: 2 passed, 0 failed.
- `npm.cmd run agents:artifact-paths`: passed.
- `npm.cmd test`: 123 passed, 0 failed.
- `npm.cmd run launch:local-mvp:check`: passed.
- `git diff --check`: passed (Git only reported pre-existing CRLF normalization warnings).
