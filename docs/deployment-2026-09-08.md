# Production release — 2026-09-08

The modularity, security and performance changes are live at [Jumbleyard](https://jumbleyard.up.railway.app).

Railway deployment `7b9b9ee5-9e13-4fbe-bcf5-8e912b2d6f0b` reached `SUCCESS`. The existing production service and persistent `/data` volume were retained. Startup logs confirm database readiness and the production server starting without errors.

## Release validation

- A frozen snapshot of 723 source files passed `npm run check`: formatting, TypeScript, lint, architecture checks and all 649 tests.
- `npm run build:railway` passed for that snapshot. Its source hashes were verified again after deployment.
- Live checks completed at 15:56 UTC: all 16 checked routes and 74 referenced assets returned successfully.
- Two-player room creation, joining, synchronization or signaling, and leaving passed for each of the seven games. Temporary verification players left their rooms afterward.
- Public playback manifests remained available for all six audio libraries. All 681 previously published cue-to-recording URL mappings were preserved.
- All six workshop APIs rejected unauthenticated library access and generation requests. Authenticated access checks passed with the new server administrator password. No paid generation was performed.

`AUDIO_ADMIN_PASSWORD` is configured in Railway. Its local copy is stored outside release source in an ignored directory restricted to the workstation user. Provider keys remain separate from workshop login.

Detailed release logs and the source manifest are retained locally in `.tmp/live-release/`. The earlier [audit report](security-performance.md) contains local load measurements and real WebRTC integration results. Live room checks do not establish production player capacity or replace a manual cross-network playthrough.

## Operational follow-up

Railway currently accepts this service's `railway.json`, but its CLI reports that configuration format will stop working on 2026-12-01. Migrate the deployment configuration before that date. This release retained the existing deployment setup.
