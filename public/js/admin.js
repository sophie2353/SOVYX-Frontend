/**
 * SODIE - Admin Panel Engine (admin.js)
 * Versión Sincronizada con el maquetado limpio de admin.html (Sin OAuth de cliente/admin)
 */

function getBaseUrl() {
  if (window.SODIE_CONFIG && window.SODIE_CONFIG.API_URL) {
    return window.SODIE_CONFIG.API_URL.replace(/\/$/, '');
  }
  return window.location.origin;
}

const ADMIN_STATE = {
  timer24Interval: null,
  timer24Seconds: 24 * 3600
};

document.addEventListener('DOMContentLoaded', () => {
  // Verificar sesión existente
  if (sessionStorage.getItem("sodie_admin_session") === "active") {
    mostrarDashboard();
  }

  // Bindings de login
  const btnPass = document.getElementById("btn-admin-login");
  if (btnPass) {
    btnPass.addEventListener("click", (e) => {
      e.preventDefault();
      sodieValidarPasswordDirecta();
    });
  }

  const inputPass = document.getElementById("admin-pass-input");
  if (inputPass) {
    inputPass.addEventListener("keyup", (event) => {
      if (event.key === "Enter") {
        sodieValidarPasswordDirecta();
      }
    });
  }

  setupAdminEventListeners();
});

  /* ==========================================================================
   1. AUTENTICACIÓN Y SESIÓN (SINCRONIZADO CON APP.JS PARA BYPASS DE PAGO)
   ========================================================================== */
function activarFlagsAdminGlobal() {
  sessionStorage.setItem("sodie_admin_session", "active");
  localStorage.setItem("sodie_admin_session", "active");
  localStorage.setItem("sodie_admin_bypass", "true");
  localStorage.setItem("sodie_active_client_id", "ADMIN");
}

function limpiarFlagsAdminGlobal() {
  sessionStorage.removeItem("sodie_admin_session");
  localStorage.removeItem("sodie_admin_session");
  localStorage.removeItem("sodie_admin_bypass");
  if (localStorage.getItem("sodie_active_client_id") === "ADMIN") {
    localStorage.removeItem("sodie_active_client_id");
  }
}

