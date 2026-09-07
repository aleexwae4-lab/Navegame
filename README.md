# WAE Neon Rider 3D

Shooter espacial 3D de **WAE OS Enterprise** con combate arcade, campaña persistente, Maestría y una capa comercial premium.

## Marca

El videojuego mantiene el sello persistente:

**wae os Enterprise**

## Stack

- Three.js 0.185.1
- Vite 8.2.2
- JavaScript ES Modules
- WebGL + Web Audio API
- Responsive / touch / keyboard

## V11 · Galactic Commerce

V11 añade la primera capa comercial del juego sin modificar el motor de combate V10.1.

### Catálogo premium

**6 naves premium**

- Viper R Black Edition — $49 MXN
- Aegis Sovereign — $89 MXN
- Nova Imperium — $149 MXN
- WAE Eclipse X — $249 MXN
- WAE Obsidian One — $399 MXN
- WAE Celestial Crown — $699 MXN

**6 armas premium**

- Trident VX-R — $39 MXN
- Storm Omega — $69 MXN
- Eclipse Cannon — $99 MXN
- Helix Railgun — $129 MXN
- Nova Destroyer — $179 MXN
- WAE Singularity — $249 MXN

Cada producto tiene SKU, rareza, serie, precio MXN, descripción, acento visual y estadísticas de potencia.

### Storefront

- Tienda accesible desde Inicio, Hangar y Game Over.
- Filtros Todo / Naves / Armas.
- Fichas con rareza, serie, estadísticas y precio.
- Navegación de retorno conserva la pantalla desde la que se abrió la tienda.
- Compra directa como modelo comercial; sin loot boxes ni resultados aleatorios.

### Seguridad comercial

El checkout real está **intencionalmente desactivado** en V11. Ningún producto premium se concede desde cliente o `localStorage`.

Cada producto declara:

```text
fulfillment = server_entitlement_required
```

El siguiente paso de monetización debe verificar pago en backend y generar un entitlement de servidor antes de desbloquear una nave o arma. Esto evita que un usuario pueda autoconcederse contenido premium editando el navegador.

Para competición futura, los rankings deberán poder separar loadouts premium y estándar si las estadísticas de pago afectan ventaja jugable.

## V10.1 · UX Hardening

- UX desacoplada del motor mediante `boot.js` + `ux.js`.
- Viewport Android estabilizado con safe areas y `visualViewport`.
- Controles táctiles compactos.
- Arrastre refinado y D-pad alternativo.
- Pulso, Esquiva y Misil muestran `LISTO` o recarga directamente en botón.
- Pausa y game over simplificados.
- Sin cambios de balance, dificultad ni economía del juego base.

## Sistemas heredados

- **V10:** Combat Feel & Mastery, telegraphs, protección inicial y Maestría.
- **V9:** Living Galaxy, facciones, Renombre y campaña.
- **V8:** Cinematic Combat, Misil WAE, Wingman y mini-bosses.
- **V7:** Legendary Run, élites, rutas y Guardianes.
- **V6:** Rogue Combat, perks, Pulso Nova y HEAT/OVERDRIVE.
- **V5:** Galactic Core, Hangar, naves, armas y WAE Cores.

## Controles

### Móvil

- Arrastrar — mover nave.
- D-pad — movimiento alternativo.
- FUEGO — disparo continuo.
- PULSO — limpia proyectiles y daña amenazas.
- ESQUIVA — Phase Dash.
- MISIL — objetivo prioritario automático.

### Teclado

- `WASD` / flechas — movimiento.
- `ESPACIO` — fuego.
- `Q` / `E` — Pulso Nova.
- `SHIFT` / `X` — Esquiva.
- `R` — Misil WAE.
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

`check` valida sintaxis acumulada de V3 a V11. Vite valida el entrypoint productivo activo en `src/v11/boot.js`.

## Arquitectura actual

```text
src/
  v4/ ... v9/     # evolución histórica del motor
  v10/
    config.js
    game.js
    main.js
    ux.js
    boot.js
    styles.css
  v11/
    catalog.js     # productos, SKUs, precios y política de fulfillment
    store.js       # storefront, filtros y checkout protegido
    styles.css     # presentación premium responsive
    boot.js        # V10.1 + Galactic Commerce
```

## Siguiente paso comercial

1. Cuenta de usuario y sesión.
2. Backend de entitlements.
3. Proveedor de pagos.
4. Webhook de pago verificado.
5. Tabla de órdenes y recibos.
6. Desbloqueo server-authoritative de productos.
7. Equipamiento real de naves/armas premium en el motor.
8. Restaurar compras por cuenta y multi-dispositivo.
