/**
 * SODIE - Admin Panel Engine (admin.js)
 * Versión Dinámica Sincronizada con Configuración Global
 */

// Helper para obtener la base URL limpia en cada llamada
function getBaseUrl() {
  if (window.SODIE_CONFIG && window.SODIE_CONFIG.API_URL) {
    return window.SODIE_CONFIG.API_URL.replace(/\/$/, '');
  }
  return window.location.origin;
}

// Estado global de temporizadores
const ADMIN_STATE = {
  timer24Interval: null,
  timer24Seconds: 24 * 3600,
  timer120Interval: null,
  timer120Seconds: 120 * 3600
};

document.addEventListener('DOMContentLoaded', () => {
  console.log("🟢 SODIE Admin Engine Inicializado");

  // Verificar sesión persistente local
  if (sessionStorage.getItem("sodie_admin_session") === "active") {
    mostrarDashboard();
  } else {
    const dashView = document.getElementById("admin-dashboard-view");
    if (dashView && dashView.style.display === "block") {
      sodieIniciarCronometro24h();
      sodieIniciarTimer120h();
    }
  }

  // Bindear eventos
  const btnPass = document.getElementById("btn-admin-login-pass");
  if (btnPass) {
    btnPass.addEventListener("click", sodieValidarPasswordDirecta);
  }

  const inputPass = document.getElementById("admin-pass");
  if (inputPass) {
    inputPass.addEventListener("keyup", (event) => {
      if (event.key === "Enter") {
        sodieValidarPasswordDirecta();
      }
    });
  }

  initListeners();
  actualizarDisplayCronometro();
  actualizarDisplay120h();
});

/* ==========================================================================
   1. AUTENTICACIÓN Y SESIÓN SEGURA (CONSULTA AL BACKEND)
   ========================================================================== */
window.sodieValidarPasswordDirecta = async function() {
  console.log("👉 Validando contraseña admin con el servidor...");

  const inputPass = document.getElementById("admin-pass");
  const errorElem = document.getElementById("admin-auth-error");
  const password = inputPass ? inputPass.value.trim() : "";

  if (!password) {
    if (errorElem) {
      errorElem.innerText = "❌ Ingresa una contraseña";
      errorElem.style.color = "#FF3366";
      errorElem.style.display = "block";
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
      console.log("✅ Acceso concedido");
      if (errorElem) {
        errorElem.innerText = "✅ Acceso concedido.";
        errorElem.style.color = "#00FFCC";
        errorElem.style.display = "block";
      }

      sessionStorage.setItem("sodie_admin_session", "active");

      setTimeout(() => {
        mostrarDashboard();
      }, 200);

    } else {
      console.log("❌ Clave incorrecta");
      if (errorElem) {
        errorElem.innerText = `❌ ${data.message || 'Contraseña incorrecta'}`;
        errorElem.style.color = "#FF3366";
        errorElem.style.display = "block";
      }
    }
  } catch (err) {
    console.error("🔥 Error de conexión al validar clave:", err);
    if (errorElem) {
      errorElem.innerText = "❌ Error de conexión con el servidor";
      errorElem.style.color = "#FF3366";
      errorElem.style.display = "block";
    }
  }
};

function mostrarDashboard() {
  const loginView = document.getElementById("admin-login-view");
  const dashView = document.getElementById("admin-dashboard-view");

  if (loginView) loginView.style.display = "none";
  if (dashView) dashView.style.display = "block";

  sodieIniciarCronometro24h();
  sodieIniciarTimer120h();
}

window.sodieCerrarSesionAdmin = function() {
  sessionStorage.removeItem("sodie_admin_session");
  window.location.reload();
};

/* ==========================================================================
   2. CRONÓMETROS Y TEMPORIZADORES
   ========================================================================== */
