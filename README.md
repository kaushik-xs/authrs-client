# authrs-client

Official client SDKs for the Authrs multi-tenant authentication service.

| SDK        | Package                                                                                   | Source                       |
| ---------- | ----------------------------------------------------------------------------------------- | ---------------------------- |
| TypeScript | [`@kaushik91/authrs-client`](https://www.npmjs.com/package/@kaushik91/authrs-client) (npm) | [`typescript/`](typescript/) |
| Rust       | [`authrs-client`](https://crates.io/crates/authrs-client) (crates.io)                     | [`rust/`](rust/)             |

Both SDKs expose the same methods and are always released together with the same version number.

## Releasing

Versions live in `typescript/package.json` and `rust/Cargo.toml` and must match (CI enforces this). Releases are cut by the **Release** workflow, which publishes both packages and tags the commit `vX.Y.Z`:

- **Actions → Release → Run workflow**, choosing `patch` / `minor` / `major`: bumps both manifests, commits, tags `vX.Y.Z`, creates the GitHub release, then publishes to npm and crates.io.
- **Pushing a tag** `vX.Y.Z` (`git tag v1.2.3 && git push origin v1.2.3`): publishes the tagged commit and creates its GitHub release. Bump both manifests to `X.Y.Z` first — the workflow fails if either differs from the tag.

Required repository secrets: `NPM_TOKEN` and `CARGO_REGISTRY_TOKEN`.
