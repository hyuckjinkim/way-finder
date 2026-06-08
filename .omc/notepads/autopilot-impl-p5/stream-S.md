# P5 Stream S — Voice Guidance (executor learnings)

Commit: `1721f8d` on `feat/p5-allmode-nav`.

## S1 maneuver-priority inversion (load-bearing for U2)
Task phrase said "instruction 원문 우선, enum 폴백" but implemented **ENUM-primary,
instruction-fallback** (route.ts:64-67, :99-104 frozen F1 contract — stated twice).
Reason: `instruction` is a required field, so instruction-primary would make the
mode-vocabulary path dead for every real step → the mandated mode-vocab test
("자동차=차선/회전 vs 도보=보행") becomes uninstantiable. Advisor confirmed.

`navInstructionText(step, mode)`:
- `maneuver && !== 'unknown'` → mode vocab phrase (+ distance prefix unless depart/arrive or <1m)
- else `instruction` → instruction
- else → "경로를 따라 계속 이동합니다"

## VoiceGuide dedup (for U2 wiring)
Interface is `speak(text: string): void` — no stepId. Dedup = suppress when text
equals last spoken; `stop()` resets the dedup latch. So U2 can call
`speak(navInstructionText(...))` every GPS sample; same turn = same string = spoken once.

## Web isolation (U2 responsibility going forward)
`expo-speech` imported top-level ONLY in `voiceGuide.expo.ts`. Verified ABSENT from
`expo export --platform web` bundle (grep dist/ empty). This holds ONLY because nothing
web-reachable imports voiceGuide.expo yet. **When U2 wires it, inject createExpoVoiceGuide
on the mobile path only** (mirror NavScreen's expo-location isolation) or it will leak.

Real audio output = T3 device QA (§9). expo-speech@~56.0.3 added, lockfile frozen.