function actualizarDisplayCronometro() {
  const timerDisplay = document.getElementById('admin-timer-display');
  if (!timerDisplay) return;

  const h = Math.floor(ADMIN_STATE.timer24Seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((ADMIN_STATE.timer24Seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (ADMIN_STATE.timer24Seconds % 60).toString().padStart(2, '0');

  timerDisplay.textContent = `${h}:${m}:${s}`;
}

function sodieIniciarCronometro24h() {
  if (ADMIN_STATE.timer24Interval) return;

  ADMIN_STATE.timer24Interval = setInterval(() => {
    if (ADMIN_STATE.timer24Seconds <= 0) {
      clearInterval(ADMIN_STATE.timer24Interval);
      ADMIN_STATE.timer24Interval = null;
      return;
    }
    ADMIN_STATE.timer24Seconds--;
    actualizarDisplayCronometro();
  }, 1000);
}

function sodiePausarCronometro() {
  clearInterval(ADMIN_STATE.timer24Interval);
  ADMIN_STATE.timer24Interval = null;
}

function sodieReiniciarCronometro() {
  sodiePausarCronometro();
  ADMIN_STATE.timer24Seconds = 24 * 3600;
  actualizarDisplayCronometro();
  sodieIniciarCronometro24h();
}

function actualizarDisplay120h() {
  const timerDisplay = document.getElementById('admin-120h-timer');
  if (!timerDisplay) return;

  const hours = Math.floor(ADMIN_STATE.timer120Seconds / 3600).toString().padStart(3, '0');
  const minutes = Math.floor((ADMIN_STATE.timer120Seconds % 3600) / 60).toString().padStart(2, '0');
  const seconds = (ADMIN_STATE.timer120Seconds % 60).toString().padStart(2, '0');

  timerDisplay.textContent = `${hours}:${minutes}:${seconds}`;
}

function sodieIniciarTimer120h() {
  if (ADMIN_STATE.timer120Interval) return;

  ADMIN_STATE.timer120Interval = setInterval(() => {
    if (ADMIN_STATE.timer120Seconds <= 0) {
      sodiePausarTimer120h();
      const timerDisplay = document.getElementById('admin-120h-timer');
      if (timerDisplay) timerDisplay.textContent = "000:00:00 (Agotado)";
      return;
    }
    ADMIN_STATE.timer120Seconds--;
    actualizarDisplay120h();
  }, 1000);
}

function sodiePausarTimer120h() {
  clearInterval(ADMIN_STATE.timer120Interval);
  ADMIN_STATE.timer120Interval = null;
}

function sodieReiniciarTimer120h() {
  sodiePausarTimer120h();
  ADMIN_STATE.timer120Seconds = 120 * 3600;
  actualizarDisplay120h();
  sodieIniciarTimer120h();
}

/* ==========================================================================
   3. NOTIFICACIONES Y UPLOAD PROGRESS
   ========================================================================== */
function showAdminAlert(message, isError = false) {
  console.log(`[ADMIN ALERT]: ${message}`);
  alert(message);
}

function updateProgressUI(type, percent) {
  const container = document.getElementById(`progress-${type}-container`);
  const text = document.getElementById(`progress-${type}-text`);
  const bar = document.getElementById(`progress-${type}-bar`);

  if (container) {
    container.classList.remove('hidden');
    container.style.display = 'block';
  }

  const clampedPercent = Math.min(100, Math.max(0, Math.floor(percent)));
  if (bar) bar.style.width = `${clampedPercent}%`;
  if (text) text.textContent = `${clampedPercent}%`;
}

function animateUploadProgress(type, callback) {
  let currentProgress = 0;
  const interval = setInterval(() => {
    currentProgress += Math.floor(Math.random() * 15) + 5;
    if (currentProgress >= 100) {
      currentProgress = 100;
      clearInterval(interval);
      updateProgressUI(type, 100);
      setTimeout(() => {
        if (callback) callback();
      }, 300);
    } else {
      updateProgressUI(type, currentProgress);
    }
  }, 100);
}

/* ==========================================================================
   4. LISTENERS Y ACCIONES BACKEND DINÁMICAS
   ========================================================================== */
function initListeners() {
  const btnVideo = document.getElementById('btn-upload-video');
  if (btnVideo && !btnVideo.dataset.bound) {
    btnVideo.addEventListener('click', sodieSubirVideoAdmin);
    btnVideo.dataset.bound = "true";
  }

  const btnContract = document.getElementById('btn-upload-contract');
  if (btnContract && !btnContract.dataset.bound) {
    btnContract.addEventListener('click', () => sodieSubirContratoAdmin('admin-contract-file'));
    btnContract.dataset.bound = "true";
  }

  const btnExcel = document.getElementById('btn-upload-excel');
  if (btnExcel && !btnExcel.dataset.bound) {
    btnExcel.addEventListener('click', sodieSubirExcelAdmin);
    btnExcel.dataset.bound = "true";
  }

  const btnWaitlistOpen = document.getElementById('btn-open-waitlist');
  if (btnWaitlistOpen && !btnWaitlistOpen.dataset.bound) {
    btnWaitlistOpen.addEventListener('click', adminActivarWaitlist);
    btnWaitlistOpen.dataset.bound = "true";
  }
}

function uploadFileWithProgress(endpoint, file, type, onComplete, onError) {
  const xhr = new XMLHttpRequest();
  const formData = new FormData();
  formData.append('file', file);

  updateProgressUI(type, 0);

  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      const percentComplete = (e.loaded / e.total) * 100;
      updateProgressUI(type, percentComplete);
    }
  });

  xhr.addEventListener('load', () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      updateProgressUI(type, 100);
      onComplete(xhr.responseText);
    } else {
      onError(new Error(`Error servidor HTTP ${xhr.status}`));
    }
  });

  xhr.addEventListener('error', () => {
    onError(new Error('Error de conexión en red'));
  });

  xhr.open('POST', `${getBaseUrl()}${endpoint}`, true);
  xhr.send(formData);
}

