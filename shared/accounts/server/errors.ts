/** A refusal the player can read, with any extra fields the client needs. */
export class AccountError extends Error {
  constructor(
    message: string,
    public status = 400,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}
