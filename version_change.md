# Version Change Checklist

Use this file when preparing a new CameraHub release version.

## Files to update

Replace the current CameraHub version, for example `0.2.2`, with the next release version in these files:

- `backend/pyproject.toml`
  - `[project]`
  - `version = "x.y.z"`

- `backend/uv.lock`
  - `[[package]]`
  - `name = "backend"`
  - `version = "x.y.z"`

- `frontend/package.json`
  - top-level `"version": "x.y.z"`

- `frontend/package-lock.json`
  - top-level `"version": "x.y.z"`
  - `packages[""].version`

- `README.md`
  - fixed deployment examples:
    - `CAMERAHUB_VERSION=x.y.z`
    - ``CAMERAHUB_VERSION=x.y.z` => deploy release `x.y.z``

- `README_zh.md`
  - fixed deployment examples:
    - `CAMERAHUB_VERSION=x.y.z`
    - ``设置 `CAMERAHUB_VERSION=x.y.z`：部署正式版本 `x.y.z``

## Do not update

- Dependency versions in lock files, such as `0.2.11`, `0.2.17`, or `10.2.2`.
- Historical release notes or development plan files unless explicitly requested.
- `frontend/src/components/app-shell.tsx`; the header version badge reads from `frontend/package.json`.

## Suggested verification

After editing, run:

```bash
rg -n "old.version|new.version" backend/pyproject.toml backend/uv.lock frontend/package.json frontend/package-lock.json README.md README_zh.md frontend/src/components/app-shell.tsx
python3 -m compileall backend/app
cd frontend && node node_modules/typescript/bin/tsc --noEmit
git diff --check
```
