---
name: Experience Poker Room — Operator + Lobby
description: Sistema visual mixto: terminal operativo para staff de sala + lobby público gold-on-glass para jugadores.
colors:
  brand-gold: "#d9b66f"
  brand-gold-deep: "#d4af37"
  brand-gold-light: "#fdd835"
  surface-canvas: "#0a0a0f"
  surface-canvas-deep: "#050508"
  surface-panel: "#0d0f12"
  surface-panel-strong: "#334155"
  surface-table: "#1e2024"
  surface-table-edge: "#0a0b0d"
  table-felt: "#104b79"
  rail-black: "#111111"
  text-primary: "#ffffff"
  text-secondary: "rgba(255,255,255,0.92)"
  text-tertiary: "rgba(255,255,255,0.65)"
  text-muted: "rgba(255,255,255,0.45)"
  glass-overlay-1: "rgba(255,255,255,0.18)"
  glass-overlay-2: "rgba(255,255,255,0.10)"
  glass-overlay-3: "rgba(255,255,255,0.06)"
  glass-border: "rgba(255,255,255,0.18)"
  glass-border-soft: "rgba(255,255,255,0.12)"
  glass-bg-base: "rgba(12,18,28,0.45)"
  state-ok: "#38b000"
  state-ok-soft: "#57c34a"
  state-danger: "#e63946"
  state-danger-urgent: "#ff453a"
  state-warning: "#ffd60a"
  state-money: "#FFD54F"
  state-ios-blue: "#3b82f6"
  state-ios-green: "#22c55e"
  state-ios-amber: "#f59e0b"
  state-ios-red: "#ef4444"
  focus-ring-gold: "rgba(212,175,55,0.55)"
typography:
  display:
    fontFamily: "Inter, SF Pro Display, Poppins, system-ui, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3.25rem)"
    fontWeight: "700"
    lineHeight: "1.15"
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Inter, SF Pro Display, system-ui, sans-serif"
    fontSize: "clamp(1.25rem, 2.6vw, 1.75rem)"
    fontWeight: "700"
    lineHeight: "1.2"
    letterSpacing: "0.3px"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: "600"
    lineHeight: "1.3"
  body:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: "400"
    lineHeight: "1.6"
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: "650"
    letterSpacing: "0.2px"
  timer:
    fontFamily: "SF Pro Display, system-ui, -apple-system, sans-serif"
    fontWeight: "800"
    fontVariantNumeric: "tabular-nums"
  money:
    fontFamily: "inherit"
    fontWeight: "700"
    color: "{colors.state-money}"
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "16px"
  xxl: "20px"
  glass: "22px"
  pill: "999px"
  circular: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
  container-max: "1400px"
  app-padding: "2rem"
components:
  table-card:
    backgroundColor: "{colors.surface-canvas}"
    borderColor: "{colors.rail-black}"
    borderWidth: "20px"
    rounded: "225px"
    padding: "0"
  seat-chip-occupied:
    backgroundColor: "{colors.surface-panel}"
    borderColor: "{colors.glass-border-soft}"
    rounded: "{rounded.circular}"
    size: "100px"
  seat-chip-available:
    backgroundColor: "{colors.glass-overlay-2}"
    borderColor: "{colors.glass-border}"
    rounded: "{rounded.circular}"
    size: "100px"
  waiting-row:
    backgroundColor: "{colors.glass-overlay-3}"
    borderColor: "{colors.glass-border-soft}"
    rounded: "{rounded.xl}"
    padding: "{spacing.sm} {spacing.md}"
  status-badge-ok:
    backgroundColor: "{colors.state-ok}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    padding: "{spacing.xs} {spacing.sm}"
  status-badge-danger:
    backgroundColor: "{colors.state-danger}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    padding: "{spacing.xs} {spacing.sm}"
  status-badge-warning:
    backgroundColor: "{colors.state-warning}"
    textColor: "{colors.surface-canvas}"
    rounded: "{rounded.pill}"
    padding: "{spacing.xs} {spacing.sm}"
  timer-display:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    typography: "{typography.timer}"
    padding: "0"
  add-player-cta:
    backgroundColor: "rgba(212,175,55,0.12)"
    textColor: "{colors.brand-gold-light}"
    borderColor: "{colors.brand-gold-deep}"
    borderStyle: "dashed"
    rounded: "{rounded.xl}"
    padding: "{spacing.md} {spacing.lg}"
  input-field:
    backgroundColor: "{colors.glass-overlay-3}"
    borderColor: "{colors.glass-border-soft}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md} {spacing.lg}"
  button-primary-action:
    backgroundColor: "{colors.state-ok-soft}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md} {spacing.lg}"
  button-ghost:
    backgroundColor: "{colors.glass-overlay-3}"
    textColor: "{colors.text-secondary}"
    borderColor: "{colors.glass-border-soft}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md} {spacing.lg}"
