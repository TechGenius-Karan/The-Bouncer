/**
 * The semantic categories a word can be tagged with, and the definitions the
 * AI tagger is given for each.
 *
 * The definitions are not decoration — they are the tagger's whole spec, and
 * the failure mode they exist to prevent is over-tagging. Each one states what
 * counts and, where a category has a known trap, what doesn't. The discipline
 * throughout is **dominant sense only**: a word is tagged for the meaning a
 * player would reach for first, never for a technically-correct secondary
 * sense. That rule is what earlier hand-review used to reject `screwdriver`
 * as a drink, `temple` as a body part, and `coffee` as a fruit.
 *
 * Categories only become rules if they clear the coverage floor in
 * buildRuleParams — listing a speculative one here is free.
 */
export interface CategoryDefinition {
  /** Tag suffix — the full tag is `category:${id}`. */
  id: string
  /** How the rule reads to a player: "The word names ___". */
  label: string
  /** Given verbatim to the tagger. */
  definition: string
  /**
   * How hard the shared theme is to spot, driving tier eligibility exactly as
   * for lexical rules. Spread deliberately rather than uniform: with ~30
   * category rules all rated the same, one tier would fill up with them.
   * 2 = instantly recognisable, 4 = takes a beat to see the connection.
   */
  subtlety: 2 | 3 | 4
}

export const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  // --- living things ---
  { id: 'animal', label: 'an animal', definition: 'A creature: mammal, reptile, amphibian, or a general animal word. Includes birds, fish and insects (they are tagged separately too).', subtlety: 2 },
  { id: 'bird', label: 'a bird', definition: 'A bird specifically.', subtlety: 3 },
  { id: 'fish', label: 'a fish', definition: 'A fish specifically. Not shellfish.', subtlety: 3 },
  { id: 'insect', label: 'an insect', definition: 'An insect, spider, or similar small invertebrate.', subtlety: 4 },
  { id: 'plant', label: 'a plant', definition: 'A plant, tree, flower or shrub. Includes trees and flowers (tagged separately too). NOT foods that happen to be plants.', subtlety: 3 },
  { id: 'tree', label: 'a tree', definition: 'A kind of tree specifically (oak, pine, maple).', subtlety: 4 },
  { id: 'flower', label: 'a flower', definition: 'A kind of flower specifically (rose, tulip, daisy).', subtlety: 4 },

  // --- the body ---
  { id: 'body-part', label: 'a body part', definition: 'An external or internal part of a human or animal body. NOT words that merely relate to the body.', subtlety: 2 },

  // --- food and drink ---
  { id: 'food', label: 'a food', definition: 'Something eaten. Includes fruits and vegetables (tagged separately too), dishes, and ingredients. NOT drinks.', subtlety: 2 },
  { id: 'fruit', label: 'a fruit', definition: 'A fruit in the everyday culinary sense (apple, banana). NOT botanical technicalities like tomato, acorn or coffee.', subtlety: 3 },
  { id: 'vegetable', label: 'a vegetable', definition: 'A vegetable in the everyday culinary sense (carrot, potato, onion).', subtlety: 3 },
  { id: 'drink', label: 'a drink', definition: 'A beverage (water, coffee, wine, juice).', subtlety: 2 },

  // --- made things ---
  { id: 'clothing', label: 'a piece of clothing', definition: 'A garment worn on the body (shirt, coat, dress). Includes footwear and hats.', subtlety: 2 },
  { id: 'furniture', label: 'a piece of furniture', definition: 'A furnishing (chair, table, bed, desk, sofa).', subtlety: 2 },
  { id: 'tool', label: 'a tool', definition: 'An implement used to do work by hand (hammer, saw, drill). NOT machines or vehicles.', subtlety: 3 },
  { id: 'weapon', label: 'a weapon', definition: 'Something used to cause harm in combat (sword, rifle, bomb).', subtlety: 3 },
  { id: 'vehicle', label: 'a vehicle', definition: 'Something that transports people or goods (car, boat, plane, train).', subtlety: 2 },
  { id: 'container', label: 'a container', definition: 'Something that holds things (box, bag, jar, bottle, basket).', subtlety: 4 },
  { id: 'instrument', label: 'a musical instrument', definition: 'A musical instrument (guitar, piano, drum, violin).', subtlety: 3 },
  { id: 'toy', label: 'a toy or game', definition: 'A plaything or game (doll, kite, chess, puzzle).', subtlety: 3 },
  { id: 'jewelry', label: 'a piece of jewelry', definition: 'An ornament worn on the body (ring, necklace, bracelet, crown).', subtlety: 4 },

  // --- places ---
  { id: 'building', label: 'a building', definition: 'A structure people enter (house, church, hospital, castle). NOT rooms inside one.', subtlety: 2 },
  { id: 'room', label: 'a room', definition: 'A room or interior space (kitchen, bedroom, attic, hallway).', subtlety: 3 },
  { id: 'landform', label: 'a landform', definition: 'A natural feature of land or water (mountain, river, valley, island, desert).', subtlety: 4 },
  { id: 'celestial', label: 'something in space', definition: 'An astronomical object (star, planet, moon, comet, galaxy).', subtlety: 4 },

  // --- people ---
  { id: 'profession', label: 'a profession', definition: 'A job or occupation held by a person (doctor, teacher, farmer, judge).', subtlety: 3 },
  { id: 'relative', label: 'a family member', definition: 'A family relation (mother, uncle, cousin, grandmother).', subtlety: 2 },

  // --- abstract but concrete-feeling ---
  { id: 'emotion', label: 'an emotion', definition: 'A feeling (anger, joy, fear, grief, pride).', subtlety: 3 },
  { id: 'weather', label: 'a weather phenomenon', definition: 'Weather or an atmospheric event (rain, snow, thunder, fog, breeze).', subtlety: 3 },
  { id: 'color', label: 'a color', definition: 'A color (red, blue, crimson, scarlet).', subtlety: 2 },
  { id: 'shape', label: 'a shape', definition: 'A geometric shape (circle, square, triangle, sphere).', subtlety: 4 },
  { id: 'metal', label: 'a metal', definition: 'A metal or alloy (iron, gold, steel, copper).', subtlety: 4 },
  { id: 'sport', label: 'a sport', definition: 'A sport or athletic activity (soccer, boxing, tennis, swimming).', subtlety: 3 },
  // No `crime` category, deliberately. Every member is by definition a harmful
  // act, so unlike `illness` there is no light subset left after blocking the
  // worst words — and "today's rule was: these are all crimes" sits badly
  // against planning.md §5.1's locked light/chill/friendly mood.
  { id: 'illness', label: 'an illness', definition: 'An everyday ailment or minor medical condition (cold, flu, rash, headache, sprain). NOT terminal or serious diseases.', subtlety: 4 },
  { id: 'time-period', label: 'a period of time', definition: 'A span or unit of time (hour, week, decade, century, season).', subtlety: 4 },
]

