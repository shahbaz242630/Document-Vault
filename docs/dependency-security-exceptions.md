# Dependency security exceptions

## `image-size` 1.2.1 through Expo/Metro

- Advisories: `GHSA-w3rx-r6r6-pgpr` and `GHSA-5p2g-fcmc-qvqq`.
- Exposure: transitive build-time parsing through the Expo/Metro toolchain.
- Upstream status on 2026-08-12: every published `image-size` version is marked affected and no patched release is available.
- Local mitigation: `patches/image-size+1.2.1.patch` rejects undersized ISO boxes and ICNS entries so parser offsets cannot remain stationary.
- Verification: hostile ICNS and JXL buffers run in bounded worker threads in `scripts/image-size-security-patch.test.cjs`.
- CI policy: `scripts/production-dependency-audit.cjs` verifies the exact patch digest and package version, permits only the two advisory URLs above, and fails on any other high or critical advisory.
- Review deadline: 2026-09-30. Replace the patch with a fixed Expo/Metro or `image-size` release as soon as one is compatible; the exception fails closed after the deadline.