---

# Design System: Experience Poker Room

## 1. Overview

**Creative North Star: "The Pit Counter"**

Dos registros visuales conviven, no se mezclan. El **gestor de mesas** (registro operativo) es un terminal sobrio: paneles planos, contraste alto, tipografía que manda, oro reservado para confirmación y CTA. La operación nunca compite con la acción; la densidad es legible pero no maximalista, construida con peso tipográfico y acento lateral, no con color. El **lobby público** (registro público) admite glass translúcido, gradientes suaves y gold-on-glass para que el jugador perciba marca y disponibilidad de mesa en menos de un segundo. El gold es el único puente entre ambos registros: aparece como acento, nunca como relleno.

Lo que este sistema rechaza explícitamente: glassmorphism decorativo en zonas operativas (inutilizable bajo luz fluorescente de sala), hero-metric templates reservados para marketing, grids de cards idénticas cuando los datos son naturalmente heterogéneos (mesa activa vs en espera vs cerrada), marketing buzzwords, skeleton loaders perpetuos, modales bloqueantes para acciones no-críticas.

**Key Characteristics:**

- Split register: gestor = plano, lobby = glass. Sin transiciones híbridas.
- Gold como acento, nunca como fondo. Máximo ~10% de cualquier superficie operativa.
- Densidad legible sobre el maximalismo. Tipografía y peso hacen el trabajo del color.
- Estado siempre redundante: icono + texto + color. Cero dependencia exclusiva de color.
- Animación al servicio de la confirmación de estado, no de la decoración.
- Touch y desktop con el mismo flujo. Targets ≥ 44×44px en zonas críticas.

## 2. Colors

Paleta dominante: negro/azul-noche profundo con oro como acento. El sistema usa **un solo gold canónico** (`#d9b66f`) con dos variantes explícitas (deep `#d4af37` para borde, light `#fdd835` para hover/labels). Los otros dos golds duplicados en código (`#d4af37`, `#fdd835`) se mantienen semánticamente solo donde ya están; refactor de tokens queda como deuda a pagar.

### Primary

- **Brand Gold** (`#d9b66f`): el único acento del sistema. Usado en títulos del gestor, hover de CTAs primarios, bordes de focus, y como tinta única del lobby público. Su rareza es el punto: si el oro aparece en más del 10% de una pantalla operativa, algo está mal.

### Secondary

- **Brand Gold Deep** (`#d4af37`): variante más saturada para bordes de mesa (rail dorado), botones "Add Player" del waiting list, y sombras tintadas. Nunca como fill de superficie.
- **Brand Gold Light** (`#fdd835`): variante para hover de texto y etiquetas con tinte cálido. No usar como fondo.

### Tertiary (operator)

- **State OK** (`#38b000`): asientos disponibles, confirmaciones de "sentar jugador", acciones seguras.
- **State OK Soft** (`#57c34a`): gradiente del botón "Rebuy" (recompra) en player-card. Más amable que el verde puro.
- **State Danger** (`#e63946`): acciones destructivas, "Eliminar mesa", cashouts que requieren confirmación.
- **State Danger Urgent** (`#ff453a`): ausencia urgente en seat-chip (pulso rápido, usado en timer de ausencia).
- **State Warning** (`#ffd60a`): ausencia normal en seat-chip (pulso lento).
- **State Money** (`#FFD54F`): cifra de stack/chips en player-card. Siempre gold, nunca verde-rojo.