export const CATEGORY_IDS: readonly string[] = CATEGORY_DEFINITIONS.map((c) => c.id)

/** Full tag string for a category id. */
export function categoryTag(id: string): string {
  return `category:${id}`
}

/**
 * Parent categories implied by a tag, applied in wordBank.ts after the
 * seed/override/AI tag merge — so a word tagged `category:bird` automatically
 * carries `category:animal` too.
 *
 * Why this exists: the original tags were reviewed one category at a time,
 * independently, so `category:bird` ended up NOT being a subset of
 * `category:animal` — of 22 birds only `parrot` was also tagged animal. That
 * makes "Is an Animal" puzzles actively wrong: a player shown an eagle and
 * told it's OUT of "names an animal" has been misinformed, not misdirected.
 *
 * Keeping it as data rather than hand-editing the tag files means the
 * invariant is enforced once and survives any re-tagging.
 */
export const CATEGORY_PARENTS: Record<string, string[]> = {
  'category:bird': ['category:animal'],
  'category:fish': ['category:animal'],
  'category:insect': ['category:animal'],
  'category:tree': ['category:plant'],
  'category:flower': ['category:plant'],
  'category:fruit': ['category:food'],
  'category:vegetable': ['category:food'],
}

/** Expands a tag list to include every implied parent category, transitively. */
export function withParentCategories(tags: string[]): string[] {
  const out = new Set(tags)
  const queue = [...tags]
  while (queue.length > 0) {
    for (const parent of CATEGORY_PARENTS[queue.pop()!] ?? []) {
      if (!out.has(parent)) {
        out.add(parent)
        queue.push(parent)
      }
    }
  }
  return [...out]
}
