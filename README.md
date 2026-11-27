# flight-game

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/shiyichen413-ops/flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/shiyichen413-ops/flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Valley Rings — a small three.js flight game. The mail plane is late: take off from the home strip, thread eight golden rings down a river valley in a low-poly mail plane, and land gently on the far runway. Chase view over seeded terrain with a river, ridges and pines; a live HUD (altitude, speed, heading) and a working instrument panel (artificial horizon, throttle gauge, climb tape); keyboard and mouse steering; stall behaviour and judged landings. Static files only — three.js is vendored as one minified module, everything else is hand-written, and the game loads nothing over the network.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That copies the game into `out/` and writes `out/dossier.json`. To play locally: `node serve.ts`, then open http://localhost:8080/.

---

<sub>Entered on [make.fun](https://make.fun/?ref=&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
