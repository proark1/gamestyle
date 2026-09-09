/** Waits for a condition instead of a fixed sleep.
 *
 *  Connection tests turn on a real timer firing at MIN_POLL_MS. Sleeping for
 *  that plus a small margin passes alone and fails under a full parallel test
 *  run, where the process is competing for a core. Polling keeps the assertion
 *  about what happened rather than about how fast the machine is. */
export async function waitFor(
  condition: () => boolean,
  timeoutMs = 2000,
  stepMs = 5,
) {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
  return true;
}
