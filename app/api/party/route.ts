import { partyGameSession } from '@/platform/party/game-session';
import {
  readRoomRequest,
  withRequestBudget,
  budgetError,
} from '@/shared/http/request-budget';
import { RoomError } from '@/shared/rooms/types';
import { roomStore } from '@/db/rooms';
import { isRoomOriginAllowed } from '@/shared/http/request-origin';
import {
  createPartyRoom,
  joinPartyRoom,
  leavePartyRoom,
  toggleReady,
  addBotToParty,
  removePlayerFromParty,
  startPartyTournament,
  reportRoundResult,
  closePartyRound,
  advanceToNextRound,
  rematchParty,
  getPartyRoom,
  voteForNextGame,
  partyPlayerAction,
  setPartyFormat,
  pauseParty,
} from '@/platform/party/coordinator';
import type { PartyAction } from '@/platform/party/types';
import { updateLobbyPresence } from '@/platform/party/coordinator';
import { currentAccount } from '@/shared/accounts/server/current';
import { getBinding } from '@/db/index';
import {
  initializeInventory,
  readInventory,
} from '@/shared/commerce/server/inventory';
import { LEGACY_ITEMS } from '@/shared/commerce/server/legacy-items';
import { parseLook } from '@/shared/wardrobe/look';
import { crewBadge } from '@/shared/crews/server/store';
import {
  assertPartyGameAccess,
  paidAdmissionEnabled,
} from '@/shared/commerce/server/access';
import { CommerceError } from '@/shared/commerce/types';

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });

async function handleRequest(request: Request) {
  if (!isRoomOriginAllowed(request, process.env.PUBLIC_GAME_ORIGIN)) {
    return json(
      { error: 'Open the game in your browser to use party mode.' },
      403,
    );
  }

  try {
    const body = (await readRoomRequest(request, 64_000)) as PartyAction;
    const store = roomStore();

    switch (body.op) {
      case 'lobby_presence': {
        const account = await currentAccount(request);
        let look = parseLook(body.look) ?? {};
        let fullGame = false;
        if (account) {
          const db = getBinding();
          await initializeInventory(db, account.id, Date.now());
          const inventory = await readInventory(db, account.id);
          look = inventory.look;
          fullGame = inventory.fullGame;
        } else {
          for (const slot of Object.keys(look) as (keyof typeof look)[])
            if (!LEGACY_ITEMS.has(look[slot]!)) delete look[slot];
        }
        return json({
          state: await updateLobbyPresence(
            store,
            body.code,
            { id: body.playerId, token: body.token },
            {
              pose: body.pose,
              browsing: body.browsing,
              look,
              fullGame,
              accountId: account?.id ?? null,
              crew: account ? await crewBadge(getBinding(), account.id) : null,
            },
          ),
        });
      }
      case 'heartbeat':
      case 'briefing_ready':
      case 'vote_lock':
      case 'rematch_interest':
        return json({
          state: await partyPlayerAction(
            store,
            body.code,
            { id: body.playerId, token: body.token },
            body.op,
            body.round,
          ),
        });
      case 'format':
        return json({
          state: await setPartyFormat(
            store,
            body.code,
            { id: body.hostId, token: body.token },
            body.format,
          ),
        });
      case 'pause':
        return json({
          state: await pauseParty(
            store,
            body.code,
            { id: body.playerId, token: body.token },
            body.paused,
          ),
        });
      case 'game_session': {
        const admission = paidAdmissionEnabled()
          ? {
              accountId: (await currentAccount(request))?.id ?? null,
              check: (game: string, accountIds: (string | null)[]) =>
                assertPartyGameAccess(getBinding(), game, accountIds),
            }
          : undefined;
        return json({
          session: await partyGameSession(
            store,
            body.code,
            body.playerId,
            body.token,
            body.round,
            Date.now(),
            admission,
          ),
        });
      }
      case 'create': {
        const { state, playerId, token } = await createPartyRoom(
          store,
          body.hostName,
          body.color,
        );
        return json({ state, playerId, token });
      }

      case 'join': {
        if (!body.code || !/^[A-Z2-9]{6}$/i.test(body.code)) {
          return json({ error: 'Invalid party room code.' }, 400);
        }
        const { state, playerId, token } = await joinPartyRoom(
          store,
          body.code,
          body.name,
          body.color,
        );
        return json({ state, playerId, token });
      }

      case 'get': {
        if (!body.code) return json({ error: 'Room code required.' }, 400);
        const state = await getPartyRoom(store, body.code);
        return json({ state });
      }

      case 'ready': {
        const state = await toggleReady(
          store,
          body.code,
          { id: body.playerId, token: body.token },
          body.ready,
        );
        return json({ state });
      }

      case 'add_bot': {
        const state = await addBotToParty(store, body.code, {
          id: body.hostId,
          token: body.token,
        });
        return json({ state });
      }

      case 'remove_player': {
        const state = await removePlayerFromParty(
          store,
          body.code,
          { id: body.hostId, token: body.token },
          body.targetId,
        );
        return json({ state });
      }

      case 'start': {
        const state = await startPartyTournament(
          store,
          body.code,
          { id: body.hostId, token: body.token },
          Date.now(),
          paidAdmissionEnabled(),
        );
        return json({ state });
      }

      case 'report_result': {
        const state = await reportRoundResult(
          store,
          body.code,
          body.round,
          { id: body.playerId, token: body.token },
          body.result,
        );
        return json({ state });
      }

      case 'close_round': {
        const state = await closePartyRound(store, body.code, body.round, {
          id: body.hostId,
          token: body.token,
        });
        return json({ state });
      }

      case 'vote': {
        const state = await voteForNextGame(
          store,
          body.code,
          body.round,
          {
            id: body.playerId,
            token: body.token,
          },
          body.game,
        );
        return json({ state });
      }

      case 'next_round': {
        const state = await advanceToNextRound(store, body.code, {
          id: body.hostId,
          token: body.token,
        });
        return json({ state });
      }

      case 'rematch': {
        const state = await rematchParty(store, body.code, {
          id: body.hostId,
          token: body.token,
        });
        return json({ state });
      }

      case 'leave': {
        const state = await leavePartyRoom(store, body.code, {
          id: body.playerId,
          token: body.token,
        });
        return json({ state });
      }

      default:
        return json({ error: 'Unknown party operation.' }, 400);
    }
  } catch (error) {
    if (error instanceof CommerceError)
      return json({ error: error.message }, error.status);
    if (error instanceof RoomError) return budgetError(error);
    const message =
      error instanceof Error
        ? error.message
        : 'Party server error. Please retry.';
    return json({ error: message }, 400);
  }
}

export const POST = withRequestBudget(handleRequest);
