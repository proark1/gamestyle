// Game links intentionally perform full navigation to give each WebGL game its own lifecycle.
// These local illustrations are served directly on both the Worker and Node hosting targets.
/* eslint-disable next/no-html-link-for-pages, next/no-img-element */
import {
  ArrowDown,
  ArrowUpRight,
  Castle,
  Gamepad2,
  Users,
  Waves,
  Eye,
  Timer,
  Mountain,
  Moon,
  HardHat,
  Blocks,
  Fish,
  CircleDot,
  Bot,
  Shuffle,
  Hammer,
  WifiOff,
  Snowflake,
  Zap,
  Luggage,
} from 'lucide-react';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import AccountButton from '@/shared/accounts/AccountButton';
import WardrobeButton from '@/shared/wardrobe/WardrobeButton';
import './collection.css';

// The shelf opens with a fixed running order, then shuffles everything after it
// so the rest of the collection gets a turn in the top row.
const PINNED = [
  'stack-or-sink',
  'uphill-delivery',
  'reel-problems',
  'shelf-control',
] as const;
const SHUFFLED = [
  'sample-stampede',
  'carry-on-carnage',
  'bungee-doubles',
  'basketball',
  'crane-clash',
  'siege-and-desist',
  'load-bearing',
  'wrong-floor',
  'one-more-button',
  'four-brain-cells',
  'act-natural',
  'dont-wake-the-giant',
  'chaos',
  'first-person',
  'panic-curling',
  'zorb-clash',
] as const;

