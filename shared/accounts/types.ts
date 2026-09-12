/** How a player signs in. The browser never learns an account id. */
export type AccountProvider = 'google' | 'email';

export type AccountSummary = {
  displayName: string | null;
  identities: { provider: AccountProvider; hint: string }[];
};

export type SignInMethods = { google: boolean; email: boolean };

export type SessionReply = {
  account: AccountSummary | null;
  methods: SignInMethods;
};

/** Tabs and the Google sign-in window tell each other about sign-in changes. */
export const ACCOUNT_CHANNEL = 'jumbleyard-account';

export type AccountMessage = {
  type: 'signed-in' | 'signed-out' | 'sign-in-failed';
};

/** A readable cookie that only says a session probably exists. */
export const SIGNED_IN_HINT = 'jy_signed_in';
