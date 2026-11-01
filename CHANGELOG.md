# Changelog

## 0.4.0
- Replaced the attachment/share-sheet email flow with a `mailto:` draft containing the complete JSON literally in the email body.
- Improved the email layout with a readable session summary, app/version, record type, local date, export timestamp, timezone, locale, schema version, record ID, tags, and per-exercise set details.
- JSON in the email body is compact (valid JSON) to reduce encoded URL size. Standalone backups remain pretty-printed.
- Added `FIN DEL JSON` sentinel and a warning for long `mailto:` URLs so users can detect possible truncation before sending.
- Removed the need to attach or download a per-session JSON file when sharing a workout or run.
- Updated the PWA cache name to force clients to fetch the new application shell.
