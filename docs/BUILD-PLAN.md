# IMI: Hostile Takeover — build plan

A real-time swarm-automation spin-off of Infinite Monkey Industries. Strip a bankrupt company's office to the copper wiring in 15 minutes. Mobile-first, browser-based, pixel art.

## Decisions (locked)

| Area | Decision |
|---|---|
| Platform | Browser, mobile-first portrait (390×844 reference). Desktop is a scaled, letterboxed version of the same layout. PWA-installable. |
| Tech | Vanilla JS (ES modules), Canvas 2D, no framework, no build step. Static files; same approach as the original game. |
| View | Isometric, 2:1 tiles. |
| Art | Pixel art, Endesga-32 palette for world, dark outlines (direction "P1"). |
| UI | Dark-purple HUD panels, Silkscreen font, DOM overlay on top of the canvas (direction "P3"). Spec lives in `design/ui.css` and `design/combo-direction.html`. |
| Sprite LOD | **Zoomed out:** 32×32 monkeys, 40×20 tiles. **Zoomed in:** 64×64 monkeys, 64×32 tiles. Art is swapped, not scaled. |
| Monkey art | Reuse `crew-art.js` (64×64) from the original game, vendored in `design/vendor/`. Roster: `miner` (breacher), `dockworker`/`carpenter`/`grease_mechanic`/`railroad` (hauler), `sailor` (rigger), `reporter` (decoy), `inspector` (enemy). |
| Pixel scale | 1 art pixel = 1 CSS pixel (3 device pixels on typical phones). Canvas is sized to the viewport, never CSS-stretched. |

## Architecture

- **Sim and render are separate.** The sim is pure JS with no DOM or canvas access, runs at a fixed 30 Hz, and is deterministic from a seed. This allows headless tests in Node and a later replay or offline-progress feature.
- **Modules** (`src/`):
  - `sim/`: `grid.js` (tiles, walls, doors, HP), `items.js`, `crew.js` (roles as state machines), `path.js` (A\* + flow-field cache), `chain.js` (chain-gang routes), `swarm.js` (whistle), `inspector.js`, `job.js` (timer, quota, scoring).
  - `render/`: `iso.js` (projection, depth sort), `camera.js` (pan, pinch, zoom LOD), `atlas.js` (sprite sheets per LOD), `layers.js` (cached static layer plus dynamic sprites), `fx.js` (dust, debris, text pops).
  - `ui/`: DOM HUD (chips, whistle, timer, toast, manifest, minimap).
  - `data/`: level JSON, item catalogue, crew stats, prestige tree.
  - `platform/`: input (pointer events), audio, save (localStorage), PWA.