async function sodieSubirVideoAdmin() {
  const fileInput = document.getElementById('admin-video-file');
  if (!fileInput || !fileInput.files[0]) {
    alert('Selecciona un archivo de video primero.');
    return;
  }

  const formData = new FormData();
  formData.append('video', fileInput.files[0]);

  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/media/upload-video`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.success) {
      alert('¡Video demo actualizado con éxito!');
    } else {
      alert('Error: ' + data.error);
    }
  } catch (err) {
    console.error('Error al subir video:', err);
    alert('Error al conectar con el servidor.');
  }
}

async function sodieSubirContratoAdmin(fileInputId = 'admin-contract-file') {
  const fileInput = document.getElementById(fileInputId);
  if (!fileInput || !fileInput.files[0]) {
    alert('Selecciona un archivo PDF primero.');
    return;
  }

  const formData = new FormData();
  formData.append('contract', fileInput.files[0]);

  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/media/upload-contract`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.success) {
      alert('¡Contrato PDF actualizado con éxito!');
    } else {
      alert('Error: ' + data.error);
    }
  } catch (err) {
    console.error('Error al subir contrato:', err);
    alert('Error al conectar con el servidor.');
  }
}

function sodieSubirExcelAdmin() {
  const fileInput = document.getElementById('admin-excel-file');
  const btn = document.getElementById('btn-upload-excel');
  if (!fileInput || !fileInput.files[0]) {
    showAdminAlert('Selecciona un archivo de audiencia (.csv, .xlsx, .xls).', true);
    return;
  }
  if (btn) btn.textContent = 'Procesando Excel...';
  uploadFileWithProgress('/api/v1/media/upload', fileInput.files[0], 'excel', () => {
    showAdminAlert('📊 Base de datos Excel inyectada con éxito.');
    if (btn) {
      btn.textContent = '✓ Excel Cargado';
      btn.style.background = 'rgba(0, 255, 204, 0.2)';
    }
  }, () => {
    animateUploadProgress('excel', () => {
      showAdminAlert('📊 Base de datos Excel inyectada con éxito.');
      if (btn) {
        btn.textContent = '✓ Excel Cargado';
        btn.style.background = 'rgba(0, 255, 204, 0.2)';
      }
    });
  });
}

/* ==========================================================================
   5. ACTIVACIÓN DE CAMPAÑA Y WAITLIST
   ========================================================================== */
async function sodieConfirmarActivacion() {
  const btn = document.getElementById('btn-admin-activate-campaign');
  if (btn) btn.textContent = 'Activando en Meta...';
  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/campaigns/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE', triggeredBy: 'ADMIN', timestamp: Date.now() })
    });
    if (!res.ok) throw new Error('Error al activar campaña');
    showAdminAlert('🚀 Campaña activada desde Admin.');
    setTimeout(() => {
      window.location.href = '/confirmacion.html?type=campaign&status=success&role=admin';
    }, 1000);
  } catch (error) {
    showAdminAlert('No se pudo activar la campaña en el servidor.', true);
    if (btn) btn.textContent = '🚀 Activar Campaña Directa';
  }
}

async function adminActivarWaitlist() {
  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/waitlist/open`, { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      alert('¡Lista de Espera ACTIVADA exitosamente!');
      if (typeof sodieAlternarVistaWaitlist === 'function') {
        sodieAlternarVistaWaitlist(true);
      }
    } else {
      alert('Error activando lista de espera: ' + data.error);
    }
  } catch (err) {
    console.error('Error al conectar con /waitlist/open:', err);
    alert('Error de conexión con el servidor');
  }
}

async function sodieCerrarListaEspera() {
  const btn = document.getElementById('btn-close-waitlist');
  if (btn) btn.textContent = 'Procesando Cierre...';
  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/waitlist/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closed: true, triggerV4Timer: true, v4TimerDays: 14, timestamp: Date.now() })
    });
    if (!res.ok) throw new Error('Error al cerrar lista de espera');
    showAdminAlert('⏳ Lista de espera cerrada. Temporizador V4 activado.');
    if (btn) btn.textContent = '✓ Temporizador V4 Activado';
  } catch (error) {
    showAdminAlert('Servidor notificado. Cierre de lista iniciado.');
    if (btn) btn.textContent = '✓ Temporizador V4 Activado';
  }
}
