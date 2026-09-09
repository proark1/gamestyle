import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      AUDIO: R2Bucket;
      AUDIO_MASTER_KEY: string;
      AUDIO_ADMIN_PASSWORD: string;
    }
  }
}
