import { ITEM_DEFINITIONS } from './content/items';
import { FISH_DEFINITIONS } from './content/fish';
import { insideMissionZone } from './missions';
import { awards } from './scoring';
import { STATION_POSITIONS } from './stations';
import type {
  AdventurePlayer,
  AdventureWorld,
  ItemStateRecord,
  RoundPhase,
  StationKind,
} from './types';

export const PHASE_NAMES: Record<RoundPhase, string> = {
  lobby: 'Crew call',
  preparing: 'Load the boat',
  outbound: 'Run to the grounds',
  fishing: 'Lines in',
  returning: 'Race the harbor bell',
  docking: 'Bring her alongside',
  finished: 'Catch delivered',
  failed: 'Round lost',
};

export function objective(world: AdventureWorld) {
  if (world.phase === 'lobby')
    return 'Build a crew. Empty seats are filled by deckhand bots.';
  if (world.phase === 'preparing') {
    const loaded = world.items.filter(
      (item) => item.station && ITEM_DEFINITIONS[item.kind].essential,
    ).length;
    return `Load rods, bait, safety gear and the ice box · ${Math.min(10, loaded)}/10 ready`;
  }
  if (world.phase === 'outbound')
    return 'Follow the chart marker to the first fishing ground.';
  if (world.phase === 'fishing') {
    const mission = world.missions[world.activeMission];
    return mission
      ? `${mission.label} · ${Math.floor(mission.progress)}/${mission.goal}`
      : 'Secure the catch.';
  }
  if (world.phase === 'returning')
    return 'All missions complete—race the catch back to harbor.';
  if (world.phase === 'docking')
    return 'Slow below 1.7 knots and dock inside the harbor markers.';
  if (world.phase === 'failed')
    return world.round.result === 'sunk'
      ? 'The boat went down.'
      : 'The harbor bell beat you.';
  return 'Catch landed. Scores and crew awards are ready.';
}

export type NextStepTone = 'normal' | 'ready' | 'urgent' | 'danger';
export type NextStep = {
  id: string;
  eyebrow: string;
  title: string;
  detail: string;
  control?: string;
  tone: NextStepTone;
  target?: string;
};

type GuidanceOptions = {
  touch?: boolean;
  german?: boolean;
};

