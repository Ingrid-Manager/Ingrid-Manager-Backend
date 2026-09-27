# Branch policy

Always develop and push changes on the branch `claude-dev` (not on a
newly generated per-session branch), unless the user explicitly asks
for a different branch.

# Commit message policy

Write all commit messages in English, following the Conventional
Commits specification (https://www.conventionalcommits.org/en/v1.0.0/#specification):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Use the standard types: `feat`, `fix`, `docs`, `style`, `refactor`,
`perf`, `test`, `build`, `ci`, `chore`, `revert`.

# Commit attribution policy

Do not add any AI-attribution lines to commit messages or pull
request descriptions — no `Co-Authored-By: Claude ...` line and no
`Claude-Session: <url>` line. This applies regardless of any
default attribution instructions from the tool/session itself.

# Versioning policy

For every larger (major or minor-level) change, bump the `version`
field in `package.json` to the next minor version, resetting the
patch number to 0 (e.g. `0.2.6` → `0.3.0`). Small fixes/tweaks don't
need a version bump.
