# Release v0.0.1 - Final Steps (Protected Branch Merge)

## ⚠️ Important: Main Branch is Protected

The `main` branch on GitHub is configured with branch protection rules:

- ✅ Requires pull request reviews before merging
- ✅ Dismisses stale pull request approvals when new commits are pushed
- ✅ Requires status checks to pass before merging

## Current Status

```
Local:
  main:    0d0afed (13 commits ahead of origin/main)
           Merge PR: Release v0.0.1 with security, reliability, and observability improvements

  origin/main: 91d01ca (production version, not updated yet)

  develop: 376b514 (1 commit ahead of main - PR instructions doc)
           All features ready for release

  tag v0.0.1: Created and pushed ✅
```

## To Complete the Release Merge

Since we cannot push directly to main (branch protection), you must complete this via GitHub:

### Method 1: GitHub Web UI (Recommended)

1. **Go to:** https://github.com/gssantos94/Jerusalem-Dorme
2. **Click:** Pull requests → New pull request
3. **Set:**
   - Base: `main`
   - Compare: `develop`
4. **Click:** Create pull request
5. **Title:** `Release v0.0.1: Security, reliability, and observability improvements`
6. **Description:** Copy contents from `PR_INSTRUCTIONS_v0.0.1.md`
7. **Add labels:** `release`, `enhancement`
8. **Click:** Create pull request
9. **After review:** Click "Merge pull request"
10. **Select:** "Create a merge commit"
11. **Confirm merge**

### Method 2: GitHub CLI (if installed)

```bash
# From your local branch develop
gh pr create \
  --base main \
  --head develop \
  --title "Release v0.0.1: Security, reliability, and observability improvements" \
  --body-file PR_INSTRUCTIONS_v0.0.1.md \
  --label release,enhancement

# Get the PR number (e.g., #1)
# Then merge:
gh pr merge 1 --merge --auto
```

### Method 3: Using GitHub API

```bash
# Create PR
curl -X POST https://api.github.com/repos/gssantos94/Jerusalem-Dorme/pulls \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Release v0.0.1: Security, reliability, and observability improvements",
    "body": "'"$(cat PR_INSTRUCTIONS_v0.0.1.md)"'",
    "head": "develop",
    "base": "main"
  }'

# Merge PR (after approval, if needed)
curl -X PUT https://api.github.com/repos/gssantos94/Jerusalem-Dorme/pulls/1/merge \
  -H "Authorization: token YOUR_GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "merge_method": "merge",
    "commit_title": "Merge PR: Release v0.0.1",
    "commit_message": "Merging v0.0.1 release from develop to main"
  }'
```

## What Happens After Merge

✅ **Automatic:**

- GitHub merges `develop` → `main`
- Commit 0d0afed becomes part of main history
- tag `v0.0.1` is visible on GitHub releases

✅ **Manual (recommended):**

1. Go to Releases: https://github.com/gssantos94/Jerusalem-Dorme/releases
2. Click "Draft a new release"
3. Select tag: `v0.0.1`
4. Title: `Release v0.0.1 - Initial Stable Release`
5. Description: Copy from PR_INSTRUCTIONS_v0.0.1.md
6. Add labels: `release`, `stable`
7. Click "Publish release"

## Verification Checklist

After merge is complete:

- [ ] PR created and merged
- [ ] develop → main merge commit visible in GitHub
- [ ] tag v0.0.1 linked to release
- [ ] GitHub Release created and published
- [ ] Build workflow triggered automatically (if configured)
- [ ] Release announced (if desired)

## Current Release Contents

**Features in v0.0.1:**
✅ Rate limiting (HTTP + Socket.IO)
✅ Input validation (Zod schemas)
✅ Timer synchronization (client-server)
✅ Event logging with /api/logs endpoint
✅ Night turn state machine
✅ Fisher-Yates shuffle
✅ Deterministic role distribution
✅ Memory leak fixes
✅ Socket.IO auto-reconnect
✅ Environment configuration

**Documentation:**

- README.md (updated with v0.0.1 features)
- PR_INSTRUCTIONS_v0.0.1.md (comprehensive PR info)
- PR_INSTRUCTIONS_v0.0.1_FINAL.md (this file)

**Commits in Release:**

```
376b514  docs: Add PR instructions for v0.0.1 release
1292607  docs: Update README with v0.0.1 improvements (TAG: v0.0.1)
cbd581c  feat(night-turns): Implement ordered night action state machine
26a5771  feat(timer-sync): Synchronize timer between client and server
7e08eb0  feat(logging): Implement comprehensive game event logging
796f549  feat(typagem): Add strict runtime validation with zod schemas
1835a0b  feat(rate-limiting): Add Socket.IO and HTTP request rate limiting
```

## Why This Process?

Protected branches ensure:

1. **Code quality:** All changes reviewed before merging
2. **Stability:** Status checks must pass (build, tests, etc)
3. **Audit trail:** Pull requests create clear merge records
4. **Rollback capability:** Easy to identify what changed in each release

## Next Version

After v0.0.1 merge:

- Continue development on `develop` branch
- Create new features in feature branches (e.g., `feature/xyz`)
- Follow same workflow: feature → develop → main via PR
- Tag releases with semantic versioning (v0.0.2, v0.1.0, etc)

---

**Status:** ✅ All code ready
**Pending:** GitHub PR merge (requires web UI or authorized API token)
**Release Tag:** v0.0.1 (created and pushed)
**Time to merge:** < 5 minutes

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
