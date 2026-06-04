---
name: code-review
description: Revisar el proyecto en busca de errores, código muerto, imports sin usar y problemas de calidad
---

# Code Review - Gestión Poker

## Overview

Revisión sistemática del código para encontrar errores, código sin usar y problemas de calidad.

## Pasos de Revisión

### 1. Errores Comunes en React/Vite

**Verificar:**
- `console.log`残留 (quitar en producción)
- `var` en lugar de `const`/`let`
- Imports no utilizados
- Variables declaradas pero nunca usadas
- Props no usadas en componentes
- State actualizado correctamente (usar función si depende de estado previo)
- Memory leaks en `useEffect` (cleanup functions faltantes)
- Dependencies arrays incompletas en `useEffect`/`useCallback`

### 2. Imports Sin Usar

Ejecutar ESLint para detectar:
```bash
npm run lint
```

**Errores comunes:**
- Importar `useEffect` pero no usar cleanup
- Importar funciones de Firebase pero no usarlas
- Imports de `lucide-react` sin usar los iconos

### 3. Código Muerto (Dead Code)

**Buscar patrones:**
```
// Archivos duplicados:
- src/pages/lobby.js vs src/pages/Lobby.jsx
- src/pages/Lobby.jsx vs src/pages/LobbyApp.jsx
- src/components/seat-modal/SeatModal.jsx vs seat-modal.js
- src/TableApp.jsx vs src/LobbyApp.jsx

// Código comentado:
grep -r "// " src/ --include="*.jsx" --include="*.js"
grep -r "/\* " src/ --include="*.jsx" --include="*.js"
```

**Funciones no llamadas:**
- Buscar funciones exportadas que no se importan en ningún otro archivo
- Verificar si `utils/` tiene funciones huérfanas

### 4. Problemas de Firebase

**Verificar:**
- `.env` no está en git (debe estar en `.gitignore`)
- Credenciales hardcodeadas
- Reglas de Firestore loosas en producción
- Storage rules excesivamente permisivas

```bash
# Verificar que .env está en .gitignore
cat .gitignore | grep -E "^\.env$"
```

### 5. Performance Issues

**Revisar:**
- `useEffect` sin dependencias `[]` que hacen fetch en cada render
- Callbacks inline en JSX (crear funciones fuera o usar `useCallback`)
- imágenes sin `loading="lazy"`
- Datos grandes serializados en state

### 6. Build y Type Errors

```bash
npm run build 2>&1 | head -50
```

**Verificar output:**
- Warnings de módulos no encontrados
- Deprecations
- Errores de tipado

### 7. Estructura de Archivos

**Verificar duplicados suspects:**
- `src/LobbyApp.jsx` y `src/LobbyApp.jsx` (¿son el mismo?)
- `src/pages/LobbyApp.jsx` vs `src/LobbyApp.jsx`
- `src/TableApp.jsx` vs otros archivos de app

## Checklist de Salida

| Categoría | Item | Estado |
|----------|------|--------|
| **Errores** | console.log residuales | ⬜ |
| | Memory leaks | ⬜ |
| | Imports sin usar | ⬜ |
| **Código Muerto** | Funciones no llamadas | ⬜ |
| | Archivos duplicados | ⬜ |
| | Código comentado | ⬜ |
| **Firebase** | Credenciales seguras | ⬜ |
| | Variables de entorno | ⬜ |
| **Performance** | useEffect dependencies | ⬜ |
| | Callbacks inline | ⬜ |
| **Build** | Sin errores | ⬜ |
| | Sin warnings críticos | ⬜ |

## Reglas de Firebase (No Modificar Directamente)

Este proyecto usa Firebase Realtime Database + Firestore. Las credenciales NUNCA deben commitearse.

## Archivos Clave a Revisar

- `src/services/firebase/` - Servicios de Firebase
- `src/hooks/` - Custom hooks
- `src/components/` - Componentes React
- `src/utils/` - Utilidades
- `src/pages/` - Páginas

## Referencias

- Reglas de React: usar `vercel-react-best-practices`
- Debugging: usar `systematic-debugging` para bugs específicos
