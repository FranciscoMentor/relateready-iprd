# RelateReady — IPRD

Aplicación web del test RelateReady (Índice de Preparación para Relaciones Duraderas — IPRD).
Test bilingüe (ES/EN), motor de puntuación en JavaScript, preview gratuito, e
Informe Extendido en PDF con 5 secciones generadas por IA (Claude). Replica el
patrón técnico de Adamantine SQ Personal (Node/Express + SQLite + pdfkit + Anthropic).

## Estado de este MVP

- ✅ Test completo (viñetas, 48 ítems núcleo, 6 de deseabilidad social, 3 cualitativos), bilingüe.
- ✅ Motor de puntuación (índices 0-100, bandas, protocolo de derivación) — probado.
- ✅ Informe Extendido en PDF con radar, texto fijo por dimensión, y las 5 secciones de IA — probado. (El preview gratuito se quitó de la interfaz a propósito, para no dar el contenido completo sin pagar; la ruta sigue existiendo en el backend por si se necesita más adelante.)
- ✅ Panel admin simple en `/admin` (usuario/clave por variables de entorno).
- ✅ **Pago real con Payphone** (botón de pago por redirección): se activa solo al configurar `PAYPHONE_TOKEN` y `PAYPHONE_STORE_ID`. Sin esas variables, el pago queda simulado automáticamente. Ver "Activar Payphone" más abajo.
- ✅ **Precio y códigos de acceso gratuito configurables sin tocar código** — ver "Cambiar el precio o dar acceso gratuito" más abajo.
- ⚠️ **IA en modo simulado si no configuras `ANTHROPIC_API_KEY`**: sin esa variable, las 5 secciones de IA muestran un texto de marcador de posición en vez de contenido real — el resto del informe (texto fijo validado, radar, tablas) funciona igual.

## Cómo desplegar esto en Render (paso a paso)

### 1. Sube este código a GitHub

Ya tienes Git GUI instalado. Desde esta misma carpeta:

1. Abre Git GUI (o tu terminal) en esta carpeta (`relateready-app`).
2. Si es un repositorio nuevo:
   ```
   git init
   git add .
   git commit -m "RelateReady IPRD — versión inicial"
   ```
3. Crea un repositorio vacío en GitHub (por ejemplo `relateready-iprd`), **sin** README ni .gitignore (ya los trae este proyecto).
4. Conecta y sube:
   ```
   git remote add origin https://github.com/TU-USUARIO/relateready-iprd.git
   git branch -M main
   git push -u origin main
   ```

### 2. Crea el servicio en Render

