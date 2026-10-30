# MS3 / MS4 / MS5 integration workflow

Agreed on 30 October 2026. This is the scoped integration plan alongside the
[agent onboarding](AGENT_ONBOARDING.md), PvA and TO. It does not authorize a
production release, production data changes, or unrelated backend work.
For this integration work, use isolated staging as described below, not the
older onboarding instructions about repeating seeds against production.

## 1. Baseline and destination

At the start of this setup:

- `integration/ms3-ms4-ms5` was created from `main` at `fab4981`.
- [PR #11](https://github.com/jaedyndant/VanderTweel/pull/11),
  `feature/ms3-client-platform-demo`, contains the client frontend and its
  existing backend integration. Jayden has approved the client frontend.
  Retargeting, fresh checks and the integration merge are still setup steps.
- The separate, public client review preview uses fixtures only. It cannot
  verify database writes, authentication, notifications or MS5 end to end.
- The back-office frontend, shared authenticated staging setup and combined
  E2E acceptance are not completed by this Git/CI change.
- `main` is currently not branch-protected. The connected account has push
  access, not repository administration access. See the owner action below.

The intended flow is:

```text
main (existing production code)
  └─ integration/ms3-ms4-ms5 (combined test/review base)
       ← chore/ms3-ms4-ms5-integration (this setup PR)
       ← feature/ms3-client-platform-demo (approved client PR #11)
       ← feature/ms4-backoffice-demo (next, separate task/PR)
       ← any narrowly scoped integration-fix PRs

integration/ms3-ms4-ms5 → main (final release PR, only after E2E + review)
```

The integration branch is a shared **merge target**, not a shared editing
branch. One task = one feature/chore branch = one reviewed PR. Claim the task
and file ownership in the project channel before starting. Never force-push,
rewrite another contributor's history or commit directly to integration/main.

## 2. Land the CI/setup PR first

Use `chore/ms3-ms4-ms5-integration`, based on the integration branch. Its scope
is CI plus this workflow documentation. Open its PR with
`--base integration/ms3-ms4-ms5`.

Before each merge, the author runs `npx tsc --noEmit`, `npx vitest run` and
`npm run build` locally; use only placeholder build configuration or explicitly
isolated staging configuration. Jaedyn/Jayden or the other assigned agent
reviews the actual diff. The integrator checks the latest GitHub `checks` run,
conflicts and the reviewed head SHA before merging through the PR. An author
must not invent a human approval or bypass a required review/check.

After the setup merge, verify that a **push** CI run succeeds on
`integration/ms3-ms4-ms5`. Verify trigger behaviour from actual Actions runs;
having a workflow file is not evidence that a run completed.

## 3. Bring the approved client into integration

Retarget the existing PR; do not create a duplicate or merge it into `main`:

```bash
gh pr edit 11 --base integration/ms3-ms4-ms5
gh pr checks 11 --watch
```

Review the changed base/diff and confirm fresh checks for that base. If the
feature needs the newest CI/base changes, merge the base into the feature:

```bash
git fetch origin
git switch feature/ms3-client-platform-demo
git merge origin/integration/ms3-ms4-ms5
git push origin feature/ms3-client-platform-demo
```

Resolve conflicts on that feature branch, rerun the gates and review any
material change beyond the already-approved client scope. Then merge PR #11
into **integration only** and verify the resulting integration push check.

## 4. Create and build the separate back-office feature

After the client merge, start from the updated integration branch in a clean
checkout/worktree (create the feature only if it does not already exist):

```bash
git fetch origin
git switch -c feature/ms4-backoffice-demo origin/integration/ms3-ms4-ms5
git push -u origin feature/ms4-backoffice-demo
```

Build only the back-office frontend and its connections to the existing
server actions/data contracts. Keep server-side role checks and the MS5
notification/refresh flow intact. The public website and MS6/3D stay out of
scope. A blocking backend defect is a named, separately scoped task/PR, not an
unannounced backend redesign.

Open a draft feature PR targeting `integration/ms3-ms4-ms5` as soon as there is
a reviewable diff. For subsequent synchronization:

```bash
git fetch origin
git switch feature/ms4-backoffice-demo
git merge origin/integration/ms3-ms4-ms5
git push origin feature/ms4-backoffice-demo
```

Run local gates, browser/responsive QA and actual GitHub checks, obtain the
assigned review, then merge this PR into integration. Do not skip the PR for
small fixes. If `main` advances, bring it into integration through a separate
sync branch/PR: branch from integration, merge `origin/main` there, resolve and
test, then review that sync PR. No direct commits to the shared target.

## 5. What GitHub CI checks — and does not check

`.github/workflows/ci.yml` keeps workflow `CI` and job/check `checks` stable:

- Branch pushes: every branch name, including `feature/**`, `chore/**`,
  `integration/**` and `main`; tag-only pushes do not trigger it.
- PRs: targets `main` or `integration/**`; opened, synchronized, reopened,
  edited and ready-for-review events. `edited` covers a changed base and also
  causes a run for title/body edits. No path filter skips documentation changes.
- Node 22, `npm ci`, TypeScript check, Vitest and the Next.js production build.
  There is no `lint` script in `package.json`, so no lint check is claimed.
- `contents: read`, no persisted checkout credential and a 20-minute job limit.
  New runs cancel older runs within the same event + branch/PR group; a push
  run and PR run cannot cancel each other.
- The build keeps the existing placeholder DB/auth/email values. This workflow
  does not migrate/seed data, deploy, send real mail or run browser E2E tests.

A push validates its branch revision; a normal PR run validates GitHub's test
merge with the target. Conflicted PRs need resolution before that PR run can
execute. These trigger semantics follow GitHub's
[workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
and [pull-request event documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request).
Cancellation follows GitHub's
[concurrency documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

**Rollout limitation:** branches must contain this workflow commit to use its
new push triggers. Existing feature branches inherit it by merging integration
into their own branch. `main` keeps its old workflow until the final release
PR lands; its existing main-push and main-target PR checks continue meanwhile.
Check actual run event, branch, commit and conclusion rather than assuming that
an old green status covers a newly retargeted or updated PR.

### Repository-owner action: enforce the merge gate

CI execution alone does **not** prevent merging red checks or direct pushes.
The repository owner must configure branch protection/rulesets for `main` and
`integration/ms3-ms4-ms5` (or the applicable integration pattern): require PRs,
the `checks` status from GitHub Actions, an assigned review and an up-to-date
base; prevent force pushes/deletion as appropriate. Confirm the effective
rules rather than relying on the older onboarding statement that main is
protected. This requires repository administration access and is not silently
performed by this workflow. It does not block preparing the branches/PRs;
until enabled, the integrator must enforce these gates operationally.

## 6. Prepare a real, isolated integration preview

The shared app preview must deploy the integration branch, with both `/office`
and `/koper` using the same **staging** backend. Branch creation alone does not
create or configure that environment.

1. Obtain legitimate access to the existing Jaedyn-owned Vercel project/team;
   do not assume access to a different Vercel account is sufficient.
2. Configure the integration Preview environment/branch explicitly with an
   isolated staging `DATABASE_URL`, separate `AUTH_SECRET`, correct auth
   callback/base URL configuration, and staging email credentials/sender.
   Verify resolved Preview settings do not fall back to production overrides.
3. Use dedicated test accounts/mailboxes for developer, PM and two unrelated
   buyers, with staging-only project/villa mappings and synthetic data. Do not
   copy customer data, seed production, or expose credentials in PRs/chat.
   Any fixture preparation is a separate, reviewed staging-only operation.
4. Make the preview accessible to authorized testers through normal Vercel
   access/sharing controls. Keep the app's real login and authorization intact;
   do not use `/api/dev-login` or add auth bypasses for acceptance evidence.
5. Confirm the deployed commit matches integration, login stays on this
   preview, reads/writes hit staging, and mail goes only to test recipients.
   Do not promote production or change its environment configuration.

The existing public **UI-only** review preview remains useful for design
feedback but is not this integration environment. Access, staging configuration
and E2E results must be recorded as pending until actually verified.

## 7. E2E acceptance for MS3 + MS4 + MS5

Use separate browser sessions for each role. Record commit/deployment,
viewport, test identity, action, expected/actual result and timestamps. Test
supported actions only; do not invent delete/upload/CRUD endpoints where the
existing backend exposes a narrower operation.

| Actor / scenario | Action and required evidence |
| --- | --- |
| Developer | Read the permitted projects/villas/buyers. Toggle progress, mark a payment paid, create an update and add a file link using the existing actions. Verify persistence after reload. |
| PM | Read and update progress/post permitted updates only for assigned projects. No payment/contract information, including indirect exposure through update text or file links. |
| Buyer A / buyer B | Keep both sessions open for different villas. Each team action for A must appear only for A, not B, including open details and subsequent reloads. Test multi-villa assignments if present in the agreed fixtures. |
| MS5 timing | Measure action completion to the correct buyer's visible update against the agreed one-minute requirement. Retaining 20-second polling is not proof that the full flow meets it. |
| Notifications | For notification-producing transitions, verify the correct staging recipients, in-app result and real email delivery. Exercise reversals/repeated actions according to the existing contract; ensure no unintended duplicate notifications. |
| Real login | Request and consume a real magic link, confirm role routing/session/logout, rejected or expired links and truthful errors. A dev-login shortcut or mailer mock is insufficient. |
| Negative authorization | Buyer cannot access office/write actions or another villa; PM cannot access unassigned projects, payments or contracts. Exercise direct routes/action requests, not only hidden buttons. |
| Mobile and failure states | Test office and buyer layouts/navigation on mobile, tablet and desktop; loading, empty, validation, denied access, failed save/network/email and retry states. A failed write must not show success. |

Existing review concerns about magic-link submission and financial data in
PM-visible updates remain explicit test targets. Green unit tests/builds or
client visual approval do not establish that these flows pass. Record actual
failures and resolve blockers through scoped PRs before acceptance.

## 8. Final release PR — no automatic merge

Once integration contains a reviewable client baseline, a **draft** PR from
`integration/ms3-ms4-ms5` to `main` can collect release evidence. Keep it draft
until the back-office PR, shared staging E2E matrix and remaining blockers are
complete. Attach links to feature PRs, checks, the tested deployment/commit,
screenshots and E2E results.

Before release: sync any new main changes through the reviewed sync process,
rerun checks and affected E2E cases, obtain final owner/reviewer approval, and
only then make the release merge decision. **Do not enable auto-merge or merge
this final PR as part of the current setup task.** Production stays unchanged
until that separate release decision.
