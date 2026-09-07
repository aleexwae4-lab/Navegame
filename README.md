# WAE Neon Rider 3D

Arcade espacial 3D de **WAE OS Enterprise**, evolucionado desde Flight Simulator V2 hacia una arquitectura modular con combate, progresión persistente y metajuego de carrera.

## Stack

- Three.js 0.185.1
- Vite 8.2.2
- JavaScript ES Modules
- WebGL + Web Audio API
- Responsive / touch / keyboard

## Galactic Core V5

V5 conserva todo el Combat Core V4 y añade una capa de carrera persistente:

- Hangar orbital integrado sin recargar la aplicación.
- 4 naves con estadísticas reales diferentes:
  - Falcon MK-I — balance general.
  - Viper R — velocidad/cadencia alta y menor blindaje.
  - Aegis X — blindaje pesado y menor movilidad.
  - Nova Prime — build experimental orientado a OVERDRIVE.
- 4 sistemas de armas con 2, 3, 4 y 5 líneas de fuego.
- Compra y equipamiento usando WAE Cores obtenidos jugando.
- Migración automática del progreso V4 a V5.
- Persistencia de Cores, bajas, mejor sector, desbloqueos y loadout.
- Mapa galáctico con selección de punto de salto.
- Repetición de sectores desbloqueados para progresión y práctica.
- Siluetas/accent visual distintos por nave.
- Estadísticas aplicadas al gameplay: velocidad, escudo máximo, cadencia y generación de HEAT.
- HUD con loadout, Cores y sector seleccionado.
- Atajos: `H` Hangar, `G` mapa galáctico, `P` pausa y `M` audio.

## Combat Core heredado

- Sectores con dificultad incremental.
- Drones enemigos con fuego dirigido.
- Guardianes de sector con HP y patrones de ataque.
- Misiones de destrucción, combo y supervivencia.
- HEAT y OVERDRIVE.
- Combos y multiplicadores.
- Power-ups de escudo y ráfaga.
- Protección breve tras impactos.
- Récord y mejor sector persistentes.

## Bucle de juego V5

```text
combate
  ↓
misión / combo / OVERDRIVE
  ↓
Guardián de sector
  ↓
WAE Cores + nuevo sector
  ↓
Hangar: desbloquear / equipar
  ↓
Mapa: elegir nuevo punto de salto
  ↓
volver al combate con otro build
```

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

`check` valida sintaxis de V3, V4 y V5. Vite valida el entrypoint productivo activo en `src/v5/main.js`.

## Arquitectura

```text
src/
  audio.js
  config.js
  game.js
  main.js
  styles.css
  v4/
    audio.js
    config.js
    game.js
    main.js
    styles.css
  v5/
    config.js     # catálogo de naves/armas y balance meta
    game.js       # extensión V4: perfil, hangar, loadouts y sectores seleccionables
    main.js       # navegación Hangar / Galaxia / combate
    styles.css    # interfaz Galactic Core
```

## Siguiente frontera de producto

1. Familias de enemigos: interceptor, bombardero, sniper, carrier y kamikaze.
2. Guardianes únicos por bioma/sector con fases y telegráficos visuales.
3. Armas secundarias activas: misil, EMP, dash y drone aliado.
4. Sistema de perks/builds por run estilo roguelite.
5. Biomas visuales y mapa galáctico con rutas/decisiones.
6. Leaderboard backend, perfiles multi-dispositivo y temporadas.
7. Gamepad, vibración avanzada y accesibilidad.
8. VFX, modelos GLTF/GLB y audio musical dinámico.
9. Telemetría de balance: duración, muertes, build win-rate y dificultad por sector.
