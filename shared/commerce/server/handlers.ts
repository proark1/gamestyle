import { getBinding } from '@/db/index';
import { accountConfig } from '../../accounts/server/config';
import { createCommerceRoutes } from './routes';
import {
  commerceEnvironment,
  stripeReady,
  verifyStripePurchase,
} from './stripe';

const routes = createCommerceRoutes({
  db: getBinding,
  config: accountConfig,
  environment: commerceEnvironment(),
  verifyPurchase: stripeReady() ? verifyStripePurchase : undefined,
});
export const getInventory = routes.GET;
export const changeInventory = routes.POST;
