# Product

## Register

mixto

(Primary surface: `product` for the staff-facing Gestor de Mesas; secondary brand surface: `poker-lobby/` for the public-facing lobby. The two registers coexist; PRODUCT.md carries the project-level default of `mixto` so per-page work can pick the right register.)

## Users

**Primary**: staff de sala (dealers, pit bosses, gerentes).

- Sala oscura, ambiente ruidoso, mucha luz artificial.
- Operan rápido en touch (tablets en mesa) y desktop (oficina del pit).
- Necesitan densidad de información sin clutter visual.
- Mirada ocasional lejos de la pantalla (anunciar manos, hablar con jugadores).
- Turnos largos, repetición constante, baja tolerancia a fricción.

**Secondary**: jugadores en self-service (lista de espera, lobby público) y administradores remotos que monitorean desde celular/tablet.

El job-to-be-done central del staff es: *abrir/cerrar mesa, mover jugadores entre lista de espera y asientos, registrar compras y retiros, y dejar la mesa lista para la siguiente mano, todo sin perder el ritmo de la sala*.

## Product Purpose

`gestion-poker` (Experience Poker Room) es la herramienta operativa de un poker room real:

- Gestionar mesas activas (abrir, cerrar, ajustar límites, registrar sesiones con timer).
- Coordinar la lista de espera general y la asignación de asientos.
- Procesar la operación por mano: registrar jugadores, ausencias temporales, cashouts, recompras, addons.
- Cerrar mesa con métricas (rake, propinas, jackpot, RPH, ocupación) y exportar a Google Sheets.
- Exhibir el estado en pantallas de mirror (display) en la sala.
- Publicar el lobby público (subproyecto `poker-lobby/`) con mesas activas para jugadores.
- Recibir datos de torneos en vivo vía TD3 (publisher) y estructura CSV.

El éxito se mide por: cero errores que dupliquen asientos, cierres de mesa correctos sin manipulación manual posterior, y un sub-3-segundo tiempo entre acción del dealer y persistencia en pantalla.

## Brand Personality

Voz: precisa, operativa, sin floritura. La herramienta desaparece detrás de la operación.

Tono: como un dealer senior. Confianza silenciosa, no performance.

Personalidad en 3 palabras: **operativa, sobria, presente**.

Referentes nombrados (con el específico que sirve):
- **Linear** (no por sus animaciones, sino por densidad de información y jerarquía tipográfica sobria): la app nunca compite con la acción.
- **Stripe Dashboard** (no por marca, sino por manejo de estados críticos en UI: success/error/loading con tratamiento diferenciable).
- **Bloomberg Terminal** como anti-referencia útil: denso pero no oscuro, no estiliza el sufrimiento del operador.

## Anti-references

Lo que esta app NO debe parecerse:

- **SaaaaS con glassmorphism decorativo**: blurs de fondo, fondos translúcidos, todo gradient. Inutilizable en una tablet bajo luz fluorescente.
- **Hero-metric template**: un número grande con label pequeño + supporting stats. Reservado para marketing, no para operación.
- **Identical card grids**: misma card repetida N veces. La operación tiene naturalmente heterogeneidad (mesa activa vs en espera vs cerrada) y debe verse así.
- **Marketing buzzwords en copy**: "empower", "seamless", "world-class". Cero tolerancia.
- **Skeleton placeholders infinitos**: el staff necesita saber si algo falló, no un spinner perpetuo.
- **Modales bloqueantes para acciones no-críticas**: una confirmación para sentarse un jugador debe ser inline, no un modal.

## Design Principles

1. **La operación manda sobre la estética.** Si un cambio mejora la velocidad de uso en sala pero afecta la simetría del dashboard, gana el cambio operativo.
2. **Densidad legible, no densidad maximalista.** Información al alcance de un vistazo, no en una sola pantalla porque sí. Tipografía y peso hacen el trabajo que en otros sitios hacen los colores.
3. **El estado de la mesa se lee en menos de 1 segundo.** Activa/en espera/cerrada se distingue por acento lateral, badge, y contexto. Nunca solo por color.
4. **Confirmaciones inline, no modales.** Un click en "sentar" muestra feedback inmediato en la fila. Solo confirmación modal para acciones destructivas irreversibles (eliminar mesa, cashout grande).
5. **Touch y desktop con el mismo flujo.** Botones targets ≥ 44×44px. Sin hover-only affordances en zonas críticas.
6. **Reducir motion al mínimo operacional.** Animación para confirmar/rechazar acción, no para decorar. Respetar `prefers-reduced-motion: reduce`.
7. **El glass y los gradientes se reservan para el lobby público.** El gestor es un terminal operativo: paneles sólidos, contraste alto, tipografía que manda.

## Accessibility & Inclusion

- **WCAG 2.1 AA** como línea base obligatoria.
- Contraste de texto: ≥ 4.5:1 contra fondo. Texto grande (≥ 18px o bold 14px): ≥ 3:1.
- Focus visible en todos los controles interactivos (outline 2px sólido en el accent color del tema).
- `prefers-reduced-motion: reduce` desactiva animaciones de motion library, mantiene solo cambios de estado.
- Sin dependencia exclusiva de color: badges de estado llevan icono + texto además del color.
- Todos los inputs tienen label visible (no solo placeholder).
- La sala es ruidosa: errores visuales + auditivos. Errores críticos deben anunciarse (aria-live="assertive").
- La sala tiene luz variable: el tema oscuro es el principal, pero los textos críticos deben pasar AA en ambos temas.
