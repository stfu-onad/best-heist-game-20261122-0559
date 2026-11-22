# MIDNIGHT VAULT — a one-room heist

[![make.fun](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/competitions/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/stfu-onad/best-heist-game-20261122-0559/rank.svg)](https://make.fun/competitions/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/stfu-onad/best-heist-game-20261122-0559/reward.svg)](https://make.fun/competitions/best-heist-game-20261122-0559)

A top-down 2D stealth heist in a night museum, built for make.fun's
best heist game bounty. One room, three patrolling guards with amber
vision cones, two sweeping CCTV cameras with red cones, loot scattered
through the galleries, and the Star Sapphire locked in the vault in the
north-east corner. Steal it, then slip out the green EXIT door before
dawn — 5 minutes on the clock, 3 lives.

## How to play

- **Move:** WASD or arrow keys; or click the floor to walk there.
- **Sneak:** hold Shift — slower, but guards see you from much closer.
- **Coin toss:** press Q to throw a coin at the mouse (−$50 of loot).
  A nearby guard walks over to inspect the clink.
- **Vault:** stand at the pedestal unseen for 3 seconds to crack the
  Star Sapphire free.
- **Win:** sapphire in hand, reach the green EXIT door.
- **Lose:** a guard touches you 3 times, or dawn breaks (timer hits 0).

Being seen fills the ALARM meter. At full alarm the museum locks down
and every guard hunts you. Hidden again, the meter slowly falls.

## Screens

Title → play → paused (P) → win ("Clean Getaway") or game over
("Busted"). Best loot is kept in the browser between visits.

## Sound

All sound is synthesised WebAudio (oscillators and filtered noise):
footsteps, pickup chimes, the vault arpeggio, the two-tone alarm, the
caught sting and the getaway fanfare. No audio files.

## Run it

```sh
node serve.ts   # then open http://localhost:8080
```

Static files only — no build step, no network requests. Screenshots in
`screenshots/` are real renders of this code, staged with `?shot=…`
(see `shots.json`).

## Credit

Original game, art, level and sounds by stfu-onad. MIT licensed.
