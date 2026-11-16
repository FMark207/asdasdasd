# The Toolbox

A collection of small browser toys, built with React + TypeScript + Vite.

## Projects

| Page | Path | Code |
| --- | --- | --- |
| Hub (pick a game) | `#/` | `src/pages/Hub.tsx` |
| Pebble Stack | `#/pebble-stack` | `src/games/pebble-stack/` |
| Would You Press The Button? | `#/press-the-button` | `src/games/press-the-button/` |

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
npm run lint
```

## Structure

```
src/
  App.tsx                 picks the page from the URL hash
  games/index.ts          list of all games (add new ones here)
  pages/Hub.tsx           the home page with the game cards
  components/
    ShapesBackground.tsx  drifting squares / circles / triangles
  lib/
    pebbles.ts            procedural realistic pebble generator
    router.ts             tiny hash router
    storage.ts            safe localStorage helpers (scores & stats)
  games/pebble-stack/
    PebbleStack.tsx       HUD, hint, game-over card (React)
    engine.ts             physics (Matter.js), input, camera, drawing
    scenery.ts            sky, clouds, space, woven mat
  games/press-the-button/
    PressTheButton.tsx    the page and its logic
    scenarios.ts          the scenarios (add more here)
    MoneyRain.tsx         falling money effect
```

## Adding a scenario to "Would You Press The Button?"

Add an object to `SCENARIOS` in `src/games/press-the-button/scenarios.ts`.
Each outcome can switch the theme (`light`, `dark`, `rich`), flicker the lights,
rain money, and make the background shapes burst or speed up.
