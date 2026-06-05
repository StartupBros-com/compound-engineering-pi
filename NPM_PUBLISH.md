# Publish to npm (super simple)

This repo is the StartupBros-maintained fork. Only publish to npm after an explicit release decision; otherwise keep validated work as a git commit/tag.

If this is your first time publishing, run these exact commands in order.

## 0) Go to repo

```bash
cd /home/will/SITES/pi-compound-engineering
```

## 1) Login once

```bash
npm login
npm whoami
```

If `npm whoami` prints your username, you are ready.

## 2) Run preflight checks

```bash
npm run release:check
```

This runs tests + package dry run.

## 3) Publish

```bash
npm run release:publish
```

## 4) Verify it is live

```bash
npm view compound-engineering-pi version
```

For the v0.2.7 release, you should see: `0.2.7`

## 5) Verify Pi install path

```bash
pi install npm:compound-engineering-pi -l
```

---

## If publish fails

### `ENEEDAUTH`
Run login again:

```bash
npm login
```

### `EOTP`
Publishing requires a one-time password. Re-run the publish command with the current OTP:

```bash
npm run release:publish -- --otp=123456
```

### `You do not have permission`
Your npm account is not allowed to publish this package name.
Use your own scoped package name in `package.json`, e.g.:

```json
"name": "@your-scope/compound-engineering-pi"
```

Then publish with:

```bash
npm publish --access public
```

### `version already exists`
Bump version, then publish again:

```bash
npm version patch
npm publish --access public
```
