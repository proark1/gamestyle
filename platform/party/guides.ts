/** Party descriptions are deliberately independent of the games' render bundles. */
export type PartyGuide = {
  minutes: number;
  complexity: 'easy' | 'medium' | 'tricky';
  quick: boolean;
  objective: [string, string];
  keyboard: [string, string];
};
const guide = (
  minutes: number,
  complexity: PartyGuide['complexity'],
  quick: boolean,
  objective: [string, string],
  keyboard: [string, string],
): PartyGuide => ({ minutes, complexity, quick, objective, keyboard });
export const PARTY_GUIDES = {
  'flip-happens': guide(
    2,
    'easy',
    true,
    [
      'Land objects upright to build a combo. Bank before another heavy landing knocks your points off the table.',
      'Lande Objekte aufrecht für Kombos. Sichere deine Punkte, bevor ein schwerer Einschlag sie vom Tisch fegt.',
    ],
    [
      'Mouse / touch or WASD aims. Hold Space and release in gold to flip. Q banks points. E changes object.',
      'Maus / Touch oder WASD zielt. Leertaste halten und bei Gold loslassen. Q sichert Punkte. E wechselt das Objekt.',
    ],
  ),
  'bouncy-castle-royale': guide(
    3,
    'easy',
    true,
    [
      'First to 7 points. Keep the ball off your floor, ride landing waves and share your team’s air.',
      'Zuerst 7 Punkte erreichen. Haltet den Ball vom Boden fern, reitet Landewellen und teilt eure Team-Luft.',
    ],
    [
      'WASD / arrows move. Space jumps; F volleys. Shift braces. Q changes team air; hold E by your gold pump to refill it.',
      'WASD / Pfeile bewegen. Leertaste springt; F schlägt. Shift federt ab. Q verteilt Team-Luft; E an der goldenen Pumpe halten zum Nachfüllen.',
    ],
  ),
  'on-the-ropes': guide(
    4,
    'easy',
    true,
    [
      'Win three knockdowns. Escape to your corner and tag your partner.',
      'Gewinnt drei Niederschläge. Flieht in eure Ecke und wechselt den Partner.',
    ],
    [
      'WASD moves. Tap Space for jab–cross; hold and release for a hook. Shift guards/parries; Q dodges. Outside, tap E to call your partner; inside, hold E at your corner to tag. F assists.',
      'WASD bewegt. Leertaste tippen: Jab–Gerade; halten und loslassen: Haken. Shift blockt/pariert; Q weicht aus. Draußen E tippen, um den Partner zu rufen; im Ring E an der Ecke halten zum Wechsel. F hilft.',
    ],
  ),
  'crane-clash': guide(
    3,
    'easy',
    true,
    [
      'Stack your team’s crates higher than the other crew before time runs out.',
      'Stapelt eure Kisten vor Ablauf der Zeit höher als das andere Team.',
    ],
    [
      'Arrow keys steer the crane; WASD swings. Q raises the hoist; Z lowers it. Space / E grabs or releases. Tab swaps the movement keys.',
      'Pfeiltasten steuern den Kran; WASD schwingt. Q hebt die Winde; Z senkt sie. Leertaste / E greift oder lässt los. Tab tauscht die Bewegungstasten.',
    ],
  ),
  basketball: guide(
    5,
    'medium',
    false,
    [
      'Score baskets for your team. Pass to your partner and defend your hoop.',
      'Sammelt Körbe für euer Team. Passt zum Partner und verteidigt euren Korb.',
    ],
    [
      'WASD moves; hold and release Space to shoot. E passes.',
      'WASD bewegt; Leertaste halten und loslassen zum Werfen. E passt.',
    ],
  ),
  'bungee-doubles': guide(
    5,
    'medium',
    false,
    [
      'Win rallies with your partner while an elastic cord keeps you together.',
      'Gewinnt Ballwechsel mit eurem Partner. Ein Gummiseil verbindet euch.',
    ],
    [
      'WASD moves. Space hits, E smashes, Shift dives and J jumps. Stay in reach of your partner.',
      'WASD bewegt. Leertaste schlägt, E schmettert, Shift hechtet und J springt. Bleibt in Reichweite eures Partners.',
    ],
  ),
  'panic-curling': guide(
    6,
    'tricky',
    false,
    [
      'Deliver and sweep baskets closer to the target than the other team.',
      'Schiebt und fegt eure Körbe näher ans Ziel als das andere Team.',
    ],
    [
      'A / D or left / right arrows aim or steer. Hold and release Space to deliver; hold Space to sweep when you are the sweeper.',
      'A / D oder Pfeile links / rechts zielen oder lenken. Leertaste halten und loslassen zum Werfen; als Feger Leertaste zum Fegen halten.',
    ],
  ),
  'zorb-clash': guide(
    3,
    'easy',
    true,
    [
      'Push the football into the other team’s goal. Bump opponents out of its path.',
      'Schiebt den Ball ins gegnerische Tor. Stoßt Gegner aus dem Weg.',
    ],
    [
      'WASD rolls. Space dashes into the ball; Shift braces against bumps. Aim your approach before dashing.',
      'WASD rollt. Leertaste sprintet zum Ball; Shift stützt gegen Stöße ab. Richte dich vor dem Sprint aus.',
    ],
  ),
  'carry-on-carnage': guide(
    3,
    'easy',
    true,
    [
      'Work together to pack the suitcase and meet the approval target.',
      'Packt gemeinsam den Koffer und erreicht die geforderte Zahl an Freigaben.',
    ],
    [
      'WASD moves, Space jumps. E grabs, Q drops, R compresses and F zips. Pack together before closing the suitcase.',
      'WASD bewegt, Leertaste springt. E greift, Q legt ab, R komprimiert und F schließt den Reißverschluss. Packt gemeinsam vor dem Schließen.',
    ],
  ),
  'sample-stampede': guide(
    3,
    'medium',
    false,
    [
      'Drive and grab samples for your team before your rivals collect them.',
      'Fahrt und schnappt euch Proben für euer Team, bevor die Gegner sie holen.',
    ],
    [
      'WASD steers and accelerates. Space / E grabs; Shift drifts.',
      'WASD lenkt und beschleunigt. Leertaste / E greift; Umschalt driftet.',
    ],
  ),
  'one-more-button': guide(
    3,
    'medium',
    true,
    [
      'Press for a bigger prize, survive the extra hazards, then cash out safely.',
      'Drückt für einen größeren Gewinn, überlebt die Gefahren und sichert euren Preis.',
    ],
    [
      'WASD moves, Space jumps. E presses the button, X cashes out at the exit and Q calls STOP. Choose when to leave with your prize.',
      'WASD bewegt, Leertaste springt. E drückt den Knopf, X sichert den Gewinn am Ausgang und Q ruft STOPP. Entscheide, wann du mit deinem Preis gehst.',
    ],
  ),
  'siege-and-desist': guide(
    4,
    'tricky',
    false,
    [
      'Coordinate your trebuchet to break the opposing team’s defenses.',
      'Bedient gemeinsam das Katapult und durchbrecht die gegnerische Verteidigung.',
    ],
    [
      'WASD moves. R winds the trebuchet, Q / E aims and F fires. Space jumps, C rides the arm and H helps. Call out before launching.',
      'WASD bewegt. R spannt das Katapult, Q / E zielt und F feuert. Leertaste springt, C besteigt den Arm und H hilft. Kündige den Schuss an.',
    ],
  ),
  'stack-or-sink': guide(
    3,
    'easy',
    true,
    [
      'Build a safe tower together before the rising water catches you.',
      'Baut gemeinsam einen sicheren Turm, bevor euch das Wasser erreicht.',
    ],
    [
      'WASD moves, Space jumps. E grabs or places, R rotates, C uses the crane and F rescues. Build steps you can climb.',
      'WASD bewegt, Leertaste springt. E greift oder platziert, R dreht, C bedient den Kran und F rettet. Baut Stufen zum Hochklettern.',
    ],
  ),
  'dont-wake-the-giant': guide(
    8,
    'medium',
    false,
    [
      'Steal and bank enough loot together without waking the giant.',
      'Stehlt und sichert gemeinsam genug Beute, ohne den Riesen zu wecken.',
    ],
    [
      'WASD moves, Shift creeps and Space jumps. E grabs or banks loot, Q places it and H helps a friend. Keep the noise down.',
      'WASD bewegt, Shift schleicht und Leertaste springt. E greift oder sichert Beute, Q legt sie ab und H hilft einem Freund. Bleibt leise.',
    ],
  ),
  'drive-thru': guide(
    4,
    'tricky',
    false,
    [
      'Keep the kitchen and car working together to deliver the orders.',
      'Arbeitet in Küche und Auto zusammen und liefert die Bestellungen aus.',
    ],
    [
      'Drivers use W / S for gas / brake, A / D to steer and Space to jump. Other jobs use Space for the main action and R / Shift for the second. E / H triggers your third action.',
      'Fahrer nutzen W / S für Gas / Bremse, A / D zum Lenken und Leertaste zum Springen. Andere Rollen nutzen Leertaste für Aktion 1 und R / Shift für Aktion 2. E / H löst Aktion 3 aus.',
    ],
  ),
  'act-natural': guide(
    3,
    'medium',
    true,
    [
      'The farmer spots human cows; the cows blend in and survive. Your role decides your goal.',
      'Der Bauer sucht menschliche Kühe; die Kühe tarnen sich und überleben. Deine Rolle bestimmt dein Ziel.',
    ],
    [
      'WASD moves; E interacts or inspects and Q drops. Cows use Space to graze. The farmer clicks a cow to select it before inspecting.',
      'WASD bewegt; E interagiert oder untersucht und Q legt ab. Kühe grasen mit Leertaste. Der Bauer klickt vor dem Untersuchen eine Kuh an.',
    ],
  ),
  'four-brain-cells': guide(
    6,
    'tricky',
    false,
    [
      'Control different limbs of one robot and make breakfast together.',
      'Steuert verschiedene Gliedmaßen eines Roboters und macht gemeinsam Frühstück.',
    ],
    [
      'WASD controls your assigned limb. E grabs; Space uses a hand tool or kicks with a foot. Q centers your limb. Talk through each step.',
      'WASD steuert dein Körperteil. E greift; Leertaste benutzt ein Handwerkzeug oder tritt mit dem Fuß. Q zentriert dein Körperteil. Sprecht jeden Schritt ab.',
    ],
  ),
  'wrong-floor': guide(
    8,
    'tricky',
    false,
    [
      'Inspect each hotel floor and agree on which things do not belong.',
      'Untersucht jede Hoteletage und entscheidet gemeinsam, was nicht dazugehört.',
    ],
    [
      'WASD explores. E inspects, R reports; 1 votes to advance and 2 to retreat. Compare what each person noticed before voting.',
      'WASD erkundet. E untersucht, R meldet; 1 stimmt für Weiter und 2 für Zurück. Vergleicht eure Beobachtungen vor der Abstimmung.',
    ],
  ),
  'load-bearing': guide(
    3,
    'medium',
    true,
    [
      'Demolish the building together while keeping the piano intact.',
      'Reißt gemeinsam das Gebäude ab und haltet dabei das Klavier heil.',
    ],
    [
      'WASD moves, Space jumps. E swings the hammer, C takes the wrecking ball, Q marks and F rescues. Check the piano’s supports before striking.',
      'WASD bewegt, Leertaste springt. E schwingt den Hammer, C übernimmt die Abrissbirne, Q markiert und F rettet. Prüfe vor dem Schlag die Stützen des Klaviers.',
    ],
  ),
  'reel-problems': guide(
    5,
    'medium',
    false,
    [
      'Catch fish together from an unstable boat. Untangle lines and rescue your crew.',
      'Fangt gemeinsam Fische auf einem wackligen Boot. Entwirrt Leinen und rettet eure Crew.',
    ],
    [
      'WASD moves. Space or a click casts; hold E to reel, releasing at red tension. Shift braces, R untangles, Q cuts and F rescues.',
      'WASD bewegt. Leertaste oder Klick wirft aus; E hält die Rolle, bei roter Spannung loslassen. Shift stützt, R entwirrt, Q kappt und F rettet.',
    ],
  ),
  'uphill-delivery': guide(
    4,
    'medium',
    false,
    [
      'Carry the sofa to its destination together before the delivery clock runs out.',
      'Tragt das Sofa gemeinsam ans Ziel, bevor die Lieferzeit abläuft.',
    ],
    [
      'WASD moves, Space jumps. E grabs or releases a sofa corner; R turns it. Release your corner and press F to open gates and doors.',
      'WASD bewegt, Leertaste springt. E greift oder löst eine Sofaecke; R dreht. Lass deine Ecke los und drücke F, um Tore und Türen zu öffnen.',
    ],
  ),
  'scaffold-scramble': guide(
    4,
    'tricky',
    false,
    [
      'Balance the platform and clean the windows as one crew.',
      'Haltet die Plattform im Gleichgewicht und putzt gemeinsam die Fenster.',
    ],
    [
      'A / D moves, W jumps. Space / F uses your tool; T swaps it. Q / Z raises or lowers the left winch; E / R controls the right.',
      'A / D bewegt, W springt. Leertaste / F benutzt das Werkzeug; T wechselt es. Q / Z hebt oder senkt die linke Winde; E / R steuert die rechte.',
    ],
  ),
  'chain-of-fools': guide(
    4,
    'medium',
    false,
    [
      'Get the whole crew through the course while sharing one safety line.',
      'Bringt die ganze Crew durch den Parcours. Ihr teilt euch eine Sicherungsleine.',
    ],
    [
      'WASD moves, Space jumps and Shift braces. F hauls a friend, E clips to a ring and Q calls out. Wait for the crew before a big jump.',
      'WASD bewegt, Leertaste springt und Shift stützt. F zieht einen Freund hoch, E hakt am Ring ein und Q ruft. Wartet vor großen Sprüngen auf die Crew.',
    ],
  ),
} satisfies Record<string, PartyGuide>;

export function getPartyGuide(id: string) {
  return PARTY_GUIDES[id as keyof typeof PARTY_GUIDES];
}
