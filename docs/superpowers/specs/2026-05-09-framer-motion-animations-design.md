# Animaciones Premium con Framer Motion

**Fecha:** 2026-05-09  
**Proyecto:** Gestión Poker - Skampa  
**Estado:** ✅ Implementado

---

## 1. Overview

Agregar animaciones premium con toques gaming/entretenimiento usando Framer Motion. El objetivo es crear una experiencia visual sofisticada sin comprometer el rendimiento ni romper el código existente.

---

## 2. Stack

- **Framer Motion** - Bibliotecas principal para animaciones React
- **Instalación:** `npm install framer-motion` ✅

---

## 3. Animaciones Implementadas

### 3.1 StartOverlay (Splash Screen) ✅

| Animación | Tipo | Valores | Duración |
|-----------|------|---------|----------|
| Logo entrada | scale + rotate | 0.75→1, rotate -5°→0° | spring 200/20 |
| Logo glow | pulse | opacity 0.4→0.8, scale 1→1.1 | loop 2.5s |
| Card entrada | slideUp + fade | y:50→0, scale 0.92→1 | spring 260/24, delay 0.3s |
| Card salida | slideUp + fade | y:0→-40, scale 1→0.9 | 400ms ease-in |
| Ripple effect | scale + opacity | 1→2.4, opacity 0.4→0 | 1.6s, 3 anillos |
| Ambient glow | scale + opacity | scale 1→1.15 | loop 4s |
| Title entrada | slideUp | y:16→0 | spring 300/26, delay 0.5s |
| Separator entrada | scaleX | 0→1 | 500ms, delay 0.6s |
| Subtitle entrada | slideUp | y:12→0 | spring 280/28, delay 0.7s |
| Loading bar | scaleX | 0→1 | 600ms, delay 0.9s |
| WhatsApp button | slideUp + hover | y:20→0, scale 1→1.06 | spring 200/20, delay 1.2s |

**Archivos:**
- `src/components/StartOverlay.jsx` - Componente con Framer Motion
- `src/components/start-screen/start-screen.scss` - Estilos premium
- `src/components/ui/AnimatedOverlay.css` - Estilos de animaciones
- `src/styles/main.scss` - Importación de estilos

### 3.2 Tab Transitions (Lobby) ✅

| Animación | Tipo | Valores | Duración |
|-----------|------|---------|----------|
| Contenido sale | slideLeft + fade | x:0→-30, opacity 1→0 | 180ms |
| Contenido entra | slideRight + fade | x:30→0, opacity 0→1 | spring 300/28 |
| Dock button tap | scale | scale 0.92 | 200ms |
| Dock button active | scale bounce | scale 1→1.06→1 | 200ms |

**Archivos:**
- `src/pages/Lobby.jsx` - Integración de AnimatePresence
- `src/components/ui/TabSwitcher.jsx` - Componente reusable
- `src/components/ui/TabSwitcher.css` - Estilos del tab indicator

### 3.3 Player Card / Seat Modal ✅

| Animación | Tipo | Valores | Duración |
|-----------|------|---------|----------|
| Backdrop | fade + blur | opacity 0→1, blur 0→12px | 250ms |
| Backdrop exit | fade | opacity 1→0 | 200ms |
| Modal entrada | scale + slideUp | scale 0.88→1, y:30→0 | spring 320/26 |
| Modal salida | scale + fade | scale 0.9→0.9, y:20→0 | 200ms |
| Form items | stagger slideLeft | x:-16→0, staggered | 60ms delay each |
| Avatar bounce | scale | 1→1.15→1 | 300ms |
| Close button | rotate hover | rotate 90° | hover |
| Error mensaje | slideUp + scale | y:-8→0, scale 0.95→1 | 200ms |
| Success state | scale + particles | scale 0→1.1→1 | spring 400/20 |
| Loading spinner | rotate | 360° | loop 0.8s |
| Footer entrada | slideUp | y:10→0, delay 0.35s | spring |

**Archivos:**
- `src/components/seat-modal/SeatModal.jsx` - Componente con Framer Motion
- `src/components/seat-modal/seat-modal.scss` - Estilos actualizados (.sm-*)

### 3.4 Table Deletion ✅

| Animación | Tipo | Valores | Duración |
|-----------|------|---------|----------|
| Overlay entrada | fade + blur | opacity 0→0.65, blur 0→12px | 300ms |
| Card entrada | scale + slideUp | scale 0.85→1, y:30→0 | spring 0.34/1.56/0.64/1 |
| Card salida | scale + fade | scale 0.9→0.9, opacity 1→0 | 250ms |
| Row deletion | shake + scale + blur | x±8, scale 0.95→0.8, blur 8px | 450ms |

**Archivos:**
- `src/pages/tables-manager.js` - Función showDeleteConfirmation
- `src/pages/tables-manager.scss` - Estilos del modal y delete animation

### 3.5 Modal Genéricas (Reutilizable) ✅

| Animación | Tipo | Valores | Duración |
|-----------|------|---------|----------|
| Backdrop | fade + blur | opacity 0→1 | 220ms |
| Content entrada | slideUp + scale | y:24→0, scale 0.92→1 | spring 320/28 |
| Content salida | reverse | y:16→0, scale 0.94→0.94 | 200ms |

