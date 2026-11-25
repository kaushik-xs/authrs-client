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
- **Publishing a GitHub release** whose tag is `vX.Y.Z`: publishes the tagged commit. The workflow fails if either manifest's version differs from the tag.

Required repository secrets: `NPM_TOKEN` and `CARGO_REGISTRY_TOKEN`.
