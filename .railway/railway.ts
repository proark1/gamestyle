import { defineRailway, preserve, project, service, volume } from "railway/iac";

/**
 * Imported from the live project with `railway config pull`, then extended with
 * the health check.
 *
 * `railway.json` is still required and must not be deleted yet. Railway reads it
 * until 2026-12-01, and it is the only place four settings can currently live:
 * `builder`, `dockerfilePath`, `restartPolicyType` and `restartPolicyMaxRetries`.
 * Neither TypeScript nor CLI 5.49.6 rejects those four keys here: both accept them
 * and the CLI then ignores them. Verified by planning deliberately wrong values
 * (`restartPolicyMaxRetries: 7`, `dockerfilePath: "Dockerfile.probe"`) and seeing
 * no diff. So do not add them back believing they are covered — re-check whether
 * a later CLI supports them, well before 2026-12-01.
 *
 * Replicas stay at one: the room database is a SQLite file on the volume mounted
 * at /data, and a second replica would split it.
 */
export default defineRailway(() => {
  const stackOrSinkVolume = volume("stack-or-sink-volume", {
    alerts: { usage: { "80": {}, "95": {}, "100": {} } },
    allowOnlineResize: true,
    region: "europe-west4-drams3a",
    sizeMB: 5000,
  });
  const jumbleyard = service("jumbleyard", {
    replicas: { "europe-west4-drams3a": 1 },
    domains: ["www.jumbleyard.com"],
    networking: { privateNetworkEndpoint: "stack-or-sink" },
    volumeMounts: { "/data": stackOrSinkVolume },
    env: {
      AUDIO_ADMIN_PASSWORD: preserve(),
      AUTH_SECRET: preserve(),
      EMAIL_FROM: preserve(),
      GOOGLE_CLIENT_ID: preserve(),
      GOOGLE_CLIENT_SECRET: preserve(),
      PUBLIC_GAME_ORIGIN: preserve(),
      RESEND_API_KEY: preserve(),
    },
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
  });

  return project("jumbleyard", {
    resources: [jumbleyard, stackOrSinkVolume],
  });
});
