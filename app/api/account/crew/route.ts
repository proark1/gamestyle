import { getBinding } from '@/db/index';
import { accountConfig } from '@/shared/accounts/server/config';
import { createCrewRoutes } from '@/shared/crews/server/routes';
const routes = createCrewRoutes({ db: getBinding, config: accountConfig });
export const GET = routes.GET;
export const POST = routes.POST;