### Neutral

- **Surface Canvas** (`#0a0a0f`): fondo de página. Negro casi puro, con un gradiente radial sutil de oro al 5% en la esquina superior-izquierda y púrpura profundo en la inferior-derecha (decorativo, no afecta legibilidad).
- **Surface Canvas Deep** (`#050508`): parte baja del gradiente de fondo. Da la sensación de "sala oscura" sin necesidad de imagen.
- **Surface Panel** (`#0d0f12`): paneles sólidos del gestor. Plano, sin translucidez.
- **Surface Panel Strong** (`#334155`): contenedores de inputs, headers de modal.
- **Surface Table** (`#1e2024`): paño central de la mesa de poker. Tono carbón, no negro puro.
- **Table Felt** (`#104b79`): azul oscuro histórico del fieltro, conservado en bordes y acentos de mesa.
- **Rail Black** (`#111`): borde exterior de la mesa (armrest). Casi negro, con aro dorado de 2px superpuesto.
- **Text Primary** (`#ffffff`): títulos, números de stack, datos críticos.
- **Text Secondary** (`rgba(255,255,255,0.92)`): cuerpo principal, labels de campos.
- **Text Tertiary** (`rgba(255,255,255,0.65)`): metadatos, timestamps, sub-títulos.
- **Text Muted** (`rgba(255,255,255,0.45)`): placeholders, estados deshabilitados.
- **Glass Overlay 1** (`rgba(255,255,255,0.18)`): borde y highlight de superficies glass del lobby.
- **Glass Overlay 2** (`rgba(255,255,255,0.10)`): fondo de botones glass en hover, seat-chip disponible.
- **Glass Overlay 3** (`rgba(255,255,255,0.06)`): fondo base de cards, waiting rows, inputs.
- **Glass Border** (`rgba(255,255,255,0.18)`): borde estándar glass.
- **Glass Border Soft** (`rgba(255,255,255,0.12)`): borde de inputs y rows sutiles.
- **Glass BG Base** (`rgba(12,18,28,0.45)`): fondo glass del lobby, con `backdrop-filter: blur(18px)`.

### Named Rules

**The One Voice Rule.** El gold aparece en ≤ 10% de cualquier superficie operativa. En el lobby puede llegar a 30% (titulares, acentos, CTA), pero nunca como fill de paneles enteros. Su rareza es el punto.

**The Status Triad Rule.** Cada estado (OK, Danger, Warning) lleva icono + texto + color. Nunca solo color. Badge "Disponible" en seat-chip usa verde + texto "Libre". Ausencia usa amarillo/rojo + icono de reloj + texto "Ausente 5:32".

**The Canvas Always Anchors Rule.** Ningún elemento flota sobre fondo transparente fuera del canvas. El lobby usa glass sobre canvas, el gestor usa paneles sólidos sobre canvas. Nunca glass sobre glass sobre glass.

## 3. Typography

**Display Font:** Inter (con SF Pro Display / Poppins fallback) — usada solo en `LobbyApp` y títulos del lobby público.

**Body Font:** system-ui stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`) — gestor de mesas y todos los paneles operativos.

**Label/Mono Font:** system mono (`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas`) reservado para IDs de mesa, timestamps en logs, y campos numéricos. El timer usa **SF Pro Display 800** con `font-variant-numeric: tabular-nums` para que los dígitos no salten al cambiar.

**Character:** La tipografía hace el trabajo de jerarquía. Sin peso, el sistema pierde legibilidad bajo luz fluorescente. Display y headline son Inter bold (700+), body es system-ui regular, label y money suben a 650-700. No hay cursivas, no hay decorativas.

### Hierarchy

- **Display** (Inter 700, `clamp(2rem, 5vw, 3.25rem)`, line-height 1.15, letter-spacing -0.01em): solo en hero del lobby público y modal de player-card completo. Nunca en gestor.
- **Headline** (Inter 700, `clamp(1.25rem, 2.6vw, 1.75rem)`, line-height 1.2, letter-spacing 0.3px): títulos de sección, nombres de mesa, header de player-card. Texto en brand-gold.
- **Title** (Inter 600, 1.125rem, line-height 1.3): títulos de cards, labels de grupo, encabezado de modal secundario.
- **Body** (system-ui 400, 15px, line-height 1.6): contenido de paneles, descripciones, texto de waiting list. Max 65-72ch en cards de detalle.
- **Label** (system-ui 650, 12px, letter-spacing 0.2px): labels de inputs, badges, KPIs pequeños. Frecuentemente uppercase implícito por tamaño.
- **Timer** (SF Pro Display 800, tabular-nums): h/m/s de timer de mesa y sesión. Opacity 0.5 cuando paused.
- **Money** (inherit 700, `#FFD54F`): cifras de stack y transacciones. Siempre gold, siempre bold, siempre tabular-nums.

