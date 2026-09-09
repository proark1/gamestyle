export const firstPersonMaterial: Record<
  string,
  { sound: string; duration: number }
> = {
  'brick.grab': {
    sound:
      'Gloved fingertips draw one rough fired-clay brick from a stack: gritty clay faces rasp together, a neighboring brick ticks, then the glove rubs the brick as it lifts clear.',
    duration: 1.5,
  },
  'brick.place': {
    sound:
      'One fired-clay brick is lowered onto dry concrete or masonry: its edge makes a compact mineral clack, then a short gritty scrape aligns it. Dry solid contact; no wet squelch.',
    duration: 1.2,
  },
  'brick.remove': {
    sound:
      'A brick is gently rocked free from a masonry course and lifted intact: tight grainy friction, two small clay contact ticks, a few mortar grains falling. No hammering or demolition.',
    duration: 1.5,
  },
  'beam.grab': {
    sound:
      'Two gloved hands lift a sawn timber post from a stack: rough grain rub, a short wooden edge scrape and one low timber knock as it clears the next beam.',
    duration: 1.5,
  },
  'beam.place': {
    sound:
      'The end of a solid sawn timber post is seated on its construction support: a deep compact wood knock followed by a very short grainy adjustment scrape.',
    duration: 1.2,
  },
  'beam.remove': {
    sound:
      'A timber post is rocked free and lifted off its support: loaded wood creak, dry end-grain friction and one soft edge knock at release. No splintering.',
    duration: 1.5,
  },
  'roof.grab': {
    sound:
      'Gloves lift one thin ribbed metal roofing sheet from a stack: quiet skin-on-metal rubbing, a short sheet edge scrape and a restrained hollow flex rattle.',
    duration: 1.5,
  },
  'roof.place': {
    sound:
      'A ribbed metal roof sheet slides a little on timber supports and settles: dry metal-on-wood scrape, two light hollow panel taps and a brief thin-sheet vibration.',
    duration: 1.5,
  },
  'roof.remove': {
    sound:
      'A ribbed metal roof sheet lifts off wooden supports: its lower edge scrapes briefly, then the thin sheet flexes with a subdued hollow metallic pop. No tearing.',
    duration: 1.5,
  },
  'cement.grab': {
    sound:
      'Two work-gloved hands squeeze and lift a full heavy kraft-paper sack of dry cement from a wooden pallet: coarse layered paper crumples under the grip, fine powder shifts inside with a muffled soft shush, and the sack bottom drags briefly across rough wood. The bag stays closed; no pouring, liquid, gravel or mixer motor.',
    duration: 2.5,
  },
  'cement.drop': {
    sound:
      'A full kraft-paper cement sack is lowered back onto a timber pallet: a heavy soft powder-damped thump, coarse paper buckling, then a brief bag-on-wood scrape as hands release. Closed dry sack, no water, stones or metal clang.',
    duration: 2,
  },
  'cement.pour': {
    sound:
      'An open kraft-paper sack tips dry fine cement powder into a stationary steel mixer drum: paper crackles at the folded mouth, then a dense soft sandy hiss as powder flows down the curved metal, a couple of small powder clumps make dull taps, and the stream thins to a faint dusty trickle. Motor off. Dry powder, not gravel or wet concrete; no splashing or loud roaring.',
    duration: 4,
  },
  'sand.grab': {
    sound:
      'A worker lifts a plastic bucket full of dry building sand by its metal bail handle: the handle clicks upright, the plastic rim creaks slightly, and dense fine grains shift with a short gritty shush. No shovel strike, water or pouring.',
    duration: 2,
  },
  'sand.drop': {
    sound:
      'A plastic bucket full of dry sand is set back on compacted ground: a heavy sand-damped plastic thud, a little grain movement, then the metal bail handle ticks down against the rim. No liquid slosh.',
    duration: 2,
  },
  'sand.pour': {
    sound:
      'A plastic bucket tips dry building sand into a stationary steel mixer: handle ticks as the bucket rotates, a sustained coarse granular rush rattles against the curved drum with fine grains pattering, then thins to a scattered trickle. Drier and grainier than cement powder, no water slosh or motor.',
    duration: 3.5,
  },
  'water.grab': {
    sound:
      'A worker lifts a half-full plastic water bucket by its metal bail: handle clicks taut, plastic creaks and clean water makes one low rounded slosh against the inside wall with a few light droplets. No pouring stream.',
    duration: 2,
  },
  'water.drop': {
    sound:
      'A half-full plastic water bucket is lowered onto the ground: muted plastic base thud, water surges against its inner wall and settles in two diminishing sloshes, then the handle taps the rim.',
    duration: 2.5,
  },
  'water.pour': {
    sound:
      'A plastic bucket pours clean water into a stationary steel cement mixer drum: a short rim drip grows into a continuous hollow splashing stream, liquid gurgles at the bucket lip, splashes resonate softly inside steel, then a few separate final drops. Motor off; no powder hiss or gravel impacts.',
    duration: 3.5,
  },
  'mortar.grab': {
    sound:
      'Thick fresh sand-and-cement mortar is transferred from a steel mixer mouth into a plastic bucket: slow heavy cohesive blobs fall with damp gritty plops, a short metal lip scrape, then sticky strands release. Dense paste, not freely splashing water; motor off.',
    duration: 2.5,
  },
  'mortar.place': {
    sound:
      'A steel bricklaying trowel deposits and draws a small bed of wet sandy mortar across rough brick: one thick sticky plop, close abrasive sand-grain rasp under the steel blade, then a short tacky peel as the trowel lifts. One compact laying stroke, not liquid pouring.',
    duration: 1.5,
  },
  'brick.wet': {
    sound:
      'One rough clay brick is pressed into a fresh mortar bed and nudged level: a soft dense contact followed by gritty wet compression, mortar squeezing at the edges and a tiny final clay adjustment tap. No dry hard landing or watery splash.',
    duration: 1.5,
  },
};