- **Rendering strategy:**
  - Floor and walls render into cached offscreen layers per LOD, with dirty-rect repaint when a wall is destroyed.
  - Sprites and items draw per frame, depth-sorted by `x+y` with a per-object z.
  - Pre-render all monkey poses into an atlas at load (the game's `CrewArt.pose` already caches canvases).
- **Performance budget:** 100 monkeys plus 150 items at 60 fps on a mid-range Android phone. The sim tick must stay under 4 ms.

## Core mechanics (first-pass rules)

- **Manual throw:** Tap a monkey, then tap an item. The monkey picks it up and carries it by the shortest walkable path to the truck. Tapping the truck sets a drop target.
- **Breacher:** Assigned to a wall or door. Hits tick down its HP. When it breaks, the grid updates and every route is recomputed (flow field invalidated).
- **Chain-gang hauler:** Two tapped endpoints, or auto-built from a cleared path. Haulers occupy tiles along the route and hand items along. Throughput is limited by hand-off rate, not distance.
- **Rigger:** Pairs with a window tile and a catch zone. Heavy or high-value items can be pushed out through that window to the net or truck.
- **Decoy:** Intercepts an inspector in range. The inspector stalls for N seconds, and each stall drains the decoy's stamina.
- **Whistle:** Hold on a heavy item. Nearby idle monkeys converge. The item moves once the monkey count reaches `weight`. Extra monkeys speed it up.
- **Job loop:** 15:00 timer; quota in dollars; items have a base value; star thresholds at 100%, 125%, 150%. Inspectors fine the job on a stripped-but-unreachable item.
- **Prestige ("Hostile Takeover"):** Banked cash buys the next, larger building. Unlocks crane helicopter, shredder truck, bionic monkeys.

## Milestones and sub-tasks

Each sub-task is sized for one delegated agent. Tag: `S` = Sonnet 5.5, `O` = Opus 5.5, always at the lowest reasoning level that does the job. `[par]` means it can run in parallel with its siblings.

### M0 · Scaffold (playable blank canvas)
1. `S [par]` Project skeleton: `index.html`, `src/main.js`, static dev server script, manifest and service worker stubs.
2. `S [par]` Pixel-perfect canvas sizing: viewport to integer DPR scale, resize and orientation handling, desktop letterbox.
3. `S [par]` Fixed-step loop (30 Hz sim, rAF render with interpolation), FPS and sim-time debug overlay.
4. `S [par]` Pointer input layer: tap, drag-pan, two-finger pinch, long-press (whistle). Emits typed events.
5. `S` Vendor `crew-art.js`; sprite loader that builds the 64 atlas and a 32 atlas (auto-downsample, flagged as placeholder).

**Done when:** the monkey roster renders as animated idle sprites on a pannable, pinch-zoomable canvas at 60 fps on a phone.

### M1 · World
6. `O` Grid model and level JSON schema (tiles, walls with HP and type, doors with lock state, windows, props, spawn and dock points). Author the first level, Dunmore & Pike Tax Services.
7. `S [par]` Iso projection and depth sort, with unit tests for screen/grid round-trips at both LODs.
8. `S [par]` Procedural prop and tile atlas generator for both LODs. Port the look from `design/scene-iso.js`; tiles 40×20 and 64×32.
9. `S` Layer renderer: cached floor and walls, dynamic sprite pass, wall-destroy dirty-rect repaint.
10. `O` Camera with discrete LOD switch: pinch past the threshold crossfades the atlas swap; focus-on-target API for the whistle.

**Done when:** the Dunmore & Pike floor renders correctly at both zoom levels with sprites depth-sorted against walls.

### M2 · Items and hauling
11. `S [par]` Item catalogue and spawning (chair, monitor, desk, cabinet, rack, vending machine, safe, statue, CEO desk) with weight, value, footprint.
12. `O` A\* pathfinding on the grid plus a cached flow field to the truck; recompute on wall changes.
13. `S` Crew state machine (idle, walk, pick up, carry, drop) and the manual tap-to-throw flow.
14. `S [par]` Truck, score and timer; delivery pops; HUD wiring for timer, quota and manifest.

**Done when:** a player can clear a room by hand and see money and the timer move.

### M3 · Crew roles
15. `O` Breacher: wall HP, hit animation, debris, route invalidation. Locked-door variant.
16. `O` Chain-gang: route authoring (tap A, tap B), tile occupancy, hand-off throughput model, visual arcs.
17. `S [par]` Whistle: converge, weight threshold, heave animation, progress ring.
18. `S [par]` HUD crew chips: select role, assign counts, cooldown on the whistle.

**Done when:** a breached shortcut visibly speeds up a chain-gang run, and a safe needs the whistle swarm to move.

### M4 · Hazards and verticality
19. `O` Inspector AI: wandering patrol, vision cone, fines.
20. `S [par]` Decoy: intercept and stall, stamina.
21. `S [par]` Rigger: window pairing, zip-line and net, drop handling.
22. `S` Multi-floor support (stairs, floor switcher in the HUD).

### M5 · Game flow
23. `S` Job intro (briefing card), results screen with stars and bank.
24. `S` Save and load (localStorage), settings, tutorial overlay.
25. `S [par]` Minimap (top-down, from the grid) and toast system.

### M6 · Prestige loop
26. `O` Takeover map and buyout tree; data-driven building list (strip-mall tax office, regional bank, high-rise).
27. `S [par]` Unlockables: crane helicopter (lifts heavy items), shredder truck (value multiplier), bionic monkeys (stat upgrades). Each is a data entry plus one behaviour hook.
28. `S` Level authoring for two more buildings.

### M7 · Polish and ship
29. `S [par]` Audio: WebAudio-synthesised original SFX and a short music loop (reuse at most 2-3 sounds from the original game); particles and screen shake.
30. `O` Performance pass: 100-monkey stress test, profiling, atlas packing.
31. `S` PWA offline cache, install prompt, safe-area insets.
32. `S` Hand-drawn 32×32 sprite pass (replaces auto-downsampled placeholders).

## How the sub-tasks will be run

- I own the plan, integration and review. Each sub-task is delegated with this template: goal, files to touch, interfaces it must honour, acceptance test, and "do not modify" paths.
- Delegation uses Sonnet 5.5 for well-specified implementation and Opus 5.5 for tasks with real algorithmic design (marked `O`), each at the lowest reasoning level that passes the acceptance test. Sim logic gets Node unit tests; render tasks get a screenshot check.
- Parallel batches use separate worktrees where files overlap, and merge after my review.

## Status (updated after M7, minus the 32px sprite pass)

Done and tested (228 unit tests, plus manual browser checks at 390x844):
- M0-M5 as before: scaffold, iso world + LOD camera, hauling, breachers/chain-gangs/whistle, inspectors/decoys/riggers, game flow, save, tutorial, minimap.
- M6 prestige loop: three buildings (Dunmore & Pike, Fairfax Regional Credit Union, Gilded Trust Bank Tower; all single-floor, multi-floor was deferred), Hostile Takeover map + upgrade shop (title -> map -> briefing -> play -> results -> map), upgrades via `computeModifiers` (bionic legs/fists/arms, decoy training, shredder truck, crane helicopter), crane command + CRANE HUD button + helicopter art, `tests/levels.test.js` (every item deliverable once walls are open, quota <= 80% of total value).
- M7: WebAudio synthesised SFX + chiptune loop (`src/platform/audio.js`, live mute), integer-pixel screen shake, PWA (service worker precache in `sw.js` — add new source files to PRECACHE, `tests/pwa.test.js` enforces it; install button, iOS hint, update banner, icons from `scripts/make-icons.mjs`, safe-area insets), perf pass (`scripts/bench.mjs`: 100 crew + 150 items, ~0.1 ms mean / <0.6 ms p95 per tick; A* heap, cached BFS ranking, render list caching).
- Playtest round 1 fixes: bigger HUD/menu text, guided 11-step tutorial with in-world arrows (targets from `tutorial` in dunmore-pike.json), mode banner (`src/ui/modebar.js`) explaining chain/whistle/breach/rig/decoy, HAUL chip renamed CHAIN, top-down plan view (`src/render/plan-renderer.js`, camera `setProjection`, 2D/3D toggle persisted as `settings.view`), service worker disabled on localhost (use `?sw=1` to test it).
- Run: `npm run dev` (http://localhost:5173), tests: `npm test`. Dev hooks: `window.__imi` (re-assigned on every job load, so re-read it after `loadJob`).
- Delegation rule: Sonnet 5.5 at low effort only, at most 2 agents in parallel.

Known issues / polish backlog:
- Gilded Trust level totals about $28k of loot (quota $17k); economy and upgrade prices are untuned. Some heavy items in the suites have only 2 reachable adjacent tiles.
- Crane helicopter is small at the zoomed-out LOD; camera does not follow it. Shredder/bionic upgrades have no on-screen feedback beyond the gold value pop.
- Map screen: single scrolling column, only checked by DOM assertions plus one screenshot; briefing does not show the job tagline; non-first levels start the camera at the grid centre.
- Inspector vision cone is drawn over walls even though the sim blocks line of sight.
- Occluded-monkey silhouettes have no darker outline; flat sky outside the building; placeholder whistle icon; 32px monkey sprites are auto-downsampled.
- Tapping overlapping sprites can pick the wrong item.
- Not tested on real touch hardware; untested in browser: tutorial steps 3-6, Escape/tab-hidden pause, restart/quit buttons, settings toggles.
- Hi-LOD render cost is ~3 ms/frame in the software-raster preview (no gain from the pass); phone-accurate timing still untested. Audio, install flow and safe-area are unverified on real devices.
- Next: hand-drawn 32x32 monkey sprites (M7.32), economy/level tuning, device testing.

## Economy v2 (automation / incremental loop, replaces the 15:00 quota loop)

Player feedback: the tactical loop was unclear and players got locked out of orders. New loop: start with 2 haulers, tap loot to sell it, spend cash to hire haulers/breachers/riggers/decoys who work automatically (`src/sim/auto.js`), buy in-run boosts (speed, haggle), strip the building (no timer fail; par-time stars), bank profit, buy the next building and persistent upgrades (recruiter, headhunter, barracks, bionic, shredder, crane) on the map.
- Sim: `createWorld({auto:true})`; costs and pacing in `src/data/economy.js` (hire 350/1200/1400/1000 x1.28 per hire; greedy-policy clear times about 9.3 / 12.7 / 17.8 min; `scripts/auto-sim.mjs`). Stall rescue ("bank advance", max 3, deducted from profit) prevents soft-locks.
- UI: cash + par clock + "BUILDING STRIPPED %" bar, four hire buttons, whistle, boost sheet, nudge banners (`src/ui/nudges.js`, gated by elapsed time), 5-step non-blocking tutorial, results with profit banked.
- Classic mode (chain/mode bar UI, 15:00 timer) still exists in the sim and tests but is no longer used by the game UI.
- Open: buildings are three hand-authored levels (no growth yet; a level generator would give "buildings start growing"), economy untuned by real play, chain-gangs have no role in auto mode yet (could return as an automated relay upgrade).

## Mobile-first UI v3 (2026-10-21, replaces the iso HUD and the select-a-monkey flow)

**Update (same day, after the first playtest of v3):** the player missed the 2.5D feel, so the **default view is 2.5D again** (zoomed to the hi-LOD stop so the building fills the screen vertically) with a **director camera** (`src/render/director.js`) that follows a working monkey and backs off for 6 s after any drag/pinch/tap; the first 4 s of a job hold on the whole building. Top-down is now the alternative: pause menu -> `2.5D VIEW` toggle (`settings.view`). The card, tray and hire sheet work in both views. The bullets below describe the top-down variant.


Playtest on a phone: the iso scene was hard to tap (tiny sprites, overlaps, floor filled ~1/3 of the screen, ~10 HUD elements). Decisions:
- **View:** top-down plan only, rotated 90 degrees CCW so the landscape floor is tall (16x12 grid -> 12 wide x 16 tall at 32 px tiles; the truck side is at the bottom). `camera.setInsets` reserves the HUD bars, `camera.fitPlan` centres the floor in the band between them; `main.js` `fitCamera()` runs on resize and every job load. Iso code still exists (camera/renderer/tests) but nothing in the UI reaches it.
- **Assigning:** tap loot (or a wall, window, inspector) and an action card pops up at it with only the buttons that apply (`src/ui/card.js`, models in `src/ui/loot.js`). Loot cards: HAUL NEXT (pins the item, `commands.prioritize`: auto holds free haulers for it and pulls back haulers still walking elsewhere), WHISTLE (heavy), CRANE (if unlocked). A bottom loot tray (`src/ui/tray.js`) lists what is left by kind; tapping a chip opens the next item of that kind. The old select-a-monkey / whistle-mode / crane-mode flow is gone.
- **Hiring:** one HIRE button (shows the recommended role, `recommendRole`) opens a sheet with all four roles and what they do; BOOST has its own sheet. Minimap and the 2D/3D toggle are no longer in the HUD (`minimap.*`, `viewtoggle.*` are unused, not deleted).
- **Tutorial:** pick loot -> haul next -> hire -> watch -> breacher nudge.
- Open: pin walls ("breach next") like items; bigger buildings (Fairfax 15 wide, Gilded 18) pan horizontally; chip icons are colour swatches (export `drawPropIcon` from the plan renderer for real icons); not yet tested on a real phone.

## Resolved rules

1. **Timer:** fixed 15:00 per job.
2. **Chain-gangs:** player-authored (tap start, tap end). Auto-build from any cleared path is a later upgrade.
3. **Failing a job:** missing quota is the only fail. Inspector fines are in the plan as score penalties, not a separate fail state.
4. **Audio:** mostly original. Sounds are synthesised with WebAudio, with no audio asset files. Reuse at most two or three sounds from the original game.
