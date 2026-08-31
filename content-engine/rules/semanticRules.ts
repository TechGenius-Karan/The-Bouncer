import type { Rule } from './types'

// Category-membership rules (planning.md §7.1.2) over the human-reviewed
// `category:*` tags from build-plan.md Phase 10.5 §2 Step 4. Subtlety is
// rated within medium's [2,3] window, not spicy's [4,5] — recognizing a
// shared category from 2-3 examples is inherently quick, so a higher rating
// would misrepresent real difficulty rather than just "unlock" the tier.
export const SEMANTIC_RULES: Rule[] = [
  {
    id: 'category-animal',
    name: 'Is an Animal',
    descriptionTemplate: 'The word names an animal.',
    family: 'semantic-knowledge',
    subtlety: 2,
    aha: 4,
    evaluate: (word) => word.tags.includes('category:animal'),
  },
  {
    id: 'category-fruit',
    name: 'Is a Fruit',
    descriptionTemplate: 'The word names a fruit.',
    family: 'semantic-knowledge',
    subtlety: 2,
    aha: 4,
    evaluate: (word) => word.tags.includes('category:fruit'),
  },
  {
    id: 'category-vehicle',
    name: 'Is a Vehicle',
    descriptionTemplate: 'The word names a vehicle.',
    family: 'semantic-knowledge',
    subtlety: 2,
    aha: 4,
    evaluate: (word) => word.tags.includes('category:vehicle'),
  },
  {
    id: 'category-building',
    name: 'Is a Building',
    descriptionTemplate: 'The word names a building.',
    family: 'semantic-knowledge',
    subtlety: 2,
    aha: 4,
    evaluate: (word) => word.tags.includes('category:building'),
  },
  {
    id: 'category-bird',
    name: 'Is a Bird',
    descriptionTemplate: 'The word names a bird.',
    family: 'semantic-knowledge',
    subtlety: 3,
    aha: 4,
    evaluate: (word) => word.tags.includes('category:bird'),
  },
  {
    id: 'category-tool',
    name: 'Is a Tool',
    descriptionTemplate: 'The word names a tool.',
    family: 'semantic-knowledge',
    subtlety: 3,
    aha: 4,
    evaluate: (word) => word.tags.includes('category:tool'),
  },
  {
    id: 'category-body-part',
    name: 'Is a Body Part',
    descriptionTemplate: 'The word names a body part.',
    family: 'semantic-knowledge',
    subtlety: 3,
    aha: 4,
    evaluate: (word) => word.tags.includes('category:body-part'),
  },
]
