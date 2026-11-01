# Fitness Tracker — especificación funcional

**Versión:** 0.4.0  
**Fecha de rutina inicial:** 1 de noviembre de 2026  
**Plataformas:** Safari iPhone 7/iOS 15 y PC  
**Persistencia:** local-only  
**Email:** compartido explícitamente desde el dispositivo, sin backend

## 1. Objetivo

Registrar cada entrenamiento de fuerza y cada salida de running, conservar el historial en el navegador, facilitar la revisión de técnica mediante GIFs y exportar los metadatos para Excel y análisis asistido por IA.

## 2. Decisiones de producto

| Decisión | Implementación |
|---|---|
| Estética | Dark mode |
| Plataformas | iPhone y PC |
| Registro | Rápido: carga, repeticiones y RIR |
| Descansos | Sin temporizador; se controlan con reloj personal |
| Nube | Eliminada |
| Persistencia | IndexedDB + localStorage de respaldo |
| Transferencia | Exportar/importar archivos; sin sincronización automática |
| Email | `mailto:` con resumen legible y JSON literal completo en formato compacto en el cuerpo |
| Archivo IA | JSON estructurado |
| Archivo Excel | CSV UTF-8 con BOM y separador `;` |
| Técnica | GIF remoto plegable por ejercicio |

## 3. Calendario

- Domingo: running recreativo, 30–40 minutos, 5–8 km, ritmo conversacional/Zona 2.
- Lunes: Torso A.
- Martes: Pierna A + abdomen.
- Miércoles: descanso.
- Jueves: Torso B.
- Viernes: Pierna B + abdomen.
- Sábado: descanso total.

## 4. Rutina precargada

### Lunes — Torso A

| Ejercicio | Series | Reps | RIR | Referencia |
|---|---:|---:|---:|---|
| Press inclinado Smith o mancuernas 30° | 3 | 8–10 | 1–2 | 20 kg c/u o 40 kg totales Smith |
| Jalón al pecho prono medio | 3 | 8–10 | 1–2 | 80 lb ≈ 36.3 kg |
| Elevaciones laterales mancuernas | 3 | 12–15 | 1 | 7.5 kg c/u |
| Remo máquina o mancuerna unilateral | 3 | 10–12 | 1–2 | 22.5 kg c/u como referencia |
| Curl inclinado | 3 | 10–12 | 1 | 10 kg c/u |
| Extensión tríceps polea | 3 | 10–12 | 1 | 20 kg o más, ajustar |

Calentamiento: movilidad dinámica de hombros/escápulas y dos aproximaciones del press inclinado (50% × 10, 75% × 5). Enfriamiento: estiramientos suaves de pectoral y dorsal.

### Martes — Pierna A + abdomen

| Ejercicio | Series | Reps | RIR | Referencia |
|---|---:|---:|---:|---|
| Sentadilla Smith | 3 | 8–10 | 2 | 70 lb en discos + barra Smith |
| Prensa 45° pies bajos/cercanos | 3 | 10–12 | 1–2 | 80 kg en discos + trineo |
| Curl femoral sentado o tumbado | 3 | 10–12 | 1 | 30 kg |
| Crunch abdominal en polea alta | 3 | 12–15 | 1 | Carga moderada |
| Elevación pantorrillas de pie | 3 | 10–12 | 1 | Ajustar |

Calentamiento: movilidad de cadera/tobillo, sentadillas sin peso y aproximaciones Smith. Indicaciones: flexión real de tronco en crunch; pausa de 1 s abajo en pantorrillas.

### Jueves — Torso B

| Ejercicio | Series | Reps | RIR | Referencia |
|---|---:|---:|---:|---|
| Jalón neutro estrecho | 3 | 8–10 | 1–2 | 110 lb ≈ 49.9 kg |
| Press pecho máquina | 3 | 8–10 | 1–2 | 40 kg o más, ajustar |
| Elevaciones laterales polea baja | 3 | 12–15 | 1 | Ajustar |
| Pájaros máquina o mancuernas | 3 | 12–15 | 1 | 7.5 kg c/u |
| Press francés barra EZ | 3 | 10–12 | 1 | 15 kg añadidos + barra |
| Curl martillo | 3 | 10–12 | 1 | 12.5 kg c/u |

Calentamiento: movilidad/rotaciones y dos aproximaciones del jalón. Enfriamiento: estiramientos suaves de pectoral y tríceps.

### Viernes — Pierna B + abdomen

| Ejercicio | Series | Reps | RIR | Referencia |
|---|---:|---:|---:|---|
| Peso muerto rumano | 3 | 8–10 | 2 | 30 kg añadidos + barra |
| Zancadas o prensa con pies altos | 3 | 10–12 | 1–2 | 12.5 kg c/u si zancadas |
| Extensión cuádriceps | 3 | 12–15 | 1 | Ajustar |
| Elevación rodillas colgado | 3 | 10–15 | 1 | Peso corporal |
| Pantorrillas sentado | 3 | 12–15 | 1 | 90 lb ≈ 40.8 kg |

Calentamiento: movilidad de cadera, bisagra sin peso y dos aproximaciones de peso muerto rumano. En elevación de rodillas, terminar con retroversión pélvica. Enfriamiento: isquiotibiales, glúteos y zona lumbar.

## 5. Requisitos funcionales

### Inicio

- Mostrar la actividad correspondiente al día actual.
- Mostrar el calendario de siete días a partir de hoy.
- Mostrar sesiones terminadas, series acumuladas y días de fuerza.
- Acceso a respaldo JSON e importación.