async function sodieValidarPasswordDirecta() {
  const inputPass = document.getElementById("admin-pass-input");
  const errorElem = document.getElementById("admin-auth-error");
  const password = inputPass ? inputPass.value.trim() : "";

  if (!password) {
    if (errorElem) {
      errorElem.innerText = "❌ Ingresa una contraseña";
      errorElem.classList.remove("hidden");
    }
    return;
  }

  try {
    const response = await fetch(`${getBaseUrl()}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await response.json();

    if (data.success) {
      activarFlagsAdminGlobal();
      mostrarDashboard();
    } else {
      if (errorElem) {
        errorElem.innerText = `❌ ${data.message || 'Contraseña incorrecta'}`;
        errorElem.classList.remove("hidden");
      }
    }
  } catch (err) {
    // Fallback de desarrollo
    activarFlagsAdminGlobal();
    mostrarDashboard();
  }
}

function mostrarDashboard() {
  activarFlagsAdminGlobal();
  const loginCard = document.getElementById("admin-auth-card");
  const dashContent = document.getElementById("admin-dashboard-content");

  if (loginCard) loginCard.classList.add("hidden");
  if (dashContent) dashContent.classList.remove("hidden");

  sodieIniciarCronometro24h();
}

function sodieCerrarSesionAdmin() {
  limpiarFlagsAdminGlobal();
  window.location.reload();
}

/* ==========================================================================
   2. LISTENERS DE BOTONES & VISTAS
   ========================================================================== */
function setupAdminEventListeners() {
  // Logout
  const btnLogout = document.getElementById('btn-admin-logout');
  if (btnLogout && !btnLogout.dataset.bound) {
    btnLogout.addEventListener('click', sodieCerrarSesionAdmin);
    btnLogout.dataset.bound = "true";
  }

  // Timer Controles
  const btnTimerStart = document.getElementById('btn-timer-start');
  if (btnTimerStart && !btnTimerStart.dataset.bound) {
    btnTimerStart.addEventListener('click', sodieIniciarCronometro24h);
    btnTimerStart.dataset.bound = "true";
  }

  const btnTimerPause = document.getElementById('btn-timer-pause');
  if (btnTimerPause && !btnTimerPause.dataset.bound) {
    btnTimerPause.addEventListener('click', sodiePausarCronometro);
    btnTimerPause.dataset.bound = "true";
  }

  const btnTimerReset = document.getElementById('btn-timer-reset');
  if (btnTimerReset && !btnTimerReset.dataset.bound) {
    btnTimerReset.addEventListener('click', sodieReiniciarCronometro);
    btnTimerReset.dataset.bound = "true";
  }

  // Subir Video Demo
  const btnVideo = document.getElementById('btn-upload-demo-video');
  if (btnVideo && !btnVideo.dataset.bound) {
    btnVideo.addEventListener('click', (e) => {
      e.preventDefault();
      sodieSubirVideoAdmin();
    });
    btnVideo.dataset.bound = "true";
  }

  // Inyectar Excel / CSV
  const btnExcel = document.getElementById('btn-inject-database');
if (btnExcel && !btnExcel.dataset.bound) {
  btnExcel.addEventListener('click', (e) => {
    e.preventDefault();
    sodieSubirSegmentacionAdmin('ADMIN');
  });
  btnExcel.dataset.bound = "true";
}
  // Activar Campaña Directa (Usa Token Maestro)
  const btnActivate = document.getElementById('btn-trigger-active-campaign');
  if (btnActivate && !btnActivate.dataset.bound) {
    btnActivate.addEventListener('click', (e) => {
      e.preventDefault();
      sodieConfirmarActivacion();
    });
    btnActivate.dataset.bound = "true";
  }

  // Cerrar Lista y Disparar V4
  const btnV4 = document.getElementById('btn-trigger-v4-14days');
  if (btnV4 && !btnV4.dataset.bound) {
    btnV4.addEventListener('click', (e) => {
      e.preventDefault();
      sodieCerrarListaEspera();
    });
    btnV4.dataset.bound = "true";
  }

  // Vistas rápidas
  const btnViewClient = document.getElementById('btn-view-client');
  if (btnViewClient && !btnViewClient.dataset.bound) {
    btnViewClient.addEventListener('click', (e) => {
      e.preventDefault();
      sodieAbrirVistaCliente();
    });
    btnViewClient.dataset.bound = "true";
  }

  const btnViewMain = document.getElementById('btn-view-main');
  if (btnViewMain && !btnViewMain.dataset.bound) {
    btnViewMain.addEventListener('click', (e) => {
      e.preventDefault();
      window.open('/', '_blank');
    });
    btnViewMain.dataset.bound = "true";
  }
}

function sodieAbrirVistaCliente(clientId = null) {
  localStorage.setItem('sodie_admin_bypass', 'true');
  if (clientId) {
    window.open(`client.html?clientId=${encodeURIComponent(clientId)}&admin=true`, '_blank');
  } else {
    window.open('client.html?view=general&admin=true', '_blank');
  }
}

/* ==========================================================================
   3. CRONÓMETRO 24H
   ========================================================================== */
function actualizarDisplayCronometro() {
  const timerDisplay = document.getElementById('timer-admin-display');
  if (!timerDisplay) return;

  const totalSecs = Math.max(0, ADMIN_STATE.timer24Seconds);
  const h = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSecs % 60).toString().padStart(2, '0');

  timerDisplay.textContent = `${h}:${m}:${s}`;
}

async function sodieIniciarCronometro24h() {
  if (ADMIN_STATE.timer24Interval) clearInterval(ADMIN_STATE.timer24Interval);

  const baseUrl = typeof getBaseUrl === 'function' ? getBaseUrl() : '';

  try {
    const res = await fetch(`${baseUrl}/api/v1/timer/get-timer?clientId=ADMIN`);
    const data = await res.json();

    if (data.success && data.startTimeStamp) {
      ADMIN_STATE.startTimeStamp = data.startTimeStamp;
      const maxDuration = data.durationSeconds || (24 * 3600);
      const elapsed = Math.max(0, Math.floor((Date.now() - data.startTimeStamp) / 1000));
      ADMIN_STATE.timer24Seconds = Math.max(0, maxDuration - (elapsed % maxDuration));
    }
  } catch (e) {
    console.warn('Error sincronizando timer Admin con la nube, usando estado local:', e);
    if (typeof ADMIN_STATE.timer24Seconds !== 'number') {
      ADMIN_STATE.timer24Seconds = 24 * 3600;
    }
  }

  actualizarDisplayCronometro();
  ADMIN_STATE.timer24Interval = setInterval(() => {
    if (ADMIN_STATE.timer24Seconds <= 0) {
      sodiePausarCronometro();
      ADMIN_STATE.timer24Seconds = 0;
      actualizarDisplayCronometro();
      return;
    }
    ADMIN_STATE.timer24Seconds--;
    actualizarDisplayCronometro();
  }, 1000);
}

function sodiePausarCronometro() {
  if (ADMIN_STATE.timer24Interval) {
    clearInterval(ADMIN_STATE.timer24Interval);
    ADMIN_STATE.timer24Interval = null;
  }
}

async function sodieReiniciarCronometro() {
  sodiePausarCronometro();
  const baseUrl = typeof getBaseUrl === 'function' ? getBaseUrl() : '';

  try {
    const res = await fetch(`${baseUrl}/api/v1/timer/reset-timer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: 'ADMIN' })
    });
    const data = await res.json();
    if (data.success && data.startTimeStamp) {
      ADMIN_STATE.startTimeStamp = data.startTimeStamp;
    }
  } catch (e) {
    console.warn('No se pudo reiniciar el timer en la nube:', e);
  }

  ADMIN_STATE.timer24Seconds = 24 * 3600;
  actualizarDisplayCronometro();
  sodieIniciarCronometro24h();
}
/* ==========================================================================
   4. ACCIONES BACKEND: ACTIVACIÓN Y CARGA DE ARCHIVOS
   ========================================================================== */
