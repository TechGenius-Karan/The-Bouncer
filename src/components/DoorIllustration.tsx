// The home screen's two door illustrations — a storybook brown door ajar
// (the word walked in) and the same door shut (the word got turned away).
// Pixel values below are a deliberate 1:1 port of the "4a · HOME — BROWN
// DOORS" artboard in the Claude Design project (The Bouncer.dc.html), not
// arbitrary — keep them in sync with that artboard rather than "cleaning
// them up" into round numbers. Door face/panel/knob colors are the
// artboard's own "DOOR RECIPE" swatch (door-face/door-panel/door-knob
// tokens); the outline is the app's existing ink color (#241F19), which
// the artboard's outline swatch already matches exactly.

interface Props {
  word: string
}

export function DoorIn({ word }: Props) {
  return (
    <div className="relative mx-auto h-[231px] w-[150px]">
      {/* w-[115px], not the artboard's literal 101px: the floor strip below
          (left-27/right‑6) overhangs the door face unevenly at 101px wide —
          widening only the right edge narrows that gap. */}
      <div className="absolute bottom-[16px] left-[33px] top-[6px] w-[115px] rounded-t-[3px] border-[6px] border-b-0 border-door-face bg-door-open-bg shadow-[0_0_0_3px_rgb(var(--color-ink)),inset_0_0_0_2.5px_rgb(var(--color-ink))]">
        <div className="absolute left-1/2 top-[18px] flex h-[32px] w-[32px] -translate-x-1/2 items-center justify-center rounded-full border-[3px] border-ink bg-bin-in">
          <div className="h-[10px] w-[10px] rounded-full bg-slip" />
        </div>
      </div>
      <div className="absolute bottom-[7px] left-[27px] right-[-6px] h-[11px] rounded-[3px] bg-ink" />
      <div className="absolute left-[-30px] top-[9px] h-[206px] w-[70px] origin-right rounded-[2px] border-[3px] border-ink bg-door-face [transform:perspective(520px)_rotateY(50deg)]">
        <div className="absolute inset-x-[5px] inset-y-[7px] rounded-[2px] border-[2.5px] border-ink bg-door-panel" />
        <div className="absolute left-[2px] top-[98px] h-[14px] w-[15px] rounded-full border-[2.5px] border-ink bg-door-knob" />
      </div>
      <div className="absolute bottom-[7px] left-[22px] h-[8px] w-[13px] rounded-[3px] bg-ink" />
      <div className="absolute left-[2px] top-[104px] flex h-[44px] -rotate-[8deg] items-center justify-center rounded-[13px] border-[2.5px] border-ink bg-slip px-3 font-display text-[20px] font-bold tracking-[0.03em] shadow-[0_6px_0_-2px_rgb(var(--color-ink))]">
        {word}
      </div>
    </div>
  )
}

export function DoorOut({ word }: Props) {
  return (
    <div className="relative mx-auto h-[230px] w-[139px]">
      <div className="absolute bottom-[16px] left-[4px] right-[3px] top-[6px] rounded-t-[3px] border-[6px] border-b-0 border-door-face bg-door-face shadow-[0_0_0_3px_rgb(var(--color-ink)),inset_0_0_0_2.5px_rgb(var(--color-ink))]">
        <div className="absolute left-[7px] right-[7px] top-[7px] h-[88px] rounded-[2px] border-[2.5px] border-ink bg-door-panel">
          <div className="absolute left-1/2 top-[6px] flex h-[34px] w-[34px] -translate-x-1/2 items-center justify-center rounded-full border-[3px] border-ink bg-bin-out text-[14px] text-slip">
            ▲
          </div>
        </div>
        <div className="absolute left-[7px] right-[7px] top-[103px] h-[88px] rounded-[2px] border-[2.5px] border-ink bg-door-panel" />
        <div className="absolute right-[5px] top-[92px] h-[15px] w-[14px] rounded-full border-[2.5px] border-ink bg-door-knob" />
      </div>
      <div className="absolute bottom-[7px] left-[-3px] right-[-4px] h-[10px] rounded-[3px] bg-ink" />
      <div className="absolute left-[24px] top-[86px] h-[3.5px] w-[24px] -rotate-[32deg] rounded-[2px] bg-bin-out" />
      <div className="absolute left-[37px] top-[99px] h-[3.5px] w-[15px] -rotate-[28deg] rounded-[2px] bg-door-mark-3" />
      <div className="absolute left-[-4px] top-[112px] flex h-[44px] rotate-[14deg] items-center justify-center rounded-[13px] border-[2.5px] border-ink bg-bin-out-tint px-3 font-display text-[20px] font-bold tracking-[0.03em] text-door-warn-text shadow-[0_6px_0_-2px_rgb(var(--color-ink))]">
        {word}
      </div>
    </div>
  )
}
