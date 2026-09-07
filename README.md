# WAE Neon Rider 3D

Arcade espacial 3D de **WAE OS Enterprise**, reconstruido desde el prototipo HTML de Flight Simulator V2 hacia una base modular V3 preparada para evolucionar.

## Stack

- Three.js 0.185.1
- Vite 8.2.2
- JavaScript ES Modules
- WebGL + Web Audio API
- Responsive / touch / keyboard

## Funciones V3

- Nave 3D construida proceduralmente con geometría Three.js.
- Campo estelar y ambiente de nebulosas.
- Movimiento independiente de FPS mediante delta time.
- Control con WASD, flechas y controles táctiles Pointer Events.
- Disparo sostenido y modo de ráfaga rápida.
- Meteoritos con dificultad progresiva.
- Colisiones nave/meteorito y láser/meteorito.
- Escudo, récord persistente, niveles y sistema de combo.
- Power-ups de escudo y ráfaga neón.
- Audio sintetizado sin assets externos.
- Pausa manual y pausa automática al cambiar de pestaña.
- HUD responsive y recuperación explícita si WebGL falla.

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

## Producción

El proyecto usa `base: './'`, por lo que el contenido de `dist/` puede servirse desde un subdirectorio o desde la raíz de un hosting estático.

## Arquitectura

```text
src/
  audio.js     # Web Audio API
  config.js    # balance y parámetros del motor
  game.js      # escena, física, entidades y gameplay
  main.js      # UI, eventos y enlace DOM <-> motor
  styles.css   # HUD, overlays y controles responsive
```

### Próximos módulos recomendados

1. Hangar y selección de naves.
2. Jefes, enemigos activos y armas secundarias.
3. Misiones/campaña y mapa galáctico.
4. Persistencia de perfil y leaderboard en backend.
5. Controles gamepad.
6. Assets GLTF/GLB optimizados y sistema de skins WAE.
7. Telemetría de rendimiento y calidad gráfica adaptable.