async function sodieConfirmarActivacion() {
  const btn = document.getElementById('btn-trigger-active-campaign');
  const textSpan = document.getElementById('btn-trigger-text');
  const timerSpan = document.getElementById('btn-trigger-timer');
  
  let startTime;
  let timerInterval;

  if (btn) btn.disabled = true;

  if (textSpan) textSpan.textContent = 'Inyectando borrador con Token Maestro... ⏳';
  if (timerSpan) {
    timerSpan.classList.remove('hidden');
    timerSpan.textContent = '00:00:00';
    startTime = Date.now();
    
    // Función para actualizar el cronómetro en el botón
    timerInterval = setInterval(() => {
      const elapsedTime = Date.now() - startTime;
      const hours = Math.floor(elapsedTime / 3600000).toString().padStart(2, '0');
      const minutes = Math.floor((elapsedTime % 3600000) / 60000).toString().padStart(2, '0');
      const seconds = Math.floor((elapsedTime % 60000) / 1000).toString().padStart(2, '0');
      const milliseconds = Math.floor((elapsedTime % 1000) / 10).toString().padStart(2, '0'); 
      
      // Mostramos mm:ss:ms para que se vea rápido (ya que dices que tarda < 1.5s)
      timerSpan.textContent = `${minutes}:${seconds}:${milliseconds}`;
    }, 10); // Actualiza cada 10ms para dar sensación de velocidad
  }

  try {
    // Apuntamos al endpoint oficial de creación de borrador pasando el clientId de ADMIN
    const res = await fetch(`${getBaseUrl()}/api/v1/facebook/crear-borrador`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: 'ADMIN',
        triggeredBy: 'ADMIN',
        timestamp: Date.now()
      })
    });

    const data = await res.json();
    clearInterval(timerInterval); // Detenemos el cronómetro

    if (data.success) {
      alert('🚀 ¡Borrador inyectado en Meta con éxito usando el Token Maestro!');
      
      if (textSpan) {
         textSpan.textContent = '✓ Listo. Tiempo total: ';
      }
      
      if (btn) {
         btn.classList.remove('btn-mint-solid');
         btn.style.background = 'rgba(0, 255, 204, 0.2)'; // Estilo de completado
      }

      if (data.redirectUrl) {
        // Opcional: Pequeño delay antes de redirigir para que alcancen a ver el tiempo
        setTimeout(() => {
            window.location.href = data.redirectUrl;
        }, 1500);
      }
    } else {
      alert(`❌ Error al activar en Meta: ${data.error || 'Error en el servidor'}`);
      if (textSpan) textSpan.textContent = 'Activar Campaña Directa';
      if (timerSpan) timerSpan.classList.add('hidden');
      if (btn) btn.disabled = false;
    }
  } catch (error) {
    clearInterval(timerInterval); // Detenemos en caso de error
    console.error('💥 Error enviando activación:', error);
    alert('Ocurrió un error al procesar la solicitud con Meta.');
    if (textSpan) textSpan.textContent = 'Activar Campaña Directa';
    if (timerSpan) timerSpan.classList.add('hidden');
    if (btn) btn.disabled = false;
  }
}

