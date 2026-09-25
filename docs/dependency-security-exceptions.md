# Dependency security exceptions

There are no active dependency security exceptions. `scripts/production-dependency-audit.cjs` fails on every high or critical production advisory.

## Retired: `image-size` 1.2.1 through Metro (closed 2026-09-25)

- Advisories: `GHSA-w3rx-r6r6-pgpr` (ICNS, `>=0.6.3 <=2.0.2`) and `GHSA-5p2g-fcmc-qvqq` (JXL/HEIF, `>=1.2.0 <=2.0.2`); both are fixed in `image-size` 2.0.3, and no fixed 1.x release exists.
- Previous exposure: `metro@0.84.4`, pulled in by `@react-native/community-cli-plugin@0.85.3`, depended on `image-size@^1.0.2`. It was covered from 2026-08-12 by the local `patches/image-size+1.2.1.patch` and a digest-pinned audit allowlist with a 2026-09-30 review deadline.
- Resolution: `metro@0.84.5` replaces the dependency with Metro's own image-dimension reader. Expo 56 already pins that exact Metro version, and the CLI plugin's `^0.84.3` range accepts it, so a scoped root `overrides` entry aligns the CLI plugin's Metro packages on 0.84.5. `image-size` is no longer installed.
- Removed with the exception: the patch file, its hostile-buffer test, and the audit allowlist, digest and deadline logic. A reappearing vulnerable `image-size` now fails the production audit like any other high advisory.
