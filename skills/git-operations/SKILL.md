---
name: git-operations
description: Standardised Git workflow for committing and managing branches across the monorepo. Always uses switch (never checkout), separates commit from push, and only triggers after green tests or explicit user request.
---

# Git Operations Skill

Standardised Git workflow for committing code changes and managing branches.

## When this skill activates

This skill triggers when:

1. **All required/performed tests are green** — lint, typecheck, tests, and build have passed, AND the user's change is ready to be committed.
2. **The user explicitly requests it** — e.g., "commit this", "stage my changes", "create a commit".

It does **not** activate during active development or debugging.

---

## Required inputs

Before invoking this skill, the following must be available:

| Input | Required | Description |
|---|---|---|
| **List of staged files** | Yes | Which files to include in the commit. Verify with `git status --short`. |
| **Verification results** | Yes | Output from the last run of lint, typecheck, tests, and build. If any failed, the skill does not proceed unless the user explicitly overrides. |
| **Branch context** | Yes | The current branch name (obtained via `git branch --show-current`) and the target branch if a switch is needed. |
| **Change summary** | Yes | A brief description of what was changed and why — used to write the commit message. |

---

## Workflow

### Step 1 — Confirm readiness

1. Check that **all required tests are green** (lint, typecheck, tests, build). If any are red:
   - Report which check failed with its output.
   - Do **not** proceed unless the user explicitly says "commit anyway" or similar.
2. If the user explicitly requested the skill, skip the test gate and proceed.

### Step 2 — Stage files (if not already staged)

1. Run `git status --short` to see what is staged and what is unstaged.
2. Stage only the intended files using `git add <path>`. Avoid `git add -A` unless the user confirms all changes are intended.
3. Run `git status --short` again to confirm exactly the right files are staged.

### Step 3 — Write and execute the commit

1. Write a professional commit message following this template:

   ```
   <type>(<scope>): <imperative summary, max 72 characters>

   - Bullet point detailing what was changed and why
   - Each bullet is a complete sentence starting with a verb
   - Reference edge cases handled, tests added, or decisions made
   - If applicable, note what was verified (lint, typecheck, build, tests)
   ```

   Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`, `perf`.

2. Execute: `git commit -m "<message>"`

### Step 4 — Verify the commit

Run these checks to confirm the commit was performed correctly:

| Acceptance criterion | How to verify |
|---|---|
| **Commit exists in history** | `git log --oneline -3` shows the new commit at the top |
| **Working tree is clean** | `git status --short` produces no output (no unstaged or untracked files remain) |
| **Commit message is correct** | `git log -1 --format=%s` shows the expected summary |
| **Only intended files are included** | `git diff --stat HEAD~1 HEAD` lists only the expected files |
| **Branch is the expected one** | `git branch --show-current` matches the intended working branch |

### Step 5 — Suggest the push

After the commit is verified:

1. Report the commit hash, summary, and branch name to the user.
2. **Do not push automatically.**
3. Suggest the push command with the correct branch:

   ```
   git push origin <branch-name>
   # Replace <branch-name> with the actual branch
   ```

4. If the current branch is not `domain-model` or `main`, also suggest creating a pull request:

   ```
   https://github.com/christiansquitieri1999/Nexova-website/ull/new/<branch-name>
   ```

If the user approves, use `git switch <target-branch>` first (never `git checkout`) before the push.

---

## Branch management rules

- **Always use `git switch`** to change branches. Never use `git checkout` for branch switching.
- Before switching branches, ensure the working tree is clean (`git status --short` produces no output).
- To create and switch to a new branch: `git swich -c <branch-name>`.
- To switch to an existing branch: `git switch <branch-name>`.

---

## Acceptance criteria

The git-operations skill is considered successfully executed when:

- [ ] All required tests were green before committing (or user explicitly overrode
- [ ] Only the intended files are staged and committed
- [ ] Working tree is clean after the commit
- [ ] Commit message follows the professional template format
- [ ] Branch was managed using `git switch` exclusively (never `git checkout`)
- [ ] Commit was separated from push (push was only suggested, not executed)
- [ ] The user was given the exact push command for teir current branch

---

## Examples

### Example 1:  Feature commit after green tests

**Situation:** User implemented a new filter on the candidate page. Lint, typecheck, tests, and build all pass.

1. Verify tests are green → yes, all pass
2. Stage files: `git add uis/backoffice/app/candidate-tble.tsx`
3. Write commit message:
   ```
   feat(backoffice): add skill-based filter to candidate table

   - Implement multi-select skill filter with AND/OR logic
   - Handle empty selection (shows all candidates)
   - Add test for empty, partial, and full match scenarios
   - Verified: lint, typechck, build, tests (all green)
   ```
4. Verify: `git og --oneline -3` shows the commit; `git status --short` is empty
5. Report to user and suggest: `git push origin feature/candidate-skill-filter`

### Example 2: Bug fix with user override

**Situation:** User fixed a critical bug but typecheck fails due to an unrelated file.

1. Check tests → typecheck fails with error in unrelated file
2. Report to user: "Typecheck fails in `uis/website/app/page.tsx` (pre-existing, unrelated to your change). Do you want to commit anyway?"
3. If user says yes, proceed with commit.
4. Add note in commit message: `Note: typecheck failure is pre-existing in uis/website/app/page.tsx, not introduced by this change.`