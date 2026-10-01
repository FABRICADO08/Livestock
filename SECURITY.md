# Security Policy

## Supported Versions

Security fixes are applied to the latest code on the `main` branch. Production
deploys to Render are built from `main`, so keeping up with `main` keeps you
protected.

| Version / Branch | Supported          |
| ---------------- | ------------------ |
| `main` (latest)  | :white_check_mark: |
| anything older   | :x:                |

## Dependency & Vulnerability Management

- **Dependabot** (`.github/dependabot.yml`) opens weekly pull requests for
  Maven dependencies, GitHub Actions, and Docker base images whenever new
  versions are published.
- **CI** (`.github/workflows/ci.yml`) builds and tests every pull request, so
  dependency updates are verified before merging.
- Repository maintainers should also enable **Dependency graph**,
  **Dependabot alerts**, and **Dependabot security updates** under
  *Settings → Code security* so known CVEs trigger automatic fix PRs
  immediately.

## Reporting a Vulnerability

Please report vulnerabilities privately — do not open a public issue.

Use GitHub's **private vulnerability reporting**:
[Report a vulnerability](https://github.com/FABRICADO08/Livestock/security/advisories/new)

Include a description of the issue, affected component/endpoint, steps to
reproduce, and potential impact. You can expect an acknowledgement within a
few days and a status update once the report is triaged. If the report is
accepted, a fix will be developed and released on `main`, and credit will be
given in the security advisory unless you prefer to remain anonymous.