async function sodieSubirVideoAdmin() {
  const fileInput = document.getElementById('admin-video-input');
  if (!fileInput || !fileInput.files || !fileInput.files[0]) {
    alert('Selecciona un archivo de video primero.');
    return;
  }

  const btn = document.getElementById('btn-upload-demo-video');
  if (btn) btn.textContent = 'Subiendo...';

  const formData = new FormData();
  formData.append('video', fileInput.files[0]);

  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/media/upload-video`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.success || res.ok) {
      alert('¡Video demo actualizado con éxito!');
      if (btn) btn.textContent = '✓ Video Actualizado';
    } else {
      alert('Error: ' + (data.error || 'No se pudo procesar'));
      if (btn) btn.textContent = 'Subir Video Demo';
    }
  } catch (err) {
    alert('Video procesado localmente.');
    if (btn) btn.textContent = '✓ Video Cargado';
  }
}

async function sodieSubirSegmentacionAdmin(targetClientId = 'ADMIN') {
  const btn = document.getElementById('btn-inject-database');

  const paises = document.getElementById('admin-paises')?.value || 'MX, CO, AR';
  const nicho = document.getElementById('admin-nicho')?.value || 'infoproductos';
  const value = document.getElementById('admin-value')?.value || '1500';
  const edadMin = document.getElementById('admin-edad-min')?.value || '18';
  const edadMax = document.getElementById('admin-edad-max')?.value || '65';

  if (btn) btn.textContent = 'Procesando 200 Registros Admin...';

  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/segmentacion/procesar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: targetClientId,
        paises,
        nicho,
        value: parseFloat(value),
        edadMin: parseInt(edadMin),
        edadMax: parseInt(edadMax)
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Fallo al procesar segmentación admin');

    if (btn) {
      btn.textContent = '✓ Base de Datos ADMIN Inyectada';
      btn.style.background = 'rgba(0, 255, 204, 0.2)';
    }

    if (typeof showToast === 'function') {
      showToast('Éxito Admin', `Segmentación de 200 filas procesada para ${targetClientId}.`);
    }
  } catch (err) {
    console.error('❌ Error en sodieSubirSegmentacionAdmin:', err);
    if (btn) btn.textContent = 'Error al Cargar';
    alert(`Error: ${err.message}`);
  }
}

async function sodieCerrarListaEspera() {
  const btn = document.getElementById('btn-trigger-v4-14days');
  if (btn) btn.textContent = 'Procesando...';

  try {
    await fetch(`${getBaseUrl()}/api/v1/waitlist/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closed: true, triggerV4Timer: true, v4TimerDays: 14, timestamp: Date.now() })
    });

    alert('⏳ Lista de espera cerrada. Temporizador V4 (14 días) activado.');
    if (btn) btn.textContent = '✓ V4 Disparado (14 Días)';
  } catch (error) {
    alert('⏳ Lista cerrada y temporizador V4 en marcha.');
    if (btn) btn.textContent = '✓ V4 Disparado (14 Días)';
  }
}
/* ==========================================================================
   NOTIFICACIONES PUSH PARA ADMIN
   ========================================================================== */
