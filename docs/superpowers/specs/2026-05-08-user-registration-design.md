# Especificación de Diseño: Registro de Usuarios con Email

**Fecha**: 2026-05-08
**Estado**: En Revisión
**Autor**: Antigravity

## 1. Objetivo
Habilitar el registro de nuevos usuarios utilizando cualquier proveedor de correo electrónico (Hotmail, Outlook, etc.) con validaciones de seguridad estrictas para las contraseñas, manteniendo la estética premium "Black & Gold".

## 2. Experiencia de Usuario (UX)
- **Acceso**: Enlace "¿No tienes una cuenta? Regístrate aquí" en la parte inferior del modal de Login.
- **Formulario de Registro**:
    - Campo: Nombre Completo (DisplayName).
    - Campo: Correo Electrónico.
    - Campo: Contraseña (con indicadores de requisitos).
    - Campo: Confirmar Contraseña.
- **Transición**: Desvanecimiento entre el modal de login y el de registro.
- **Éxito**: El usuario es logueado automáticamente tras el registro y redirigido a la aplicación.

## 3. Requisitos de Seguridad (Contraseña)
Se implementará una validación personalizada que bloquee el registro si la contraseña no cumple con:
- Mínimo **8 caracteres**.
- Al menos una **mayúscula**.
- Al menos una **minúscula**.
- Al menos un **símbolo** (ej. !@#$%^&*).

## 4. Componentes Técnicos

### 4.1 Servicios (Firebase)
Archivo: `src/services/config/firebaseConfig.js`
- Exportar `registerUser(email, password, displayName)`:
  ```javascript
  import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
  // ...
  export const registerUser = async (email, password, displayName) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    return cred;
  };
  ```

### 4.2 Interfaz de Usuario (UI)
- **`src/ui/signup-modal.js`** (Nuevo):
    - Implementación del formulario con validación en tiempo real de los requisitos de contraseña.
    - Uso de `showToast` para errores de Firebase (ej. email ya en uso).
- **`src/ui/login-modal.js`**:
    - Añadir el enlace de registro y el manejador para cerrar login/abrir signup.

## 5. Casos de Borde y Errores
- **Email ya registrado**: Mostrar error "Este correo ya está en uso".
- **Contraseña débil**: El botón de registro permanecerá deshabilitado o mostrará error si no cumple los requisitos 8/A/a/#.
- **Contraseñas no coinciden**: Validación visual antes de enviar el formulario.

## 6. Plan de Pruebas
1. Intentar registrar un usuario con un email de Hotmail/Outlook.
2. Verificar que la validación de 8 caracteres y símbolos funcione correctamente.
3. Confirmar que el `displayName` se guarde correctamente en el perfil de Firebase.
4. Asegurar que tras el registro se redirija correctamente al área protegida.
