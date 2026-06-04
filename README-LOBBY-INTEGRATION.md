# Integración del Lobby React dentro de **gestion-poker**

Este patch trae una carpeta `poker-lobby/` *lista* (React + Vite) conectada a Firestore
y apuntando al documento **`td3/currentTournament`** (igual que tu app actual).

## Pasos rápidos

1) Copia la carpeta **`poker-lobby/`** de este patch a la raíz de tu repo `gestion-poker/`.
2) Instala deps del subproyecto:
   ```bash
   npm --prefix poker-lobby i
   ```
3) Compila el root y el lobby React, y copia los assets a `dist/lobby` antes del deploy:
   ```bash
   # build root
   npm run build
   # build lobby (subproyecto)
   npm --prefix poker-lobby run build
   # copiar assets a dist/lobby
   node scripts/copy-lobby.mjs
   # ahora deploy de hosting
   firebase deploy --only hosting
   ```

> El script copia **poker-lobby/dist/** → **dist/lobby/** para servirlo en `/lobby`.

## Variables de entorno

El lobby React acepta **dos prefijos** de variables:
- `VITE_FIREBASE_*` **o** `VITE_FB_*` (compatibles con tu `.env` actual).  
  Ejemplo (`poker-lobby/.env.local`):
  ```
  VITE_FB_API_KEY=xxxxx
  VITE_FB_AUTH_DOMAIN=xxxxx.firebaseapp.com
  VITE_FB_PROJECT_ID=xxxxx
  VITE_FB_STORAGE_BUCKET=xxxxx.appspot.com
  VITE_FB_MESSAGING_SENDER_ID=0000000000
  VITE_FB_APP_ID=1:0000000000:web:xxxxxxxx
  # opcional para cambiar ruta:
  VITE_LOBBY_DOC=td3/currentTournament
  ```

## Rewrites de Firebase Hosting (opcional pero recomendado)

Asegúrate de tener un rewrite para que **/lobby/** entre al index del React:
```jsonc
{
  "hosting": {
    "public": "dist",
    "rewrites": [
      /* otras reglas */,
      { "source": "/lobby/**", "destination": "/lobby/index.html" }
    ]
  }
}
```

Si ya tienes un rewrite a `/lobby/` que apunta a `/index.html`, cámbialo a `/lobby/index.html`.

## Dev local del lobby

```bash
cd poker-lobby
npm run dev
```

¡Listo! Cualquier cambio que hagas en `poker-lobby/src/pages/Lobby.tsx` se refleja en el subproyecto.
