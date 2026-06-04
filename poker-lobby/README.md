# Skampa • Poker Lobby (React + Vite)

Listo para migrar el Lobby a React de forma gradual.

## 🔌 Datos en tiempo real
Lee un documento de Firestore por defecto en `lobby/current` (configurable con `VITE_LOBBY_DOC`).  
Estructura sugerida del documento:

```json
{
  "tournamentName": "Liga Turbo Skampa • 40K GTZ NLHE",
  "level": 3,
  "smallBlind": 200,
  "bigBlind": 400,
  "ante": 400,
  "entries": 22,
  "rebuys": 7,
  "playersRemaining": 19,
  "avgStack": 24500,
  "clockSeconds": 865,
  "nextSmallBlind": 300,
  "nextBigBlind": 600,
  "nextAnte": 600,
  "lastUpdated": 1728000000000
}
```

> Si Firebase no está configurado, el UI entra en modo **DEMO** para que puedas ver el diseño y validar el flujo.

## ⚙️ Variables de entorno
Crea un archivo `.env` (o `.env.local`) en la raíz:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# opcional:
VITE_LOBBY_DOC=lobby/current
```

## ▶️ Scripts
- `npm i`
- `npm run dev` (http://localhost:5173)
- `npm run build`

## 🧩 Migración gradual
- Este repo solo monta el **Lobby** (`src/pages/Lobby.tsx`) y componentes de UI de **glass**.
- Los estilos no usan SCSS para evitar deprecaciones. Puedes añadir Tailwind luego, si lo prefieres.
- El **reloj** baja localmente cada segundo, pero si escribes `clockSeconds` en Firestore se ajusta al valor remoto inmediatamente.

## 🧪 Conexión TTD3 → Firestore (sugerencia)
Desde TTD3 exporta los tokens hacia un pequeño script (AutoHotkey, Node o cualquier bridge) que haga `updateDoc()` al doc `lobby/current` con los campos de arriba. Una vez que hagas *update*, la UI reacciona al instante.