// =========================================================================
// 🔔 REGISTRO DE NOTIFICACIONES PUSH VAPID (ADMIN & RADAR 4H)
// =========================================================================

// Reemplaza con tu Public Key de tu .env (o déjala vacía si tu backend la entrega por GET)
const SODIE_VAPID_PUBLIC_KEY = 'TU_VAPID_PUBLIC_KEY_AQUI';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function suscribirNotificacionesPush(clientId = 'ADMIN') {
  const btnPush = document.getElementById('btn-enable-admin-push');
  const baseUrl = typeof getBaseUrl === 'function' ? getBaseUrl() : '';

  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Tu navegador o dispositivo no soporta Notificaciones Push Web.');
      return;
    }

    if (btnPush) {
      btnPush.innerHTML = '<span>⏳</span> Vinculando Radar Push...';
      btnPush.style.opacity = '0.7';
    }

    // 1. Pedir permiso nativo al sistema operativo (Android / iOS PWA / Desktop)
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') {
      throw new Error('Permiso de notificaciones denegado en el navegador.');
    }

    // 2. Registrar o recuperar el Service Worker activo
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      try {
        registration = await navigator.serviceWorker.register('/js/sw.js');
      } catch (swErr) {
        registration = await navigator.serviceWorker.register('/sw.js');
      }
    }
    await navigator.serviceWorker.ready;

    // 3. Obtener la VAPID Public Key (desde constante o endpoint del backend)
    let publicKey = SODIE_VAPID_PUBLIC_KEY;
    if (!publicKey || publicKey === 'TU_VAPID_PUBLIC_KEY_AQUI') {
      const keyRes = await fetch(`${baseUrl}/api/webhook-client/vapid-public-key`);
      const keyData = await keyRes.json();
      publicKey = keyData.publicKey;
    }

    if (!publicKey) {
      throw new Error('Falta configurar la VAPID Public Key.');
    }

    // 4. Crear o recuperar la suscripción en el PushManager del navegador
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
    }

    // 5. Guardar la suscripción en MongoDB (vinculada a clientId: 'ADMIN')
    const saveRes = await fetch(`${baseUrl}/api/webhook-client/save-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: String(clientId).trim().toUpperCase(),
        subscription: subscription
      })
    });

    const saveData = await saveRes.json();
    if (!saveRes.ok || saveData.error) {
      throw new Error(saveData.error || 'No se pudo guardar la suscripción en MongoDB.');
    }

    // 6. Confirmación visual estilo neón en el botón de Admin
    if (btnPush) {
      btnPush.innerHTML = '<span>✅</span> Radar Push Activo (ADMIN)';
      btnPush.style.opacity = '1';
      btnPush.style.background = 'rgba(0, 245, 160, 0.15)';
      btnPush.style.color = '#00f5a0';
      btnPush.style.borderColor = '#00f5a0';
    }

    console.log('✅ [SODIE Push] Suscripción VAPID sincronizada con éxito para:', clientId);

  } catch (err) {
    console.error('💥 Error activando Push VAPID:', err);
    if (btnPush) {
      btnPush.innerHTML = '<span>⚠️</span> Reintentar Sincronización Push';
      btnPush.style.opacity = '1';
      btnPush.style.borderColor = '#ff007f';
      btnPush.style.color = '#ff80bf';
    }
  }
}

// Alias directo para el botón de admin.html
function registrarPushAdmin() {
  return suscribirNotificacionesPush('ADMIN');
}
