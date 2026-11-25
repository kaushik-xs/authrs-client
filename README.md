# authrs-client

Official client SDKs for the Authrs multi-tenant authentication service.

| SDK        | Package                                                                                   | Source                       |
| ---------- | ----------------------------------------------------------------------------------------- | ---------------------------- |
| TypeScript | [`@kaushik91/authrs-client`](https://www.npmjs.com/package/@kaushik91/authrs-client) (npm) | [`typescript/`](typescript/) |
| Rust       | [`authrs-client`](https://crates.io/crates/authrs-client) (crates.io)                     | [`rust/`](rust/)             |

Both SDKs expose the same methods and are always released together with the same version number.

## Releasing

Push a version tag — that's the whole release:

```sh
git tag v1.2.3 && git push origin v1.2.3
```

The **Release** workflow runs the CI checks, takes the version from the tag, stamps it into `typescript/package.json` and `rust/Cargo.toml`, publishes to npm and crates.io, and creates the GitHub release. The versions committed in the manifests are not used for releases, so there is nothing to bump beforehand.

Required repository secrets: `NPM_TOKEN` and `CARGO_REGISTRY_TOKEN`.
