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

  // Distressing subject matter — planning.md §7.5's content-safety
  // requirement, which had never actually been implemented (Word.safety was
  // hardcoded false until this file existed). The `bad-words` filter used when
  // building the bank catches profanity, not sexual violence, atrocity or
  // terminal illness, so all of these were sitting in a 15,000-word bank able
  // to surface in ANY puzzle — a "Contains R" puzzle could have shown "rape".
  //
  // The line drawn here is deliberately narrow: words whose primary reference
  // is sexual violence, child abuse, atrocity, suicide, or a terminal or
  // stigmatised disease. Ordinary words about death or conflict ("dead",
  // "kill", "war", "gun") are NOT blocked — they're common English and
  // unremarkable in a word game. This is about what would upset someone
  // opening a light daily puzzle, not squeamishness about vocabulary.
  'rape',
  'raped',
  'rapist',
  'molest',
  'molested',
  'molester',
  'incest',
  'pedophile',
  'sodomy',
  'genocide',
  'holocaust',
  'lynch',
  'lynching',
  'massacre',
  'atrocity',
  'torture',
  'tortured',
  'mutilation',
  'suicide',
  'suicidal',
  'slave',
  'slaves',
  'slavery',
  'overdose',
  'abortion',
  'prostitution',
  'prostitute',
  'brothel',
  'terrorism',
  'terrorist',
  'cancer',
  'leukemia',
  'tumor',
  'tumour',
  'aids',
  'polio',
  'cholera',
  'leprosy',
  'plague',
  'syphilis',
  'herpes',
  'chlamydia',
  'anthrax',
  'smallpox',
  'gangrene',
  'dementia',
  'psychosis',
  'schizophrenia',
  'miscarriage',
  'amputation',
  'chemotherapy',

  // Slurs against groups of people — a gap the earlier content-safety pass left
  // open, because it was scoped to distressing *subject matter* (violence,
  // atrocity, terminal illness) and a slur is neither. Found the way these
  // things are always found: "midget" turned up as an IN answer in a generated
  // "remove the last letter and you get an animal" puzzle (midget -> midge).
  //
  // The line is the same one drawn above — a word whose *primary* modern
  // reference is a slur, not any word that can be used as an insult. So these
  // eight are blocked and the following are deliberately NOT, despite being in
  // the bank: crazy, insane, lame, savage, primitive, dwarf, blind, deaf, mute,
  // dumb, idiot, moron, addict, alcoholic, wheelchair, handicapped, colored,
  // queer. They are ordinary English whose dominant sense is not a slur, and
  // blocking them would be the squeamishness about vocabulary this file warns
  // against at the top. "colored" is also just the past tense of "color", and
  // "invalid" is overwhelmingly the adjective.
  'midget',
  'retarded',
  'cripple',
  'crippled',
  'imbecile',
  'negro',
  'oriental',
  'gypsy',

  // Severe medical conditions. Blocked so the `illness` category can stay —
  // "cold, flu, rash, headache, hiccup" is a perfectly good light puzzle,
  // "coma, stroke, seizure, depression" is not. Without this the category
  // would have had to go entirely; everyday ailments are still ~75 words.
  'coma',
  'stroke',
  'seizure',
  'paralysis',
  'blindness',
  'aneurysm',
  'embolism',
  'meningitis',
  'hepatitis',
  'malaria',
  'rabies',
  'tetanus',
  'trauma',
  'gunshot',
  'epidemic',
  'asphyxiation',
  'delirium',
  'depression',
  'disability',
  'alcoholism',
  'autism',
  'bipolar',
])
