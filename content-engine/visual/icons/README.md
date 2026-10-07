# Visual icons — provenance and licences

- `openmoji/<HEX>.svg` — unmodified files from OpenMoji 17.0.0's black line set
  (https://openmoji.org), fetched by `npm run visual:fetch-icons` from
  `https://cdn.jsdelivr.net/npm/openmoji@17.0.0/black/svg/`. Licence: CC BY-SA 4.0.
  Required credit: "All emojis designed by OpenMoji – the open-source emoji and
  icon project. License: CC BY-SA 4.0".
- `noun/<id>.svg` — Noun Project icons, CC BY 3.0. Each one's creator and page are
  recorded on its item in `../items.ts` and shown on the in-game credits screen.
- `public/icons/visual/<id>.svg` — produced from the files above by
  `npm run visual:icons` (recoloured, stroke-scaled, optimized). As adaptations,
  the OpenMoji-derived files are CC BY-SA 4.0 too. This covers the icon files
  only, not the game's code.

Never hand-edit an output file: `iconFiles.test.ts` fails if one stops matching
what the normalizer produces from its raw file.
