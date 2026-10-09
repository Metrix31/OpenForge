# Security Policy

## Overview

OpenForge is an open-source initiative by **Metrix31 Labs** focused on building powerful, accessible, and independent software.

Security is an important part of every OpenForge project. We take vulnerability reports seriously and encourage security researchers, contributors, and users to report potential security issues responsibly.

This policy describes which versions receive security updates and how to report vulnerabilities affecting OpenForge repositories.

## Supported Versions

OpenForge contains multiple projects, each of which may have its own release cycle and versioning scheme. Security support therefore depends on the individual project.

In general:

| Version                           | Support Status                      |
| --------------------------------- | ----------------------------------- |
| Latest stable release             | Supported where actively maintained |
| Older releases                    | Support depends on the project      |
| Unreleased development versions   | No guarantee of security support    |
| Archived or discontinued projects | Not actively supported              |

For the most accurate information, consult the relevant project's repository, release notes, and documentation.

Users are encouraged to update to the latest stable release whenever possible.

## Reporting a Vulnerability

**Please do not disclose unpatched security vulnerabilities through public GitHub issues, discussions, pull requests, or other public channels.**

If you discover a potential security vulnerability in OpenForge, please report it privately whenever possible.

### Preferred Reporting Method

Use GitHub's private vulnerability reporting feature if it is enabled for the affected repository:

1. Open the relevant OpenForge repository on GitHub.
2. Navigate to the repository's **Security** tab.
3. Select **Report a vulnerability**, if available.
4. Provide the details needed to understand and reproduce the issue.

For the main OpenForge repository, visit:

https://github.com/Metrix31/OpenForge

If private vulnerability reporting is unavailable, contact the repository maintainer through an appropriate private contact method listed in the repository or GitHub profile. Avoid sharing sensitive technical details publicly.

### Include in Your Report

Please provide as much of the following information as possible:

* **Affected project and version:** Identify the relevant OpenForge project and version.
* **Vulnerability description:** Explain the issue and its potential impact.
* **Reproduction steps:** Provide clear, minimal steps to reproduce the vulnerability.
* **Proof of concept:** Include a minimal example where appropriate and safe.
* **Environment:** Specify the operating system, configuration, and relevant dependencies.
* **Suggested mitigation:** If known, describe possible fixes or workarounds.

Please do not include real users' personal information, passwords, access tokens, private keys, or other sensitive data in your report.

## What to Expect

Every report will be reviewed as resources allow. OpenForge is an independent open-source initiative, and response times may vary depending on the complexity and severity of the issue and available development resources.

Where possible, the maintainer will:

1. Acknowledge receipt of the report.
2. Assess its validity, severity, and potential impact.
3. Request additional information if necessary.
4. Work on a fix or mitigation for confirmed vulnerabilities.
5. Publish relevant security information once disclosure is appropriate.

Not every report will necessarily result in a code change. Reports may be declined if the issue cannot be reproduced, does not represent a security vulnerability, falls outside the project's scope, or is considered an intended behavior.

If a report is declined, an explanation will be provided where reasonably possible.

These steps are intended as a general process, not a guarantee of specific response or resolution times.

## Responsible Disclosure

Please allow reasonable time for the maintainer to investigate and address a reported vulnerability before publicly disclosing technical details.

Please do not exploit vulnerabilities beyond what is necessary to demonstrate the issue, access or modify other users' data, disrupt services, or conduct testing against systems without authorization.

Coordinated disclosure helps protect users while allowing maintainers to develop and distribute appropriate fixes.

## Security Updates

Security fixes may be distributed through:

* Updated software releases.
* GitHub security advisories.
* Release notes and repository announcements.
* Relevant project documentation.

Users should monitor the repositories of the OpenForge projects they use and install security updates as soon as practical.

The availability and distribution of updates may vary by project.

## Scope

This policy applies to security vulnerabilities in software maintained within the OpenForge organization or explicitly identified as an OpenForge project by Metrix31 Labs.

Third-party dependencies and external services may have their own security policies and reporting procedures. If a vulnerability originates in an upstream dependency, it may need to be reported to the relevant maintainer as well.

## Security Best Practices

Users and contributors are encouraged to:

* Download software from official OpenForge repositories and release pages.
* Verify that downloads originate from trusted sources.
* Keep applications and dependencies up to date.
* Avoid sharing credentials, secrets, or private configuration files.
* Review permissions requested by applications before granting access.
* Report suspicious behavior or potential vulnerabilities responsibly.

Contributors should avoid committing API keys, passwords, access tokens, private keys, or other secrets to version control.

## Policy Changes

This policy may be updated as OpenForge grows and its security processes evolve. Individual projects may introduce additional security requirements or more specific reporting procedures.

---

<p align="center">
  <b>OpenForge</b> is an initiative by <b>Metrix31 Labs</b>.
  <br/>
  <sub>Built for freedom. Powered by open source.</sub>
</p>