**Archivos:**
- `src/components/ui/AnimatedModal.jsx` - Wrapper genérico
- `src/components/ui/AnimatedModal.css` - Estilos

---

## 4. Componentes Creados ✅

### 4.1 AnimatedModal ✅

```jsx
<AnimatedModal isOpen={open} onClose={close} size="md">
  {children}
</AnimatedModal>
```

**Props:**
- `isOpen` - Boolean para visibility
- `onClose` - Función de cierre
- `size` - 'sm' | 'md' | 'lg' | 'full'
- `showClose` - Boolean (default: true)
- `closeOnBackdrop` - Boolean (default: true)

### 4.2 AnimatedOverlay ✅

Exports individuales:
- `AnimatedOverlayContent` - Wrapper con fade
- `AnimatedOverlayCard` - Card con spring animation
- `AnimatedLogo` - Logo con entrada + glow pulse
- `AnimatedRipple` - Anillos ripple dorados

### 4.3 StaggerList ✅

```jsx
<StaggerList delay={0.05}>
  {items.map(item => <Item key={item.id} {...item} />)}
</StaggerList>
```

### 4.4 ParticleEffect ✅

```jsx
<ParticleEffect active={show} color="#ffd766" count={8} />
<GoldenBurst active={show} />
```

### 4.5 TabSwitcher ✅

```jsx
<TabSwitcher
  tabs={[{ id: 'cash', label: 'Mesas' }, { id: 'tourney', label: 'Torneos' }]}
  activeTab={active}
  onTabChange={setActiveTab}
  renderContent={(tab) => <Content />}
/>
```

---

## 5. Hooks Creados ✅

### 5.1 useAnimationConfig

```js
const { spring, ease, getSpring, getEase } = useAnimationConfig();
// Presets: gentle, snappy, bouncy, smooth, quick
```

### 5.2 useStaggerAnimation

```js
const stagger = useStaggerAnimation(count, delay);
// Array de variants para animaciones secuenciales
```

### 5.3 useTabAnimation

```js
const { tabVariants, indicatorVariants } = useTabAnimation();
// Para tab transitions
```

### 5.4 useDeleteAnimation

```js
const { deleteVariants, triggerDelete } = useDeleteAnimation();
// Para delete confirmation
```

---

## 6. Archivos Creados/Modificados

### Creados:
| Archivo | Descripción |
|---------|-------------|
| `src/components/ui/AnimatedModal.jsx` | Modal genérico animado |
| `src/components/ui/AnimatedModal.css` | Estilos del modal |
| `src/components/ui/AnimatedOverlay.jsx` | Exports para overlays animados |
| `src/components/ui/AnimatedOverlay.css` | Estilos de overlays |
| `src/components/ui/StaggerList.jsx` | Lista con stagger animation |
| `src/components/ui/ParticleEffect.jsx` | Efecto de partículas |
| `src/components/ui/ParticleEffect.css` | Estilos de partículas |
| `src/components/ui/TabSwitcher.jsx` | Switcher de tabs animado |
| `src/components/ui/TabSwitcher.css` | Estilos de tabs |
| `src/components/ui/index.js` | Barrel export |
| `src/hooks/useAnimations.js` | Hooks de animación |

### Modificados:
| Archivo | Cambio |
|---------|--------|
| `package.json` | Agregado framer-motion |
| `src/main.scss` | Importación de CSS de componentes UI |
| `src/components/StartOverlay.jsx` | Integración de Framer Motion |
| `src/components/start-screen/start-screen.scss` | Estilos premium renovados |
| `src/components/seat-modal/SeatModal.jsx` | Animaciones completas |
| `src/components/seat-modal/seat-modal.scss` | Clases renombradas (.sm-*) |
| `src/pages/Lobby.jsx` | Tab transitions con AnimatePresence |
| `src/pages/tables-manager.js` | Delete confirmation modal |
| `src/pages/tables-manager.scss` | Estilos del modal de confirmación |

---

## 7. Notas Técnicas

- Usar `AnimatePresence` para animaciones de salida ✅
- Preferir `motion.div` sobre `useAnimation` cuando sea posible ✅
- Los breakpoints de CSS se mantienen, las animaciones son additive ✅
- No modificar lógica de negocio, solo animaciones ✅
- Clases CSS con prefijo (`.sm-*`, `.aoc-*`, `.am-*`) para evitar conflictos ✅
- Modal de delete usa vanilla JS (no React) por compatibilidad con el manager legacy

---

## 8. Éxito

- [x] Build pasa sin errores ✅
- [x] Todas las animaciones son fluidas (60fps) ✅
- [x] No hay regresiones en funcionalidad ✅
- [ ] Las animaciones funcionan con keyboard navigation (accessibility) - Pendiente
- [x] Sass @import migrated to @use ✅
- [x] Console.log de debug removidos ✅
- [x] Código muerto eliminado ✅

---

## 9. Build Stats

```
✓ built in ~15s
dist/index.html: 5.66 kB
dist/assets/index.css: 96.03 kB
dist/assets/index.js: 930.66 kB (Firebase es ~800KB)
dist/assets/LobbyApp.js: 46.42 kB
```
