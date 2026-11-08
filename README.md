# Stargym - Plataforma de Gestión Fitness

Este proyecto es una aplicación web completa para la gestión de gimnasios, que incluye autenticación, pagos con PayPal y Binance Pay, y gestión de perfiles de usuario.

## 🛡️ Configuración de Seguridad

Para proteger la información sensible, este proyecto utiliza variables de entorno. **Nunca subas el archivo `.env` al repositorio.**

### Requisitos Previos

1. Node.js instalado.
2. Una instancia de MongoDB (Local o Atlas).
3. Cuenta PayPal Business y cuenta Binance Pay Merchant para habilitar pagos reales.

### Pasos para configurar el entorno:

1.  **Clona el repositorio.**
2.  **Instala las dependencias:**
    ```bash
    npm install
    ```
3.  **Configura tus credenciales:**
    *   Copia el archivo `.env.example` y cámbiale el nombre a `.env`.
    *   Abre el archivo `.env` y rellena los valores con tus propias claves y URLs de conexión.

### Variables Críticas

*   `MONGODB_URI`: Tu cadena de conexión a la base de datos.
*   `JWT_SECRET`: Secreto aleatorio de al menos 32 caracteres para firmar los tokens de sesión. El servidor no inicia si falta o es demasiado corto. Puedes generar uno con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
*   `PAYPAL_ENV`, `PAYPAL_CLIENT_ID` y `PAYPAL_CLIENT_SECRET`: credenciales de una aplicación REST de PayPal. Usa `sandbox` para probar y `live` para producción.
*   `BINANCE_PAY_API_KEY` y `BINANCE_PAY_SECRET`: credenciales API de Binance Pay Merchant. La API Key se envía en el encabezado `BinancePay-Certificate-SN`; no hace falta configurar una variable aparte para el Certificate SN.

Los planes y las recargas se cobran en USD. Cada compra de membresía cubre un mes y se debe renovar manualmente; no hay cargos recurrentes automáticos.

Para configurar PayPal, crea una aplicación REST en el panel de desarrolladores, copia el Client ID y Secret de Sandbox en `.env` y prueba el flujo. Para producción, usa las credenciales Live y configura `APP_BASE_URL` con el dominio HTTPS real.

Para Binance Pay, habilita una cuenta Merchant y genera las credenciales API de Binance Pay. Guarda la API Key en `BINANCE_PAY_API_KEY` y la Secret Key en `BINANCE_PAY_SECRET`; la API Key se usa como Certificate SN al firmar solicitudes. El servidor envía como notificación la ruta `https://tu-dominio/api/payments/binance/webhook`; el dominio debe ser público y aceptar HTTPS para que Binance pueda notificar los pagos. Binance Pay y PayPal se comunican desde el servidor; nunca publiques esas credenciales en el navegador.

La aplicación solo acredita recargas o activa membresías después de consultar y confirmar el estado y el importe con el proveedor. En local puedes abrir la aplicación en `http://localhost:3000`; para pagos públicos y pruebas externas se necesita una URL accesible y HTTPS.

### Verificación de correo al registrarse

Al crear una cuenta, Stargym envía un código de seis dígitos por correo. La persona debe introducirlo en `verify.html` para activar la cuenta; el código vence en 10 minutos y se permiten cinco intentos.

Configura estas variables SMTP en `.env` antes de iniciar el servidor:

*   `SMTP_HOST`, `SMTP_PORT` y `SMTP_SECURE`: datos del servidor de correo. Para Gmail puedes usar `smtp.gmail.com`, puerto `465` y `SMTP_SECURE=true` (o puerto `587` y `false`).
*   `SMTP_USER` y `SMTP_PASS`: credenciales SMTP. En Gmail utiliza una contraseña de aplicación, no la contraseña normal.
*   `FROM_EMAIL`: remitente autorizado, por ejemplo `Stargym <tu-correo@gmail.com>`.
*   `APP_BASE_URL`: URL pública de Stargym en producción; en local, `http://localhost:3000`.

Si SMTP no está configurado o falla el envío, no se activa la cuenta. Puedes copiar `.env.example` a `.env`, reemplazar los valores de ejemplo por los tuyos y reiniciar el servidor. No compartas ni subas `.env`.

## 🚀 Ejecución

Para iniciar el servidor en modo desarrollo:

```bash
node server.js
```

El servidor estará disponible en `http://localhost:3000` (o el puerto que hayas definido).

## Sesiones y área privada

- La landing (`/` o `index.html`) mantiene visible la oferta pública y adapta la navegación según la sesión.
- El dashboard (`dashboard.html`), el perfil (`profile.html`) y el checkout (`checkout.html`) requieren sesión. Las rutas `/mi-perfil` y `/rutinas` llevan a sus páginas privadas correspondientes.
- El panel `/admin` utiliza el inicio de sesión normal y solo permite operaciones administrativas a la cuenta verificada cuyo correo coincide con `ADMIN_EMAIL`. Desde allí se pueden consultar y editar usuarios, administrar membresías, revisar pagos y cartera, registrar ajustes de saldo con motivo y eliminar cuentas con confirmación por correo. Configura `ADMIN_EMAIL` en `.env` con el correo de tu cuenta administradora; no uses una cuenta sin verificar.
- Al iniciar sesión tras intentar abrir una página privada, el usuario vuelve a esa página.
- Cerrar sesión elimina la sesión del navegador y revoca el token actual en el servidor; las rutas privadas de API también rechazan tokens revocados.
- La notificación y el cierre por inactividad se comparten entre la landing, el dashboard, el perfil y el checkout. Tras un minuto sin actividad, el navegador muestra una notificación; al hacer clic se mantiene la sesión. Si las notificaciones están bloqueadas o no disponibles, se muestra un aviso dentro de la página. La sesión se cierra 15 segundos después del aviso si no hay actividad.
- Las páginas públicas y privadas adaptan su navegación, formularios y cuadrículas a móviles, tablets y pantallas de escritorio.# Stargym
# Stargym
