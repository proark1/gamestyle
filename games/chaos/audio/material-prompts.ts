import type { CATALOG } from '../catalog';
import { houseMaterial } from './house-prompts';
import { homeExpansionMaterial } from './home-expansion-prompts';
type Action = 'grab' | 'place' | 'drop' | 'remove' | 'throw' | 'impact';

type ObjectId = (typeof CATALOG)[number]['id'];

export const chaosMaterial: Record<ObjectId, Record<Action, string>> = {
  ...houseMaterial,
  ...homeExpansionMaterial,
  stairs: {
    grab: 'A heavy timber staircase is lifted: dry wooden joint creaks and work-glove friction.',
    place:
      'A timber staircase is seated against its landing: two weighty wooden knocks, a brief joist creak and a final carpenter hammer tap.',
    drop: 'A heavy timber stair module lands on a wooden floor with a hollow low thump and short joint rattle.',
    remove:
      'A wooden staircase is detached from its landing with a short timber scrape and dry joint creak.',
    throw:
      'A timber stair module is heaved away with a wooden frame creak and brief glove movement.',
    impact:
      'A heavy timber stair module hits the ground with a hollow frame thud and short wooden rattle.',
  },
  wall: {
    grab: 'Work gloves grip the rough edges of a heavy plastered masonry wall section and lift it from concrete: coarse glove abrasion, a low stone edge scrape, then silence as it clears the ground.',
    place:
      'A heavy masonry wall section is aligned and seated on a concrete foundation: a short gritty adjustment scrape followed by one dense, low stone thud. A few grains fall; no demolition.',
    drop: 'A plastered masonry section is lowered roughly onto concrete: its bottom corner knocks first, followed by a heavier flat thud and a little grit skittering.',
    remove:
      'An intact masonry wall section rocks free from its seated position: dry mineral friction, two small gritty knocks, then a brief scrape as the bottom edge lifts clear.',
    throw:
      'A worker heaves and releases a masonry wall section: gloves drag against rough plaster with a short gravelly scrape and sleeve strain. End at release; no airborne whoosh or landing.',
    impact:
      'A heavy masonry section falls flat onto a concrete slab: a dense blunt stone impact, a smaller edge knock, and loose grit scattering. The section stays intact; no explosion or rubble collapse.',
  },
  window: {
    grab: 'Gloves lift a masonry window section by its wooden frame: palm friction, timber joint creak, a very faint intact glass pane chatter, then the stone base scrapes clear.',
    place:
      'A framed glass window wall section seats onto masonry: a short stone scrape and solid base knock, with a light secondary wooden frame tick and intact pane rattle.',
    drop: 'A heavy window wall section is set onto concrete: a muted masonry thud transmits into a brief wooden frame creak and delicate glass vibration; glass remains whole.',
    remove:
      'A window wall section is eased loose: its masonry base rasps, the wooden frame creaks under the lift, and a loosely held intact pane gives a tiny chatter.',
    throw:
      'Hands tighten on a wooden window frame and swing the intact wall section outward: glove friction, stressed frame creak and one fine glass rattle. Stop at release with no landing.',
    impact:
      'A window wall section lands on its masonry base on concrete: deep mineral thud, frame knocking and a brief higher glass-pane chatter. No shattering or tinkling broken glass.',
  },
  door: {
    grab: 'Gloves lift a solid wooden door and frame: dry palm rub, a strained timber joint creak and a small loose hinge tick as it tilts.',
    place:
      'A wooden door frame slides into a timber opening: dry wood-on-wood friction, two restrained seating knocks and a faint metal hinge rattle.',
    drop: 'A wooden door frame is set on concrete: two uneven end-grain knocks, a short edge scrape and a loose hinge ticking once.',
    remove:
      'An intact wooden door frame is wiggled out of its opening: tight dry timber squeak, rubbing wood and one released joint clack. No splintering.',
    throw:
      'Gloved hands swing and release a wooden door frame: palm scuff, flexing wood creak and a small hinge rattle. No door slam or landing.',
    impact:
      'A wooden door and frame falls onto concrete: broad hollow timber slap, a second corner knock and loose hinge chatter, then stillness. No broken wood.',
  },
  roof: {
    grab: 'Hands lift a terracotta-tiled roof section by its timber underside: rough wood rubbing, a beam creak and a few dry clay tiles softly clicking against each other.',
    place:
      'A tiled roof section settles onto wooden wall supports: low timber seating knocks underneath a brief cluster of dry terracotta tile clacks.',
    drop: 'A terracotta-tiled timber roof section is lowered onto concrete: a blunt wooden edge knock followed by short hollow clay rattles as the tiles settle intact.',
    remove:
      'A tiled roof section lifts away from timber supports: dry beam friction and a creak, followed by several small clay tile clicks as its weight shifts.',
    throw:
      'A worker swings a tiled timber roof section: gloves rasp on wood, the frame flexes and clay tiles chatter briefly. End at release, no landing or rushing air.',
    impact:
      'A terracotta roof section lands on its timber frame on concrete: a low wooden crash with several hollow clay clacks and a final small tile rattle. No tiles shatter.',
  },
  floor: {
    grab: 'Gloves slide under a thick timber floor panel and lift: dry grain rubbing, one edge scraping the stack and a restrained board flex creak.',
    place:
      'A thick wooden floor panel slides against its neighboring board and seats on joists: a grainy wooden scrape followed by two broad resonant timber knocks.',
    drop: 'A thick timber panel is lowered onto concrete edge first and then flat: a sharp wooden corner knock followed by a broader hollow board slap.',
    remove:
      'A timber floor panel is rocked and lifted from its supports: tight wood friction, a short joint squeak and an edge clack as it clears the neighboring board.',
    throw:
      'Hands shift grip and throw a wooden floor panel: gloves brush rough grain and the panel flexes with one faint creak. No landing or synthetic whoosh.',
    impact:
      'A thick wooden floor panel lands flat on concrete: a broad resonant wood slap, a short corner bounce and a gritty sliding scrape. No breaking.',
  },
  sofa: {
    grab: 'An upholstered sofa is lifted from below: fabric compresses and rubs against gloves, its wooden frame creaks and one internal spring gives a muffled flex.',
    place:
      'A sofa is gently positioned on wooden flooring: its feet make two soft wooden contacts, upholstery swishes and a spring settles with a quiet creak.',
    drop: 'A heavy upholstered sofa is set firmly on concrete: a low cushioned frame thump, feet knocking separately, soft fabric movement and a muted spring creak.',
    remove:
      'A sofa is shifted out of its position: short wooden feet scrape, upholstery brushes the gloves and the loaded frame creaks as it lifts.',
    throw:
      'A sofa is swung and released: upholstery stretches with a cloth swish and its wooden frame and springs groan briefly. No impact or comic spring twang.',
    impact:
      'An upholstered sofa hits concrete on its side: a large soft fabric-damped thump, a secondary wooden frame knock and muted internal spring rattle. No explosion.',
  },
  table: {
    grab: 'Hands lift a solid wooden table by the apron: glove rub on timber, a small joint creak, and its last foot briefly scuffing the ground.',
    place:
      'A solid wooden table is positioned on timber flooring: two pairs of feet tap in quick succession, followed by a tiny leg adjustment scrape.',
    drop: 'A wooden table is set firmly onto concrete: four uneven dry leg knocks, a low tabletop resonance and a short foot skid.',
    remove:
      'A wooden table is pulled slightly then lifted: its feet rasp across flooring, a mortise joint creaks under load, and the contact sound ends cleanly.',
    throw:
      'Hands swing a solid wooden table: a palm scrape along the apron and a strained wooden joint creak. Stop at release without a landing.',
    impact:
      'A wooden table tumbles onto concrete: one leg cracks against the slab without breaking, then the tabletop makes a broad resonant knock and a short edge scrape.',
  },
  chair: {
    grab: 'A wooden chair is picked up by its back rail: palm friction, a light joint squeak and one chair foot briefly scraping away.',
    place:
      'A wooden chair settles on a wooden floor: four light uneven foot taps and a small dry scrape as the last leg is aligned.',
    drop: 'A wooden chair is put down quickly on concrete: a compact clatter of feet, a brief seat resonance and a joint creak.',
    remove:
      'A wooden chair is drawn backward and lifted: several short leg scrapes on flooring, followed by a tiny back-rail creak under the grip.',
    throw:
      'A worker grips and tosses a wooden chair: glove scuff along the back rail and one dry joint creak. No exaggerated air sweep or landing.',
    impact:
      'A wooden chair tumbles on concrete: alternating light leg and backrest clacks, a short hollow seat knock and a final small scrape. It stays intact.',
  },
  bed: {
    grab: 'A wooden bed with a mattress is lifted by its side rail: coarse cloth brushes the arms, a loaded timber joint creaks and a foot scuffs clear.',
    place:
      'A bed frame is placed on wooden flooring: low uneven leg knocks, a quiet timber creak and soft mattress fabric settling.',
    drop: 'A wooden bed with mattress is lowered firmly onto concrete: a heavy damped wooden thud, a second foot knock and a soft mattress bounce rustle.',
    remove:
      'A bed is eased away from its position: short wooden foot scrapes, side-rail creaking and bedding rubbing as the frame lifts.',
    throw:
      'A bed frame and mattress are swung outward: timber joints strain with a low creak and mattress fabric swishes. End at release without impact.',
    impact:
      'A wooden bed with mattress lands on concrete: broad fabric-damped frame thump, separate wooden leg knocks and a soft mattress settling rustle. No splintering.',
  },
  plant: {
    grab: 'Gloves grip and lift a terracotta plant pot: a gritty ceramic base scrape, faint dry soil shifting and delicate leaves brushing together. No ceramic impact after lift.',
    place:
      'A terracotta plant pot is gently set on wood: a small hollow ceramic tok, a few soil grains settling and a brief fine leaf rustle.',
    drop: 'A filled terracotta plant pot is set firmly on concrete: short rounded ceramic knock, gritty base scrape and leaves shaking gently. No cracking.',
    remove:
      'A potted plant is slid slightly and lifted from a wooden surface: rough pot-base friction, dry soil movement and a soft leaf brush.',
    throw:
      'A terracotta plant pot is swung and released: glove scrape on fired clay, loose soil sliding inside and leaves swishing. No landing or ceramic break.',
    impact:
      'An intact terracotta plant pot tips onto concrete: hollow ceramic knock, a brief rim rattle, loose soil pattering and leaves brushing the ground. No shattering.',
  },
  lamp: {
    grab: 'A metal floor lamp is lifted by its stem: glove friction, a faint stem creak, a small base scrape and its fabric shade brushing softly.',
    place:
      'A metal floor lamp is set upright on wood: a compact base tap, a faint ringing stem vibration and a soft lampshade rustle.',
    drop: 'A floor lamp base is lowered firmly onto concrete: a dull metal clonk, a short stem ring and lampshade fabric fluttering once.',
    remove:
      'A metal floor lamp is slid then lifted: a small base scrape on the floor, a quiet stem tick and shade rustle. No electrical buzzing.',
    throw:
      'A worker swings a floor lamp by its metal stem: glove rub, loose fitting ticks and a soft shade flutter. End at release; no impact.',
    impact:
      'A floor lamp falls sideways on concrete: metal base clonk, two lighter stem ticks and a muffled lampshade contact. No bulb breaking or electric sparks.',
  },
  toilet: {
    grab: 'Gloves lift a heavy porcelain toilet: rubbery palm friction on glazed ceramic, a brief rough unglazed base scrape and a restrained lid tick.',
    place:
      'A porcelain toilet is seated on a firm floor: a dense hollow ceramic knock, a tiny base adjustment scrape and the lid tapping once. No water or flushing.',
    drop: 'A heavy porcelain toilet is set firmly on concrete: a low ceramic clonk with a short hollow cavity ring and a small lid rattle. No fracture.',
    remove:
      'An intact porcelain toilet is rocked gently and lifted: rough ceramic base friction, two small contact knocks and a light lid tick. No plumbing or flushing.',
    throw:
      'Hands heave and release a heavy porcelain toilet: gloves squeak faintly on smooth glaze and the loose lid clicks. No landing, flushing or whoosh.',
    impact:
      'An intact porcelain toilet lands on concrete: one heavy hollow ceramic clonk, a smaller rim contact and brief lid chatter. No shattering or water splash.',
  },
  workbench: {
    grab: 'A heavy wooden workbench is lifted by its apron: glove rasp, a deep timber joint creak and a few loose metal tools ticking on the top.',
    place:
      'A heavy timber workbench settles on concrete: two deep leg thuds, a short last-foot scrape and a couple of quiet tool rattles.',
    drop: 'A workbench is set down heavily on a concrete slab: thick wooden leg knocks, a broad low timber resonance and loose metal tools briefly clattering.',
    remove:
      'A timber workbench is dragged a few centimeters and lifted: coarse wooden foot scrape, load-bearing joint creak and light tool movement.',
    throw:
      'A worker heaves a wooden workbench: strained timber creak, glove rubbing and loose tools sliding briefly on its top. Stop before any landing.',
    impact:
      'A heavy wooden workbench strikes concrete: deep wooden frame thud, a second leg knock and short irregular tool clatter. No breaking timber.',
  },
  barrow: {
    grab: 'Gloves take wheelbarrow handles and raise its steel legs: handle rub, frame creak, brief leg scrape and a small hollow tray rattle while the tire stays grounded.',
    place:
      'A steel wheelbarrow is parked: rubber tire rolls a short distance, then two steel feet touch concrete with paired clinks and the empty tray resonates softly.',
    drop: 'Wheelbarrow handles are lowered quickly: steel support legs clack on concrete, rubber tire shifts with a dull scuff and the thin metal tray rattles.',
    remove:
      'A wheelbarrow is lifted out of its parked stance: steel feet scrape clear, its frame creaks and the rubber wheel makes a short gravelly roll.',
    throw:
      'A wheelbarrow is heaved by its handles: frame creak, thin steel tray rattle and a loose axle tick. End at release without landing or motor noise.',
    impact:
      'A steel wheelbarrow tumbles on concrete: hollow tray clang, frame clatter, damped rubber tire bounce and a final metal tick. Short natural ringing.',
  },
  cone: {
    grab: 'Gloves squeeze and lift a flexible traffic cone: quiet plastic flexing, palm rub and a rubber base peeling away from concrete with a soft scuff.',
    place:
      'A flexible traffic cone is set upright on concrete: one soft flat rubber-base slap and a faint hollow plastic wobble that quickly stops.',
    drop: 'A traffic cone is dropped upright a short distance: muted rubber slap, a tiny base bounce and flexible plastic flutter. No hard metallic knock.',
    remove:
      'A traffic cone is tilted then lifted from the ground: short rubber edge scrape and a quiet hollow plastic flex under the hand.',
    throw:
      'A hand squeezes and tosses a flexible plastic cone: soft plastic crumple, glove friction and a little base flap. No whoosh or impact.',
    impact:
      'A traffic cone tumbles onto concrete: soft rubber-base slap, two hollow plastic taps and a short rubber skid. No ringing, ceramic clack or breakage.',
  },
  pallet: {
    grab: 'Gloves lift a rough wooden shipping pallet: grain rasp, one slat creak and a bottom runner scraping clear of the stack.',
    place:
      'A wooden pallet is aligned on concrete: bottom runners scrape a short distance then settle with two dry low wood knocks and a nail squeak.',
    drop: 'A rough timber pallet is put down abruptly: several dry slat clacks over a low runner thud, then a small board rattle.',
    remove:
      'A wooden pallet is rocked off its resting position: runner friction, a tight nail-joint squeak and a slat tick as the weight releases.',
    throw:
      'Hands swing a wooden pallet: coarse glove-on-grain rasp and stressed slat creaks with a little nail chatter. End at release with no landing.',
    impact:
      'A wooden shipping pallet lands on concrete: broad runner thump, brittle-sounding but intact slat clatter, one small bounce and a short rough scrape.',
  },
  bricks: {
    grab: 'Gloved hands lift a small stack of fired clay bricks: gritty brick faces slide against one another with two quiet dry clacks as the grip tightens.',
    place:
      'A small stack of clay bricks is carefully seated against masonry: short gritty alignment scrape, one compact solid clay knock and a smaller top-brick tick.',
    drop: 'A stack of fired clay bricks is lowered firmly onto concrete: several closely spaced dry clay clacks, low base contact and a sprinkle of grit.',
    remove:
      'An intact stack of bricks is loosened and lifted from masonry: coarse mineral rubbing and staggered small clay clicks as the load shifts.',
    throw:
      'Hands swing and release a small stack of clay bricks: gloves scrape rough faces and adjacent bricks click together briefly. No landing sound.',
    impact:
      'Several intact clay bricks land on concrete: staggered sharp mineral clacks with a heavy first hit, smaller bounces and gritty short sliding tails. No glassy ringing.',
  },
  bone: {
    grab: 'A small dry bone is pinched and lifted: faint glove rub on its rough surface and one tiny scrape as it leaves the ground. Very quiet handling.',
    place:
      'A dry bone is laid gently on wood: a light hollow hard clack and a short textured scrape as it settles.',
    drop: 'A dry bone is put down on concrete: a small hard click, a second lighter contact and a brief rough scrape.',
    remove:
      'A dry bone is nudged and lifted from the floor: one short rough surface scrape and soft glove friction, then silence.',
    throw:
      'A hand grips and releases a small dry bone: faint textured glove rubbing and sleeve movement. No exaggerated air sound or landing.',
    impact:
      'A small dry bone bounces on concrete: three diminishing light hollow clacks followed by a tiny gritty roll. No snapping or flesh sounds.',
  },
};
