# WAE Neon Rider 3D

Shooter espacial 3D de **WAE OS Enterprise**, evolucionado desde un prototipo WebGL hacia una arquitectura modular con carrera persistente, builds roguelite, rutas de riesgo/recompensa, combate cinematográfico y campaña galáctica.

## Marca

El juego incorpora un sello persistente visible durante la experiencia con la marca:

**wae os Enterprise**

El sello permanece en portada, combate y pantallas del sistema como firma visual del videojuego.

## Stack

- Three.js 0.185.1
- Vite 8.2.2
- JavaScript ES Modules
- WebGL + Web Audio API
- Responsive / touch / keyboard

## Living Galaxy V9

V9 conserva todo Cinematic Combat V8 y añade una capa de universo persistente:

- 4 facciones ligadas a los biomas:
  - Dominio Helix — velocidad vectorial.
  - Forja Solar — artillería térmica.
  - Pacto de la Falla — cazadores élite.
  - Legión Verdant — guerra de desgaste.
- Cada facción modifica parámetros reales del combate:
  - velocidad enemiga;
  - velocidad de proyectiles;
  - daño recibido;
  - presencia de élites.
- Objetivo secundario por sector con recompensa independiente.
- 5 familias de objetivos secundarios:
  - combo;
  - caza de élites;
  - uso táctico del Misil WAE;
  - supervivencia con escudo alto;
  - puntuación de sector.
- Recompensas de objetivos en WAE Cores + Renombre.
- Campaña persistente con:
  - Renombre;
  - capítulos;
  - rango;
  - victorias totales;
  - victorias por facción;
  - objetivos completados.
- Rangos de campaña:
  - Piloto.
  - As de Sector.
  - Vanguardia.
  - Comandante Estelar.
  - Leyenda WAE.
- Pantalla Galaxia Viva con historial de victorias por facción.
- HUD de facción, doctrina, rango, capítulo y objetivo secundario.
- Migración V8 → V9 sin perder progreso anterior.

## Sistemas heredados

### V8 · Cinematic Combat

- Slow-motion contextual.
- FOV/cámara dinámica.
- Telegraphs de Guardianes.
- Misil WAE guiado (`R`).
- Wingman autónomo.
- 4 mini-bosses.
- Encuentros especiales.

### V7 · Legendary Run

- Phase Dash (`SHIFT` / `X`).
- Enemigos élite.
- Rutas Estable, Cacería Élite y Anomalía Volátil.
- Eventos raros.
- Guardianes únicos por bioma.

### V6 · Rogue Combat

- Raider, Sentinel, Sniper y Swarm.
- Pulso Nova (`Q` / `E`).
- Guardianes con 3 fases.
- 8 perks roguelite.
- HEAT + OVERDRIVE.

### V5 · Galactic Core

- Hangar orbital.
- 4 naves.
- 4 sistemas de armas.
- WAE Cores.
- Mapa galáctico y punto de salto.

## Bucle de juego V9

```text
Hangar / mapa / loadout
        ↓
facción + doctrina + objetivo secundario
        ↓
combate + Wingman
        ↓
élites / evento / mini-boss
        ↓
HEAT + OVERDRIVE + Phase Dash
        ↓
Pulso Nova + Misil WAE
        ↓
Guardián F1/F2/F3
        ↓
perk + ruta riesgo/recompensa
        ↓
Cores + Renombre + victoria de facción
        ↓
nuevo sector / capítulo / rango
        ↓
run hasta game over
        ↓
progreso persistente → nueva run
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

`check` valida sintaxis acumulada de V3 a V9. Vite valida el entrypoint productivo activo en `src/v9/main.js`.

## Arquitectura

```text
src/
  v4/            # Combat Core
  v5/            # Galactic Core / Hangar / loadout
  v6/            # Rogue Combat / perks / biomas
  v7/            # Legendary Run / élites / rutas / Guardianes
  v8/            # Cinematic Combat / misiles / Wingman / mini-bosses
  v9/
    config.js     # facciones, objetivos, rangos y balance de campaña
    game.js       # Living Galaxy: campaña, Renombre y doctrinas
    main.js       # HUD V9, Galaxia Viva y progreso de facción
    styles.css    # sello wae os Enterprise y capa visual de campaña
```

## Siguiente frontera de producto

1. Música adaptativa por intensidad, facción y fase.
2. Gamepad completo y vibración contextual.
3. Logros y desafíos de maestría.
4. Leaderboard backend y perfil multi-dispositivo.
5. Modelos GLTF/GLB y VFX de mayor fidelidad.
6. Telemetría de balance y economía.
7. Accesibilidad configurable: flashes, shake, contraste y remapeo.
