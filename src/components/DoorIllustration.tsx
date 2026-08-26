// The home screen's two "evidence" illustrations — a door left ajar (the
// word walked in) and a framed notice board (the word got turned away).
// Pixel values below are a deliberate 1:1 port of the "2a · HOME — TWO
// DOORS" artboard in the Claude Design project (The Bouncer.dc.html), not
// arbitrary — keep them in sync with that artboard rather than "cleaning
// them up" into round numbers.

interface Props {
  word: string
}

export function DoorIn({ word }: Props) {
  return (
    <div className="relative h-[196px] w-full">
      <div className="absolute bottom-[22px] left-[26px] right-0 top-0 overflow-hidden rounded-t-[10px] border-[3px] border-b-0 border-ink bg-door-in-frame">
        <div className="absolute inset-x-0 bottom-0 h-[34px] bg-door-in-threshold" />
        <div className="absolute left-1/2 top-[16px] flex h-[34px] w-[34px] -translate-x-1/2 items-center justify-center rounded-full bg-bin-in text-[15px] text-white">
          ●
        </div>
      </div>
      <div className="absolute bottom-0 left-[22px] right-0 h-[22px] border-t-[3px] border-ink bg-skip-bg" />
      <div className="absolute left-0 top-[6px] h-[162px] w-[40px] origin-right rounded-[4px] border-[3px] border-ink bg-slip shadow-[-4px_4px_0_-1px_rgb(var(--color-line))] [transform:perspective(420px)_rotateY(52deg)]">
        <div className="absolute left-[6px] top-[60px] h-[7px] w-[7px] rounded-full bg-ink" />
      </div>
      <div className="absolute left-[8px] top-[104px] h-[3px] w-[22px] rounded-[2px] bg-door-mark-1" />
      <div className="absolute left-[14px] top-[114px] h-[3px] w-[14px] rounded-[2px] bg-door-mark-2" />
      <div className="absolute left-[16px] top-[78px] flex h-[48px] -rotate-[7deg] items-center justify-center rounded-[14px] border-[2.5px] border-ink bg-slip px-3 font-display text-[22px] font-bold tracking-[0.03em] shadow-[0_7px_0_-2px_rgb(var(--color-ink))]">
        {word}
      </div>
    </div>
  )
}

export function DoorOut({ word }: Props) {
  return (
    <div className="relative h-[196px] w-full">
      <div className="absolute bottom-[22px] left-[8px] right-[8px] top-0 rounded-t-[10px] border-[3px] border-b-0 border-ink bg-slip">
        <div className="absolute left-[14px] right-[14px] top-[16px] h-[52px] rounded-[6px] border-2 border-line" />
        <div className="absolute bottom-[16px] left-[14px] right-[14px] top-[80px] rounded-[6px] border-2 border-line" />
        <div className="absolute right-[16px] top-[82px] h-[11px] w-[11px] rounded-full border-2 border-ink bg-bin-out" />
        <div className="absolute left-1/2 top-[26px] flex h-[34px] w-[34px] -translate-x-1/2 items-center justify-center rounded-full bg-bin-out text-[13px] text-white">
          ▲
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[22px] border-t-[3px] border-ink bg-skip-bg" />
      <div className="absolute left-[48px] top-[74px] h-[3px] w-[26px] -rotate-[32deg] rounded-[2px] bg-bin-out" />
      <div className="absolute left-[62px] top-[88px] h-[3px] w-[16px] -rotate-[28deg] rounded-[2px] bg-door-mark-3" />
      <div className="absolute left-[2px] top-[96px] flex h-[48px] rotate-[13deg] items-center justify-center rounded-[14px] border-[2.5px] border-door-warn bg-bin-out-tint px-3 font-display text-[22px] font-bold tracking-[0.03em] text-door-warn-text shadow-[0_7px_0_-2px_rgb(var(--color-door-warn))]">
        {word}
      </div>
    </div>
  )
}
