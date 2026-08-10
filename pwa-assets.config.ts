import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

// The preset's default padding fill for maskable/apple-touch icons is opaque
// white — for a dark-background icon like ours, that leaves a visible white
// margin (a real bug on Android specifically, where the OS crops maskable
// icons to its own mask shape and reveals whatever's behind the icon content
// unless the full canvas is filled with the icon's own background color).
// Override both to the icon's actual background (tailwind.config.ts `ink`).
export default defineConfig({
  preset: {
    ...preset,
    maskable: {
      ...preset.maskable,
      resizeOptions: { fit: 'contain', background: '#241F19' },
    },
    apple: {
      ...preset.apple,
      resizeOptions: { fit: 'contain', background: '#241F19' },
    },
  },
  images: ['public/favicon.svg'],
})
