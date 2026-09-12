import { getBinding } from '@/db/index';
import { accountConfig } from './config';
import { createAccountRoutes } from './routes';

const routes = createAccountRoutes({
  db: getBinding,
  config: () => accountConfig(),
});

export const getSession = routes.session;
export const startGoogle = routes.googleStart;
export const finishGoogle = routes.googleCallback;
export const startEmail = routes.emailStart;
export const verifyEmail = routes.emailVerify;
export const saveProfile = routes.profile;
export const signOut = routes.signOut;
export const deleteAccount = routes.remove;
