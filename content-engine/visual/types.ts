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
