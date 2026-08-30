// natural's stopwords list isn't part of its public export map / type
// declarations (see expandWordBank.ts's import comment) — this just types
// the one submodule path we import directly.
declare module 'natural/lib/natural/util/stopwords.js' {
  export const words: string[]
}
