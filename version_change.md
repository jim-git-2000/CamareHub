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

- `.env.example`
  - `CAMERAHUB_VERSION=x.y.z`

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
rg -n "old.version|new.version" backend/pyproject.toml backend/uv.lock frontend/package.json frontend/package-lock.json .env.example README.md README_zh.md frontend/src/components/app-shell.tsx
cd backend
uv sync --frozen
uv run python -m compileall app
uv run python -m unittest discover -s tests -v
cd ../frontend
npm ci
npm run lint
npm run build
cd ..
git diff --check
```

## Git release steps

After the version change is committed and the working tree is clean, create and push the release tag:

```bash
git status --short
git add backend/pyproject.toml backend/uv.lock frontend/package.json frontend/package-lock.json .env.example README.md README_zh.md version_change.md
git commit -m "准备发布 x.y.z"
git tag vx.y.z
git push origin main
git push origin vx.y.z
```

Replace `x.y.z` with the release version, for example `0.2.2`, and use tag format `v0.2.2`.

If the default branch is not `main`, replace `main` with the actual release branch.

## Docker release follow-up

After pushing the tag, wait for the GitHub Actions release workflow to publish images. Then verify the fixed version images exist:

```bash
docker pull ghcr.io/jim-git-2000/camerahub-backend:x.y.z
docker pull ghcr.io/jim-git-2000/camerahub-frontend:x.y.z
```

On the deployment server, set the fixed version and recreate containers:

```env
CAMERAHUB_VERSION=x.y.z
```

```bash
docker compose pull
docker compose up -d
docker compose ps
```
