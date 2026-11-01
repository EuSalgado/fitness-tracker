# Fitness Tracker — local-only PWA

**Versión:** 0.4.0  
**Diseñada para:** Safari en iPhone 7/iOS 15 y navegadores de escritorio.  
**Publicación:** GitHub Pages o cualquier hosting estático HTTPS.  
**Persistencia:** únicamente el navegador local; no usa backend ni nube.

## Qué incluye

- Interfaz oscura y adaptable a iPhone y PC.
- Calendario semanal: domingo running, lunes Torso A, martes Pierna A, miércoles descanso, jueves Torso B, viernes Pierna B y sábado descanso.
- Rutina precargada con los ejercicios, series, rangos de repeticiones, RIR, cargas de referencia e indicaciones entregadas por el usuario.
- Registro rápido por serie: carga, repeticiones y RIR.
- Guardado local automático mediante IndexedDB, con respaldo de compatibilidad en localStorage.
- Recuperación de la última sesión por ejercicio.
- GIF de demostración plegable por ejercicio (requiere conexión a internet).
- Historial de sesiones completadas.
- Registro de peso, cintura, sueño y running.
- Panel de volumen directo, progresión estimada y mediciones.
- Exportación completa JSON, CSV de series y Markdown.
- Al finalizar una sesión de fuerza o guardar una carrera, botón para abrir un borrador `mailto:` dirigido a `salgado.eust@gmail.com`, con resumen legible y JSON completo incluido literalmente en el cuerpo del correo.
- Importar un JSON de respaldo.
- PWA instalable y caché offline del shell de la aplicación.

## Importante: dónde se guardan los datos

Todos los registros quedan en el navegador y dispositivo donde se introducen. **No existe sincronización automática entre iPhone y PC.** Publicar el código en GitHub no publica ni sincroniza los datos guardados en IndexedDB/localStorage.

Para conservar el historial:

1. Descarga un respaldo JSON periódicamente desde Inicio o Progreso.
2. Guarda el archivo en tu PC (y, preferiblemente, una segunda copia).
3. Para migrar a otro navegador/dispositivo, abre Fitness Tracker e importa ese JSON.

El almacenamiento del navegador puede borrarse al limpiar datos del sitio, restablecer el teléfono o por políticas del sistema. No utilices la app sin respaldos si el historial es importante.

## Cómo funciona el envío por correo

La aplicación no tiene servidor de correo y no puede enviar mensajes automáticamente. El botón **Abrir correo con resumen + JSON** construye un enlace `mailto:` con:

- Destinatario: `salgado.eust@gmail.com`.
- Asunto con el nombre de la rutina y la fecha.
- Resumen legible: título, fecha, aplicación y versión, tipo de registro, fecha de exportación, zona horaria, idioma, versión del esquema, identificador, etiquetas, duración, ejercicios y series (o métricas de running).
- El JSON completo, válido y en formato compacto, incluido literalmente en el cuerpo del mensaje. No se requiere adjuntar ningún archivo.

El borrador se abre en la aplicación de correo configurada en el dispositivo. **Debes revisar y pulsar Enviar manualmente.** La aplicación web no puede enviar el correo por sí sola.

Los enlaces `mailto:` no tienen un límite de longitud uniforme: el navegador, el sistema operativo o el cliente de correo pueden truncar cuerpos extensos. Por eso el mensaje incluye el número de caracteres del JSON y el marcador `FIN DEL JSON`. Antes de enviar, comprueba que el marcador final aparezca después de la última llave del objeto JSON. Si no aparece, no envíes ese borrador; utiliza la exportación de respaldo desde la aplicación y comparte el archivo por el método que prefieras.

El mismo flujo se utiliza para los registros de running. El CSV general sigue disponible para analizar todas las series en Excel; el JSON de correo está optimizado para el análisis de una sesión concreta con IA.

## Ejecutar en tu PC

Puedes usar Live Server en VS Code. Para abrirlo también desde el iPhone en la misma Wi-Fi, usa la IP local del PC, no `127.0.0.1`.

Para un servidor local sencillo:

```bash
python -m http.server 8080
```

Abre `http://localhost:8080` en el PC. En el iPhone, `http://<IP-LOCAL-DEL-PC>:8080`.

La instalación PWA y el Service Worker requieren HTTPS o un contexto seguro. Para probar la instalación completa usa la publicación HTTPS. El botón de correo utiliza `mailto:` y abre la app de correo configurada en el dispositivo.

## Publicar en GitHub Pages (gratis)

1. Crea un repositorio en GitHub. Si quieres que otras personas no puedan ver el código, configúralo como privado; comprueba las condiciones vigentes de GitHub Pages para repositorios privados de tu plan.
2. Sube el contenido de esta carpeta a la raíz del repositorio.
3. En GitHub abre **Settings → Pages**.
4. En **Build and deployment**, selecciona **Deploy from a branch**.
5. Selecciona `main` y la carpeta `/ (root)`, guarda y espera el despliegue.
6. Abre la URL HTTPS que GitHub Pages asigna al proyecto en Safari.
7. En Safari: **Compartir → Añadir a pantalla de inicio**.

Cada `git push` que afecte a la rama publicada actualiza la aplicación. El historial local guardado en el iPhone permanece en el almacenamiento del navegador, no en GitHub.

## GIFs de ejercicios y atribución

Los GIFs se enlazan desde el CDN de [ExerciseGymGifsDB](https://github.com/JahelCuadrado/ExerciseGymGifsDB), que organiza material de terceros. Su README indica expresamente que los GIFs pertenecen a sus respectivos autores y que el repositorio no concede derechos sobre ellos. No se descargan ni se copian al repositorio Fitness Tracker; se muestran como enlaces remotos de demostración. El uso puede requerir revisar los derechos del material original antes de redistribuir o publicar la app para terceros.

Los GIFs necesitan conexión a internet. Los registros de entrenamiento funcionan sin conexión una vez cargada la aplicación.

## Compatibilidad y pruebas

Antes de confiar en el registro a largo plazo, prueba en Safari del iPhone:

1. Inicia un entrenamiento y guarda una serie.
2. Cierra y vuelve a abrir la app; comprueba que la serie sigue registrada.
3. Prueba iniciar una sesión, bloquear el teléfono y reabrirla.
4. Descarga un JSON de respaldo.
5. En un entorno de prueba, importa el JSON y comprueba que recupera sesiones, series, mediciones y carreras.
6. Termina una sesión y pulsa **Abrir correo con resumen + JSON**. Comprueba destinatario, asunto, resumen, JSON completo y el marcador final `FIN DEL JSON` antes de pulsar Enviar.

## Notas sobre las cargas

Las cargas precargadas son referencias, no objetivos obligatorios. Algunas se expresan como carga por mancuerna, discos añadidos o carga de la torre. La etiqueta de cada ejercicio indica cómo interpretar el dato. Para máquinas Smith y prensas, registra de forma consistente el criterio elegido; el peso efectivo de barras contrapesadas y trineos puede variar entre equipos.

## Estructura

- `index.html`: estructura principal.
- `styles.css`: interfaz y estilos responsive.
- `app.js`: rutina, registro, almacenamiento local, exportación y correo.
- `service-worker.js`: caché del shell PWA.
- `manifest.webmanifest`: instalación como PWA.
- `assets/`: iconos.
