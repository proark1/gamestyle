/**
 * Who runs Jumbleyard, named on the privacy page. Account holders are sent to
 * these details for access, correction and export requests, so no sign-in
 * method opens over HTTPS until they are filled in.
 */
export type Operator = { name: string; address: string; email: string };

export const OPERATOR: Operator | null = null;