### Named Rules

**The Two-Font Rule.** Máximo dos familias activas por superficie. Gestor: system-ui + system-mono. Lobby: Inter + system-ui. Nunca tres.

**The Tabular Number Rule.** Cualquier cifra que cambia con el tiempo (timer, stack, contador de jugadores) usa `font-variant-numeric: tabular-nums`. Sin esto, los dígitos saltan al actualizar y se pierde la sensación de control operativo.

## 4. Elevation

El sistema usa **dos modos de elevación, no sombras decorativas**. Superficies planas en reposo. Las sombras entran solo como respuesta a estado (hover, modal, focus, seat occupied). El efecto 3D está reservado a la mesa de poker y los seat-chips: la mesa tiene un aro 3D construido con `::before` y `::after` (mask radial), los seats tienen un halo en anillos concéntricos al hover. El resto del sistema se comunica con **peso tipográfico, color de acento y border lateral**, no con sombra.

**No usar sombras nunca para:** separar cards, indicar jerarquía, dar "profundidad visual" sin propósito. **Usar sombras solo para:** modal abierto (shadow-2), seat occupied hover (drop-shadow fuerte), tooltip activo (shadow-2), mesa de poker (3D realista obligatorio).

### Shadow Vocabulary

- **Shadow 1 — Subtle Lift** (`0 1px 2px rgba(0,0,0,0.35)`): hover de botón, focus de input. Sutil, no compite con el contenido.
- **Shadow 2 — Modal** (`0 8px 24px rgba(0,0,0,0.28)`): modal, drawer, popover. Separa la capa de interacción del fondo.
- **Shadow 3 — Waiting Row Hover** (`0 10px 28px rgba(0,0,0,0.32)`): fila de waiting list al hover. Refuerza que es clickeable.
- **Shadow 4 — Player Seat Hover** (`drop-shadow(0 10px 18px rgba(0,0,0,0.45))`): seat-chip ocupado al hover, con `transform: scale(1.08)`. Es la sombra más fuerte del sistema.
- **Shadow Table 3D** (`inset 0 0 26px rgba(0,0,0,0.5), inset 0 20px 42px rgba(0,0,0,0.22), 0 10px 28px rgba(0,0,0,0.38)`): mesa de poker realista. No se replica en ningún otro componente.
- **Shadow Tooltip** (`0 8px 20px rgba(0,0,0,0.45)` + inset highlight): tooltip de seat-chip, sobre el avatar.

### Named Rules

**The Flat-By-Default Rule.** Toda superficie arranca plana. La sombra aparece como respuesta a `hover`, `focus-visible`, o un cambio de estado explícito. Si algo tiene sombra en reposo, está mal.

**The Lateral Accent Rule.** En el gestor, la diferenciación de estado se hace con **borde lateral coloreado** (4px) o **badge de status en la esquina superior-izquierda**, no con sombra. La mesa activa lleva un acento lateral dorado de 3-4px; la mesa en espera, ninguno. La mesa cerrada, borde rojo 2px.

**The 3D-Exception Rule.** Mesa de poker y seat-chips son los únicos elementos con elevación 3D. Cualquier otro componente que intente parecer 3D rompe el lenguaje operativo y se confunde con decoración.

## 5. Components

### Table Card (Poker Table)

