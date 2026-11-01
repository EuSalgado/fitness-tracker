/* Fitness Tracker · Local-only edition
 * All personal workout data remains in this browser (IndexedDB + localStorage fallback).
 * No cloud, account, tracking service, or server-side email is used.
 */
(function () {
  'use strict';

  var APP_NAME = 'Fitness Tracker';
  var APP_VERSION = '0.4.0';
  var OWNER_EMAIL = 'salgado.eust@gmail.com';
  var DB_NAME = 'fitness-tracker-db';
  var DB_STORE = 'app';
  var DB_KEY = 'main-state';
  var DB_FALLBACK_KEY = 'fitness-tracker-local-v2';
  var GIF_BASE = 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/';
  var state = null;
  var currentView = 'inicio';
  var selectedPlanId = null;
  var lastCompletedSessionId = null;
  var lastSavedRunId = null;
  var savePromise = Promise.resolve();
  var toastTimeout = null;

  var MUSCLES = {
    chest_upper: 'Pectoral clavicular', chest: 'Pectoral mayor', back_width: 'Dorsal ancho',
    back_thickness: 'Espalda media', shoulders: 'Deltoides lateral', rear_delts: 'Deltoides posterior',
    biceps: 'Bíceps', triceps: 'Tríceps', quads: 'Cuádriceps', hamstrings: 'Isquiotibiales',
    glutes: 'Glúteos', calves: 'Pantorrillas', abs: 'Recto abdominal'
  };

  function uid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function fmtDate(value) {
    if (!value) return '—';
    var d = new Date(value.length === 10 ? value + 'T12:00:00' : value);
    return d.toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }
  function fmtDateLong(value) {
    if (!value) return '—';
    var d = new Date(value.length === 10 ? value + 'T12:00:00' : value);
    return d.toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }
  function fmtDateTime(value) {
    if (!value) return '—';
    return new Date(value).toLocaleString('es-CO', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  function formatPace(distanceKm, durationMin) {
    if (!distanceKm || !durationMin) return '—';
    var raw = durationMin / distanceKm;
    var mins = Math.floor(raw);
    var secs = Math.round((raw - mins) * 60);
    if (secs === 60) { mins += 1; secs = 0; }
    return mins + ':' + String(secs).padStart(2, '0');
  }
  function gif(slug) { return GIF_BASE + slug + '.gif'; }

  function exercise(id, name, muscle, sets, repMin, repMax, rirText, targetRir, loadSuggestion, defaultKg, weightUnit, gifPath, note, tip) {
    return {
      id: id, name: name, muscle: muscle, sets: sets, repMin: repMin, repMax: repMax,
      rirText: rirText, rir: targetRir, loadSuggestion: loadSuggestion || 'Ajustar según rendimiento',
      defaultKg: defaultKg === null ? '' : defaultKg, weightUnit: weightUnit || 'kg',
      gifUrl: gifPath ? gif(gifPath) : '', note: note || '', tip: tip || ''
    };
  }

  function defaultPlans() {
    var now = new Date().toISOString();
    return [
      {
        id: 'torso-a', name: 'Torso A', day: 'Lunes', weekday: 1, focus: 'Pecho superior · dorsal · deltoides lateral', updatedAt: now,
        warmup: '7 min: movilidad dinámica de hombros y escápulas. Press inclinado: 2 series de aproximación (50% × 10 y 75% × 5).',
        workNotes: 'En el curl inclinado, permite que los brazos se extiendan sin perder el control del hombro. En las elevaciones laterales, trabaja en el plano escapular, ligeramente hacia delante.',
        cooldown: '5 min: estiramiento de pectoral en marco de puerta y dorsal sujetando un poste, 30 s por lado.',
        exercises: [
          exercise('incline-press', 'Press inclinado (Smith o mancuernas, 30°)', 'chest_upper', 3, 8, 10, '1–2', 1.5, '20 kg por mancuerna o 40 kg totales en Smith', 20, 'kg por mancuerna / registra carga total en Smith', 'pectorals/dumbbell-incline-palm-in-press', 'Alternativa: Smith o mancuernas. Ajusta el banco aproximadamente a 30°.', 'Mantén escápulas estables, muñecas alineadas y baja hasta un rango cómodo sin perder control.'),
          exercise('lat-pulldown-pronated', 'Jalón al pecho prono (agarre medio)', 'back_width', 3, 8, 10, '1–2', 1.5, '80 lb ≈ 36.3 kg', 36.3, 'kg en la torre', 'lats/cable-pulldown-pro-lat-bar', '', 'Lleva los codos hacia abajo; evita tirar detrás de la nuca o balancear el tronco.'),
          exercise('db-lateral-raise', 'Elevaciones laterales con mancuernas', 'shoulders', 3, 12, 15, '1', 1, '7.5 kg por mancuerna', 7.5, 'kg por mancuerna', 'delts/dumbbell-lateral-raise', 'Trabaja en el plano escapular, con los brazos ligeramente adelantados.', 'Eleva sin impulso y detén el recorrido antes de que el trapecio domine el movimiento.'),
          exercise('row-unilateral', 'Remo (máquina o mancuerna unilateral)', 'back_thickness', 3, 10, 12, '1–2', 1.5, '22.5 kg por mancuerna como referencia', 22.5, 'kg por mancuerna', 'upper-back/lever-one-arm-bent-over-row', 'El GIF muestra un remo unilateral en máquina; la variante con mancuerna es equivalente en patrón.', 'Evita rotar el tronco; dirige el codo hacia la cadera o costillas según la trayectoria.'),
          exercise('incline-curl', 'Curl de bíceps en banco inclinado', 'biceps', 3, 10, 12, '1', 1, '10 kg por mancuerna', 10, 'kg por mancuerna', 'biceps/dumbbell-incline-biceps-curl', 'Deja que el brazo se extienda completamente hasta donde el hombro permanezca cómodo.', 'Mantén el brazo detrás del torso y evita adelantar el codo al subir.'),
          exercise('triceps-pushdown', 'Extensión de tríceps en polea (barra o cuerda)', 'triceps', 3, 10, 12, '1', 1, '20 kg o más; ajustar', 20, 'kg en la torre', 'triceps/cable-triceps-pushdown-v-bar', '', 'Mantén los codos cerca del tronco y extiende sin mover los hombros.')
        ]
      },
      {
        id: 'pierna-a', name: 'Pierna A + abdomen', day: 'Martes', weekday: 2, focus: 'Énfasis en cuádriceps', updatedAt: now,
        warmup: '7 min: movilidad de cadera y tobillos, sentadillas con peso corporal y 2 series de aproximación para Smith.',
        workNotes: 'En el crunch en polea, realiza flexión real de la columna (enrolla el torso), no solo flexión de cadera. En pantorrillas, pausa 1 segundo abajo en el estiramiento controlado.',
        cooldown: '5 min: estiramiento suave de cuádriceps e isquiotibiales.',
        exercises: [
          exercise('smith-squat', 'Sentadilla en máquina Smith', 'quads', 3, 8, 10, '2', 2, '70 lb en discos + barra Smith', 31.8, 'kg en discos (barra Smith aparte)', 'glutes/smith-squat', 'La carga de la barra Smith varía según la máquina. Registra por separado los discos si desconoces el peso efectivo de la barra.', 'Pies en una posición que permita profundidad cómoda; rodillas siguen la dirección de los pies.'),
          exercise('leg-press', 'Prensa de piernas (pies bajos y relativamente juntos)', 'quads', 3, 10, 12, '1–2', 1.5, '80 kg en discos + trineo', 80, 'kg en discos (trineo aparte)', 'glutes/sled-45-leg-press', '', 'Desciende hasta donde mantengas la pelvis apoyada y no bloquees agresivamente las rodillas.'),
          exercise('leg-curl-seated', 'Curl femoral sentado o tumbado', 'hamstrings', 3, 10, 12, '1', 1, '30 kg como referencia', 30, 'kg en máquina', 'hamstrings/lever-seated-leg-curl', 'GIF de curl femoral sentado; también puedes realizarlo tumbado si esa máquina está disponible.', 'Ajusta el eje de la máquina a la rodilla y controla la vuelta.'),
          exercise('cable-crunch', 'Crunch abdominal en polea alta', 'abs', 3, 12, 15, '1', 1, 'Carga moderada; ajustar', '', 'kg en la torre', 'abs/cable-kneeling-crunch', 'No conviertas el movimiento en una bisagra de cadera.', 'Flexiona el tronco acercando costillas y pelvis; evita tirar solamente con los brazos.'),
          exercise('standing-calf', 'Elevación de pantorrillas de pie', 'calves', 3, 10, 12, '1', 1, 'Carga moderada; ajustar', '', 'kg en máquina', 'calves/barbell-standing-calf-raise', 'GIF de elevación de talones de pie con barra; úsalo como referencia del recorrido si empleas máquina.', 'Alcanza dorsiflexión controlada y sube hasta la máxima elevación sin rebotar.')
        ]
      },
      {
        id: 'torso-b', name: 'Torso B', day: 'Jueves', weekday: 4, focus: 'Espalda alta · deltoides posterior · brazos', updatedAt: now,
        warmup: '7 min: movilidad y rotaciones articulares. Jalón neutro: 2 series de aproximación progresivas.',
        workNotes: 'En las elevaciones laterales en polea, coloca el cable según la comodidad del hombro; puedes pasar el cable delante o detrás del cuerpo.',
        cooldown: '5 min: estiramiento suave de pectoral y tríceps por encima de la cabeza.',
        exercises: [
          exercise('lat-pulldown-neutral', 'Jalón al pecho (agarre neutro estrecho)', 'back_width', 3, 8, 10, '1–2', 1.5, '110 lb ≈ 49.9 kg', 49.9, 'kg en la torre', 'lats/cable-pulldown-with-v-bar', '', 'Mantén el pecho estable y lleva los codos hacia abajo sin convertirlo en un remo.'),
          exercise('machine-chest-press', 'Press de pecho en máquina', 'chest', 3, 8, 10, '1–2', 1.5, '40 kg o más; ajustar', 40, 'kg en máquina', 'pectorals/lever-standing-chest-press', 'El GIF muestra una variante de press de pecho en máquina; ajusta asiento y agarres a tu máquina.', 'Alinea las empuñaduras con la zona media del pecho y evita despegar la espalda del respaldo.'),
          exercise('cable-lateral-raise', 'Elevaciones laterales en polea baja', 'shoulders', 3, 12, 15, '1', 1, 'Ajustar polea', '', 'kg en la torre', 'delts/cable-lateral-raise', '', 'Mantén tensión continua sin inclinarte para generar impulso.'),
          exercise('reverse-fly', 'Pájaros (máquina o mancuernas)', 'rear_delts', 3, 12, 15, '1', 1, '7.5 kg por mancuerna como referencia', 7.5, 'kg por mancuerna', 'delts/lever-seated-reverse-fly', 'GIF de apertura inversa en máquina; también puedes usar mancuernas.', 'Abre los brazos sin encoger los hombros ni exagerar la retracción escapular.'),
          exercise('skull-crusher', 'Press francés con barra EZ', 'triceps', 3, 10, 12, '1', 1, '15 kg añadidos + barra EZ', 15, 'kg añadidos (barra aparte)', 'triceps/barbell-lying-triceps-extension', 'Registra los discos añadidos; el peso de la barra EZ depende del modelo.', 'Mantén los brazos relativamente estables y flexiona los codos con control.'),
          exercise('hammer-curl', 'Curl martillo con mancuernas', 'biceps', 3, 10, 12, '1', 1, '12.5 kg por mancuerna', 12.5, 'kg por mancuerna', 'biceps/dumbbell-hammer-curl-v-2', '', 'Mantén agarre neutro, muñecas rectas y evita balancear el tronco.')
        ]
      },
      {
        id: 'pierna-b', name: 'Pierna B + abdomen', day: 'Viernes', weekday: 5, focus: 'Énfasis en cadena posterior', updatedAt: now,
        warmup: '7 min: movilidad de cadera y bisagra de cadera sin peso. Haz 2 series de aproximación para el peso muerto rumano.',
        workNotes: 'En la elevación de rodillas, termina cada repetición con retroversión pélvica: lleva la pelvis hacia arriba para que el abdomen participe activamente.',
        cooldown: '5 min: estiramientos suaves de isquiotibiales, glúteos y zona lumbar.',
        exercises: [
          exercise('romanian-deadlift', 'Peso muerto rumano (barra, Smith o mancuernas)', 'hamstrings', 3, 8, 10, '2', 2, '30 kg añadidos (15 kg por lado) + barra', 30, 'kg añadidos (barra aparte)', 'glutes/barbell-romanian-deadlift', 'Prioriza la variante con la que mantengas mejor control y trayectoria.', 'Empuja la cadera atrás, conserva una ligera flexión de rodilla y detén el descenso cuando ya no puedas mantener la columna estable.'),
          exercise('lunges', 'Zancadas con mancuernas o prensa (pies altos)', 'glutes', 3, 10, 12, '1–2', 1.5, '12.5 kg por mancuerna si eliges zancadas', 12.5, 'kg por mancuerna', 'glutes/dumbbell-rear-lunge', 'GIF de zancada posterior con mancuernas. Si eliges prensa, registra la carga de discos.', 'Mantén equilibrio, paso suficientemente largo y rodilla alineada con el pie.'),
          exercise('leg-extension', 'Extensión de cuádriceps en máquina', 'quads', 3, 12, 15, '1', 1, 'Carga moderada; ajustar', '', 'kg en máquina', 'quads/lever-leg-extension', '', 'Ajusta el eje con la articulación de la rodilla y evita impulso al extender.'),
          exercise('hanging-knee-raise', 'Elevación de rodillas colgado', 'abs', 3, 10, 15, '1', 1, 'Peso corporal', 0, 'peso corporal', 'abs/assisted-hanging-knee-raise', 'El GIF muestra una variante asistida; utiliza la misma trayectoria sin asistencia si puedes mantener el control.', 'Evita balancearte y termina cada repetición con retroversión pélvica.'),
          exercise('seated-calf', 'Elevación de pantorrillas sentado', 'calves', 3, 12, 15, '1', 1, '90 lb ≈ 40.8 kg', 40.8, 'kg en máquina', 'calves/barbell-seated-calf-raise', 'GIF de elevación de talones sentado con barra; úsalo como referencia si tu máquina es diferente.', 'Mantén la rodilla flexionada, pausa abajo y completa el recorrido sin rebotes.')
        ]
      }
    ];
  }

  function freshState() {
    return {
      schemaVersion: 3, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      plans: defaultPlans(), sessions: [], metrics: [], runs: [], activityNotes: []
    };
  }

  function openDB() {
    return new Promise(function (resolve) {
      if (!window.indexedDB) return resolve(null);
      var request;
      try { request = indexedDB.open(DB_NAME, 3); } catch (e) { return resolve(null); }
      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { resolve(null); };
    });
  }
  var dbPromise = openDB();
  function dbGet() {
    return dbPromise.then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(DB_STORE, 'readonly');
          var req = tx.objectStore(DB_STORE).get(DB_KEY);
          req.onsuccess = function () { resolve(req.result || null); };
          req.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    });
  }
  function dbSet(value) {
    return dbPromise.then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(DB_STORE, 'readwrite');
          tx.objectStore(DB_STORE).put(value, DB_KEY);
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    });
  }
  function migrateState(stored) {
    if (!stored) return freshState();
    if (!Array.isArray(stored.sessions)) stored.sessions = [];
    if (!Array.isArray(stored.metrics)) stored.metrics = [];
    if (!Array.isArray(stored.runs)) stored.runs = [];
    if (!Array.isArray(stored.activityNotes)) stored.activityNotes = [];
    if (Number(stored.schemaVersion || 1) < 3) {
      // Preserve local history, but load the updated routine and email/export schema.
      stored.plans = defaultPlans();
      stored.schemaVersion = 3;
      stored.updatedAt = new Date().toISOString();
    }
    return stored;
  }
  function loadState() {
    return dbGet().then(function (stored) {
      if (stored) return migrateState(stored);
      try {
        var backup = localStorage.getItem(DB_FALLBACK_KEY) || localStorage.getItem(DB_KEY);
        if (backup) return migrateState(JSON.parse(backup));
      } catch (e) { /* Fresh state below. */ }
      return freshState();
    });
  }
  function persist() {
    state.updatedAt = new Date().toISOString();
    var snapshot = JSON.parse(JSON.stringify(state));
    savePromise = savePromise.then(function () {
      return dbSet(snapshot).then(function () {
        try {
          localStorage.setItem(DB_FALLBACK_KEY, JSON.stringify(snapshot));
          localStorage.setItem(DB_KEY, JSON.stringify(snapshot));
        } catch (e) { /* IndexedDB remains the primary store. */ }
      });
    });
    return savePromise;
  }

  function toast(message) {
    var region = document.getElementById('toast-region');
    if (!region) return;
    var el = document.createElement('div');
    el.className = 'toast'; el.textContent = message; region.appendChild(el);
    window.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 3000);
  }
  function completedSessions() {
    return state.sessions.filter(function (s) { return s.status === 'completed'; }).sort(function (a, b) { return (b.startedAt || '').localeCompare(a.startedAt || ''); });
  }
  function getPlan(id) { return state.plans.find(function (p) { return p.id === id; }); }
  function getActiveSession() { return state.sessions.find(function (s) { return s.status === 'in_progress'; }) || null; }
  function countDoneSets(session) {
    var total = 0;
    (session.exercises || []).forEach(function (e) { (e.sets || []).forEach(function (s) { if (s.done) total++; }); });
    return total;
  }
  function countExercisesDone(session) {
    return (session.exercises || []).filter(function (e) { return (e.sets || []).some(function (s) { return s.done; }); }).length;
  }
  function durationMinutes(session) {
    var end = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
    return Math.max(0, Math.round((end - new Date(session.startedAt).getTime()) / 60000));
  }
  function localDateFromDayOffset(offset) {
    var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offset);
    return d;
  }
  function dateISO(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function scheduleForDay(day) {
    if (day === 0) return { kind: 'run', title: 'Running recreativo', subtitle: '30–40 min · 5–8 km · Zona 2' };
    if (day === 1) return { kind: 'plan', planId: 'torso-a' };
    if (day === 2) return { kind: 'plan', planId: 'pierna-a' };
    if (day === 3) return { kind: 'rest', title: 'Descanso', subtitle: 'Recuperación total; caminata ligera opcional.' };
    if (day === 4) return { kind: 'plan', planId: 'torso-b' };
    if (day === 5) return { kind: 'plan', planId: 'pierna-b' };
    return { kind: 'rest', title: 'Descanso total', subtitle: 'Prioriza sueño y recuperación.' };
  }
  function setView(view) {
    currentView = view; render();
    try { window.scrollTo(0, 0); } catch (e) {}
  }
  function setActiveNav() {
    var items = document.querySelectorAll('.nav-item');
    Array.prototype.forEach.call(items, function (item) { item.classList.toggle('active', item.getAttribute('data-route') === currentView); });
  }
  function render() {
    setActiveNav();
    var root = document.getElementById('app');
    if (currentView === 'inicio') root.innerHTML = renderHome();
    else if (currentView === 'entrenar') root.innerHTML = renderTrain();
    else if (currentView === 'rutina') root.innerHTML = renderPlans();
    else if (currentView === 'historial') root.innerHTML = renderHistory();
    else if (currentView === 'progreso') root.innerHTML = renderProgress();
    else root.innerHTML = renderHome();
    var info = document.getElementById('local-status');
    if (info) info.textContent = 'Guardado local';
  }

  function renderHome() {
    var active = getActiveSession();
    var sessions = completedSessions();
    var totalSets = sessions.reduce(function (n, s) { return n + countDoneSets(s); }, 0);
    var today = new Date();
    var day = today.getDay();
    var task = scheduleForDay(day);
    var todayCard = '';
    if (task.kind === 'plan') {
      var todayPlan = getPlan(task.planId);
      todayCard = '<div class="today-card"><div class="eyebrow">Entrenamiento de hoy · ' + esc(fmtDateLong(todayISO())) + '</div><h2>' + esc(todayPlan.name) + '</h2><p class="subtitle">' + esc(todayPlan.focus) + '</p><button class="btn full" data-action="start-workout" data-plan-id="' + esc(todayPlan.id) + '">Iniciar entrenamiento</button></div>';
    } else if (task.kind === 'run') {
      todayCard = '<div class="today-card"><div class="eyebrow">Actividad de hoy · ' + esc(fmtDateLong(todayISO())) + '</div><h2>Running recreativo</h2><p class="subtitle">30–40 min · 5–8 km · ritmo suave y conversacional (Zona 2).</p><p class="muted small">Sin sprints. Termina con 2 min caminando y estiramientos suaves.</p><button class="btn full" data-action="open-run-form">Registrar running</button></div>';
    } else {
      todayCard = '<div class="today-card"><div class="eyebrow">Hoy · ' + esc(fmtDateLong(todayISO())) + '</div><h2>' + esc(task.title) + '</h2><p class="subtitle">' + esc(task.subtitle) + '</p></div>';
    }
    var week = '';
    for (var i = 0; i < 7; i++) {
      var d = localDateFromDayOffset(i);
      var item = scheduleForDay(d.getDay());
      var title = item.kind === 'plan' ? getPlan(item.planId).name : item.title;
      var sub = item.kind === 'plan' ? getPlan(item.planId).focus : item.subtitle;
      var badge = item.kind === 'rest' ? 'Descanso' : (item.kind === 'run' ? 'Running' : 'Fuerza');
      week += '<div class="week-row"><div class="week-date"><strong>' + esc(d.toLocaleDateString('es-CO', { weekday: 'short' })) + '</strong><span>' + d.getDate() + '/' + (d.getMonth() + 1) + '</span></div><div class="week-info"><strong>' + esc(title) + '</strong><span>' + esc(sub) + '</span></div><span class="pill">' + badge + '</span></div>';
    }
    return '<section class="page-heading"><div class="eyebrow">Fitness Tracker · Programa semanal</div><h1>Entrena.<br>Registra. Progresa.</h1><p class="subtitle">Tu rutina del 1 de noviembre en adelante, con seguimiento local y exportación por correo.</p></section>' +
      (active ? '<div class="card active-session-card"><div class="card-head"><div><div class="eyebrow">Sesión en curso</div><h2 style="margin:0">' + esc(active.planName) + '</h2><p class="muted small" style="margin:5px 0 0">' + countDoneSets(active) + ' series registradas</p></div><span class="pill green">En curso</span></div><button class="btn full" data-action="resume-workout">Continuar entrenamiento</button></div>' : todayCard) +
      '<div class="grid grid-3"><div class="card"><div class="metric">' + sessions.length + '</div><div class="metric-label">Sesiones completadas</div></div><div class="card"><div class="metric">' + totalSets + '</div><div class="metric-label">Series registradas</div></div><div class="card"><div class="metric">' + state.plans.length + '</div><div class="metric-label">Días de fuerza</div></div></div>' +
      '<section class="section"><div class="section-header"><h2>Tu semana</h2><span class="pill">4 días de fuerza</span></div><div class="card week-card">' + week + '</div></section>' +
      '<section class="section"><div class="section-header"><h2>Respaldo de datos</h2></div><div class="card"><p class="muted small">Los datos solo existen en este navegador. Descarga periódicamente un JSON y guárdalo en tu PC. Para enviar una sesión, usa el botón de correo al finalizar.</p><div class="button-row"><button class="btn secondary" data-action="export-json">Descargar respaldo JSON</button><button class="btn secondary" data-action="import-json">Restaurar respaldo</button><input id="import-json-file" type="file" accept="application/json,.json" style="display:none"></div></div></section>';
  }

  function renderTrain() {
    var active = getActiveSession();
    if (active) return renderWorkout(active);
    var completed = lastCompletedSessionId ? state.sessions.find(function (s) { return s.id === lastCompletedSessionId; }) : null;
    if (completed && completed.status === 'completed') return renderFinishedSession(completed);
    var cards = state.plans.map(function (p) {
      return '<div class="day-card"><div class="day-meta"><strong>' + esc(p.day) + ' · ' + esc(p.name) + '</strong><span>' + p.exercises.length + ' ejercicios · ' + esc(p.focus) + '</span></div><button class="btn small-btn" data-action="start-workout" data-plan-id="' + esc(p.id) + '">Iniciar</button></div>';
    }).join('');
    return '<section class="page-heading"><div class="eyebrow">Registro de sesión</div><h1>¿Qué entrenamos?</h1><p class="subtitle">Selecciona una sesión. Se mostrarán los datos de la última vez que realizaste cada ejercicio.</p></section>' + cards + '<div class="notice info" style="margin-top:16px">Domingo: running recreativo. Miércoles y sábado: descanso. El temporizador de descanso se eliminó; utiliza tu reloj.</div>';
  }

  function renderDemo(e) {
    if (!e.gifUrl) return '';
    return '<details class="demo-details"><summary>Ver GIF de técnica</summary><div class="demo-frame"><img src="' + esc(e.gifUrl) + '" alt="Demostración de ' + esc(e.name) + '" loading="lazy" referrerpolicy="no-referrer"><a class="tiny muted" href="' + esc(e.gifUrl) + '" target="_blank" rel="noopener">Abrir GIF en otra pestaña</a></div></details>';
  }

  function lastExercisePerformance(exerciseId) {
    var sessions = completedSessions();
    for (var i = 0; i < sessions.length; i++) {
      var exerciseRow = (sessions[i].exercises || []).find(function (e) { return e.exerciseId === exerciseId; });
      if (exerciseRow) {
        var sets = (exerciseRow.sets || []).filter(function (s) { return s.done; });
        if (sets.length) return { date: sessions[i].startedAt, sets: sets };
      }
    }
    return null;
  }

  function renderWorkout(session) {
    var done = countDoneSets(session);
    var planned = (session.exercises || []).reduce(function (n, e) { return n + (e.plannedSets || 0); }, 0);
    var cards = (session.exercises || []).map(function (e) {
      var previous = lastExercisePerformance(e.exerciseId);
      var prevText = previous ? 'Última vez (' + fmtDate(previous.date) + '): ' + previous.sets.map(function (s) { return (s.weight === 0 ? 'Peso corporal' : s.weight + ' kg') + ' × ' + s.reps; }).join(' · ') : 'Sin registro anterior';
      var rows = e.sets.map(function (s, index) {
        var defaultWeight = s.weight !== null && s.weight !== undefined && s.weight !== '' ? s.weight : (e.defaultKg !== '' ? e.defaultKg : '');
        var defaultRir = s.rir !== null && s.rir !== undefined ? s.rir : e.targetRir;
        return '<div class="set-row ' + (s.done ? 'done' : '') + '" data-set-row="' + esc(s.id) + '">' +
          '<div class="set-index">' + (index + 1) + '</div>' +
          '<div class="field"><label>' + (e.weightUnit === 'peso corporal' ? 'Carga (kg)' : 'Carga (kg)') + '</label><input type="number" inputmode="decimal" min="0" step="0.1" data-field="weight" value="' + esc(defaultWeight) + '" placeholder="' + (e.defaultKg !== '' ? esc(e.defaultKg) : 'kg') + '"></div>' +
          '<div class="field"><label>Reps</label><input type="number" inputmode="numeric" min="1" max="100" step="1" data-field="reps" value="' + (s.reps !== null && s.reps !== undefined ? esc(s.reps) : '') + '" placeholder="' + e.repMin + '–' + e.repMax + '"></div>' +
          '<div class="field"><label>RIR</label><input type="number" inputmode="decimal" min="0" max="5" step="0.5" data-field="rir" value="' + esc(defaultRir) + '"></div>' +
          '<button class="btn ' + (s.done ? 'secondary' : '') + ' set-save" data-action="save-set" data-set-id="' + esc(s.id) + '" data-exercise-id="' + esc(e.id) + '" aria-label="Guardar serie">' + (s.done ? '✓' : 'OK') + '</button>' +
          '</div>';
      }).join('');
      return '<article class="exercise-card"><div class="exercise-top"><div><div class="exercise-name">' + esc(e.name) + '</div><div class="exercise-prescription">' + e.plannedSets + ' series · ' + e.repMin + '–' + e.repMax + ' reps · objetivo RIR ' + esc(e.rirText || e.targetRir) + '</div></div><span class="pill">' + esc(MUSCLES[e.muscle] || e.muscle) + '</span></div>' +
        '<div class="load-hint"><strong>Referencia:</strong> ' + esc(e.loadSuggestion || 'Ajustar') + (e.weightUnit ? '<br><span class="tiny">Registro: ' + esc(e.weightUnit) + '</span>' : '') + '</div>' +
        renderDemo(e) + (e.note ? '<p class="tiny muted exercise-note">' + esc(e.note) + '</p>' : '') + (e.tip ? '<p class="tiny technique-tip"><strong>Técnica:</strong> ' + esc(e.tip) + '</p>' : '') +
        '<div class="last-performance">' + esc(prevText) + '</div>' + rows +
        '<div class="button-row" style="margin-top:9px"><button class="btn ghost small-btn" data-action="add-set" data-exercise-id="' + esc(e.id) + '">＋ Añadir serie</button></div></article>';
    }).join('');
    var plan = getPlan(session.planId);
    return '<section class="page-heading"><div class="eyebrow">Sesión activa · ' + esc(fmtDate(session.startedAt)) + '</div><h1>' + esc(session.planName) + '</h1><p class="subtitle">Registra carga, repeticiones y RIR. Cada serie se guarda automáticamente en este dispositivo.</p></section>' +
      (plan && plan.warmup ? '<div class="notice info session-instruction"><strong>Calentamiento · 7 min</strong><br>' + esc(plan.warmup) + '</div>' : '') +
      '<div class="card progress-card"><div class="card-head"><div><strong>Progreso de la sesión</strong><div class="small muted" style="margin-top:4px">' + done + ' de ' + planned + ' series planificadas</div></div><strong>' + (planned ? Math.round(done / planned * 100) : 0) + '%</strong></div><div class="progress-track"><span style="width:' + (planned ? Math.min(100, done / planned * 100) : 0) + '%"></span></div></div>' + cards +
      (plan && plan.workNotes ? '<div class="notice info session-instruction"><strong>Indicaciones de la sesión</strong><br>' + esc(plan.workNotes) + '</div>' : '') +
      '<div class="card finish-card"><div class="field"><label>Notas de la sesión (opcional)</label><textarea id="session-notes" placeholder="Energía, molestias, técnica, observaciones…">' + esc(session.notes || '') + '</textarea></div><button class="btn full" style="margin-top:13px" data-action="finish-workout">Finalizar y generar correo</button></div>';
  }

  function renderFinishedSession(session) {
    var plan = getPlan(session.planId);
    var setCount = countDoneSets(session);
    return '<section class="page-heading"><div class="eyebrow">Sesión guardada</div><h1>Entrenamiento<br>completado.</h1><p class="subtitle">' + esc(fmtDateLong(session.startedAt.slice(0, 10))) + ' · ' + esc(session.planName) + '</p></section>' +
      '<div class="card"><div class="grid grid-3"><div><div class="metric">' + setCount + '</div><div class="metric-label">Series</div></div><div><div class="metric">' + countExercisesDone(session) + '</div><div class="metric-label">Ejercicios</div></div><div><div class="metric">' + durationMinutes(session) + '</div><div class="metric-label">Minutos</div></div></div><hr><div class="small muted">Inicio: ' + esc(fmtDateTime(session.startedAt)) + '<br>Final: ' + esc(fmtDateTime(session.endedAt)) + '<br>Rutina: ' + esc(session.planName) + '</div></div>' +
      '<section class="section"><div class="section-header"><h2>Enviar resumen</h2><span class="pill green">Listo para compartir</span></div><div class="card"><p class="small muted">Abre un borrador dirigido a ' + OWNER_EMAIL + ' con un resumen legible y el JSON completo dentro del cuerpo del mensaje. No necesitas adjuntar archivos. Revisa el contenido y pulsa Enviar en Mail.</p><button class="btn full" data-action="email-session" data-session-id="' + esc(session.id) + '">Abrir correo con resumen + JSON</button><p class="tiny muted" style="margin:10px 0 0">El navegador no envía el mensaje automáticamente: abre tu aplicación de correo para que confirmes el envío. Comprueba que el bloque termine en FIN DEL JSON.</p></div></section>' +
      (plan && plan.cooldown ? '<div class="notice info session-instruction"><strong>Enfriamiento</strong><br>' + esc(plan.cooldown) + '</div>' : '') +
      '<div class="button-row" style="margin-top:14px"><button class="btn secondary" data-route="historial">Ver historial</button><button class="btn ghost" data-action="dismiss-finished">Volver al inicio</button></div>';
  }

  function renderPlans() {
    var cards = state.plans.map(function (p) {
      var exerciseRows = p.exercises.map(function (e) {
        return '<div class="routine-ex-row"><div><strong>' + esc(e.name) + '</strong><div class="tiny muted">' + esc(MUSCLES[e.muscle] || e.muscle) + ' · ' + e.sets + ' × ' + e.repMin + '–' + e.repMax + ' · RIR ' + esc(e.rirText || e.rir) + '</div><div class="tiny muted">Referencia: ' + esc(e.loadSuggestion) + '</div>' + (e.gifUrl ? '<a class="tiny demo-link" href="' + esc(e.gifUrl) + '" target="_blank" rel="noopener">Ver demostración GIF ↗</a>' : '') + '</div></div>';
      }).join('');
      return '<details class="card routine-day"><summary><div class="history-summary"><div><strong>' + esc(p.day) + ' · ' + esc(p.name) + '</strong><div class="small muted">' + esc(p.focus) + '</div></div><span class="pill">' + p.exercises.length + ' ejercicios</span></div></summary><div class="routine-details"><div class="notice info"><strong>Calentamiento</strong><br>' + esc(p.warmup) + '</div>' + exerciseRows + '<div class="notice info"><strong>Indicaciones</strong><br>' + esc(p.workNotes) + '</div><div class="tiny muted"><strong>Enfriamiento:</strong> ' + esc(p.cooldown) + '</div><button class="btn full" style="margin-top:12px" data-action="start-workout" data-plan-id="' + esc(p.id) + '">Iniciar ' + esc(p.name) + '</button></div></details>';
    }).join('');
    return '<section class="page-heading"><div class="eyebrow">Programa vigente · desde 1 nov 2026</div><h1>Tu rutina</h1><p class="subtitle">Cuatro sesiones de fuerza. Los domingos se registra running; miércoles y sábados son descanso.</p></section>' + cards + '<div class="notice info" style="margin-top:15px">Los pesos son referencias iniciales. Ajusta la carga para cumplir el rango de repeticiones y RIR con técnica estable. La aplicación registra el peso que realmente utilizaste.</div>' + '<div class="tiny muted attribution">GIFs demostrativos enlazados desde <a href="https://github.com/JahelCuadrado/ExerciseGymGifsDB" target="_blank" rel="noopener">ExerciseGymGifsDB</a>. La biblioteca advierte que los GIFs pertenecen a sus respectivos autores; se muestran desde su CDN y no se copian a este proyecto.</div>';
  }

  function renderHistory() {
    var sessions = completedSessions();
    if (!sessions.length) return '<section class="page-heading"><div class="eyebrow">Registro histórico</div><h1>Historial</h1><p class="subtitle">Aquí aparecerán las sesiones completadas.</p></section><div class="empty"><strong>Aún no hay entrenamientos</strong>Completa tu primera sesión para comenzar a construir tu historial.</div>';
    var items = sessions.map(function (s) {
      var setCount = countDoneSets(s);
      var exCount = countExercisesDone(s);
      var detail = (s.exercises || []).map(function (e) {
        var sets = (e.sets || []).filter(function (x) { return x.done; }).map(function (x) { return (x.weight === 0 ? 'Peso corporal' : x.weight + ' kg') + ' × ' + x.reps + ' (RIR ' + x.rir + ')'; }).join(' · ');
        return '<div class="history-item"><strong>' + esc(e.name) + '</strong><div class="small muted" style="margin-top:4px">' + esc(sets || 'Sin series registradas') + '</div></div>';
      }).join('');
      return '<details class="card history-card"><summary><div class="history-summary"><div><strong>' + esc(s.planName) + '</strong><div class="small muted" style="margin-top:5px">' + esc(fmtDate(s.startedAt)) + ' · ' + durationMinutes(s) + ' min</div></div><div style="text-align:right"><strong>' + setCount + ' series</strong><div class="small muted">' + exCount + ' ejercicios</div></div></div></summary><hr>' + detail + (s.notes ? '<div class="notice info" style="margin-top:10px">' + esc(s.notes) + '</div>' : '') + '<button class="btn secondary full" style="margin-top:12px" data-action="email-session" data-session-id="' + esc(s.id) + '">Abrir correo con resumen + JSON</button></details>';
    }).join('');
    return '<section class="page-heading"><div class="eyebrow">Registro histórico</div><h1>Tu historial</h1><p class="subtitle">' + sessions.length + ' sesiones completadas. Abre cada una para consultar las series o volver a compartirla.</p></section>' + items + '<div class="button-row" style="margin-top:16px"><button class="btn secondary" data-action="export-csv">Exportar todas las series CSV</button><button class="btn secondary" data-action="export-json">Respaldo completo JSON</button></div>';
  }

  function estimate1RM(weight, reps) {
    if (weight === null || weight === undefined || !weight || !reps || reps > 15) return null;
    return weight * (1 + reps / 30);
  }
  function getExerciseProgress(exerciseId) {
    var rows = [];
    completedSessions().slice().reverse().forEach(function (s) {
      (s.exercises || []).forEach(function (e) {
        if (e.exerciseId !== exerciseId) return;
        var best = null;
        (e.sets || []).forEach(function (set) {
          if (!set.done) return;
          var value = estimate1RM(Number(set.weight), Number(set.reps));
          if (value && (!best || value > best.value)) best = { value: value, weight: Number(set.weight), reps: Number(set.reps), date: s.startedAt };
        });
        if (best) rows.push(best);
      });
    });
    return rows;
  }
  function renderVolumeSummary() {
    var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 6);
    var totals = {};
    completedSessions().forEach(function (session) {
      if (new Date(session.startedAt) < cutoff) return;
      (session.exercises || []).forEach(function (ex) {
        var count = (ex.sets || []).filter(function (set) { return set.done; }).length;
        if (count) totals[ex.muscle] = (totals[ex.muscle] || 0) + count;
      });
    });
    var keys = Object.keys(totals).sort(function (a, b) { return totals[b] - totals[a]; });
    if (!keys.length) return '<div class="empty">Completa sesiones para consultar las series directas registradas en los últimos siete días.</div>';
    var max = Math.max.apply(null, keys.map(function (key) { return totals[key]; }));
    return keys.map(function (key) {
      return '<div style="margin:10px 0"><div class="history-summary small" style="margin-bottom:5px"><span>' + esc(MUSCLES[key] || key) + '</span><strong>' + totals[key] + ' series</strong></div><div class="progress-track"><span style="width:' + (totals[key] / max * 100) + '%"></span></div></div>';
    }).join('') + '<p class="tiny muted" style="margin:12px 0 0">Conteo por músculo principal del ejercicio. No incluye estímulo indirecto ni equivale por sí solo a una medida de hipertrofia.</p>';
  }

  function renderProgress() {
    var sessions = completedSessions();
    var totalSets = sessions.reduce(function (n, s) { return n + countDoneSets(s); }, 0);
    var latestMetric = state.metrics.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); })[0];
    var lastSavedRun = lastSavedRunId ? state.runs.find(function (run) { return run.id === lastSavedRunId; }) : null;
    var runSavedNotice = lastSavedRun ? '<div class="card" style="margin-bottom:14px;border-color:var(--accent-strong)"><strong>Running guardado</strong><p class="small muted" style="margin:6px 0 10px">' + esc(lastSavedRun.distanceKm) + ' km · ' + esc(lastSavedRun.durationMin) + ' min · ' + esc(fmtDate(lastSavedRun.date)) + '</p><button class="btn full" data-action="email-run" data-run-id="' + esc(lastSavedRun.id) + '">Abrir correo con resumen + JSON</button></div>' : '';
    var exerciseMap = {};
    state.plans.forEach(function (p) { p.exercises.forEach(function (e) { exerciseMap[e.id] = e.name; }); });
    sessions.forEach(function (s) { s.exercises.forEach(function (e) { exerciseMap[e.exerciseId] = e.name; }); });
    var options = Object.keys(exerciseMap).map(function (id) { return '<option value="' + esc(id) + '">' + esc(exerciseMap[id]) + '</option>'; }).join('');
    var latestWeight = latestMetric && latestMetric.weightKg ? latestMetric.weightKg + ' kg' : '—';
    var latestWaist = latestMetric && latestMetric.waistCm ? latestMetric.waistCm + ' cm' : '—';
    var metrics = state.metrics.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); }).slice(0, 8).map(function (m) {
      return '<div class="history-item"><div class="history-summary"><div><strong>' + esc(fmtDate(m.date)) + '</strong><div class="small muted" style="margin-top:4px">' + (m.sleepHours ? esc(m.sleepHours) + ' h sueño' : '') + '</div></div><div style="text-align:right"><strong>' + (m.weightKg ? esc(m.weightKg) + ' kg' : '—') + '</strong><div class="small muted">Cintura ' + (m.waistCm ? esc(m.waistCm) + ' cm' : '—') + '</div></div></div></div>';
    }).join('');
    var runs = state.runs.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); }).slice(0, 8).map(function (r) {
      return '<div class="history-item"><div class="history-summary"><div><strong>' + esc(fmtDate(r.date)) + ' · ' + esc(r.distanceKm) + ' km</strong><div class="small muted">' + esc(r.durationMin) + ' min · ritmo ' + esc(formatPace(r.distanceKm, r.durationMin)) + ' min/km</div></div><div style="text-align:right"><strong>' + (r.avgHr ? esc(r.avgHr) + ' bpm' : '—') + '</strong><div class="small muted">' + (r.rpe ? 'RPE ' + esc(r.rpe) : '') + '</div></div></div>' + (r.notes ? '<div class="tiny muted" style="margin-top:5px">' + esc(r.notes) + '</div>' : '') + '<button class="btn secondary small-btn" style="margin-top:9px" data-action="email-run" data-run-id="' + esc(r.id) + '">Abrir correo con resumen + JSON</button></div>';
    }).join('');
    return '<section class="page-heading"><div class="eyebrow">Análisis longitudinal</div><h1>Tu progreso</h1><p class="subtitle">Registra medidas corporales y running; compara tu rendimiento durante los mesociclos.</p></section>' +
      runSavedNotice + '<div class="grid grid-3"><div class="card"><div class="metric">' + sessions.length + '</div><div class="metric-label">Sesiones</div></div><div class="card"><div class="metric">' + totalSets + '</div><div class="metric-label">Series registradas</div></div><div class="card"><div class="metric" style="font-size:22px">' + esc(latestWeight) + '</div><div class="metric-label">Último peso corporal</div></div></div>' +
      '<section class="section"><div class="section-header"><h2>Volumen directo · 7 días</h2><span class="pill">Series completadas</span></div><div class="card">' + renderVolumeSummary() + '</div></section>' +
      '<section class="section"><div class="section-header"><h2>Registrar mediciones</h2><span class="pill">Opcional</span></div><form id="metrics-form" class="card"><div class="form-grid"><div class="field"><label>Fecha</label><input type="date" name="date" value="' + todayISO() + '" required></div><div class="field"><label>Peso (kg)</label><input type="number" name="weightKg" min="20" max="300" step="0.1" placeholder="72.6"></div><div class="field"><label>Cintura (cm)</label><input type="number" name="waistCm" min="30" max="200" step="0.1" placeholder="79.0"></div><div class="field"><label>Sueño (horas)</label><input type="number" name="sleepHours" min="0" max="24" step="0.25" placeholder="7"></div><div class="field full-field"><label>Notas</label><input type="text" name="notes" placeholder="Condiciones de medición, fatiga, etc."></div></div><button class="btn full" style="margin-top:13px" type="submit">Guardar medición</button></form></section>' +
      '<section class="section"><div class="section-header"><h2>Running recreativo</h2><span class="pill">Domingos · Zona 2</span></div><form id="run-form" class="card"><div class="form-grid"><div class="field"><label>Fecha</label><input type="date" name="date" value="' + todayISO() + '" required></div><div class="field"><label>Distancia (km)</label><input type="number" name="distanceKm" min="0.1" max="300" step="0.01" placeholder="6.00" required></div><div class="field"><label>Duración (min)</label><input type="number" name="durationMin" min="1" max="1000" step="1" placeholder="38" required></div><div class="field"><label>FC promedio (bpm)</label><input type="number" name="avgHr" min="50" max="240" step="1" placeholder="145"></div><div class="field"><label>Esfuerzo percibido (1–10)</label><input type="number" name="rpe" min="1" max="10" step="1" placeholder="3"></div><div class="field full-field"><label>Notas</label><input type="text" name="notes" placeholder="Sensaciones, ruta, clima…"></div></div><button class="btn full" style="margin-top:13px" type="submit">Guardar carrera</button></form><div class="card" style="margin-top:10px">' + (runs || '<div class="empty">Todavía no hay carreras registradas.</div>') + '</div></section>' +
      '<section class="section"><div class="section-header"><h2>Progresión por ejercicio</h2></div><div class="card"><div class="field"><label>Selecciona un ejercicio</label><select id="progress-exercise">' + options + '</select></div><div id="exercise-chart" style="margin-top:15px">Selecciona un ejercicio para consultar su progreso.</div></div></section>' +
      '<section class="section"><div class="section-header"><h2>Mediciones recientes</h2><span class="pill">Cintura: ' + esc(latestWaist) + '</span></div><div class="card">' + (metrics || '<div class="empty">Todavía no hay mediciones registradas.</div>') + '</div></section>' +
      '<section class="section"><div class="section-header"><h2>Exportar / restaurar</h2></div><div class="card"><p class="muted small">CSV para Excel; JSON para IA y respaldo completo; Markdown para lectura rápida.</p><div class="button-row"><button class="btn secondary" data-action="export-csv">Series CSV</button><button class="btn secondary" data-action="export-json">Respaldo JSON</button><button class="btn secondary" data-action="export-md">Informe Markdown</button><button class="btn ghost" data-action="import-json">Importar JSON</button><input id="import-json-file" type="file" accept="application/json,.json" style="display:none"></div></div></section>';
  }

  function startWorkout(planId) {
    var existing = getActiveSession();
    if (existing) { setView('entrenar'); return; }
    var plan = getPlan(planId); if (!plan) return;
    lastCompletedSessionId = null;
    var session = {
      id: uid(), planId: plan.id, planName: plan.name, planDay: plan.day, focus: plan.focus,
      startedAt: new Date().toISOString(), endedAt: null, status: 'in_progress', notes: '', updatedAt: new Date().toISOString(),
      exercises: plan.exercises.map(function (e) {
        var sets = [];
        for (var i = 0; i < Number(e.sets || 0); i++) sets.push({ id: uid(), weight: e.defaultKg === '' ? '' : Number(e.defaultKg), reps: '', rir: Number(e.rir), done: false, type: 'working' });
        return {
          id: uid(), exerciseId: e.id, name: e.name, muscle: e.muscle, plannedSets: Number(e.sets),
          repMin: Number(e.repMin), repMax: Number(e.repMax), targetRir: Number(e.rir), rirText: e.rirText,
          loadSuggestion: e.loadSuggestion, weightUnit: e.weightUnit, defaultKg: e.defaultKg, note: e.note, tip: e.tip,
          gifUrl: e.gifUrl, sets: sets
        };
      })
    };
    state.sessions.push(session); persist(); setView('entrenar');
  }

  function findSessionExercise(exerciseId) {
    var session = getActiveSession();
    if (!session) return null;
    return session.exercises.find(function (e) { return e.id === exerciseId; });
  }
  function saveSet(exerciseId, setId, row) {
    var ex = findSessionExercise(exerciseId); if (!ex) return;
    var set = ex.sets.find(function (s) { return s.id === setId; }); if (!set) return;
    var weight = row.querySelector('[data-field="weight"]').value;
    var reps = row.querySelector('[data-field="reps"]').value;
    var rir = row.querySelector('[data-field="rir"]').value;
    if (weight === '' || !isFinite(Number(weight)) || Number(weight) < 0 || reps === '' || Number(reps) <= 0) { toast('Introduce carga y repeticiones válidas.'); return; }
    if (rir === '' || Number(rir) < 0 || Number(rir) > 5) { toast('El RIR debe estar entre 0 y 5.'); return; }
    set.weight = Number(weight); set.reps = Number(reps); set.rir = Number(rir); set.done = true; set.savedAt = new Date().toISOString();
    var session = getActiveSession(); session.updatedAt = new Date().toISOString();
    persist(); render(); toast('Serie guardada en este dispositivo.');
  }
  function addSet(exerciseId) {
    var ex = findSessionExercise(exerciseId); if (!ex) return;
    ex.sets.push({ id: uid(), weight: ex.defaultKg === '' ? '' : Number(ex.defaultKg), reps: '', rir: ex.targetRir, done: false, type: 'working' });
    persist(); render(); toast('Serie adicional añadida.');
  }
  function finishWorkout() {
    var session = getActiveSession(); if (!session) return;
    if (!countDoneSets(session)) { toast('Registra al menos una serie antes de finalizar.'); return; }
    var notes = document.getElementById('session-notes');
    if (notes) session.notes = notes.value.trim();
    session.endedAt = new Date().toISOString(); session.status = 'completed'; session.updatedAt = new Date().toISOString();
    lastCompletedSessionId = session.id;
    persist().then(function () { currentView = 'entrenar'; render(); toast('Sesión guardada. Puedes preparar el correo.'); });
  }
  function openRunForm() { currentView = 'progreso'; render(); window.setTimeout(function () { var form = document.getElementById('run-form'); if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80); }

  function openModal(title, content) {
    document.getElementById('modal-root').innerHTML = '<div class="modal-backdrop" data-action="close-modal"><div class="modal" data-modal-inner><div class="modal-head"><h2>' + esc(title) + '</h2><button class="icon-button" data-action="close-modal" aria-label="Cerrar">×</button></div>' + content + '</div></div>';
  }
  function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

  function downloadBlob(name, type, content) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  function allSetRows() {
    var rows = [];
    completedSessions().forEach(function (s) {
      (s.exercises || []).forEach(function (e, exerciseIndex) {
        (e.sets || []).forEach(function (set, index) {
          if (!set.done) return;
          rows.push({
            app_name: APP_NAME, app_version: APP_VERSION, export_type: 'training_session_set',
            session_id: s.id, session_title: s.planName, plan_id: s.planId, plan_name: s.planName,
            plan_day: s.planDay || '', session_started_at: s.startedAt, session_ended_at: s.endedAt,
            session_date: (s.startedAt || '').slice(0, 10), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
            duration_min: durationMinutes(s), session_notes: s.notes || '', exercise_order: exerciseIndex + 1,
            exercise_id: e.exerciseId, exercise_name: e.name, primary_muscle: MUSCLES[e.muscle] || e.muscle,
            prescribed_sets: e.plannedSets, prescribed_rep_min: e.repMin, prescribed_rep_max: e.repMax,
            target_rir: e.rirText || e.targetRir, load_suggestion: e.loadSuggestion || '', weight_unit: e.weightUnit || 'kg',
            set_number: index + 1, weight_kg: set.weight, repetitions: set.reps, actual_rir: set.rir,
            set_type: set.type || 'working', set_saved_at: set.savedAt || '', gif_url: e.gifUrl || '',
            exercise_note: e.note || '', technique_tip: e.tip || ''
          });
        });
      });
    });
    return rows;
  }
  function csvCell(value) {
    var s = String(value == null ? '' : value);
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function csvFromRows(rows) {
    if (!rows.length) return '\ufeffSin series registradas';
    var headers = Object.keys(rows[0]);
    var lines = [headers.map(csvCell).join(';')];
    rows.forEach(function (row) { lines.push(headers.map(function (h) { return csvCell(row[h]); }).join(';')); });
    return '\ufeff' + lines.join('\r\n');
  }
  function exportCSV() {
    downloadBlob('fitness-tracker-series-' + todayISO() + '.csv', 'text/csv;charset=utf-8', csvFromRows(allSetRows()));
    toast('CSV descargado; puedes abrirlo con Excel.');
  }
  function exportJSON() {
    var payload = {
      metadata: { app: APP_NAME, appVersion: APP_VERSION, schemaVersion: state.schemaVersion, exportType: 'complete_backup', exportedAt: new Date().toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '', tags: ['fitness', 'hypertrophy', 'training-log', 'backup'] },
      data: state
    };
    downloadBlob('fitness-tracker-backup-' + todayISO() + '.json', 'application/json;charset=utf-8', JSON.stringify(payload, null, 2));
    toast('Respaldo JSON descargado.');
  }
  function exportMarkdown() {
    var sessions = completedSessions();
    var md = '# Fitness Tracker — Informe\n\nAplicación: ' + APP_NAME + ' ' + APP_VERSION + '\nGenerado: ' + new Date().toLocaleString('es-CO') + '\nZona horaria: ' + (Intl.DateTimeFormat().resolvedOptions().timeZone || '') + '\n\nSesiones completadas: ' + sessions.length + '\n\n';
    sessions.slice(0, 40).forEach(function (s) {
      md += '## ' + fmtDate(s.startedAt) + ' — ' + s.planName + '\n\nDuración: ' + durationMinutes(s) + ' min · Series registradas: ' + countDoneSets(s) + '\n\n';
      s.exercises.forEach(function (e) {
        var sets = e.sets.filter(function (x) { return x.done; }); if (!sets.length) return;
        md += '### ' + e.name + '\n\n' + sets.map(function (x, i) { return '- Serie ' + (i + 1) + ': ' + x.weight + ' kg × ' + x.reps + ' reps — RIR ' + x.rir; }).join('\n') + '\n\n';
      });
      if (s.notes) md += '**Notas:** ' + s.notes + '\n\n';
    });
    md += '\n## Mediciones\n\n| Fecha | Peso (kg) | Cintura (cm) | Sueño (h) |\n|---|---:|---:|---:|\n';
    state.metrics.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).forEach(function (m) { md += '| ' + m.date + ' | ' + (m.weightKg || '') + ' | ' + (m.waistCm || '') + ' | ' + (m.sleepHours || '') + ' |\n'; });
    md += '\n## Running\n\n| Fecha | Distancia (km) | Duración (min) | FC promedio | RPE |\n|---|---:|---:|---:|---:|\n';
    state.runs.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).forEach(function (r) { md += '| ' + r.date + ' | ' + r.distanceKm + ' | ' + r.durationMin + ' | ' + (r.avgHr || '') + ' | ' + (r.rpe || '') + ' |\n'; });
    downloadBlob('fitness-tracker-informe-' + todayISO() + '.md', 'text/markdown;charset=utf-8', md);
    toast('Informe Markdown descargado.');
  }

  function sessionExport(session) {
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    var data = {
      metadata: {
        app: APP_NAME, appVersion: APP_VERSION, schemaVersion: state.schemaVersion,
        exportType: 'single_workout_session', exportedAt: new Date().toISOString(), timezone: tz,
        locale: navigator.language || 'es-CO', recipient: OWNER_EMAIL,
        tags: ['fitness', 'workout', 'strength-training', 'hypertrophy', 'training-session', session.planName.toLowerCase().replace(/[^a-z0-9]+/g, '-')]
      },
      session: {
        id: session.id, title: session.planName, planId: session.planId, planDay: session.planDay || '', focus: session.focus || '',
        status: session.status, startedAt: session.startedAt, endedAt: session.endedAt,
        dateLocal: (session.startedAt || '').slice(0, 10), timezone: tz, durationMinutes: durationMinutes(session),
        completedExerciseCount: countExercisesDone(session), completedSetCount: countDoneSets(session),
        plannedSetCount: (session.exercises || []).reduce(function (n, e) { return n + Number(e.plannedSets || 0); }, 0),
        notes: session.notes || '',
        exercises: (session.exercises || []).map(function (e, i) {
          return {
            order: i + 1, exerciseId: e.exerciseId, name: e.name, primaryMuscle: MUSCLES[e.muscle] || e.muscle,
            plannedSets: e.plannedSets, repRange: { min: e.repMin, max: e.repMax }, targetRIR: e.rirText || e.targetRir,
            suggestedLoad: e.loadSuggestion || '', weightUnit: e.weightUnit || 'kg', gifUrl: e.gifUrl || '',
            note: e.note || '', techniqueTip: e.tip || '',
            sets: (e.sets || []).map(function (s, idx) { return { setNumber: idx + 1, done: !!s.done, weightKg: s.weight === '' ? null : s.weight, repetitions: s.reps === '' ? null : s.reps, actualRIR: s.rir, type: s.type || 'working', savedAt: s.savedAt || null }; })
          };
        })
      }
    };
    var flat = [];
    (session.exercises || []).forEach(function (e, exIndex) {
      (e.sets || []).forEach(function (s, index) {
        if (!s.done) return;
        flat.push({
          app: APP_NAME, app_version: APP_VERSION, export_type: 'workout_session',
          session_id: session.id, session_title: session.planName, plan_id: session.planId, plan_day: session.planDay || '',
          session_date: (session.startedAt || '').slice(0, 10), started_at: session.startedAt, ended_at: session.endedAt,
          timezone: tz, duration_minutes: durationMinutes(session), session_notes: session.notes || '',
          exercise_order: exIndex + 1, exercise_id: e.exerciseId, exercise_name: e.name,
          primary_muscle: MUSCLES[e.muscle] || e.muscle, planned_sets: e.plannedSets,
          rep_min: e.repMin, rep_max: e.repMax, target_rir: e.rirText || e.targetRir,
          load_suggestion: e.loadSuggestion || '', weight_unit: e.weightUnit || 'kg',
          set_number: index + 1, weight_kg: s.weight, reps: s.reps, actual_rir: s.rir,
          set_type: s.type || 'working', set_saved_at: s.savedAt || '', gif_url: e.gifUrl || ''
        });
      });
    });
    return { json: JSON.stringify(data, null, 2), csv: csvFromRows(flat), metadata: data.metadata, session: data.session, rowCount: flat.length };
  }
  function emailText(metadata, title, date, details, json) {
    var divider = '========================================';
    var tags = Array.isArray(metadata.tags) ? metadata.tags.join(' · ') : '';
    var lines = [
      'FITNESS TRACKER',
      'INFORME DE ENTRENAMIENTO',
      divider,
      '',
      'RESUMEN DEL REGISTRO',
      'Título: ' + title,
      'Fecha del entrenamiento: ' + date,
      'Destinatario: ' + OWNER_EMAIL,
      'Aplicación: ' + metadata.app + ' · versión ' + metadata.appVersion,
      'Tipo de registro: ' + metadata.exportType,
      'Generado: ' + metadata.exportedAt,
      'Zona horaria: ' + (metadata.timezone || 'No disponible'),
      'Idioma: ' + (metadata.locale || 'No disponible'),
      'Versión del esquema: ' + metadata.schemaVersion,
      'Identificador: ' + (metadata.recordId || 'No disponible'),
      'Etiquetas: ' + tags,
      '',
      'DETALLES DE LA SESIÓN',
      details || 'Sin detalles adicionales.',
      '',
      divider,
      'JSON COMPLETO — CONTENIDO ESTRUCTURADO (formato compacto)',
      'El contenido JSON comienza en la siguiente llave { y termina antes de «FIN DEL JSON».',
      'Longitud del JSON: ' + json.length + ' caracteres.',
      divider,
      '',
      json,
      '',
      divider,
      'FIN DEL JSON',
      divider,
      '',
      'Mensaje generado localmente por Fitness Tracker.',
      'El JSON está incluido literalmente en este correo; no se requiere adjuntar ningún archivo.'
    ];
    return lines.join('\r\n').replace(/\r?\n/g, '\r\n');
  }

  function openEmailWithJson(prepared) {
    var mailto = 'mailto:' + OWNER_EMAIL +
      '?subject=' + encodeURIComponent(prepared.subject) +
      '&body=' + encodeURIComponent(prepared.body);
    // mailto body sizes have implementation-specific limits. The ending
    // sentinel lets the user detect truncation before sending the message.
    if (mailto.length > 18000) {
      toast('El correo es extenso (' + prepared.json.length + ' caracteres JSON). Comprueba que aparezca FIN DEL JSON antes de enviarlo.');
    } else {
      toast('Abriendo el borrador. Revisa el resumen y el bloque JSON antes de enviarlo.');
    }
    window.location.href = mailto;
  }

  function prepareSessionExport(session) {
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    var date = (session.startedAt || '').slice(0, 10);
    var payload = {
      metadata: {
        app: APP_NAME, appVersion: APP_VERSION, schemaVersion: state.schemaVersion,
        exportType: 'single_workout_session', exportedAt: new Date().toISOString(), timezone: tz,
        locale: navigator.language || 'es-CO', intendedRecipient: OWNER_EMAIL,
        recordId: session.id, title: session.planName, trainingDate: date,
        tags: ['fitness', 'workout', 'strength-training', 'hypertrophy', 'training-session', session.planName.toLowerCase().replace(/[^a-z0-9]+/g, '-')]
      },
      session: {
        id: session.id, title: session.planName, planId: session.planId, planDay: session.planDay || '', focus: session.focus || '',
        status: session.status, startedAt: session.startedAt, endedAt: session.endedAt, dateLocal: date, timezone: tz,
        durationMinutes: durationMinutes(session), completedExerciseCount: countExercisesDone(session),
        completedSetCount: countDoneSets(session), plannedSetCount: (session.exercises || []).reduce(function (n, e) { return n + Number(e.plannedSets || 0); }, 0),
        notes: session.notes || '',
        exercises: (session.exercises || []).map(function (e, i) {
          return {
            order: i + 1, exerciseId: e.exerciseId, name: e.name, primaryMuscle: MUSCLES[e.muscle] || e.muscle,
            plannedSets: e.plannedSets, repRange: { min: e.repMin, max: e.repMax }, targetRIR: e.rirText || e.targetRir,
            suggestedLoad: e.loadSuggestion || '', weightUnit: e.weightUnit || 'kg', demonstrationGif: e.gifUrl || '',
            techniqueNote: e.note || '', techniqueCue: e.tip || '',
            sets: (e.sets || []).map(function (set, idx) {
              return { setNumber: idx + 1, completed: !!set.done, load: set.weight === '' ? null : set.weight,
                repetitions: set.reps === '' ? null : set.reps, actualRIR: set.rir, setType: set.type || 'working', savedAt: set.savedAt || null };
            })
          };
        })
      }
    };
    var slug = (session.planName || 'entrenamiento').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    var filename = 'fitness-' + slug + '-' + (date || todayISO()) + '.json';
    var json = JSON.stringify(payload);
    var exerciseDetails = (session.exercises || []).map(function (exercise) {
      var completed = (exercise.sets || []).filter(function (set) { return set.done; });
      var lines = completed.map(function (set, index) { return '  Serie ' + (index + 1) + ': ' + set.weight + ' kg × ' + set.reps + ' reps · RIR ' + set.rir; });
      return exercise.name + ' — ' + (MUSCLES[exercise.muscle] || exercise.muscle) + '\n' + (lines.length ? lines.join('\n') : '  Sin series completadas');
    }).join('\n\n');
    var details = 'Inicio: ' + session.startedAt + '\nFin: ' + session.endedAt + '\nDuración: ' + durationMinutes(session) + ' min\nEjercicios completados: ' + countExercisesDone(session) + '\nSeries completadas: ' + countDoneSets(session) + '\nSeries planificadas: ' + payload.session.plannedSetCount + '\nNotas: ' + (session.notes || 'Sin notas') + '\n\nDETALLE POR EJERCICIO\n' + exerciseDetails;
    var subject = 'Fitness Tracker | ' + session.planName + ' | ' + (date || todayISO());
    return { json: json, filename: filename, subject: subject, body: emailText(payload.metadata, session.planName, date, details, json) };
  }
  function shareSessionEmail(sessionId) {
    var session = state.sessions.find(function (s) { return s.id === sessionId; });
    if (!session) { toast('No se encontró esa sesión.'); return; }
    var prepared = prepareSessionExport(session);
    openEmailWithJson(prepared);
  }
  function prepareRunExport(run) {
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    var pace = formatPace(run.distanceKm, run.durationMin);
    var payload = {
      metadata: {
        app: APP_NAME, appVersion: APP_VERSION, schemaVersion: state.schemaVersion,
        exportType: 'running_session', exportedAt: new Date().toISOString(), timezone: tz,
        locale: navigator.language || 'es-CO', intendedRecipient: OWNER_EMAIL,
        recordId: run.id, title: 'Running recreativo', trainingDate: run.date,
        tags: ['fitness', 'running', 'recreational-running', 'zone-2', 'cardio']
      },
      runningSession: {
        id: run.id, title: 'Running recreativo', date: run.date, timezone: tz,
        distanceKm: run.distanceKm, durationMinutes: run.durationMin, averagePaceMinPerKm: pace,
        averageHeartRateBpm: run.avgHr, perceivedExertionRPE: run.rpe, notes: run.notes || '', savedAt: run.updatedAt || ''
      }
    };
    var filename = 'fitness-running-' + run.date + '.json';
    var json = JSON.stringify(payload);
    var details = 'Distancia: ' + run.distanceKm + ' km\nDuración: ' + run.durationMin + ' min\nRitmo medio: ' + pace + ' min/km\nFC promedio: ' + (run.avgHr || 'No registrada') + '\nRPE: ' + (run.rpe || 'No registrado') + '\nNotas: ' + (run.notes || 'Sin notas');
    var subject = 'Fitness Tracker | Running | ' + run.date;
    return { json: json, filename: filename, subject: subject, body: emailText(payload.metadata, 'Running recreativo', run.date, details, json) };
  }
  function shareRunEmail(runId) {
    var run = state.runs.find(function (item) { return item.id === runId; });
    if (!run) { toast('No se encontró ese registro de running.'); return; }
    var prepared = prepareRunExport(run);
    openEmailWithJson(prepared);
  }
  function drawProgressChart() {
    var select = document.getElementById('progress-exercise');
    var root = document.getElementById('exercise-chart');
    if (!select || !root) return;
    var rows = getExerciseProgress(select.value);
    if (!rows.length) { root.innerHTML = '<div class="empty">Todavía no hay suficientes registros para graficar este ejercicio.</div>'; return; }
    var max = Math.max.apply(null, rows.map(function (r) { return r.value; }));
    var bars = rows.slice(-10).map(function (r) {
      var height = Math.max(8, r.value / max * 125);
      return '<div class="chart-bar" style="height:' + height + 'px" title="' + esc(r.value.toFixed(1)) + ' kg estimados"></div>';
    }).join('');
    var first = rows[0].value; var last = rows[rows.length - 1].value;
    var change = first ? ((last - first) / first * 100) : 0;
    root.innerHTML = '<div class="grid grid-2" style="margin-bottom:12px"><div><div class="metric">' + last.toFixed(1) + ' kg</div><div class="metric-label">Último e1RM estimado</div></div><div><div class="metric" style="color:' + (change >= 0 ? 'var(--accent)' : 'var(--warning)') + '">' + (change >= 0 ? '+' : '') + change.toFixed(1) + '%</div><div class="metric-label">Cambio desde primer registro</div></div></div><div class="chart-wrap"><div class="chart-bars">' + bars + '</div><div class="chart-labels"><span>' + esc(fmtDate(rows[Math.max(0, rows.length - 10)].date)) + '</span><span>' + esc(fmtDate(rows[rows.length - 1].date)) + '</span></div></div><p class="tiny muted" style="margin:9px 0 0">Estimación orientativa mediante Epley; no es una medición de 1RM. Se excluyen series de más de 15 repeticiones.</p>';
  }

  document.addEventListener('click', function (event) {
    var route = event.target.closest('[data-route]');
    if (route) { setView(route.getAttribute('data-route')); return; }
    var button = event.target.closest('[data-action]'); if (!button) return;
    var action = button.getAttribute('data-action');
    if (action === 'close-modal') { closeModal(); }
    else if (action === 'start-workout') startWorkout(button.getAttribute('data-plan-id'));
    else if (action === 'resume-workout') setView('entrenar');
    else if (action === 'save-set') saveSet(button.getAttribute('data-exercise-id'), button.getAttribute('data-set-id'), button.closest('.set-row'));
    else if (action === 'add-set') addSet(button.getAttribute('data-exercise-id'));
    else if (action === 'finish-workout') finishWorkout();
    else if (action === 'dismiss-finished') { lastCompletedSessionId = null; setView('inicio'); }
    else if (action === 'email-session') shareSessionEmail(button.getAttribute('data-session-id'));
    else if (action === 'email-run') shareRunEmail(button.getAttribute('data-run-id'));
    else if (action === 'open-run-form') openRunForm();
    else if (action === 'export-json') exportJSON();
    else if (action === 'export-csv') exportCSV();
    else if (action === 'export-md') exportMarkdown();
    else if (action === 'import-json') { var importInput = document.getElementById('import-json-file'); if (importInput) importInput.click(); }
  });

  document.addEventListener('submit', function (event) {
    if (event.target.id === 'metrics-form') {
      event.preventDefault();
      var data = new FormData(event.target);
      var metric = { id: uid(), date: data.get('date'), weightKg: data.get('weightKg') ? Number(data.get('weightKg')) : null, waistCm: data.get('waistCm') ? Number(data.get('waistCm')) : null, sleepHours: data.get('sleepHours') ? Number(data.get('sleepHours')) : null, notes: String(data.get('notes') || '').trim(), updatedAt: new Date().toISOString() };
      if (!metric.weightKg && !metric.waistCm && !metric.sleepHours) { toast('Introduce al menos una medición.'); return; }
      state.metrics.push(metric); persist(); render(); toast('Medición guardada localmente.');
    } else if (event.target.id === 'run-form') {
      event.preventDefault();
      var runData = new FormData(event.target);
      var run = { id: uid(), date: runData.get('date'), distanceKm: Number(runData.get('distanceKm')), durationMin: Number(runData.get('durationMin')), avgHr: runData.get('avgHr') ? Number(runData.get('avgHr')) : null, rpe: runData.get('rpe') ? Number(runData.get('rpe')) : null, notes: String(runData.get('notes') || '').trim(), updatedAt: new Date().toISOString() };
      if (!(run.distanceKm > 0) || !(run.durationMin > 0)) { toast('Revisa distancia y duración.'); return; }
      state.runs.push(run); lastSavedRunId = run.id; persist(); render(); toast('Running guardado. Ya puedes compartir su JSON por correo.');
    }
  });

  document.addEventListener('change', function (event) {
    if (event.target.id === 'progress-exercise') drawProgressChart();
    if (event.target.id === 'import-json-file' && event.target.files && event.target.files[0]) {
      var file = event.target.files[0]; var reader = new FileReader();
      reader.onload = function () {
        try {
          var imported = JSON.parse(String(reader.result));
          // Accept current backup envelope and older raw state exports.
          if (imported && imported.data) imported = imported.data;
          if (!imported || !Array.isArray(imported.plans) || !Array.isArray(imported.sessions) || !Array.isArray(imported.metrics) || !Array.isArray(imported.runs)) throw new Error('El archivo no tiene el formato de respaldo esperado.');
          if (!window.confirm('Esto reemplazará los datos locales actuales por el respaldo seleccionado. ¿Continuar?')) return;
          if (Number(imported.schemaVersion || 1) < 3) imported.plans = defaultPlans();
          imported.schemaVersion = 3;
          state = imported; persist().then(function () { lastCompletedSessionId = null; setView('inicio'); toast('Respaldo restaurado.'); });
        } catch (err) { toast('No se pudo importar: ' + err.message); }
        event.target.value = '';
      };
      reader.readAsText(file);
    }
  });

  window.addEventListener('beforeunload', function () { if (state) persist(); });

  loadState().then(function (loaded) {
    state = migrateState(loaded || freshState());
    if (!Array.isArray(state.plans) || !state.plans.length) state.plans = defaultPlans();
    if (!Array.isArray(state.sessions)) state.sessions = [];
    if (!Array.isArray(state.metrics)) state.metrics = [];
    if (!Array.isArray(state.runs)) state.runs = [];
    persist(); render();
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('./service-worker.js').catch(function () { /* App remains usable without SW. */ });
    }
  });
})();
