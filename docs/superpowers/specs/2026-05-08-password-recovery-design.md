# Especificación de Diseño: Recuperación de Contraseña

**Fecha**: 2026-05-08
**Estado**: En Revisión
**Autor**: Antigravity

## 1. Objetivo
Implementar una funcionalidad de recuperación de contraseña segura y profesional para la aplicación Skampa Poker, utilizando Firebase Authentication y manteniendo la estética premium "Black & Gold".

## 2. Experiencia de Usuario (UX)
- **Punto de Entrada**: Enlace "¿Olvidaste tu contraseña?" ubicado debajo del campo de password en el modal de inicio de sesión.
- **Flujo de Navegación**:
    1. El usuario hace clic en el enlace.
    2. El modal de login se oculta.
    3. Se muestra un modal dedicado de recuperación.
    4. El usuario ingresa su correo y solicita el enlace.
    5. Tras el éxito, se muestra un "Toast" de confirmación y se regresa automáticamente al login.
- **Feedback**: Notificaciones visuales (Toasts) para éxito y errores (ej. correo no registrado).

## 3. Componentes Técnicos

### 3.1 Servicios (Firebase)
Archivo: `src/services/config/firebaseConfig.js`
- Exportar `sendRecoveryEmail(email)`:
  ```javascript
  import { sendPasswordResetEmail } from 'firebase/auth';
  // ...
  export const sendRecoveryEmail = (email) => sendPasswordResetEmail(auth, email);
  ```

### 3.2 Interfaz de Usuario (UI)
- **`src/ui/login-modal.js`**:
    - Actualizar HTML para incluir el enlace.
    - Manejar el evento click para disparar el flujo de recuperación.
- **`src/ui/recovery-modal.js`** (Nuevo):
    - Estructura HTML con icono, descripción, input de email y botones de acción.
    - Animaciones de entrada (`modalScaleIn`).
    - Lógica de envío y manejo de estados.
- **`src/ui/toast.js`** (Nuevo):
    - Función `showToast(message, type = 'success')`.
    - Estilos integrados para no depender de librerías externas.

## 4. Estética y Estilos
- **Fondo**: Glassmorphism con `backdrop-filter: blur(20px)`.
- **Colores**: Acentos en oro (#d4af37) y blanco sobre fondo oscuro (#0f0f14).
- **Tipografía**: SF Pro Text / Cormorant Garamond para títulos.

## 5. Casos de Borde y Errores
- **Email inválido**: Mostrar error en el modal antes de enviar a Firebase.
- **Usuario no encontrado**: Firebase no suele revelar si un email existe por seguridad, pero se mostrará un mensaje genérico de éxito para evitar enumeración de usuarios.
- **Cierre manual**: El botón "Volver" debe restaurar el estado del modal de login.

## 6. Plan de Pruebas
1. Verificar que el enlace en el login abre el modal correcto.
2. Probar el botón "Volver" para asegurar que el login regresa sin errores.
3. Simular un envío exitoso y verificar la aparición del Toast.
4. Verificar la recepción del correo de Firebase (en entorno de desarrollo).
