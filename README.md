# WAE Neon Rider 3D

Arcade espacial 3D de **WAE OS Enterprise**, evolucionado desde el prototipo Flight Simulator V2 hacia una arquitectura modular y un Combat Core V4 orientado a partidas cortas, progresión y rejugabilidad.

## Stack

- Three.js 0.185.1
- Vite 8.2.2
- JavaScript ES Modules
- WebGL + Web Audio API
- Responsive / touch / keyboard

## Combat Core V4

La V4 conserva el motor estable de V3 y agrega una capa de gameplay de mayor profundidad:

- Sectores infinitos con dificultad incremental.
- Drones enemigos con desplazamiento lateral y fuego dirigido.
- Guardián de sector con HP, entrada cinematográfica y patrón de ataque.
- Misiones cortas rotativas: destrucción, cadenas de combate y supervivencia sin impacto.
- Sistema HEAT que premia rendimiento sostenido.
- OVERDRIVE temporal al completar HEAT, con disparo acelerado y multiplicador de puntuación.
- Combos visibles y multiplicadores crecientes.
- WAE Cores persistentes obtenidos por desempeño, no por compra de ventaja.
- Mejor sector persistente por jugador/dispositivo.
- HUD específico para misión, HEAT, combo y salud del Guardián.
- Audio diferenciado para armas enemigas, jefe, misión y OVERDRIVE.
- Protección breve tras impactos para evitar daño múltiple injusto.
- Corrección del lifecycle de Game Over para mantener la nave destruida fuera de escena.

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

El comando `check` valida sintaxis de V3 y V4. El build de Vite valida el entrypoint productivo activo en `src/v4/main.js`.

## Arquitectura

```text
src/
  audio.js
  config.js
  game.js
  main.js
  styles.css
  v4/
    audio.js      # feedback sonoro de combate
    config.js     # balance de sectores, drones, boss, HEAT y progresión
    game.js       # extensión del motor V3 con Combat Core
    main.js       # HUD y entrada productiva V4
    styles.css    # interfaz responsive V4
```

## Bucle principal de juego

```text
destruir amenazas
      ↓
encadenar combo
      ↓
llenar HEAT
      ↓
activar OVERDRIVE
      ↓
completar misión
      ↓
derrotar Guardián
      ↓
entrar a un sector más difícil
```

## Próximos módulos recomendados

1. Hangar y selección de naves usando WAE Cores como progreso cosmético/desbloqueo.
2. Armas secundarias y builds de nave.
3. Más familias de enemigos y jefes con patrones diferenciados.
4. Mapa galáctico y campaña ligera.
5. Leaderboard backend y perfiles multi-dispositivo.
6. Gamepad y vibración avanzada.
7. Modelos GLTF/GLB optimizados, skins y efectos VFX.
8. Telemetría de dificultad, duración de partida y balance.
