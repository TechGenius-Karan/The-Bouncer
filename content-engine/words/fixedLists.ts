export const VOWELS = new Set(['a', 'e', 'i', 'o', 'u'])

// Candidate targets for hidden-word rules — short, concrete nouns that plausibly
// hide inside longer words ("leg" in "legacy", "ear" in "search"). This is the
// *candidate* list, not the shipped rule list: buildRuleParams.ts counts real
// coverage against the word bank and only promotes targets that clear the floor,
// so adding a speculative target here is free and growing the word bank
// automatically unlocks more of them.
//
// Grouped because the groups are themselves the best rules. "The word hides a
// body part" is a far better aha than "the word hides LEG" — the player gets a
// category insight rather than a single lookup — so the generator builds both a
// per-group rule and per-target rules from these lists.

export const HIDDEN_BODY_PARTS = [
  'ear',
  'arm',
  'leg',
  'hip',
  'rib',
  'eye',
  'lip',
  'jaw',
  'gum',
  'toe',
  'shin',
  'chin',
  'back',
  'hand',
  'head',
  'bone',
  'skin',
  'nail',
  'heel',
  'heart',
  'liver',
  'thumb',
] as const

export const HIDDEN_ANIMALS = [
  'cat',
  'dog',
  'rat',
  'ant',
  'bee',
  'owl',
  'cow',
  'pig',
  'fox',
  'hen',
  'ape',
  'bat',
  'ram',
  'elk',
  'eel',
  'crab',
  'bear',
  'lion',
  'wolf',
  'deer',
  'goat',
  'mole',
  'seal',
  'swan',
  'crow',
  'hare',
  'toad',
  'worm',
  'mouse',
  'horse',
] as const

export const HIDDEN_COLORS = [
  'red',
  'tan',
  'jet',
  'ash',
  'rose',
  'gold',
  'navy',
  'teal',
  'plum',
  'olive',
  'coral',
  'amber',
  'green',
  'brown',
  'black',
  'white',
] as const

export const HIDDEN_NUMBERS = ['one', 'two', 'six', 'ten', 'nine', 'four', 'five', 'eight'] as const

// Groups added after the taxonomy audit found the aha-5 tier held just 4 rules
// while the aha-1 filler tier held 87. Every list below was coverage-checked
// against the real bank before being added, and two candidate groups were
// dropped on inspection rather than on coverage:
//
//   metal  264 words, but 245 of them from "tin" alone (continent, printing) —
//          a single weak target wearing a group costume.
//   name   369 words, but "hides a name" reveals as arbitrary rather than as
//          an insight, and it collides with the proper-noun handling.
//
// "bra" is likewise absent from clothing: 54 hits, nearly all of them library/
// celebrate/brain, where nobody reads it as a garment.
//
// Two more groups cleared coverage and were still cut, after reading their
// actual matches — the floor counts words, it cannot tell a good find from a
// bad one:
//
//   tool        chainsaw and screwdriver "hide a tool" by being one; fingernail
//               and toenail match the body-part sense of nail; and the largest
//               variant was "hoe" inside shoe/shoes/horseshoe.
//   instrument  9 of its 34 words were organization/organic/organism — "organ"
//               in the wrong sense entirely. Remove those and it drops under
//               the floor, so there was no version of it worth shipping.
export const HIDDEN_FOODS = [
  'pea', 'oat', 'egg', 'ham', 'jam', 'pie', 'nut', 'rice', 'bean', 'corn',
  'cake', 'soup', 'salt', 'bread', 'honey', 'lemon', 'onion', 'grape', 'melon',
] as const

export const HIDDEN_DRINKS = [
  'tea', 'ale', 'cola', 'wine', 'beer', 'milk', 'juice', 'cider', 'water', 'cocoa',
] as const

export const HIDDEN_CLOTHING = [
  'cap', 'hat', 'tie', 'vest', 'coat', 'sock', 'shoe', 'robe', 'gown', 'belt',
  'scarf', 'shirt', 'skirt', 'glove', 'dress',
] as const

export const HIDDEN_WEATHER = [
  'ice', 'sun', 'fog', 'rain', 'snow', 'wind', 'hail', 'mist', 'storm', 'cloud', 'frost',
] as const

export const HIDDEN_FURNITURE = [
  'bed', 'cot', 'rug', 'lamp', 'desk', 'sofa', 'shelf', 'stool', 'table', 'chair', 'bench',
] as const

export const HIDDEN_VEHICLES = [
  'car', 'bus', 'van', 'cab', 'ship', 'boat', 'cart', 'tram', 'train', 'truck', 'plane',
] as const

/** Every hidden-word target, in one list — this is what features.ts precomputes hits against. */
export const HIDDEN_WORD_TARGETS = [
  ...HIDDEN_NUMBERS,
  ...HIDDEN_BODY_PARTS,
  ...HIDDEN_ANIMALS,
  ...HIDDEN_COLORS,
  ...HIDDEN_FOODS,
  ...HIDDEN_DRINKS,
  ...HIDDEN_CLOTHING,
  ...HIDDEN_WEATHER,
  ...HIDDEN_FURNITURE,
  ...HIDDEN_VEHICLES,
] as const

/** The named groups, for the "hides a <group>" rules. */
// Keys read straight into the reveal text as "hides the name of <a|an> <key>
// inside it", so they have to be singular nouns that survive that sentence.
export const HIDDEN_WORD_GROUPS = {
  number: HIDDEN_NUMBERS,
  'body part': HIDDEN_BODY_PARTS,
  animal: HIDDEN_ANIMALS,
  color: HIDDEN_COLORS,
  food: HIDDEN_FOODS,
  drink: HIDDEN_DRINKS,
  'piece of clothing': HIDDEN_CLOTHING,
  'kind of weather': HIDDEN_WEATHER,
  'piece of furniture': HIDDEN_FURNITURE,
  vehicle: HIDDEN_VEHICLES,
} as const satisfies Record<string, readonly string[]>

/** Rule #10 (subsequence): fixed in-order-letter targets — no external dictionary needed. */
export const SUBSEQUENCE_TARGETS = ['ace'] as const
