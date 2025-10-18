# AI contributor instructions for HYVEMYND (Hive • PIXI)

This project is a browser-first Hive implementation with Pixi.js rendering and Capacitor packaging for Android. Game rules and state live in plain JS under `www/js`. Keep edits minimal, side-effect free where possible, and use existing public functions.

## Architecture (what talks to what)
- `www/index.html`: loads Pixi, GSAP and project scripts; declares main DOM containers (board, trays, HUD, history panel).
- `www/js/main.js`: bootstraps three Pixi applications (board + two trays), wires HUD/history UI, and wraps `updateHUD()` after load.
- `www/js/board.js`: board/tray drawing helpers and hex grid primitives (referenced by `game.js`).
- `www/js/game.js`: core game logic and state.
  - Globals: `state` (turn/move, queenPlaced, gameOver), `window.cells` (Map keyed by `"q,r"`), `tray` (all pieces), `selected`, `legalZones`, `animating`.
  - Coordinate helpers: `axialToPixel(q,r)` and the global `CELL_RADIUS`.
  - Placement flow: `selectPlacement(piece)` → `commitPlacement(q,r)`.
  - Movement flow: `selectMove(piece)` → `commitMove(q,r)`.
  - Legality: `legalPlacementZones(color): Set<string>` and `legalMoveZones(piece): Set<string>|Array<string>`.
  - Turn/HUD: `updateHUD()`, `passTurn()`.
  - FX/animation: `animatePieceMovement(...)` with type-specific animators; use when moving pieces.
- `www/js/pieces.js`: piece creation/metadata and visuals (loaded after game.js in `index.html`).
- `www/js/resize.js`: viewport/zoom management.
- Node-only test harnesses: `test_spider.js` (validates spider rules), `test_distance.js`.
- Capacitor Android project under `/android/` for packaging—doesn’t affect browser dev loop.

## Developer workflows
- Run in browser: open `www/index.html` with a static server (file URLs can block audio/autoplay). If using VS Code Live Server or any static server, serve `www/` as site root.
- No build step is required for web; scripts are plain ES5/ES6 loaded directly. Android build is via Capacitor/Gradle, outside typical web loop.
- Dependencies (Pixi/GSAP) are loaded via CDN in `index.html`; no bundler.
- Tests: there’s no framework test; use the Node harnesses directly with `node test_spider.js`. Keep harnesses pure CommonJS.

## Conventions and patterns
- Board addressing is axial hex coordinates `(q,r)`; keys are `"q,r"` strings. Use `axialToPixel()` for layout.
- All board cells live in `window.cells: Map<string,{gfx,q,r,stack:[]}>`. Occupied cells are those with `stack.length>0`.
- Piece objects live in `tray` with `meta` fields: `{ key:'Q'|'A'|'G'|'B'|'S', color:'white'|'black', placed:boolean, q:number, r:number }` and display props.
- Always go through selection/commit flows when applying a move so animations, history, and HUD update correctly:
  - Placement: `selectPlacement(piece)` then `commitPlacement(q,r)`.
  - Movement: `selectMove(piece)` then `commitMove(q,r)`.
- Compute legality using provided APIs:
  - `legalPlacementZones(color)` returns a Set of destination keys.
  - `legalMoveZones(piece)` returns allowed destination keys for that piece given hive connectivity rules (see also `wouldHiveRemainConnectedAfterMove`).
- Game progression and pass: `updateHUD()` handles turn text and will call `passTurn()` when no legal actions exist.
- Animations rely on GSAP; respect `animating` flag to avoid double-actions.

## Integration points for agents (AI, UI, tooling)
- To add a computer player, build a small runner that gathers actions from `legalPlacementZones` / `legalMoveZones`, chooses one, then calls the commit flows. Trigger it after `updateHUD()` or when `state.current` changes. Example entry points and globals exist in `game.js` at:
  - `updateHUD()` (lines ~813+), `passTurn()` (~851), `selectPlacement()` (~898), `legalPlacementZones()` (~908), `selectMove()` (~1090), `legalMoveZones()` (~1188), `commitMove()` (~1528).
- History overlay and HUD are wired in `main.js` (rendering functions `renderHistoryControls`, `showHistoryOverlay`, `hideHistoryOverlay`). If emitting new history snapshots, follow the existing `snap.pieces` shape.
- Zoom/viewport utilities: `setupZoomControls(app)`, `zoomAt(x,y,factor)`, `autoZoomToFitPieces()` in `game.js` and `resize.js`.

## Gotchas
- Many functions rely on implicit globals (`window.app`, `window.cells`, `window.pieceLayer`, `tray`). Avoid refactors that de-globalize without updating all call sites.
- `index.html` loads scripts in order; don’t reorder without checking cross-file references. Current order: board.js → game.js → pieces.js → resize.js → main.js.
- Keep coordinates as integers; destination keys must match `"q,r"` string form used in Maps/Sets.
- Animations stack height: vertical offset is `stack.length * 6`; when moving to a new cell, compute target Y using the destination cell’s `stack.length` after any temporary removals.
- When adding UI, ensure pointer events don’t block Pixi canvas unless intentionally overlaying (`history-board-overlay` uses pointerEvents: none).

## Example: enumerate and apply a legal action
- Placements for current side: `for (const k of legalPlacementZones(state.current)) { const [q,r] = k.split(',').map(Number); /* candidate */ }`
- Moves for a piece: `const moves = legalMoveZones(piece); for (const k of moves) { /* ... */ }`
- Apply: `selectMove(piece); commitMove(q,r); // or selectPlacement + commitPlacement`

## External dependencies
- Pixi.js 6.5.10 via CDN
- GSAP 3.11.5 via CDN
- Capacitor 7.x for Android wrapper (package.json)

## Coding style
- Prefer small, targeted changes. Preserve public function signatures and global state contracts.
- When adding new files, include via `<script src="js/yourfile.js"></script>` after `game.js` in `index.html` if it depends on globals.
- Keep Node harnesses separate from browser code; do not import browser globals there.
