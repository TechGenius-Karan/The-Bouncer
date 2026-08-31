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

/** Every hidden-word target, in one list — this is what features.ts precomputes hits against. */
export const HIDDEN_WORD_TARGETS = [
  ...HIDDEN_NUMBERS,
  ...HIDDEN_BODY_PARTS,
  ...HIDDEN_ANIMALS,
  ...HIDDEN_COLORS,
] as const

/** The named groups, for the "hides a <group>" rules. */
export const HIDDEN_WORD_GROUPS = {
  number: HIDDEN_NUMBERS,
  'body part': HIDDEN_BODY_PARTS,
  animal: HIDDEN_ANIMALS,
  color: HIDDEN_COLORS,
} as const satisfies Record<string, readonly string[]>

/** Rule #10 (subsequence): fixed in-order-letter targets — no external dictionary needed. */
export const SUBSEQUENCE_TARGETS = ['ace'] as const
