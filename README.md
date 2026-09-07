# WAE Neon Rider 3D

Shooter espacial 3D de **WAE OS Enterprise**, evolucionado desde un prototipo WebGL hacia una arquitectura modular con carrera persistente, builds roguelite, rutas de riesgo/recompensa y combate cinematográfico.

## Stack

- Three.js 0.185.1
- Vite 8.2.2
- JavaScript ES Modules
- WebGL + Web Audio API
- Responsive / touch / keyboard

## Cinematic Combat V8

V8 conserva toda la progresión V7 y añade una capa de lectura, espectáculo y prioridad táctica:

- Slow-motion contextual en impactos y cambios de fase importantes.
- FOV/cámara dinámica durante momentos cinematográficos.
- Telegraph visual antes del ataque firma de cada Guardián.
- Misil WAE guiado (`R` o botón táctil):
  - adquiere automáticamente el blanco prioritario;
  - prioriza Guardianes, mini-bosses y élites;
  - posee cooldown independiente;
  - inflige daño alto a drones y Guardianes.
- Wingman autónomo integrado a la nave:
  - orbita alrededor del jugador;
  - adquiere blancos automáticamente;
  - aporta daño de soporte durante la run.
- 4 mini-bosses asociados a biomas:
  - Void Breaker.
  - Solar Lancer.
  - Rift Phantom.
  - Emerald Citadel.
- Mini-bosses con HP reforzado, patrones de fuego propios y recompensas de Cores.
- Encuentros especiales durante sector:
  - Ala de Ases.
  - Tormenta de Cores.
  - Última Línea.
- HUD nuevo para Misil WAE, mini-boss, encuentro activo y alertas cinematográficas.
- Persistencia V8 de mini-bosses derrotados y misiles disparados.
- Migración de perfil V7 → V8 sin perder Cores, naves, armas, loadout, perks de carrera histórica o mejor sector.

## Sistemas heredados de V7

- Phase Dash (`SHIFT` / `X`).
- Enemigos élite y recompensas premium.
- Rutas Estable, Cacería Élite y Anomalía Volátil.
- Eventos raros.
- Guardianes únicos por bioma con ataques firma.
- Estadísticas persistentes de élites y Guardianes derrotados.

## Sistemas heredados de V6

- 4 clases enemigas: Raider, Sentinel, Sniper y Swarm.
- Pulso Nova (`Q` / `E`).
- Guardianes con 3 fases.
- 8 perks roguelite por run.
- 4 biomas rotativos.
- HEAT + OVERDRIVE.

## Galactic Core heredado de V5

- Hangar orbital.
- 4 naves con estadísticas reales.
- 4 sistemas de armas con 2–5 líneas de fuego.
- WAE Cores obtenidos jugando.
- Mapa galáctico y selección de punto de salto.
- Persistencia de loadout, desbloqueos y mejor sector.

## Bucle de juego V8

```text
Hangar / mapa / loadout
        ↓
combate + Wingman
        ↓
élites / evento raro / mini-boss
        ↓
HEAT + OVERDRIVE + Phase Dash
        ↓
Pulso Nova + Misil WAE
        ↓
telegraph → Guardián F1/F2/F3
        ↓
slow-motion / momento crítico
        ↓
elegir perk
        ↓
elegir ruta de riesgo/recompensa
        ↓
nuevo bioma + build acumulada
        ↓
run hasta game over
        ↓
Cores → Hangar → nueva run
```

## Controles

- `WASD` / flechas — movimiento.
- `ESPACIO` — disparo principal.
- `Q` / `E` — Pulso Nova.
- `SHIFT` / `X` — Phase Dash.
- `R` — Misil WAE guiado.
- `P` / `Esc` — pausa.
- `M` — audio.
- `H` — Hangar.
- `G` — mapa galáctico.

## Desarrollo

```bash
npm install
npm run dev
```

## Validación

```bash
npm run check
npm run build
```

`check` valida sintaxis acumulada de V3 a V8. Vite valida el entrypoint productivo activo en `src/v8/main.js`.

## Arquitectura

```text
src/
  audio.js
  config.js
  game.js
  main.js
  styles.css
  v4/            # Combat Core
  v5/            # Galactic Core / Hangar / loadout
  v6/            # Rogue Combat / perks / biomas
  v7/            # Legendary Run / élites / rutas / Guardianes
  v8/
    config.js     # mini-bosses, encuentros y balance cinematográfico
    game.js       # misiles, Wingman, telegraphs, slow-motion y mini-bosses
    main.js       # HUD V8, controles y feedback cinematográfico
    styles.css    # capa visual Cinematic Combat
```

## Siguiente frontera de producto

1. Música adaptativa real por intensidad, bioma y fase de Guardián.
2. Gamepad completo y vibración contextual.
3. Modelos GLTF/GLB optimizados y VFX de mayor fidelidad.
4. Misiones narrativas y campaña ligera.
5. Leaderboard backend, cuentas multi-dispositivo y temporadas.
6. Telemetría de balance: duración, muertes, pick-rate, win-rate y economía de Cores.
7. Accesibilidad: remapeo, intensidad de flashes, shake y modos de contraste.
