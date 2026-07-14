# Data Retention and Deletion Policy

This policy is the MVP baseline for production pilots.

## Retained data

- User account and workspace membership data is retained while the account is active.
- Project, requirement, analysis, task, sprint, integration, collaboration, and notification data is retained while the workspace is active.
- Analytics events store event metadata only; sensitive requirement content must not be copied into analytics metadata.
- AI job telemetry stores provider/model, status, attempts, duration, token usage, and safe error categories.

## Deletion

- Project archive is the default reversible deletion path.
- Permanent deletion requests should be handled by an admin process until self-serve deletion is implemented.
- Refresh tokens are removed/revoked during logout and should be periodically cleaned after expiry.

## Backups

- Production databases must use managed automated backups.
- Restore drills should be performed before private beta and after major schema changes.

## Provider data

- AI requests may send requirement context to the configured AI provider.
- Do not place API tokens or private credentials inside analytics metadata, integration config, comments, or requirements.
