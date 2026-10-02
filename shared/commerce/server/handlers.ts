import { getBinding } from '@/db/index';
import { accountConfig } from '../../accounts/server/config';
import { createCommerceRoutes } from './routes';

// No payment adapter is enabled until its storefront verification is implemented.
const routes = createCommerceRoutes({ db: getBinding, config: accountConfig });
export const getInventory = routes.GET;
export const changeInventory = routes.POST;
