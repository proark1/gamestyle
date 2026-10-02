import { getBinding } from '@/db/index';
import { accountConfig } from '@/shared/accounts/server/config';
import { createStackChallengeRoutes } from '@/games/stack-or-sink/challenge-route';
const routes = createStackChallengeRoutes({
  db: getBinding,
  config: accountConfig,
});
export const GET = routes.GET;
export const POST = routes.POST;