function shuffle(slugs: readonly string[]) {
  const order = [...slugs];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

const CARDS: Record<string, ReactElement> = {
  'carry-on-carnage': (
    <a
      key="carry-on-carnage"
      className="game-card carry-on-carnage-card"
      href="/carry-on-carnage"
      aria-label="Carry-On Carnage: Gate Check Roulette in the Jumbleyard style"
    >
      <div className="game-card-art">
        <img
          src="/images/carry-on-carnage.png"
          alt="Desperate travelers dogpiling to compress an overstuffed bulging suitcase before the gate agent's metal sizer box as a piñata burst launches rubber ducks and flamingos."
          width="1536"
          height="1024"
          loading="lazy"
        />
        <span className="game-card-tag">
          <Luggage size={14} /> GATE CHECK ROULETTE
        </span>
        <span className="new-game-tag">NEU IN JUMBLEYARD</span>
        <span className="game-card-play" aria-hidden="true">
          <ArrowUpRight size={27} />
        </span>
      </div>
      <div className="game-card-content">
        <div className="game-card-meta">
          <span>
            <Users size={14} /> 1–4 Reisende
          </span>
          <span>
            <Timer size={14} /> 3 Minuten · Boarding Call
          </span>
        </div>
        <h2>
          Carry-On <span>Carnage</span>
          <span className="game-title-dot">.</span>
        </h2>
        <p>
          Packt den absurden Urlaubsmüll in Handgepäck-Koffer, springt zu dritt
          drauf, um die Reißverschlüsse zuzukriegen, schmuggelt Hummer an der
          TSA vorbei und besteht den gnadenlosen Metall-Testkasten der
          Fluglinie!
        </p>
        <div className="game-card-bottom">
          <span>SQUISH IT! ZIP IT! DON&apos;T POP!</span>
          <strong>
            Carry-On Carnage spielen <ArrowUpRight size={17} />
          </strong>
        </div>
      </div>
    </a>
  ),
  'bungee-doubles': (
    <a
      key="bungee-doubles"
      className="game-card bungee-doubles-card"
      href="/bungee-doubles"
      aria-label="Bungee Padel: 2v2 tethered padel mayhem with wall rebounds in the Jumbleyard style"
    >
      <div className="game-card-art">
        <img
          src="/images/bungee-doubles.png"
          alt="Two toy padel players in orange shirts tethered by an elastic bungee cord dive across the court for a smash off the back glass."
          width="1536"
          height="1024"
          loading="lazy"
        />
        <span className="game-card-tag">
          <Gamepad2 size={14} /> 2 GEGEN 2 · BUNGEE PADEL
        </span>
        <span className="new-game-tag">NEU IN JUMBLEYARD</span>
        <span className="game-card-play" aria-hidden="true">
          <ArrowUpRight size={27} />
        </span>
      </div>
      <div className="game-card-content">
        <div className="game-card-meta">
          <span>
            <Users size={14} /> 1–4 Spieler (2v2)
          </span>
          <span>
            <Timer size={14} /> Bis 7 Punkte
          </span>
        </div>
        <h2>
          Bungee <span>Padel</span>
          <span className="game-title-dot">.</span>
        </h2>
        <p>
          Padel-Doppel mit absolutem Team-Chaos! Enge Glas- und Gitterwände,
          wilde Rebounds von der Rückwand und euer Teammate am elastischen
          Bungee-Seil. Nutzt die Seilspannung für Überschall-Smashs!
        </p>
        <div className="game-card-bottom">
          <span>Glas-Rebound oder Team-Bonk?</span>
          <strong>
            Bungee Padel spielen <ArrowUpRight size={17} />
          </strong>
        </div>
      </div>
    </a>
  ),
  'panic-curling': (
    <a
      key="panic-curling"
      className="game-card curling-card"
      href="/panic-curling"
      aria-label="Panic Curling: Extreme Ice & Sweeper Chaos in the Jumbleyard style"
    >
      <div className="game-card-art">
        <img
          src="/images/panic-curling.png"
          alt="Curling crew in winter parkas frantically scrubbing thin cracking pond ice with brooms and blowtorches as an anvil and teammate in a laundry basket slide toward the target house."
          width="1536"
          height="1024"
          loading="lazy"
        />
        <span className="game-card-tag">
          <Snowflake size={14} /> EXTREME ICE & SWEEPER CHAOS
        </span>
        <span className="new-game-tag">NEU IN JUMBLEYARD</span>
        <span className="game-card-play" aria-hidden="true">
          <ArrowUpRight size={27} />
        </span>
      </div>
      <div className="game-card-content">
        <div className="game-card-meta">
          <span>
            <Users size={14} /> 1–4 Spieler
          </span>
          <span>
            <Timer size={14} /> 3 Ends · Eis-Panik
          </span>
        </div>
        <h2>
          Panic <span>Curling</span>
          <span className="game-title-dot">.</span>
        </h2>
        <p>
          Olympisches Curling als schlitterndes Slapstick-Desaster! Werft
          Granitblöcke, Ambosse oder eure Teammates im Wäschekorb. Schrubbt mit
          Besen und Flammenwerfern das dünne Eis – aber passt auf, sonst brecht
          ihr ein!
        </p>
        <div className="game-card-bottom">
          <span>SWEEP! HARDER! NO, STOP!</span>
          <strong>
            Panic Curling spielen <ArrowUpRight size={17} />
          </strong>
        </div>
      </div>
    </a>
  ),
  basketball: (
    <a
      key="basketball"
      className="game-card basketball-card"
      href="/basketball"
      aria-label="Court Clash: 2v2 street basketball in the Jumbleyard style"
    >
      <div className="game-card-art">
        <img
          src="/images/court-clash.png"
          alt="Four toy basketball players in orange and teal jerseys compete on an outdoor court as one leaps toward the hoop for a slam dunk."
          width="1536"
          height="1024"
          loading="lazy"
        />
        <span className="game-card-tag">
          <Gamepad2 size={14} /> 2 GEGEN 2 · STREETBALL
        </span>
        <span className="new-game-tag">NEU IN JUMBLEYARD</span>
        <span className="game-card-play" aria-hidden="true">
          <ArrowUpRight size={27} />
        </span>
      </div>
      <div className="game-card-content">
        <div className="game-card-meta">
          <span>
            <Users size={14} /> 1–4 Spieler (2v2)
          </span>
          <span>
            <Timer size={14} /> Bis 15 Punkte
          </span>
        </div>
        <h2>
          Court <span>Clash</span>
          <span className="game-title-dot">.</span>
        </h2>
        <p>
          Streetball im 2-gegen-2 Match! Dribble, passe zu deinem Teammate,
          triff 3-Pointer oder nutze spektakuläre Supersprünge für krachende
          Slam Dunks.
        </p>
        <div className="game-card-bottom">
          <span>Swish oder Slam Dunk?</span>
          <strong>
            Court Clash spielen <ArrowUpRight size={17} />
          </strong>
        </div>
      </div>
    </a>
  ),
  'crane-clash': (
    <a
      key="crane-clash"
      className="game-card crane-clash-card"
      href="/crane-clash"
      aria-label="Crane Clash: swing from the crane cable and stack crates as high as possible"
    >
      <div className="game-card-art">
        <img
          src="/images/crane-clash.png"
          alt="Workers swing from orange and teal crane cables carrying wooden crates toward two teetering towers while their teammates operate the cranes."
          width="1536"
          height="1024"
          loading="lazy"
        />
        <span className="game-card-tag">
          <HardHat size={14} /> 2 KRÄNE · 4 SPIELER
        </span>
        <span className="new-game-tag">NEU IN JUMBLEYARD</span>
        <span className="game-card-play" aria-hidden="true">
          <ArrowUpRight size={27} />
        </span>
      </div>
      <div className="game-card-content">
        <div className="game-card-meta">
          <span>
            <Users size={14} /> 1–4 Spieler (2v2)
          </span>
          <span>
            <Timer size={14} /> 3-Minuten Match
          </span>
        </div>
        <h2>
          Crane <span>Clash</span>
          <span className="game-title-dot">.</span>
        </h2>
        <p>
          Zwei Kräne, ein chaotischer Baustellenhof und wer schwingt, fliegt!
          Hänge am Seil, bring dich durch Eigenbewegung in Schwung, greife
          Kisten und baue mit deinem Team den höchsten Turm.
        </p>
        <div className="game-card-bottom">
          <span>Wer am höchsten baut, gewinnt.</span>
          <strong>
            Crane Clash spielen <ArrowUpRight size={17} />
          </strong>
        </div>
      </div>
    </a>
  ),
  'siege-and-desist': (
    <a
      key="siege-and-desist"
      className="game-card siege-card"
      href="/siege-and-desist"
    >
      <div className="game-card-art">
        <img
          src="/images/siege-and-desist.png"
          alt="Four tiny medieval crew members work one enormous wooden trebuchet on a golden hillside while a boulder sails toward a sandstone keep flying a red banner."
          width="1536"
          height="1024"
          loading="lazy"
        />
        <span className="game-card-tag">
          <Castle size={14} /> EVERYONE VS. THE KEEP
        </span>
        <span className="new-game-tag">NEW TO JUMBLEYARD</span>
        <span className="game-card-play" aria-hidden="true">
          <ArrowUpRight size={27} />
        </span>
      </div>
      <div className="game-card-content">
        <div className="game-card-meta">
          <span>
            <Users size={14} /> 1–4 players
          </span>
          <span>
            <Timer size={14} /> 4-minute sieges
          </span>
        </div>
        <h2>
          Siege <span>and</span> Desist
          <span className="game-title-dot">.</span>
        </h2>
        <p>
          One trebuchet, four opinions, and a castle that genuinely falls over.
          Wind the counterweight, load the sling, and bring the banner down
          before dawn.
        </p>
        <div className="game-card-bottom">
          <span>Someone will end up in the sling.</span>
          <strong>
            Play Siege and Desist <ArrowUpRight size={17} />
          </strong>
        </div>
      </div>
    </a>
  ),
  'stack-or-sink': (
    <a
      key="stack-or-sink"
      className="game-card stack-card"
      href="/stack-or-sink"
    >
      <div className="game-card-art">
        <img
          src="/images/stack-or-sink.png"
          alt="Hard-hatted friends stack crates and a sofa above a rising flood in a toy-like salvage yard."
          width="1536"
          height="1024"
          fetchPriority="high"
        />
        <span className="game-card-tag">
          <Waves size={14} /> EVERYONE VS. THE FLOOD
        </span>
        <span className="game-card-play" aria-hidden="true">
          <ArrowUpRight size={27} />
        </span>
      </div>
      <div className="game-card-content">
        <div className="game-card-meta">
          <span>
            <Users size={14} /> 1–4 players
          </span>
          <span>Co-op survival</span>
        </div>
        <h2>
          Stack <span>or</span> Sink
          <span className="game-title-dot">.</span>
        </h2>
        <p>
          The water’s rising. Your escape plan is a pile of junk. Build a tower,
          rescue your crew, and try not to move the load-bearing sofa.
        </p>
        <div className="game-card-bottom">
          <span>One crew. One very wobbly plan.</span>
          <strong>
            Play Stack or Sink <ArrowUpRight size={17} />
          </strong>
        </div>
      </div>
    </a>
  ),
  'uphill-delivery': (
    <a
      key="uphill-delivery"
      className="game-card delivery-card"
      href="/uphill-delivery"
    >
      <div className="game-card-art">
        <img
          src="/images/uphill-delivery.png"
          alt="Four hard-hatted friends carry an enormous yellow sofa up a mountain village, past a rope bridge and a stubborn goat."
          width="1536"
          height="1024"
          fetchPriority="high"
        />
        <span className="game-card-tag">
          <Mountain size={14} /> EVERYONE VS. GRAVITY
        </span>
        <span className="game-card-play" aria-hidden="true">
          <ArrowUpRight size={27} />
        </span>
      </div>
      <div className="game-card-content">
        <div className="game-card-meta">
          <span>
            <Users size={14} /> 1–4 players
          </span>
          <span>Co-op physics</span>
        </div>
        <h2>
          Uphill Delivery<span className="game-title-dot">.</span>
        </h2>
        <p>
          Deliver a very large sofa to a very high address. Share the weight,
          bounce across gaps, and catch it when gravity takes over. Mind the
          front door.
        </p>
        <div className="game-card-bottom">
          <span>Four friends. One sofa. No elevator.</span>
          <strong>
            Play Uphill Delivery <ArrowUpRight size={17} />
          </strong>
        </div>
      </div>
    </a>
  ),
  'reel-problems': (
    <a
      key="reel-problems"
      className="game-card reel-card"
      href="/reel-problems"
    >
      <div className="game-card-art">
        <img
          src="/images/reel-problems.png"
          alt="Four friends in a tiny coral fishing boat are dragged across a lake by an enormous fish, with tangled lines and one friend overboard."
          width="1536"
          height="1024"
          fetchPriority="high"
        />
        <span className="game-card-tag">
          <Fish size={14} /> THE FISH CAUGHT US
        </span>
        <span className="new-game-tag">NEW TO JUMBLEYARD</span>
        <span className="game-card-play" aria-hidden="true">
          <ArrowUpRight size={27} />
        </span>
      </div>
      <div className="game-card-content">
        <div className="game-card-meta">
          <span>
            <Users size={14} /> 1–4 anglers
          </span>
          <span>
            <Timer size={14} /> 5-minute tournaments
          </span>
        </div>
        <h2>
          Reel Problems<span className="game-title-dot">.</span>
        </h2>
        <p>
          Big fish. Tiny boat. Cast together, untangle your lines, and turn lake
          junk into gear. Try to land the catch before it lands you in the
          water.
        </p>
        <div className="game-card-bottom">
          <span>Four friends. One very questionable boat.</span>
          <strong>
            Play Reel Problems <ArrowUpRight size={17} />
          </strong>
        </div>
      </div>
    </a>
  ),
  'shelf-control': (
    <a
      key="shelf-control"
      className="game-card shelf-control-card"
      href="/shelf-control"
    >
      <div className="game-card-art">
        <img
          src="/images/shelf-control.png?v=toy-style-2"
          alt="Wooden mannequins sneak a ladder past a distracted night guard in a furniture showroom."
          width="1536"
          height="1024"
          loading="lazy"
        />
        <span className="game-card-tag">
          <Eye size={14} /> PLEASE DO NOT MOVE THE DISPLAYS
        </span>
        <span className="game-card-play" aria-hidden="true">
          <ArrowUpRight size={27} />
        </span>
      </div>
      <div className="game-card-content">
        <div className="game-card-meta">
          <span>
            <Users size={14} /> 1–4 players + NPCs
          </span>
          <span>
            <Timer size={14} /> 3-minute shifts
          </span>
        </div>
        <h2>
          Shelf Control<span className="game-title-dot">.</span>
        </h2>
        <p>
          One night guard. Three very unconvincing mannequins. Blend into the
          furniture displays, switch off security, and sneak out carrying a
          ladder.
        </p>
        <div className="game-card-bottom">
          <span>Look normal. Everything must stay.</span>
          <strong>
            Play Shelf Control <ArrowUpRight size={17} />
          </strong>
        </div>
      </div>
    </a>
  ),
  'wrong-floor': (
    <a key="wrong-floor" className="game-card hotel-card" href="/wrong-floor">
      <div className="game-card-art">
        <img
          src="/images/wrong-floor.png"
          alt="Four toy guests check out of a mysterious hotel. Only one sees the shadow sprinting toward their elevator."
          width="1536"
          height="1024"
          loading="lazy"
        />
        <span className="game-card-tag">
          <Eye size={14} /> WHY CAN ONLY YOU SEE THAT?
        </span>
        <span className="new-game-tag">NEW TO JUMBLEYARD</span>
        <span className="game-card-play" aria-hidden="true">
          <ArrowUpRight size={27} />
        </span>
      </div>
      <div className="game-card-content">
        <div className="game-card-meta">
          <span>
            <Users size={14} /> 1–4 guests + NPCs
          </span>
          <span>
            <Timer size={14} /> 5 elevator stops
          </span>
        </div>
        <h2>
          Wrong Floor<span className="game-title-dot">.</span>
        </h2>
        <p>
          One hallway. Four different realities. Compare impossible clues, vote
          to advance or retreat, and run when the hotel disagrees.
        </p>
        <div className="game-card-bottom">
          <span>“The hallway is empty.” Are you sure?</span>
          <strong>
            Play Wrong Floor <ArrowUpRight size={17} />
          </strong>
        </div>
      </div>
    </a>
  ),
  'load-bearing': (
    <a
      key="load-bearing"
      className="game-card wreck-card"
      href="/load-bearing"
      aria-label="Load Bearing: bring a condemned house down without destroying the piano"
    >
      <div className="game-card-art wreck-art">
        <img
          src="/images/load-bearing.png"
          alt="A wrecking ball demolishes a toy house while four workers try to protect an upright piano on the exposed upper floor."
          width="1536"
          height="1024"
          loading="lazy"
        />
        <span className="game-card-tag">
          <Hammer size={14} /> MIND THE PIANO
        </span>
        <span className="new-game-tag">NEW TO JUMBLEYARD</span>
        <span className="game-card-play" aria-hidden="true">
          <ArrowUpRight size={27} />
        </span>
      </div>
      <div className="game-card-content">
        <div className="game-card-meta">
          <span>
            <Users size={14} /> 1–4 players
          </span>
          <span>
            <Timer size={14} /> 3-minute jobs
          </span>
        </div>
        <h2>
          Load Bearing<span className="game-title-dot">.</span>
        </h2>
        <p>
          Bring a condemned house down in three minutes. The client&rsquo;s
          piano is on the upper floor and has to survive. Cut the wrong support
          and the whole storey pancakes onto it.
        </p>
        <div className="game-card-bottom">
          <span>Which wall was holding that up?</span>
          <strong>
            Play Load Bearing <ArrowUpRight size={17} />
          </strong>
        </div>
      </div>
    </a>
  ),
  'one-more-button': (
    <a
      key="one-more-button"
      className="game-card button-card"
      href="/one-more-button"
    >
      <div className="game-card-art">
        <img
          src="/images/one-more-button.png"
          alt="A contestant presses a huge red button as a giant boxing glove launches three friends through a toy game-show room."
          width="1536"
          height="1024"
          loading="lazy"
        />
        <span className="game-card-tag">
          <CircleDot size={14} /> SOMEONE ALWAYS PRESSES AGAIN
        </span>
        <span className="new-game-tag">NEW TO JUMBLEYARD</span>
        <span className="game-card-play" aria-hidden="true">
          <ArrowUpRight size={27} />
        </span>
      </div>
      <div className="game-card-content">
        <div className="game-card-meta">
          <span>
            <Users size={14} /> 1–4 players
          </span>
          <span>
            <Timer size={14} /> 3-minute shows
          </span>
        </div>
        <h2>
          One More Button<span className="game-title-dot">.</span>
        </h2>
        <p>
          Every press adds money. And another terrible idea. Dodge giant gloves,
          slippery soap, and spinning sofas. Get your crew out with the
          winnings.
        </p>
        <div className="game-card-bottom">
          <span>We were rich until you touched it.</span>
          <strong>
            Play One More Button <ArrowUpRight size={17} />
          </strong>
        </div>
      </div>
    </a>
  ),
  'four-brain-cells': (
    <a
      key="four-brain-cells"
      className="game-card brain-card"
      href="/four-brain-cells"
    >
      <div className="game-card-art">
        <img
          src="/images/four-brain-cells.png"
          alt="A clumsy toy robot with four colored limbs pours coffee, flips pancakes, and accidentally kicks the breakfast table."
          width="1536"
          height="1024"
          loading="lazy"
        />
        <span className="game-card-tag">
          <Bot size={14} /> SOME ASSEMBLY REQUIRED
        </span>
        <span className="new-game-tag">NEW TO JUMBLEYARD</span>
        <span className="game-card-play" aria-hidden="true">
          <ArrowUpRight size={27} />
        </span>
      </div>
      <div className="game-card-content">
        <div className="game-card-meta">
          <span>
            <Users size={14} /> 1–4 brain cells
          </span>
          <span>
            <Timer size={14} /> 6-minute breakfast
          </span>
        </div>
        <h2>
          Four Brain Cells<span className="game-title-dot">.</span>
        </h2>
        <p>
          Everyone controls one limb of a clumsy robot. Cook pancakes, pour
          coffee, and get breakfast to the table. Someone, please stop kicking.
        </p>
        <div className="game-card-bottom">
          <span>Four players. One functioning adult.</span>
          <strong>
            Play Four Brain Cells <ArrowUpRight size={17} />
          </strong>
        </div>
      </div>
    </a>
  ),
  'act-natural': (
    <a key="act-natural" className="game-card cow-card" href="/act-natural">
      <div className="game-card-art">
        <img
          src="/images/blend-business.png"
          alt="A cow secretly drags a ladder behind a farmer while the rest of the herd grazes innocently."
          width="1536"
          height="1024"
          loading="lazy"
        />
        <span className="game-card-tag">
          <Eye size={14} /> YOUR FRIENDS ARE THE COWS
        </span>
        <span className="game-card-play" aria-hidden="true">
          <ArrowUpRight size={27} />
        </span>
      </div>
      <div className="game-card-content">
        <div className="game-card-meta">
          <span>
            <Users size={14} /> 2–4 players · solo practice
          </span>
          <span>
            <Timer size={14} /> 3-minute rounds
          </span>
        </div>
        <h2>
          Blend Business<span className="game-title-dot">.</span>
        </h2>
        <p>
          One farmer. A very ordinary herd. Steal the keys, cut the power, and
          escape with your fellow fake cows. Just remember to chew.
        </p>
        <div className="game-card-bottom">
          <span>Three of these cows are your friends.</span>
          <strong>
            Play Blend Business <ArrowUpRight size={17} />
          </strong>
        </div>
      </div>
    </a>
  ),
  'dont-wake-the-giant': (
    <a
      key="dont-wake-the-giant"
      className="game-card giant-card"
      href="/dont-wake-the-giant"
    >
      <div className="game-card-art">
        <img
          src="/images/tiptoe-thieves.png"
          alt="Four tiny thieves climb a sleeping bearded giant in a warm cottage, with a gold necklace, teaspoon bridge, and a feather near his foot."
          width="1536"
          height="1024"
          loading="lazy"
        />
        <span className="game-card-tag">
          <Moon size={14} /> EVERYONE VS. ONE ENORMOUS NAP
        </span>
        <span className="game-card-play" aria-hidden="true">
          <ArrowUpRight size={27} />
        </span>
      </div>
      <div className="game-card-content">
        <div className="game-card-meta">
          <span>
            <Users size={14} /> 2–4 players · solo practice
          </span>
          <span>Co-op stealth</span>
        </div>
        <h2>
          Tiptoe Thieves<span className="game-title-dot">.</span>
        </h2>
        <p>
          Climb a breathing giant, steal his treasure, and creep back to the
          door. Cushion your landings. Watch his arm. Please don’t tickle his
          foot.
        </p>
        <div className="game-card-bottom">
          <span>Four tiny thieves. One enormous nap.</span>
          <strong>
            Play the cottage heist <ArrowUpRight size={17} />
          </strong>
        </div>
      </div>
    </a>
  ),
  chaos: (
    <a key="chaos" className="game-card builders-card" href="/chaos">
      <div className="game-card-art">
        <img
          src="/images/permit-pending.png"
          alt="Four hard-hatted builders carry a sofa and assemble a house while a crane lifts the roof."
          width="1536"
          height="1024"
          loading="lazy"
        />
        <span className="game-card-tag">
          <HardHat size={14} /> CHAOS WITH THE CREW
        </span>
        <span className="new-game-tag">NEW TO JUMBLEYARD</span>
        <span className="game-card-play" aria-hidden="true">
          <ArrowUpRight size={27} />
        </span>
      </div>
      <div className="game-card-content">
        <div className="game-card-meta">
          <span>
            <Users size={14} /> 1–4 players
          </span>
          <span>Co-op building chaos</span>
        </div>
        <h2>
          Permit Pending<span className="game-title-dot">.</span>
        </h2>
        <p>
          Build a house, haul the furniture, and get it ready for the customer.
          Work the crane, rescue a shaky delivery, and save your crew’s best
          creations.
        </p>
        <div className="game-card-bottom">
          <span>Big plans. Questionable permits.</span>
          <strong>
            Play Permit Pending <ArrowUpRight size={17} />
          </strong>
        </div>
      </div>
    </a>
  ),
  'first-person': (
    <a
      key="first-person"
      className="game-card brick-by-hand-card"
      href="/first-person"
    >
      <div className="game-card-art">
        <img
          src="/images/brick-by-hand.png"
          alt="A builder lays a brick with a mortar trowel while friends work on the house beside a cement mixer."
          width="1536"
          height="1024"
          loading="lazy"
        />
        <span className="game-card-tag">
          <Blocks size={14} /> BRICK BY BRICK, TOGETHER
        </span>
        <span className="new-game-tag">NEW TO JUMBLEYARD</span>
        <span className="game-card-play" aria-hidden="true">
          <ArrowUpRight size={27} />
        </span>
      </div>
      <div className="game-card-content">
        <div className="game-card-meta">
          <span>
            <Users size={14} /> 1–4 players
          </span>
          <span>First-person building</span>
        </div>
        <h2>
          Brick by Hand<span className="game-title-dot">.</span>
        </h2>
        <p>
          Pick up your trowel and build with your own hands. Mix mortar, lay
          individual bricks, and raise a home with your friends, one wall at a
          time.
        </p>
        <div className="game-card-bottom">
          <span>One crew. Every brick.</span>
          <strong>
            Play Brick by Hand <ArrowUpRight size={17} />
          </strong>
        </div>
      </div>
    </a>
  ),
  'zorb-clash': (
    <a
      key="zorb-clash"
      className="game-card zorb-clash-card"
      href="/zorb-clash"
      aria-label="Zorb Clash: Bubble soccer and sumo derby with hyper-bouncy Cannon physics"
    >
      <div className="game-card-art">
        <img
          src="/images/zorb-clash.png"
          alt="Players inside giant transparent inflatable bumper balls crash into each other on a soccer pitch with bouncing ragdolls and an oversized ball."
          width="1536"
          height="1024"
          loading="lazy"
        />
        <span className="game-card-tag">
          <Zap size={14} /> BUBBLE SOCCER · SUMO DERBY
        </span>
        <span className="new-game-tag">NEW TO JUMBLEYARD</span>
        <span className="game-card-play" aria-hidden="true">
          <ArrowUpRight size={27} />
        </span>
      </div>
      <div className="game-card-content">
        <div className="game-card-meta">
          <span>
            <Users size={14} /> 1–4 players
          </span>
          <span>Hyper-bouncy physics</span>
        </div>
        <h2>
          Zorb <span>Clash</span>
          <span className="game-title-dot">.</span>
        </h2>
        <p>
          Fast-paced bubble soccer where hitting the ball is secondary and
          launching your friends across the pitch is primary! Charge bumper
          dashes, brace against hits, and wiggle out of the upside-down turtle
          state.
        </p>
        <div className="game-card-bottom">
          <span>Strap in. Bounce hard. Flip upside down.</span>
          <strong>
            Play Zorb Clash <ArrowUpRight size={17} />
          </strong>
        </div>
      </div>
    </a>
  ),
  'sample-stampede': (
    <a
      key="sample-stampede"
      className="game-card sample-stampede-card"
      href="/sample-stampede"
      aria-label="Sample Stampede: Wholesale warehouse cart derby with squeaky-wheel drifting and free sample frenzy"
    >
      <div className="game-card-art">
        <img
          src="/images/sample-stampede.png"
          alt="Overloaded shopping carts drift through industrial warehouse aisles as players race towards free food samples."
          width="1536"
          height="1024"
          loading="lazy"
        />
        <span className="game-card-tag">
          <Zap size={14} /> CART DERBY · WAREHOUSE CHAOS
        </span>
        <span className="new-game-tag">NEW TO JUMBLEYARD</span>
        <span className="game-card-play" aria-hidden="true">
          <ArrowUpRight size={27} />
        </span>
      </div>
      <div className="game-card-content">
        <div className="game-card-meta">
          <span>
            <Users size={14} /> 1–4 players
          </span>
          <span>Squeaky-wheel drift physics</span>
        </div>
        <h2>
          Sample <span>Stampede</span>
          <span className="game-title-dot">.</span>
        </h2>
        <p>
          Push squeaky-wheel shopping carts through wholesale aisles! Pile on
          50lb kibble bags to drift hard around corners, race for fresh taquito
          samples, and survive the eagle-eyed exit receipt gauntlet.
        </p>
        <div className="game-card-bottom">
          <span>Drift hard. Snag samples. Watch the receipt.</span>
          <strong>
            Play Sample Stampede <ArrowUpRight size={17} />
          </strong>
        </div>
      </div>
    </a>
  ),
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ room?: string; raum?: string }>;
}) {
  const { room, raum } = await searchParams;
  if (room && /^[A-Z2-9]{6}$/i.test(room))
    redirect(`/stack-or-sink?room=${encodeURIComponent(room)}`);
  if (raum && /^[A-Z2-9]{6}$/i.test(raum))
    redirect(`/chaos?raum=${encodeURIComponent(raum)}`);
  const order = [...PINNED, ...shuffle(SHUFFLED)];
  return (
    <main className="collection">
      <header className="collection-header">
        <a className="collection-brand" href="/">
          <span>
            <Gamepad2 size={24} />
          </span>
          JUMBLEYARD<span className="brand-period">.</span>
        </a>
        <span className="collection-header-note">
          GOOD COMPANY. QUESTIONABLE PLANS.
        </span>
        <div className="collection-header-actions">
          <a className="collection-nav" href="#games">
            Pick a game <ArrowDown size={15} />
          </a>
          <WardrobeButton variant="header" />
          <AccountButton variant="header" />
        </div>
      </header>
      <section className="collection-intro">
        <div className="collection-kicker">
          <span className="live-dot" /> LITTLE GAMES. BIG FRIENDSHIP TESTS.
        </div>
        <h1>
          Bring your friends.
          <br />
          <span>Make a little chaos.</span>
        </h1>
        <p>
          Escape a flood. Fool a farmer. Carry a sofa. Build something together.
          <br className="desktop-break" /> More ways to find out who you can
          count on.
        </p>
        <ul className="collection-stats">
          <li>
            <Gamepad2 size={14} /> {order.length} games
          </li>
          <li>
            <Users size={14} /> 1–4 players
          </li>
          <li>
            <Timer size={14} /> 3–6 minute rounds
          </li>
          <li>
            <WifiOff size={14} /> No download, no account needed
          </li>
        </ul>
      </section>
      <div className="shelf-lead">
        <h2>The whole yard</h2>
        <span>
          <Shuffle size={13} /> Reshuffled every visit
        </span>
      </div>
      <section className="game-shelf" id="games" aria-label="Choose a game">
        {order.map((slug) => CARDS[slug])}
      </section>
      <footer className="collection-footer">
        <span>
          <Gamepad2 size={17} /> SAME LITTLE WORLD. DIFFERENT BAD IDEAS.
        </span>
        <span>No download. Share a room code. You’re in.</span>
      </footer>
    </main>
  );
}
