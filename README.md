# WAE Neon Rider 3D

Arcade espacial 3D de **WAE OS Enterprise**, evolucionado desde Flight Simulator V2 hacia un shooter roguelite modular con combate, carrera persistente, builds por run y progresión galáctica.

## Stack

- Three.js 0.185.1
- Vite 8.2.2
- JavaScript ES Modules
- WebGL + Web Audio API
- Responsive / touch / keyboard

## Rogue Combat V6

V6 conserva Hangar, armas, Cores y mapa galáctico de V5 y añade profundidad táctica dentro de cada partida:

- 4 clases enemigas con comportamiento propio:
  - Raider — interceptor móvil y agresivo.
  - Sentinel — unidad pesada con más HP y fuego doble.
  - Sniper — movimiento controlado y proyectil rápido/preciso.
  - Swarm — unidad ligera con desplazamiento errático de alta velocidad.
- Pulso Nova como habilidad secundaria activa (`Q` / `E` o botón táctil):
  - elimina proyectiles enemigos;
  - daña a todas las unidades activas;
  - golpea al Guardián;
  - posee cooldown independiente.
- Guardianes con 3 fases dinámicas según HP:
  - mayor movilidad;
  - aumento de cadencia;
  - patrones múltiples de proyectiles;
  - nodos orbitales visuales.
- 8 perks roguelite elegibles al limpiar sectores:
  - Overclock — cadencia primaria.
  - Reactor Rojo — generación de HEAT.
  - Bulwark — escudo máximo.
  - Núcleo Phase — cooldown de Pulso Nova.
  - Bounty Link — puntuación por bajas.
  - Capacitor X — potencia de Pulso Nova.
  - Nanites — reparación entre sectores.
  - Disruptor — reducción de velocidad enemiga.
- 4 biomas rotativos por sector:
  - Vacío Cyan.
  - Tormenta Solar.
  - Falla Violeta.
  - Frente Esmeralda.
- Fondo, niebla, estrellas y acento visual cambian con el bioma.
- HUD nuevo para bioma, perks activos, Pulso Nova y fase del boss.
- Perfil V6 migrado desde V5 sin perder Cores, bajas, naves, armas, loadout o mejor sector.

## Galactic Core heredado de V5

- Hangar orbital.
- 4 naves con estadísticas reales.
- 4 sistemas de armas con 2, 3, 4 y 5 líneas de fuego.
- Compra/equipamiento con WAE Cores obtenidos jugando.
- Mapa galáctico con selección de punto de salto.
- Sectores repetibles y desbloqueables.
- Persistencia de Cores, bajas, mejor sector, desbloqueos y loadout.

## Combat Core heredado

- Misiones de destrucción, combo y supervivencia.
- HEAT y OVERDRIVE.
- Combos y multiplicadores.
- Power-ups de escudo y ráfaga.
- Protección breve tras impactos.
- Récord persistente.

## Bucle de juego V6

```text
Hangar / mapa / loadout
        ↓
combate por clases enemigas
        ↓
combo + HEAT + OVERDRIVE
        ↓
Pulso Nova / gestión de cooldown
        ↓
Guardián Fase 1 → Fase 2 → Fase 3
        ↓
sector dominado
        ↓
elegir 1 de 3 perks
        ↓
nuevo bioma + build acumulada
        ↓
repetir hasta game over
        ↓
Cores → Hangar → nueva run
```

## Controles

- `WASD` / flechas — movimiento.
- `ESPACIO` — disparo principal.
- `Q` / `E` — Pulso Nova.
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

`check` valida sintaxis de V3, V4, V5 y V6. Vite valida el entrypoint productivo activo en `src/v6/main.js`.

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
  v6/
    config.js     # biomas, roles enemigos, perks y balance V6
    game.js       # Rogue Combat: IA por rol, Pulso Nova, perks y bosses por fases
    main.js       # HUD V6, selección de perks y controles
    styles.css    # capa visual V6 sobre estilos V5
```

## Siguiente frontera de producto

1. Bosses únicos por bioma con telegráficos visuales diferenciados.
2. Dash, misil dirigido y drone aliado como habilidades alternativas.
3. Rutas ramificadas del mapa con riesgo/recompensa.
4. Música dinámica por fase y bioma.
5. Gamepad y vibración avanzada.
6. Leaderboard backend, perfiles multi-dispositivo y temporadas.
7. Modelos GLTF/GLB optimizados, VFX y skins.
8. Telemetría de balance: duración, muertes, pick-rate y win-rate de perks/builds.
