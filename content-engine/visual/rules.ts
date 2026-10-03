import type { Family, VisualRule } from './types.js'

// The visual rule taxonomy (planning-visual-pivot.md §4.1): one plain property
// per rule, in families. A rule runs once ever (D6), and that is checked by id,
// so ids are permanent: never rename or delete a rule — set `retired: true`.

/** How the tagger judges every rule in a family (§4.1). A rule's `basis` adds to this. */
export const FAMILY_BASIS: Record<Family, string> = {
  'has-part':
    'Judge a typical, intact, everyday example of the thing, as normally sold, found or used.',
  'made-of':
    'Judge a typical, everyday example of the thing. Answer yes only if that material is clearly most of it.',
  'where-found':
    'Answer yes only if the thing is commonly found there in everyday life, not merely possible there.',
  'what-it-does': 'Judge what the thing is mainly used for, or what it naturally does.',
  physical:
    'Judge a typical, intact, everyday example of the thing, in its normal state and at its normal size.',
  'how-used': 'Judge how a typical example of the thing is normally used in everyday life.',
  'size-weight':
    'Judge a typical, full-sized, real-world example of the thing, not a toy or model.',
  senses: 'Judge a typical example of the thing, as a person would normally experience it.',
  living: 'Judge what the thing is, in plain everyday terms rather than technical ones.',
  shape:
    'Judge the thing as it is usually drawn in a simple emoji-style icon, seen from the usual angle.',
  context: 'Answer yes only if the thing is commonly associated with that setting or occasion.',
}