- **Shape:** óvalo 800×450px, `border-radius: 225px` (circular real, no clip-path).
- **Background:** radial-gradient de `#1e2024` a `#0a0b0d` (carbón a casi-negro), con textura `carbon-fibre.png` superpuesta en blend `overlay`, y un highlight radial dorado al 8% en el cuadrante superior.
- **Border / Rail:** armrest negro `#111` de 20px, con aro dorado de 2px inset. Es la única superficie con oro como borde continuo; la "marca" de la mesa.
- **Shadow:** sombra realista obligatoria (Shadow Table 3D). No se puede aplanar.
- **Logo centro:** PNG del club con `opacity: 0.08`, `filter: sepia(1) saturate(2) hue-rotate(5deg)` para tono dorado de marca de agua. Apenas visible, no compite con la acción.

### Seat Chip

- **Shape:** circular, 100×100px, `border-radius: 50%`.
- **Available (vacío):** fondo `rgba(255,255,255,0.08)`, borde glass `rgba(255,255,255,0.28)`, blur 10px. Al hover, brillo diagonal cruza el círculo (`seatShine` 2.2s).
- **Occupied (con avatar):** avatar circular con shadow interna negra, anillo dorado de 3px (`rgba(212,175,55,0.35)`), badge de número glass en la base. Al hover, escala 1.08 + `drop-shadow` fuerte + halo en 3 anillos concéntricos.
- **Absence Ring:** ausencia normal usa borde `#ffd60a` pulsando 1.8s; ausencia urgente usa `#ff453a` pulsando 0.8s con box-shadow rojo. La pulsación es la única animación aceptada por larga.
- **Tooltip:** glass `rgba(16,19,27,0.88)`, blur 6px, padding 10×14, aparece con `cubic-bezier(0.68, -0.55, 0.265, 1.55)` 0.3s. Contiene nombre, stack, tiempo en mesa.

### Timer Display

- **Style:** SF Pro Display 800, tabular-nums, transparente. Sin fondo, sin borde: el número ES el componente.
- **Behavior:** NumberFlow anima el cambio de dígito; opacity 0.5 cuando paused con transition 0.3s. Sin padding ni decoración.
- **Compact mode:** inline sin padding; full mode: bloque con `:` separadores visibles.
- **Estados:** running (opacity 1), paused (opacity 0.5), initial-00:00:00 (idle, sin destacar).

### Waiting Row

- **Shape:** card glass, `border-radius: 16px`, padding `0.65rem 0.7rem`.
- **Background:** `rgba(255,255,255,0.06)` con `backdrop-filter: blur(12px)`.
- **Border:** `rgba(255,255,255,0.14)`.
- **Shadow:** `0 8px 24px rgba(0,0,0,0.28)` en reposo; `0 10px 28px rgba(0,0,0,0.32)` + translateY(-2px) en hover.
- **Layout interno:** grid 3 columnas `40px 1fr auto`: avatar 40×40, nombre (con ellipsis), grupo de acciones.
- **Action buttons:** 18×18 svg, fondo `rgba(255,255,255,0.06)`, `border-radius: 10px`. Sit-btn hover = verde; delete-btn hover = rojo.

### Status Badge (generalizado)

- **Shape:** pill (`border-radius: 999px`), padding 4×10, font 13px / 600.
- **OK:** fondo verde `#38b000` + texto blanco + icono check.
- **Danger:** fondo rojo `#e63946` + texto blanco + icono X.
- **Warning:** fondo amarillo `#ffd60a` + texto canvas + icono reloj.
- **Mesa activa:** badge gold `#d9b66f` con texto "EN JUEGO".
- **Mesa en espera:** badge gris `rgba(255,255,255,0.16)` con texto "EN PAUSA".
- **Mesa cerrada:** badge rojo con texto "CERRADA".

### Add Player CTA

- **Shape:** card dashed, `border-radius: 16px`, padding `0.9rem 1rem`, borde 1px dashed `rgba(212,175,55,0.65)`.
- **Background:** gradiente vertical `rgba(255,255,255,0.10)→0.04` sobre `rgba(212,175,55,0.12)`.
- **Text:** brand-gold-light `#fdd835` 700, letter-spacing 0.2px.
- **Hover:** translateY(-1px) + box-shadow `0 6px 18px rgba(212,175,55,0.18)`.

