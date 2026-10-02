export type ItemGroup = 'thing' | 'food' | 'vehicle' | 'animal' | 'plant'

export type IconSource =
  { set: 'openmoji'; hex: string } | { set: 'noun'; creator: string; url: string }

export interface Item {
  /**
   * Permanent. It is the icon's filename, and from Phase 2 the key every tag
   * and every stored puzzle refers to — renaming one orphans both.
   */
  id: string
  /** The caption players read (planning-visual-pivot.md D2). Lowercase; the UI owns capitalisation. */
  name: string
  group: ItemGroup
  icon: IconSource
  blocked?: boolean
}

/** A matrix cell as the generator reads it. `unsure` and untagged are both null. */
export type Tri = boolean | null

export const FAMILIES = [
  'has-part',
  'made-of',
  'where-found',
  'what-it-does',
  'physical',
  'how-used',
  'size-weight',
  'senses',
  'living',
  'shape',
  'context',
] as const

export type Family = (typeof FAMILIES)[number]

export interface VisualRule {
  /**
   * Permanent. Uniqueness (D6) is checked by id, so a renamed rule could run its
   * idea twice. The `visual-` prefix keeps it clear of word rule ids in the
   * shared `rules` collection. Retire a rule; never rename or delete it.
   */
  id: string
  family: Family
  /** The reveal sentence (planning.md §3.5), about the IN items: "It has a handle." */
  reveal: string
  /** Extra tagging guidance for this rule, added to its family's FAMILY_BASIS. */
  basis?: string
  /** Out of generation for good, but its id stays reserved and it is still a rival. */
  retired?: boolean
}