1. Entra a [render.com](https://render.com) con tu cuenta (o crea una — es gratis para empezar).
2. Click **New +** → **Blueprint**.
3. Conecta tu cuenta de GitHub si no lo has hecho, y selecciona el repositorio `relateready-iprd`.
4. Render va a detectar automáticamente el archivo `render.yaml` de este proyecto y va a proponer crear el servicio web `relateready-iprd` con un disco persistente de 1GB para la base de datos. Click **Apply**.
5. Render va a pedirte completar las variables de entorno marcadas como secretas (`sync: false` en `render.yaml`). Complétalas en el dashboard del servicio, en **Environment**:
   - `ANTHROPIC_API_KEY` — tu clave de la API de Anthropic (para que las 5 secciones de IA se generen de verdad). Si la dejas vacía, el sitio funciona igual pero esas secciones muestran texto de ejemplo.
   - `ADMIN_USER` y `ADMIN_PASSWORD` — usuario y clave para entrar a `/admin`. Cámbialos por algo tuyo, no dejes los valores de ejemplo.
   - `PAYPHONE_TOKEN` y `PAYPHONE_STORE_ID` — déjalos vacíos por ahora (pago simulado). Ver sección "Activar Payphone" más abajo.
6. Click **Deploy**. La primera build tarda unos minutos (instala dependencias, incluida `better-sqlite3`, que compila un módulo nativo — es normal que tarde un poco más que otros proyectos Node).
7. Cuando termine, Render te da una URL pública (algo como `https://relateready-iprd.onrender.com`). Ábrela y prueba el flujo completo tú mismo antes de compartirla.

### 3. Verifica que funciona

- Completa el test tú mismo de principio a fin.
- Descarga el preview gratuito.
- Usa el botón de pago (simulado) y descarga el Informe Extendido.
- Entra a `https://TU-URL/admin` con el usuario/clave que configuraste, y confirma que tu envío de prueba aparece en la lista.

## Activar Payphone (pago real)

La integración real ya está implementada (método "Botón de pago por redirección" de Payphone, flujo Prepare + Confirm — ver `services/payphone.js`). Mientras `PAYPHONE_TOKEN` y `PAYPHONE_STORE_ID` estén vacíos en Render, el pago queda simulado automáticamente; en cuanto ambas variables tengan valor, `PAYPHONE_ENABLED` pasa a `true` solo y el sitio empieza a cobrar de verdad — no hace falta tocar código.

Para activarlo:

1. Crea (o usa) una aplicación en el [portal de desarrolladores de Payphone](https://appdeveloper.payphonetodoesposible.com), con el dominio real de tu sitio (con `https://`) como "Dominio web" y "Url de respuesta".
2. En la pestaña **Credenciales** de esa aplicación, copia el **Token** (es el valor de `PAYPHONE_TOKEN`).
3. Copia el **Store ID** desde el popup **Listado de tiendas** (un identificador tipo UUID, no el "Identificador" de la pestaña Detalles — es el valor de `PAYPHONE_STORE_ID`).
4. Configura esas dos variables en Render (Environment del servicio web) y guarda — Render redepliega automáticamente.
5. Haz una prueba real (invita a un "Probador" desde el portal de Payphone si tu aplicación sigue en modo Prueba) antes de cambiar el switch de la aplicación a Producción.

Cómo funciona el flujo, en resumen: al hacer clic en "Pagar", el backend prepara la transacción con Payphone y abre una pestaña nueva con la pasarela de pago. Al terminar, Payphone redirige esa pestaña de vuelta a tu sitio con los parámetros de la transacción; el frontend los detecta, confirma el pago con el backend, y muestra el enlace de descarga del Informe Extendido. Si por algún motivo la pestaña se cierra antes de redirigir, la persona puede volver a la pestaña original y usar el botón "Ya pagué — verificar".

## Cambiar el precio o dar acceso gratuito (sin tocar código)

Ambas cosas se controlan desde Render → tu servicio → **Environment**, agregando o editando estas dos variables. Guardar cualquiera de las dos hace que Render redepliegue solo (tarda uno o dos minutos, sin necesidad de tocar GitHub ni el código).

**Cambiar el precio del Informe Extendido:**

- Variable `EXTENDED_PRICE_CENTS`, en centavos de dólar. Por ejemplo, `1999` = $19.99, `2999` = $29.99.
- Si la dejas sin configurar, usa el valor por defecto ($24.99).
- El precio se actualiza automáticamente en el botón de pago, en el monto que se le cobra a Payphone, y en el panel admin.

**Dar acceso gratuito a un panel de personas (beta testers):**

- Variable `FREE_ACCESS_CODES`, con uno o varios códigos separados por coma. Ejemplo: `PANEL2026` o `PANEL2026,BETA-ADAMANTINE` (mayúsculas/minúsculas no importan).
- En la pantalla de resultados, debajo del botón de pago, aparece un enlace "¿Tienes un código de acceso gratuito?" — quien escriba ahí uno de esos códigos desbloquea el Informe Extendido sin pagar.
- El mismo código lo puede usar cualquier cantidad de personas (no es de un solo uso) — pensado para repartirlo a todo un panel de prueba.
- Si dejas `FREE_ACCESS_CODES` vacío o sin configurar, esa opción simplemente no deja canjear nada (nadie puede colarse).
- Puedes cambiar o quitar los códigos en cualquier momento desde Environment, sin redeploy manual.

## Desarrollo local (opcional, para probar cambios antes de subirlos)

Requiere Node 18 o superior instalado en tu PC.

```
npm install
copy .env.example .env       (en Windows; en Mac/Linux: cp .env.example .env)
npm start
```

Abre `http://localhost:3000` en tu navegador.

## Estructura del proyecto

```
server.js                  — arranque de Express
db/init.js                 — SQLite (better-sqlite3), tabla submissions
data/                       — dimensiones, ítems, viñetas, contextos de intake, contenido interpretativo fijo
services/scoring.js         — motor de puntuación (JS puro, sin IA)
services/aiAnalysis.js      — las 5 secciones generadas por Claude
services/pdfGenerator.js    — preview y extendido en PDF (pdfkit)
services/payphone.js        — pago (simulado / listo para conectar real)
routes/api.js                — /api/meta, /api/submit, /api/report/*, /api/payment/*
routes/admin.js              — panel /admin (básico) + API JSON de /panel-control
views/panel.html              — panel de control completo (KPIs, resultados, calendario)
public/                      — frontend (HTML/CSS/JS puro, bilingüe)
render.yaml                  — blueprint de despliegue en Render
```

## Panel de control (`/admin` y `/panel-control`)

Desde 2026-08, el panel de administración usa sesión propia (`express-session`,
guardada en la misma base SQLite) en vez de HTTP Basic Auth — inicia sesión en
`/admin/login` con `ADMIN_USER` / `ADMIN_PASSWORD` (variables de entorno) y la
sesión dura 8 horas. Cambia también `SESSION_SECRET` antes de desplegar (ver
`.env.example`).

Hay dos vistas, con el mismo login:

- **`/admin`** — tabla básica de envíos, filtros, chips de seguimiento
  comercial, exportar CSV, marcar como pagado a mano.
- **`/panel-control`** — panel completo: tarjetas de KPI (conversión a informe
  pagado, envíos con protocolo de derivación activado, ingresos aproximados),
  pestaña Resultados con detalle por persona (contacto editable, las 8
  dimensiones con banda de color, respuestas cualitativas, seguimiento
  comercial), y pestaña Calendario con Outlook/Teams en vivo vía Microsoft
  Graph (MSAL, "public client", sin secretos en el backend — reutiliza el
  registro de Azure "Adamantine Panel Interno" ya creado para el panel de SQ
  Assessment). Antes de usar el calendario en producción, agrega la URL de
  RelateReady a las Redirect URIs de ese registro en Azure Portal — ver la
  nota en `.env.example`.

Los campos de correo y teléfono del test (opcionales) alimentan el
seguimiento comercial del panel — se agregaron a `submissions` con una
migración automática (`db/init.js`), segura de correr en cada arranque.

## Fuente del contenido

Todo el contenido (ítems, viñetas, texto interpretativo, prompts de IA, algoritmo
de puntuación, estructura del informe, precios) proviene directamente de los
documentos ya aprobados en `C:\Users\Francisco\Documents\Test IPRD`:
`IPRD_especificacion_tecnica.docx`, `IPRD_banco_de_items.xlsx`,
`IPRD_puntuacion_e_interpretacion.docx`, `IPRD_estructura_informe.docx`.
Si corriges algo en esos documentos, el código de este proyecto (especialmente
`data/items.js`, `data/reportContent.js` y `services/aiAnalysis.js`) debe
actualizarse a mano para que coincidan.
