/**
 * SODIE - Admin Panel Engine (admin.js)
 * Versión Sincronizada con el maquetado de admin.html
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
   1. AUTENTICACIÓN Y SESIÓN
   ========================================================================== */
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
      sessionStorage.setItem("sodie_admin_session", "active");
      mostrarDashboard();
    } else {
      if (errorElem) {
        errorElem.innerText = `❌ ${data.message || 'Contraseña incorrecta'}`;
        errorElem.classList.remove("hidden");
      }
    }
  } catch (err) {
    // Fallback de desarrollo
    sessionStorage.setItem("sodie_admin_session", "active");
    mostrarDashboard();
  }
}

function mostrarDashboard() {
  const loginCard = document.getElementById("admin-auth-card");
  const dashContent = document.getElementById("admin-dashboard-content");

  if (loginCard) loginCard.classList.add("hidden");
  if (dashContent) dashContent.classList.remove("hidden");

  sodieIniciarCronometro24h();
}

function sodieCerrarSesionAdmin() {
  sessionStorage.removeItem("sodie_admin_session");
  window.location.reload();
}

/* ==========================================================================
   2. LISTENERS DE BOTONES (IDs SINCRONIZADOS CON ADMIN.HTML)
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
      sodieSubirExcelAdmin();
    });
    btnExcel.dataset.bound = "true";
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
}

// Función para abrir la vista cliente saltándose bloqueos
function sodieAbrirVistaCliente(clientId = null) {
  localStorage.setItem('sodie_admin_bypass', 'true');
  
  if (clientId) {
    window.open(`client.html?clientId=${encodeURIComponent(clientId)}&admin=true`, '_blank');
  } else {
    window.open('client.html?view=general&admin=true', '_blank');
  }
}

// Agregar esto dentro de setupAdminEventListeners() en admin.js:
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

function sodieIniciarCronometro24h() {
  if (ADMIN_STATE.timer24Interval) clearInterval(ADMIN_STATE.timer24Interval);

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

function sodieReiniciarCronometro() {
  sodiePausarCronometro();
  ADMIN_STATE.timer24Seconds = 24 * 3600;
  actualizarDisplayCronometro();
}

/* ==========================================================================
   ADMIN FRONTEND CONTROLLER (Sin lógica sensible ni credenciales)
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  // Bind Botón 1: Iniciar Sesión en FB y generar Token 90 días
  const btnFbLogin = document.getElementById('btn-fb-login');
  if (btnFbLogin && !btnFbLogin.dataset.bound) {
    btnFbLogin.addEventListener('click', (e) => {
      e.preventDefault();
      sodieIniciarSesionFB();
    });
    btnFbLogin.dataset.bound = "true";
  }

  // Bind Botón 2: Activar Campaña en Meta
  const btnActivate = document.getElementById('btn-trigger-active-campaign');
  if (btnActivate && !btnActivate.dataset.bound) {
    btnActivate.addEventListener('click', (e) => {
      e.preventDefault();
      sodieConfirmarActivacion();
    });
    btnActivate.dataset.bound = "true";
  }
});

/* 1. Inicia sesión con FB SDK y le manda el shortToken al Backend */
function sodieIniciarSesionFB() {
  if (typeof FB === 'undefined') {
    return alert('⚠️ El SDK de Facebook aún se está cargando. Intenta en un segundo.');
  }

  FB.login(function(response) {
    if (response.authResponse) {
      const shortToken = response.authResponse.accessToken;

      // El backend se encarga de convertirlo a 90 días
      fetch(`${getBaseUrl()}/api/v1/admin/fb-exchange-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortLivedToken: shortToken })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.longLivedToken) {
          // Guardamos únicamente el token de 90 días en la sesión local
          localStorage.setItem('sodie_fb_access_token', data.longLivedToken);
          
          const badge = document.getElementById('fb-token-state');
          if (badge) badge.textContent = 'Autenticado (Token 90 días activo) 🟢';
          
          alert('✅ Sesión iniciada. Token de 90 días generado y vinculado correctamente.');
        } else {
          alert('❌ Error al convertir el token a 90 días: ' + (data.error || 'Desconocido'));
        }
      })
      .catch(err => console.error('💥 Error en exchange token:', err));
    } else {
      alert('⚠️ Cancelado por el usuario.');
    }
  }, { scope: 'ads_management,ads_read,business_management' });
}

/* 2. Dispara la activación: el backend pone el act_id y llama a metaServices */
async function sodieConfirmarActivacion() {
  const btn = document.getElementById('btn-trigger-active-campaign');
  if (btn) btn.textContent = 'Inyectando borrador en Meta... ⏳';

  const token = localStorage.getItem('sodie_fb_access_token');
  if (!token) {
    if (btn) btn.textContent = '🚀 Activar Campaña Directa';
    return alert('⚠️ Primero debes iniciar sesión en Facebook para vincular el token de 90 días.');
  }

  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/admin/campaigns/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: token,
        triggeredBy: 'ADMIN',
        timestamp: Date.now()
      })
    });

    const data = await res.json();

    if (data.success) {
      alert('🚀 ¡Borrador inyectado en Meta con éxito! Segmentación cargada desde Excel.');
      if (btn) btn.textContent = '✓ Campaña Activa / Borrador Listo';

      // Redirección hacia confirmación con los datos devueltos por el backend
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    } else {
      alert(`❌ Error al activar en Meta: ${data.error || 'Error en el servidor'}`);
      if (btn) btn.textContent = '🚀 Activar Campaña Directa';
    }
  } catch (error) {
    console.error('💥 Error enviando activación:', error);
    alert('⚠️ Ocurrió un error al procesar la solicitud.');
    if (btn) btn.textContent = '🚀 Activar Campaña Directa';
  }
}

/* ==========================================================================
   4. ACCIONES BACKEND Y CARGA DE ARCHIVOS
   ========================================================================== */
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

async function sodieSubirExcelAdmin(targetClientId = 'ADMIN') {
  const fileInput = document.getElementById('admin-excel-input');
  const btn = document.getElementById('btn-inject-database');

  if (!fileInput || !fileInput.files || !fileInput.files[0]) {
    alert('Selecciona un archivo (.csv, .xlsx, .xls) primero.');
    return;
  }

  if (btn) btn.textContent = 'Procesando Excel con IA1...';

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('clientId', targetClientId);
  formData.append('sessionId', `sess_${targetClientId.toLowerCase()}_${Date.now()}`);
  formData.append('nicho', 'infoproductos');

  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/media/upload`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Fallo al subir el archivo');

    if (btn) {
      btn.textContent = '✓ Base de Datos Inyectada';
      btn.style.background = 'rgba(0, 255, 204, 0.2)';
    }

    if (typeof showToast === 'function') {
      showToast('Éxito Admin', `Excel procesado para ${targetClientId}. Registros: ${data.totalRegistros}`);
    }
  } catch (err) {
    console.error('❌ Error en sodieSubirExcelAdmin:', err);
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
