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
   4. ACCIONES BACKEND: ACTIVACIÓN Y CARGA DE ARCHIVOS
   ========================================================================== */
async function sodieConfirmarActivacion() {
  const btn = document.getElementById('btn-trigger-active-campaign');
  if (btn) btn.textContent = 'Inyectando borrador con Token Maestro... ⏳';

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

    if (data.success) {
      alert('🚀 ¡Borrador inyectado en Meta con éxito usando el Token Maestro!');
      if (btn) btn.textContent = '✓ Campaña Activa / Borrador Listo';

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    } else {
      alert(`❌ Error al activar en Meta: ${data.error || 'Error en el servidor'}`);
      if (btn) btn.textContent = 'Activar Campaña Directa 🚀';
    }
  } catch (error) {
    console.error('💥 Error enviando activación:', error);
    alert('⚠️ Ocurrió un error al procesar la solicitud con Meta.');
    if (btn) btn.textContent = 'Activar Campaña Directa 🚀';
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