### Entrenamiento

- Iniciar una de las cuatro rutinas.
- Mostrar prescripción, carga sugerida, GIF, nota y cue técnico por ejercicio.
- Registrar cada serie con carga, repeticiones y RIR.
- Prellenar el peso de referencia cuando exista, permitiendo editarlo.
- Permitir series adicionales.
- Guardar al confirmar cada serie.
- Recuperar última ejecución del mismo ejercicio.
- Mantener sesión abierta al recargar/cerrar la pestaña.
- No incorporar temporizador de descanso.
- Finalizar sesión y mostrar acciones de exportar/compartir.

### Running y mediciones

- Registrar fecha, distancia, duración, FC media, RPE y notas.
- Registrar peso, cintura, horas de sueño y notas.

### Historial y progreso

- Consultar sesiones anteriores, series y RIR.
- Consultar el conteo de series directas por músculo principal.
- Mostrar progresión orientativa por ejercicio mediante Epley, indicando que no es 1RM medido.

### Exportaciones

- JSON completo de respaldo, con metadatos de exportación y versión de esquema.
- CSV de todas las series completadas, con datos de sesión, plan, ejercicio, músculo, prescripción, carga, repeticiones, RIR, marca temporal y URL de demo.
- Markdown para revisión humana/IA.
- Importar JSON con validación y confirmación explícita.

### Compartir por correo

- Al finalizar una sesión de fuerza o guardar un registro de running, abrir un borrador `mailto:` dirigido a `salgado.eust@gmail.com`.
- El asunto identifica la aplicación, el tipo/nombre de sesión y la fecha.
- El cuerpo incluye un encabezado legible con destinatario, título, fecha, aplicación/versión, tipo de registro, fecha de exportación, zona horaria, idioma, versión de esquema, ID y etiquetas.
- Añade un resumen de la sesión y el JSON completo, válido y en formato compacto, literalmente en el cuerpo del correo.
- No se adjuntan archivos ni se requiere descarga para enviar una sesión individual.
- El usuario revisa el contenido y confirma el envío en su aplicación de correo; no existe envío automático.
- El cuerpo termina con el marcador `FIN DEL JSON` para detectar posibles truncamientos del cliente de correo o del navegador.
- Si el contenido es muy extenso, se advierte al usuario. Los límites de longitud de `mailto:` dependen de la plataforma y no están estandarizados.
- El CSV del historial completo sigue disponible para Excel; JSON completo y Markdown siguen disponibles como exportaciones manuales.

## 6. Modelo de datos

Estado principal:

```json
{
  "schemaVersion": 3,
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "plans": [],
  "sessions": [],
  "metrics": [],
  "runs": [],
  "activityNotes": []
}
```

Cada sesión conserva una copia de la prescripción al momento de iniciarse. Cada serie conserva `weight`, `reps`, `rir`, `done`, `type` y `savedAt`. Los registros históricos no se modifican al actualizar la rutina futura.

## 7. Arquitectura

```text
GitHub Pages / static HTTPS hosting
              |
              v
Safari iPhone / Desktop browser
              |
       app.js + styles.css
              |
      IndexedDB (primary)
              |
      localStorage (fallback)
              |
   Export JSON / CSV / Markdown
              |
 mailto con resumen y JSON literal en el cuerpo
```

No hay backend, autenticación, base de datos remota, correo automatizado ni sync.

## 8. Requisitos no funcionales

- JavaScript vanilla para mantener la app ligera y compatible con Safari iOS 15.
- Interfaz mobile-first y controles táctiles amplios.
- Guardado inmediato de series.
- Aplicación usable sin conexión después de la primera carga; los GIFs remotos requieren internet.
- Mensaje claro de que los datos pertenecen al navegador/dispositivo actual.
- Recordatorio de exportar respaldo con regularidad.

## 9. Riesgos y limitaciones

1. **Sin sincronización:** iPhone y PC tendrán historiales independientes hasta que se exporte/importa un archivo.
2. **Almacenamiento del navegador:** puede ser borrado por el usuario, por limpieza del sistema o por políticas del navegador. El JSON descargado es la copia portátil.
3. **Email:** `mailto:` abre un borrador, pero nunca envía automáticamente. Algunos navegadores/clientes pueden limitar o truncar cuerpos largos; verificar el marcador `FIN DEL JSON` antes de enviar.
4. **GIFs externos:** los GIFs se enlazan desde ExerciseGymGifsDB. Su README dice que los derechos pertenecen a autores respectivos y que el repositorio no los licencia. No se copian al repositorio; se requiere conexión y revisar derechos antes de redistribuir la app.
5. **Unidades:** carga de mancuernas, discos añadidos, barra Smith y trineo no son intercambiables. Se conservan instrucciones por ejercicio para que el registro sea consistente.

## 10. Pruebas de aceptación

- La rutina de noviembre se ve en orden correcto.
- Domingo permite registrar running; miércoles y sábado aparecen como descanso.
- Cada ejercicio muestra su demo GIF plegable.
- Una serie guardada persiste después de recargar.
- Sesión se puede reabrir si se cierra la app a mitad.
- Finalizar presenta resumen y opciones de correo.
- El archivo JSON contiene todos los metadatos y series completadas.
- CSV puede abrirse en Excel.
- Importar JSON restaura historial, rutina, carreras y mediciones.
- El menú Compartir o el fallback mailto funciona sin backend.
