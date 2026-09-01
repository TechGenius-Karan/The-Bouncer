/**
 * Words present in the corpus bank that shouldn't appear in a puzzle.
 *
 * These pass every mechanical filter — alphabetic, not stopwords, not
 * profane, and WordNet does have an entry — but they read as noise rather
 * than words to a player: abbreviations, onomatopoeia, transcription
 * artifacts, and letter-repetitions that only technically qualify.
 *
 * They matter disproportionately because they're short and moderately
 * frequent, so they beat better words to the clue slots. A real generated
 * palindrome puzzle read "pop, mum, non" — one non-word out of three clues,
 * on a rule whose whole appeal is recognising a real palindrome.
 *
 * Blocking rather than regenerating the bank: `Word.safety.blocked` already
 * exists and is already respected by draftClueSet and trapSelection, it just
 * had nothing setting it. Rebuilding bulkSeedWords.ts takes ~20 minutes of
 * WordNet lookups and would lose this judgment on the next regeneration.
 */
export const BLOCKED_WORDS = new Set([
  // Not words on their own — transcription/abbreviation artifacts
  'non',
  'ana',
  'ese',
  'tnt',
  'mem',
  'dod',
  'nan',
  'mam',
  'pap',
  'tat',
  'tut',
  'mrs',
  'mmm',
  'ahh',
  'ooh',
  'shh',
  'hah',
  'heh',
  'huh',
  'hmm',
  'yay',
  'yah',
  'nah',
  'yep',
  'yup',
  'nope',
  'whoa',
  'oops',
  'wham',
  'argh',
  'ugh',
  'eh',
])
