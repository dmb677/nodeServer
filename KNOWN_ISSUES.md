# Known Issues

## Authentication and meditation history

| Severity | Location | Issue | Recommended remediation |
| --- | --- | --- | --- |
| High | `routes/auth.js:231,273` | User passwords are stored and compared as plaintext. | Migrate stored passwords to a modern password hash and verify credentials with the hashing library. |
| Medium | `routes/auth.js:200-205,232-237,279-281` | Session error callbacks invoke `next`, but the affected route handlers do not declare it. A session failure can raise a `ReferenceError`. | Accept `next` in each affected handler and return immediately after forwarding an error. |
| Medium | `routes/auth.js:145-153,167-175` | Meditation history has no retention limit or pagination; the complete history is returned and rendered on every request. | Define a retention and/or pagination contract before limiting stored or returned records. |
| Low | `sites/MeditationTimer/httpdocs/dist/js/meditation-summary.js:48-67` | Invalid history entries are excluded from time and daily totals but still counted as completed sessions. | Count only validated records, or show malformed records separately. |