### Inputs

- **Style:** stroke `rgba(255,255,255,0.14)`, fondo `rgba(255,255,255,0.05)`, `border-radius: 12px`, padding `0.72rem 0.8rem`.
- **Focus:** border `rgba(255,255,255,0.25)` + `box-shadow: 0 0 0 3px rgba(255,215,102,0.25)` (focus ring gold suave).
- **Placeholder:** `rgba(255,255,255,0.45)`.
- **Disabled:** opacity 0.65, cursor not-allowed.

### Buttons (gestor)

- **Primary Action (Rebuy):** gradiente `#57c34a→#34a038`, padding 12×16, radius 12, font 700. Hover = `filter: brightness(1.05)`.
- **Ghost / Cancel:** fondo `rgba(255,255,255,0.06)`, borde `rgba(255,255,255,0.12)`, texto `#e9e9e9` 700.
- **Danger:** mismo radius, fondo rojo, padding 12×16. Solo para acciones destructivas irreversibles.

### Navigation (Side Panel + Bottom Dock)

- **Side panel:** glass translúcido en lobby, panel sólido `#0d0f12` en gestor. Anclado a la izquierda en desktop, drawer en mobile.
- **Bottom dock (lobby):** row de iconos 48×48 con etiqueta debajo. Item activo tiene fondo gold-tint y label en brand-gold.
- **Touch targets:** 44×44px mínimo en cualquier botón de navegación.

## 6. Do's and Don'ts

### Do

- **Do** mantener el gold en ≤ 10% de cualquier superficie operativa. Si un panel tiene más de un acento dorado activo, simplificar.
- **Do** usar borde lateral de 3-4px para indicar estado de mesa (activa = gold, en espera = transparente, cerrada = rojo).
- **Do** usar `font-variant-numeric: tabular-nums` en timer, stack, contadores de jugadores, y cualquier cifra que cambie.
- **Do** combinar icono + texto + color en badges de estado. La redundancia es la accesibilidad.
- **Do** respetar `prefers-reduced-motion: reduce` desactivando animaciones de sheen, pulse, y transforms decorativos. Mantener solo cambios de estado.
- **Do** usar `border-radius` consistente dentro de cada registro: gestor en `12px`/`16px`, lobby en `18px`/`22px`. Mezclar radios en la misma vista rompe el lenguaje.
- **Do** aplicar focus visible 2px outline brand-gold en todo control interactivo. Sin focus, sin WCAG AA.
- **Do** anunciar errores críticos con `aria-live="assertive"` además del color. La sala es ruidosa.
- **Do** usar el glass del lobby para superficies flotantes (modal, drawer, popover). En el gestor, paneles sólidos `#0d0f12` siempre.

### Don't

- **Don't** usar glassmorphism decorativo en zonas operativas. Blur de fondo, paneles translúcidos, gradientes constantes — inutilizable bajo luz fluorescente de sala.
- **Don't** aplicar hero-metric templates (número grande + label pequeño). Reservado para marketing, no para operación.
- **Don't** crear grids de cards idénticas cuando los datos son heterogéneos. La mesa activa, en espera, y cerrada deben verse distintas, no idénticas con un color.
- **Don't** usar marketing buzzwords en copy: "empower", "seamless", "world-class", "next-generation". Cero tolerancia.
- **Don't** dejar skeleton loaders corriendo perpetuamente. Si algo tarda > 3s, mostrar mensaje de error explícito.
- **Don't** abrir modales bloqueantes para acciones no-críticas. "Sentar jugador" muestra feedback inline en la fila, no un modal.
- **Don't** depender exclusivamente del color para comunicar estado. Agrega siempre icono + texto.
- **Don't** aplicar hover-only affordances en zonas críticas. Touch y desktop comparten el mismo flujo.
- **Don't** usar sombra en superficies en reposo. Las sombras entran solo con hover, focus, o cambio de estado.
- **Don't** animar la decoración. Animación para confirmar/rechazar acción, no para brillar.
- **Don't** duplicar el oro. Hay un solo `brand-gold` canónico; las variantes `deep` y `light` son semánticas, no alias opcionales.
