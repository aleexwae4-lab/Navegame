# WAE Neon Rider 3D

Shooter espacial 3D de **WAE OS Enterprise**, evolucionado desde un prototipo WebGL hacia una arquitectura modular con carrera persistente, builds roguelite, rutas de riesgo/recompensa, combate cinematográfico, campaña galáctica y progresión de Maestría.

## Marca

El videojuego mantiene un sello persistente con la marca:

**wae os Enterprise**

El sello permanece en portada, combate y pantallas clave como firma visual oficial del juego.

## Stack

- Three.js 0.185.1
- Vite 8.2.2
- JavaScript ES Modules
- WebGL + Web Audio API
- Responsive / touch / keyboard

## V10 · Combat Feel & Mastery

V10 conserva Living Galaxy V9 y prioriza sensación de control, legibilidad y aprendizaje:

- Control táctil por arrastre sobre el área libre de combate.
- D-pad tradicional disponible en paralelo.
- Soporte multitáctil: mover con un dedo y mantener FUEGO con otro.
- Protección de lanzamiento durante los primeros segundos de cada run.
- Daño reducido durante esa ventana para evitar muertes instantáneas al aprender.
- Telegraph visual de entrada para enemigos nuevos.
- Telegraph breve antes de disparos enemigos mediante anillo 3D.
- Feedback de impacto con flash contextual, vibración heredada, camera kick y micro slow-motion.
- Tutorial contextual progresivo que enseña:
  - movimiento;
  - fuego sostenido;
  - Pulso Nova;
  - Esquiva;
  - Misil WAE.
- El tutorial se completa y persiste para no repetir instrucciones indefinidamente.
- Sistema persistente de **Maestría**.
- Maestría obtenida por:
  - combo 10;
  - objetivos secundarios;
  - hitos de bajas;
  - mini-bosses;
  - Guardianes;
  - sectores perfectos sin recibir daño.
- Rangos de Maestría:
  - Cadete;
  - Piloto;
  - As;
  - Cazador Estelar;
  - Guardián WAE;
  - Leyenda.
- La Maestría se muestra fuera del combate para mantener el HUD móvil limpio.
- Migración V9 → V10 conservando progreso anterior.

## V9 · Living Galaxy

- 4 facciones ligadas a los biomas:
  - Dominio Helix — velocidad vectorial.
  - Forja Solar — artillería térmica.
  - Pacto de la Falla — cazadores élite.
  - Legión Verdant — guerra de desgaste.
- Cada facción modifica velocidad enemiga, proyectiles, daño o presencia de élites.
- Objetivo secundario por sector.
- Recompensas en WAE Cores + Renombre.
- Campaña persistente con Renombre, capítulos, rango y victorias por facción.
- Pantalla Galaxia Viva.

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

## Bucle de juego V10

```text
JUGAR
  ↓
mover + fuego + aprender controles
  ↓
objetivo + enemigos telegráficos
  ↓
combo / Pulso / Esquiva / Misil
  ↓
élites / evento / mini-boss
  ↓
Guardián F1/F2/F3
  ↓
perk + ruta
  ↓
Cores + Renombre + Maestría
  ↓
nuevo sector / capítulo / rango
  ↓
run hasta game over
  ↓
progreso persistente → nueva run
```

## Controles

### Móvil

- Arrastrar en el espacio libre — mover nave.
- D-pad — movimiento alternativo.
- FUEGO — mantener para disparo continuo.
- PULSO — limpia proyectiles y daña amenazas.
- ESQUIVA — Phase Dash con invulnerabilidad breve.
- MISIL — busca automáticamente el objetivo prioritario.

### Teclado

- `WASD` / flechas — movimiento.
- `ESPACIO` — disparo principal.
- `Q` / `E` — Pulso Nova.
- `SHIFT` / `X` — Esquiva / Phase Dash.
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

`check` valida sintaxis acumulada de V3 a V10. Vite valida el entrypoint productivo activo en `src/v10/main.js`.

## Arquitectura

```text
src/
  v4/             # Combat Core
  v5/             # Galactic Core / Hangar / loadout
  v6/             # Rogue Combat / perks / biomas
  v7/             # Legendary Run / élites / rutas / Guardianes
  v8/             # Cinematic Combat / misiles / Wingman / mini-bosses
  v9/             # Living Galaxy / facciones / campaña / Renombre
  v10/
    config.js      # balance V10 y rangos de Maestría
    game.js        # telegraphs, launch grace, mastery y coaching
    main.js        # drag steering, feedback y UI de Maestría
    styles.css     # feedback visual V10 sin saturar el combate
```

## Siguiente frontera de producto

1. Música adaptativa por intensidad, facción y fase.
2. Gamepad completo y vibración contextual.
3. Logros con desafíos específicos y recompensas cosméticas.
4. Leaderboard backend y perfil multi-dispositivo.
5. Modelos GLTF/GLB y VFX de mayor fidelidad.
6. Telemetría anónima de balance y economía.
7. Accesibilidad configurable: flashes, shake, contraste y remapeo.