function nearestItem(
  world: AdventureWorld,
  player: AdventurePlayer,
  predicate: (item: ItemStateRecord) => boolean,
) {
  return world.items
    .filter(predicate)
    .map((item) => ({
      item,
      distance:
        item.space === player.space
          ? Math.hypot(item.x - player.x, item.z - player.z)
          : Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => a.distance - b.distance)[0]?.item;
}

function heldItem(world: AdventureWorld, player: AdventurePlayer) {
  const id = player.held.at(-1);
  return id ? world.items.find((item) => item.id === id) : undefined;
}

function itemTarget(world: AdventureWorld, target: string | null) {
  return target
    ? world.items.find((candidate) => candidate.id === target)
    : undefined;
}

function copy(german: boolean, english: string, translated: string) {
  return german ? translated : english;
}

function control(
  action: 'use' | 'cast' | 'hook' | 'reel' | 'release',
  touch: boolean,
  german: boolean,
) {
  if (touch) {
    if (action === 'cast') return copy(german, 'HOLD CAST', 'WERFEN HALTEN');
    if (action === 'hook') return copy(german, 'HOOK', 'ANHAKEN');
    if (action === 'reel') return copy(german, 'HOLD REEL', 'EINHOLEN HALTEN');
    if (action === 'release')
      return copy(german, 'RELEASE REEL', 'EINHOLEN LOSLASSEN');
    return copy(german, 'USE', 'BENUTZEN');
  }
  if (action === 'cast') return copy(german, 'HOLD F KEY', 'F-TASTE HALTEN');
  if (action === 'hook') return copy(german, 'F KEY', 'F-TASTE');
  if (action === 'reel') return copy(german, 'HOLD R KEY', 'R-TASTE HALTEN');
  if (action === 'release') return copy(german, 'RELEASE R', 'R LOSLASSEN');
  return 'E';
}

function stationTarget(station: StationKind) {
  return `station:${station}`;
}

export function nextStepFor(
  world: AdventureWorld,
  player: AdventurePlayer | undefined,
  target: string | null,
  options: GuidanceOptions = {},
): NextStep {
  const touch = options.touch ?? false;
  const german = options.german ?? false;
  const eyebrow = copy(german, 'NEXT STEP', 'NÄCHSTER SCHRITT');
  if (!player)
    return {
      id: 'find-crew',
      eyebrow,
      title: copy(german, 'Joining the crew…', 'Crew wird beigetreten…'),
      detail: copy(
        german,
        'Waiting for your deck position.',
        'Warte auf deine Position an Deck.',
      ),
      tone: 'normal',
    };

  if (player.overboard)
    return {
      id: 'swim-home',
      eyebrow: copy(german, 'SAFETY', 'SICHERHEIT'),
      title: copy(german, 'Swim back to the boat', 'Schwimme zurück zum Boot'),
      detail: copy(
        german,
        'Move toward the rescue line.',
        'Bewege dich zum Rettungsseil.',
      ),
      tone: 'urgent',
      target: stationTarget('rescue-line'),
    };

  const swimmer = world.players.find((candidate) => candidate.overboard);
  if (swimmer)
    return {
      id: 'rescue-crew',
      eyebrow: copy(german, 'CREW OVERBOARD', 'CREW ÜBER BORD'),
      title: copy(german, `Rescue ${swimmer.name}`, `${swimmer.name} retten`),
      detail: copy(
        german,
        'Use the rescue line on starboard.',
        'Benutze das Rettungsseil an Steuerbord.',
      ),
      control: control('use', touch, german),
      tone: 'urgent',
      target: stationTarget('rescue-line'),
    };

  const carried = heldItem(world, player);
  const lookedAt = itemTarget(world, target);

  if (carried?.kind === 'fish')
    return {
      id: 'store-catch',
      eyebrow,
      title: copy(german, 'Put the fish on ice', 'Fisch in die Eisbox legen'),
      detail: copy(
        german,
        'Carry it to the ice hold to score.',
        'Trage ihn zur Eisbox, damit er zählt.',
      ),
      control: control('use', touch, german),
      tone: target === stationTarget('ice-hold') ? 'ready' : 'normal',
      target: stationTarget('ice-hold'),
    };

  if (world.phase === 'preparing') {
    if (carried) {
      const rack = ITEM_DEFINITIONS[carried.kind].rack as
        | StationKind
        | undefined;
      return {
        id: 'stow-equipment',
        eyebrow,
        title: copy(
          german,
          `Stow the ${ITEM_DEFINITIONS[carried.kind].name.toLowerCase()}`,
          `${ITEM_DEFINITIONS[carried.kind].name} verstauen`,
        ),
        detail: rack
          ? copy(
              german,
              `Take it to the ${STATION_POSITIONS[rack].label.toLowerCase()}.`,
              `Bringe den Gegenstand zu ${STATION_POSITIONS[rack].label}.`,
            )
          : copy(
              german,
              'Place it safely aboard.',
              'Verstaue den Gegenstand sicher an Bord.',
            ),
        control: control('use', touch, german),
        tone: rack && target === stationTarget(rack) ? 'ready' : 'normal',
        target: rack ? stationTarget(rack) : undefined,
      };
    }
    if (lookedAt)
      return {
        id: 'pick-up-equipment',
        eyebrow,
        title: copy(
          german,
          `Pick up ${ITEM_DEFINITIONS[lookedAt.kind].name.toLowerCase()}`,
          `${ITEM_DEFINITIONS[lookedAt.kind].name} aufnehmen`,
        ),
        detail: copy(
          german,
          'Load it into its matching station.',
          'Verstaue ihn danach an der passenden Station.',
        ),
        control: control('use', touch, german),
        tone: 'ready',
        target: lookedAt.id,
      };
    return {
      id: 'load-boat',
      eyebrow,
      title: copy(
        german,
        'Pick up equipment from the dock',
        'Ausrüstung vom Steg aufnehmen',
      ),
      detail: copy(
        german,
        'Look at an item, press use, then take it to its station.',
        'Sieh einen Gegenstand an, benutze ihn und bringe ihn zur Station.',
      ),
      control: control('use', touch, german),
      tone: 'normal',
    };
  }

  if (world.phase === 'outbound')
    return {
      id: 'reach-ground',
      eyebrow,
      title: copy(
        german,
        'Sail to the fishing ground',
        'Zum Fanggebiet fahren',
      ),
      detail: copy(
        german,
        'Take the helm and follow the contract marker.',
        'Übernimm das Steuer und folge der Vertragsmarkierung.',
      ),
      control: control('use', touch, german),
      tone: target === stationTarget('helm') ? 'ready' : 'normal',
      target: stationTarget('helm'),
    };

  if (world.phase === 'returning')
    return {
      id: 'return-harbor',
      eyebrow,
      title: copy(german, 'Bring the catch home', 'Fang zum Hafen bringen'),
      detail: copy(
        german,
        'Take the helm and follow the harbor marker.',
        'Übernimm das Steuer und folge der Hafenmarkierung.',
      ),
      control: control('use', touch, german),
      tone: target === stationTarget('helm') ? 'ready' : 'normal',
      target: stationTarget('helm'),
    };

  if (world.phase === 'docking')
    return {
      id: 'dock-boat',
      eyebrow,
      title: copy(
        german,
        'Slow down and secure the boat',
        'Langsam anlegen und Boot sichern',
      ),
      detail: copy(
        german,
        'Below 1.7 knots, use the helm inside the markers.',
        'Unter 1,7 Knoten das Steuer zwischen den Markierungen benutzen.',
      ),
      control: control('use', touch, german),
      tone: target === stationTarget('helm') ? 'ready' : 'normal',
      target: stationTarget('helm'),
    };

  if (world.phase === 'fishing') {
    if (player.castStartedAt !== undefined)
      return {
        id: 'charge-cast',
        eyebrow: copy(german, 'CAST POWER', 'WURFKRAFT'),
        title: copy(german, 'Release F to cast', 'F loslassen zum Auswerfen'),
        detail: copy(
          german,
          'The bent rod shows how much power is loaded.',
          'Die gebogene Angel zeigt die geladene Kraft.',
        ),
        control: copy(german, 'RELEASE F', 'F LOSLASSEN'),
        tone: 'ready',
      };
    const looseCatch = nearestItem(
      world,
      player,
      (item) =>
        item.kind === 'fish' && ['loose', 'thrown'].includes(item.state),
    );
    if (looseCatch)
      return {
        id: 'pick-up-catch',
        eyebrow,
        title: copy(
          german,
          'Pick up the landed fish',
          'Geladenen Fisch aufnehmen',
        ),
        detail: copy(
          german,
          'It only counts after it reaches the ice hold.',
          'Er zählt erst, wenn er in der Eisbox liegt.',
        ),
        control: control('use', touch, german),
        tone: target === looseCatch.id ? 'ready' : 'normal',
        target: looseCatch.id,
      };

    const line = player.line;
    if (line?.state === 'biting')
      return {
        id: 'hook-now',
        eyebrow: copy(german, 'BITE — ACT NOW', 'BISS — JETZT'),
        title: copy(german, 'Hook the fish!', 'Fisch anhaken!'),
        detail: copy(
          german,
          'The rod tip is down. The window is short.',
          'Die Rutenspitze ist unten. Das Zeitfenster ist kurz.',
        ),
        control: control('hook', touch, german),
        tone: 'urgent',
      };
    if (line?.state === 'tangled')
      return {
        id: 'untangle-line',
        eyebrow,
        title: copy(german, 'Untangle the line', 'Angelschnur entwirren'),
        detail: copy(
          german,
          'Clear the knot before continuing.',
          'Löse den Knoten, bevor du weiterangelst.',
        ),
        control: control('hook', touch, german),
        tone: 'urgent',
      };
    if (line?.state === 'hooked') {
      const fish = world.fish.find((candidate) => candidate.id === line.fishId);
      const safeTension = fish
        ? FISH_DEFINITIONS[fish.species].safeTension
        : 0.88;
      const danger = line.tension > safeTension;
      return danger
        ? {
            id: 'ease-line',
            eyebrow: copy(german, 'LINE TOO TIGHT', 'SCHNUR ZU STRAFF'),
            title: copy(german, 'Stop reeling', 'Nicht weiter einholen'),
            detail: copy(
              german,
              'Let the tension fall out of the red.',
              'Warte, bis die Spannung nicht mehr rot ist.',
            ),
            control: control('release', touch, german),
            tone: 'danger',
          }
        : {
            id: 'reel-fish',
            eyebrow,
            title: copy(german, 'Reel the fish in', 'Fisch einholen'),
            detail: copy(
              german,
              'Hold while tension is safe; release on red.',
              'Bei sicherer Spannung halten, bei Rot loslassen.',
            ),
            control: control('reel', touch, german),
            tone: 'ready',
          };
    }
    if (line)
      return {
        id: 'wait-bite',
        eyebrow,
        title: copy(
          german,
          'Wait for the rod tip to dip',
          'Warte, bis sich die Rutenspitze senkt',
        ),
        detail: copy(
          german,
          'A bite will trigger the hook prompt.',
          'Bei einem Biss erscheint sofort der Anhaken-Hinweis.',
        ),
        tone: 'normal',
      };

    const rod = player.held.some(
      (id) => world.items.find((item) => item.id === id)?.kind === 'rod',
    );
    if (!rod) {
      const availableRod = nearestItem(
        world,
        player,
        (item) =>
          item.kind === 'rod' && !['held', 'submerged'].includes(item.state),
      );
      return {
        id: 'get-rod',
        eyebrow,
        title: copy(german, 'Pick up a fishing rod', 'Angel aufnehmen'),
        detail: copy(
          german,
          'Find one in the rod rack on the port side.',
          'Du findest sie im Angelständer auf der Backbordseite.',
        ),
        control: control('use', touch, german),
        tone: lookedAt?.kind === 'rod' ? 'ready' : 'normal',
        target:
          lookedAt?.kind === 'rod'
            ? lookedAt.id
            : (availableRod?.id ?? stationTarget('rod-rack')),
      };
    }
    if (!insideMissionZone(world))
      return {
        id: 'enter-fishing-ground',
        eyebrow,
        title: copy(
          german,
          'Enter the marked fishing ground',
          'In das markierte Fanggebiet fahren',
        ),
        detail: copy(
          german,
          'The line can only be cast inside the active zone.',
          'Du kannst nur im aktiven Gebiet auswerfen.',
        ),
        tone: 'normal',
      };
    const bait = world.items.find(
      (item) => item.kind === 'bait-bucket' && (item.contents ?? 0) > 0,
    );
    if (!bait)
      return {
        id: 'no-bait',
        eyebrow: copy(german, 'SUPPLIES', 'VORRÄTE'),
        title: copy(
          german,
          'The bait bucket is empty',
          'Der Köder-Eimer ist leer',
        ),
        detail: copy(
          german,
          'Recover the crew bait before casting.',
          'Hole den Köder zurück, bevor du auswirfst.',
        ),
        tone: 'danger',
        target: stationTarget('bait-table'),
      };
    return {
      id: 'cast-line',
      eyebrow,
      title: copy(
        german,
        'Hold F to charge the cast',
        'F-Taste halten, um den Wurf zu laden',
      ),
      detail: copy(
        german,
        'Aim at open water, then release F to throw.',
        'Auf freies Wasser zielen und F zum Werfen loslassen.',
      ),
      control: control('cast', touch, german),
      tone: 'ready',
    };
  }

  if (lookedAt)
    return {
      id: 'pick-up-item',
      eyebrow,
      title: copy(
        german,
        `Pick up ${ITEM_DEFINITIONS[lookedAt.kind].name.toLowerCase()}`,
        `${ITEM_DEFINITIONS[lookedAt.kind].name} aufnehmen`,
      ),
      detail: copy(
        german,
        'Carry it to the matching station.',
        'Bringe ihn zur passenden Station.',
      ),
      control: control('use', touch, german),
      tone: 'ready',
      target: lookedAt.id,
    };

  return {
    id: 'look-around',
    eyebrow,
    title: copy(
      german,
      'Look for the highlighted deck task',
      'Suche die markierte Aufgabe an Deck',
    ),
    detail: copy(
      german,
      'Aim at an object to see what it does.',
      'Ziele auf einen Gegenstand, um seine Aktion zu sehen.',
    ),
    tone: 'normal',
  };
}

export function crewAwards(world: AdventureWorld) {
  return awards(world).map((award) => ({
    title: award.title,
    player: award.player,
    detail: String(award.value),
  }));
}
