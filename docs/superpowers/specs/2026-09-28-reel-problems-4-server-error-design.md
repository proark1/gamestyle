# Reel Problems 4 Server Error Repair

## Problem

Launching a multiplayer boat displays `Unexpected token 'I', "Internal S"... is not valid JSON`. The client expects every `/api/peer` response to be JSON, but the current development server returns a plain-text `Internal Server Error`. The server-wide `/api/health` endpoint also returns HTTP 500, confirming that this is a server/runtime failure rather than a Reel Problems 4 simulation failure.

## Design

1. Restart the stale development server and use its fresh startup/request diagnostics to identify the underlying server fault.
2. Repair only the fault responsible for the HTTP 500, preserving the existing Reel Problems 4 networking protocol and gameplay behavior.
3. Harden `peerRequest` so it reads the response safely. Valid JSON responses retain their current behavior; non-JSON failures produce a stable, player-readable connection error instead of exposing a JSON parser exception.
4. Keep practice mode independent from the multiplayer endpoint.

## Error Handling

- A structured peer API error continues to use the server-provided message and HTTP status.
- A non-JSON error response maps to a generic room-connection message with the original HTTP status.
- Successful non-JSON responses are treated as invalid server responses rather than accepted.

## Verification

- `/api/health` returns a successful response after the server repair.
- `/api/peer` returns JSON for both valid and rejected requests.
- Launching a Reel Problems 4 boat creates a multiplayer room without displaying the parser error.
- Peer client tests cover non-JSON error responses.
- Relevant tests, type checking, and linting pass.