export const VISUAL_RULES: VisualRule[] = [
  // has-part
  { id: 'visual-has-a-handle', family: 'has-part', reveal: 'It has a handle.' },
  { id: 'visual-has-legs', family: 'has-part', reveal: 'It has legs.' },
  { id: 'visual-has-a-tail', family: 'has-part', reveal: 'It has a tail.' },
  { id: 'visual-has-wheels', family: 'has-part', reveal: 'It has wheels.' },
  { id: 'visual-has-a-lid', family: 'has-part', reveal: 'It has a lid.' },

  // made-of
  { id: 'visual-made-of-metal', family: 'made-of', reveal: 'It is made mostly of metal.' },
  { id: 'visual-made-of-wood', family: 'made-of', reveal: 'It is made mostly of wood.' },
  { id: 'visual-made-of-fabric', family: 'made-of', reveal: 'It is made mostly of fabric.' },
  { id: 'visual-made-of-plastic', family: 'made-of', reveal: 'It is made mostly of plastic.' },

  // where-found
  { id: 'visual-found-in-a-kitchen', family: 'where-found', reveal: 'It belongs in a kitchen.' },
  {
    id: 'visual-found-in-a-bathroom',
    family: 'where-found',
    reveal: 'It belongs in a bathroom.',
  },
  { id: 'visual-found-on-a-farm', family: 'where-found', reveal: 'You would find it on a farm.' },
  {
    id: 'visual-found-in-the-sea',
    family: 'where-found',
    reveal: 'You would find it in or on the sea.',
  },
  {
    id: 'visual-found-in-a-classroom',
    family: 'where-found',
    reveal: 'You would find it in a classroom.',
  },
  {
    id: 'visual-found-in-a-garden',
    family: 'where-found',
    reveal: 'You would find it in a garden.',
  },
  {
    id: 'visual-found-outdoors',
    family: 'where-found',
    reveal: 'You would usually find it outdoors.',
  },
  {
    id: 'visual-found-in-most-homes',
    family: 'where-found',
    reveal: 'You would find it in most homes.',
  },

  // what-it-does
  { id: 'visual-gives-light', family: 'what-it-does', reveal: 'It gives off light.' },
  { id: 'visual-cuts', family: 'what-it-does', reveal: 'It is used to cut things.' },
  { id: 'visual-makes-music', family: 'what-it-does', reveal: 'It is used to make music.' },
  { id: 'visual-holds-liquid', family: 'what-it-does', reveal: 'It is made to hold a liquid.' },
  {
    id: 'visual-builds-or-fixes',
    family: 'what-it-does',
    reveal: 'It is a tool for building or fixing things.',
  },
  { id: 'visual-is-a-tool', family: 'what-it-does', reveal: 'It is a tool.' },
  { id: 'visual-played-with', family: 'what-it-does', reveal: 'People play with it.' },

  // physical
  { id: 'visual-floats', family: 'physical', reveal: 'It floats in water.' },
  {
    id: 'visual-breaks-if-dropped',
    family: 'physical',
    reveal: 'It would break if dropped on a hard floor.',
  },
  {
    id: 'visual-conducts-electricity',
    family: 'physical',
    reveal: 'Electricity can flow through it.',
    basis: 'Living things count as no.',
    // Retired 2026-10-03: on the pilot bank it matched made-of-metal and
    // sticks-to-a-magnet exactly (planning-visual-pivot.md §7, correlated physics).
    retired: true,
  },
  { id: 'visual-sticks-to-a-magnet', family: 'physical', reveal: 'A magnet would stick to it.' },
  { id: 'visual-melts-on-a-hot-day', family: 'physical', reveal: 'It would melt on a hot day.' },
  { id: 'visual-burns-easily', family: 'physical', reveal: 'It catches fire easily.' },

  // how-used
  {
    id: 'visual-needs-power',
    family: 'how-used',
    reveal: 'It needs electricity or a battery to work.',
  },
  { id: 'visual-worn', family: 'how-used', reveal: 'You wear it.' },
  { id: 'visual-ridden', family: 'how-used', reveal: 'People ride on it or in it.' },
  {
    id: 'visual-used-in-one-hand',
    family: 'how-used',
    reveal: 'You use it holding it in one hand.',
    basis: 'Living things and food count as no.',
  },
  { id: 'visual-used-with-water', family: 'how-used', reveal: 'You use it with water.' },
  { id: 'visual-used-every-day', family: 'how-used', reveal: 'Most people use it every day.' },
  {
    id: 'visual-needs-two-hands',
    family: 'how-used',
    reveal: 'You need two hands to use it.',
    basis: 'Living things and food count as no.',
  },

  // size-weight
  { id: 'visual-fits-in-a-pocket', family: 'size-weight', reveal: 'It fits in a pocket.' },
  {
    id: 'visual-heavier-than-a-person',
    family: 'size-weight',
    reveal: 'It is heavier than an adult person.',
  },
  { id: 'visual-bigger-than-a-car', family: 'size-weight', reveal: 'It is bigger than a car.' },
  {
    id: 'visual-lift-with-one-hand',
    family: 'size-weight',
    reveal: 'You could lift it with one hand.',
    // Retired 2026-10-03: the inverse of heavier-than-a-person (0.96).
    retired: true,
  },

  // senses
  { id: 'visual-shiny', family: 'senses', reveal: 'It is shiny.' },
  { id: 'visual-soft', family: 'senses', reveal: 'It is soft to the touch.' },
  { id: 'visual-smells-strong', family: 'senses', reveal: 'It has a strong smell.' },
  { id: 'visual-loud', family: 'senses', reveal: 'It can make a loud noise.' },
  { id: 'visual-hard', family: 'senses', reveal: 'It is hard to the touch.' },
  {
    id: 'visual-sweet',
    family: 'senses',
    reveal: 'It tastes sweet.',
    basis: 'Only things people eat can count as yes.',
  },

  // living
  { id: 'visual-alive', family: 'living', reveal: 'It is alive.' },
  { id: 'visual-is-an-animal', family: 'living', reveal: 'It is an animal.' },
  { id: 'visual-is-food', family: 'living', reveal: 'It is food.' },
  { id: 'visual-is-a-vehicle', family: 'living', reveal: 'It is a vehicle.' },
  { id: 'visual-is-a-plant', family: 'living', reveal: 'It is a plant.' },
  { id: 'visual-grows-on-a-plant', family: 'living', reveal: 'It grows on a plant.' },
  { id: 'visual-from-an-animal', family: 'living', reveal: 'It comes from an animal.' },
  { id: 'visual-has-feathers', family: 'living', reveal: 'It has feathers.' },
  { id: 'visual-made-by-people', family: 'living', reveal: 'It is made by people.' },
  {
    id: 'visual-moves-by-itself',
    family: 'living',
    reveal: 'It can move on its own.',
    basis: 'Vehicles need someone to drive them, so they count as no.',
    // Retired 2026-10-03: identical to is-an-animal, since only animals move on their own.
    retired: true,
  },

  // shape: judged on the icon as drawn (§4.1)
  { id: 'visual-round', family: 'shape', reveal: 'It is round.' },
  { id: 'visual-long-and-thin', family: 'shape', reveal: 'It is long and thin.' },
  { id: 'visual-has-a-hole', family: 'shape', reveal: 'It has a hole you could see through.' },
  { id: 'visual-has-a-sharp-point', family: 'shape', reveal: 'It has a sharp point.' },
  { id: 'visual-has-straight-edges', family: 'shape', reveal: 'It has straight edges.' },

  // context
  { id: 'visual-used-in-sport', family: 'context', reveal: 'It is used in a sport.' },
  { id: 'visual-at-a-party', family: 'context', reveal: 'You might see it at a party.' },
  { id: 'visual-winter', family: 'context', reveal: 'It is mostly used or seen in winter.' },
  { id: 'visual-at-the-beach', family: 'context', reveal: 'You might see it at the beach.' },
]
