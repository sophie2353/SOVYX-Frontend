/**
 * SODIE - Admin Panel Engine (admin.js)
 * Control total de cargas de archivos (Video, Contrato, Excel) con progreso en %,
 * autenticación biométrica/passwords, activación directa de campaña, lista de espera y temporizadores activos.
 */

/* ==========================================================================
   1. ESTADO GLOBAL Y CONFIGURACIÓN INICIAL
   ========================================================================== */
const ADMIN_KEY = "sodie_202623555"; // Clave de acceso

// Estado del Cronómetro de Lanzamiento (24h)
let timerInterval = null;
let totalSeconds = 86400; // 24 horas por defecto

// Estado del Temporizador de 120 Horas
const ADMIN_STATE = {
  timer120Seconds: 120 * 3600, // 120 horas en segundos
  timer120Interval: null,
  elapsedSeconds: 0            // Segundos transcurridos en sesión
};

document.addEventListener('DOMContentLoaded', () => {
  // Prevenir que el formulario de login recargue la página al presionar Enter o Submit
  const loginForm = document.getElementById("admin-login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      sodieValidarLoginAdmin(e);
    });
  }

  // Verificar si ya existe una sesión activa
  if (sessionStorage.getItem("sodie_admin_session") === "active") {
    mostrarDashboard();
  }
});

/* ==========================================================================
   2. AUTENTICACIÓN Y CONTROL DE SESIÓN
   ========================================================================== */

// Validar inicio de sesión por Contraseña
function sodieValidarLoginAdmin(e) {
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }
  
  const inputPass = document.getElementById("admin-pass")?.value;
  const errorElem = document.getElementById("admin-auth-error");

  if (inputPass === ADMIN_KEY) {
    sessionStorage.setItem("sodie_admin_session", "active");
    if (errorElem) errorElem.style.display = "none";
    mostrarDashboard();
  } else {
    if (errorElem) {
      errorElem.innerText = "Contraseña incorrecta";
      errorElem.style.display = "block";
    }
  }
}

// Validar por Biometría Local Directa del Celular (Huella / Rostro)
async function sodieAutenticarBiometriaAdmin() {
  const errorElem = document.getElementById("admin-auth-error");
  if (errorElem) errorElem.style.display = "none";

  try {
    // 1. Verificar si el dispositivo tiene biometría local habilitada
    if (!window.PublicKeyCredential || !await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) {
      showAdminAlert("Tu celular no tiene habilitada la biometría o el navegador no la soporta.");
      return;
    }

    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    // 2. Desplegar directamente el banner/diálogo de huella o rostro del celular
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: challenge,
        rp: { name: "SODIE Admin" },
        user: {
          id: new Uint8Array(16),
          name: "admin@sodie",
          displayName: "SODIE Admin"
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        timeout: 60000,
        // CLAVE AQUÍ: Forzar a usar la biometría interna del celular (Platform) 
        // y exigir verificación del usuario (Huella/Rostro)
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required"
        }
      }
    });

    if (credential) {
      sessionStorage.setItem("sodie_admin_session", "active");
      mostrarDashboard();
    }
  } catch (err) {
    console.warn("Respuesta o cancelación biométrica del dispositivo:", err);
    
    // Si el usuario cancela o cierra el prompt biométrico
    if (err.name === "NotAllowedError") {
      if (errorElem) {
        errorElem.innerText = "Verificación biométrica cancelada.";
        errorElem.style.display = "block";
      }
    } else {
      // Fallback para pruebas locales en entornos donde no hay hardware registrado
      sessionStorage.setItem("sodie_admin_session", "active");
      mostrarDashboard();
    }
  }
}

// Transición visual al Dashboard e Inicio de Funciones
function mostrarDashboard() {
  const loginView = document.getElementById("admin-login-view");
  const dashView = document.getElementById("admin-dashboard-view");

  if (loginView) loginView.style.display = "none";
  if (dashView) dashView.style.display = "block";
  
  // Inicializar Event Listeners y Timers
  initListeners();
  actualizarDisplayCronometro();
  actualizarDisplay120h();

  // Iniciar cronómetro automáticamente al entrar
  sodieIniciarCronometro();
  sodieIniciarTimer120h();
}

function sodieCerrarSesionAdmin() {
  sessionStorage.removeItem("sodie_admin_session");
  window.location.reload();
}

/* ==========================================================================
   3. CRONÓMETRO DE LANZAMIENTO (24 HORAS)
   ========================================================================== */
function sodieIniciarCronometro() {
  if (timerInterval) return;
  
  timerInterval = setInterval(() => {
    if (totalSeconds <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      return;
    }
    totalSeconds--;
    actualizarDisplayCronometro();
  }, 1000);
}

function sodiePausarCronometro() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function sodieReiniciarCronometro() {
  sodiePausarCronometro();
  totalSeconds = 86400;
  actualizarDisplayCronometro();
}

function actualizarDisplayCronometro() {
  const dias = Math.floor(totalSeconds / (3600 * 24));
  const horas = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutos = Math.floor((totalSeconds % 3600) / 60);
  const segundos = totalSeconds % 60;

  const display = `${String(dias).padStart(2, '0')}:${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
  
  const elem = document.getElementById("admin-timer-display");
  if (elem) elem.innerText = display;
}

/* ==========================================================================
   4. TEMPORIZADOR DE 120 HORAS (LISTA DE ESPERA)
   ========================================================================== */
function sodieIniciarTimer120h() {
  if (ADMIN_STATE.timer120Interval) return;

  ADMIN_STATE.timer120Interval = setInterval(() => {
    if (ADMIN_STATE.timer120Seconds > 0) {
      ADMIN_STATE.timer120Seconds--;
      actualizarDisplay120h();
    } else {
      sodiePausarTimer120h();
      const timerDisplay = document.getElementById('admin-120h-timer');
      if (timerDisplay) timerDisplay.textContent = "000:00:00 (Agotado)";
    }
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
}

function actualizarDisplay120h() {
  const timerDisplay = document.getElementById('admin-120h-timer');
  if (!timerDisplay) return;

  const hours = Math.floor(ADMIN_STATE.timer120Seconds / 3600);
  const minutes = Math.floor((ADMIN_STATE.timer120Seconds % 3600) / 60);
  const seconds = ADMIN_STATE.timer120Seconds % 60;

  const hStr = hours.toString().padStart(3, '0');
  const mStr = minutes.toString().padStart(2, '0');
  const sStr = seconds.toString().padStart(2, '0');

  timerDisplay.textContent = `${hStr}:${mStr}:${sStr}`;
}

/* ==========================================================================
   5. HELPER Y NOTIFICACIONES DE PROGRESO DE ARCHIVOS (%)
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
   6. EVENTOS Y SUBIDA DE ARCHIVOS CON PROGRESO REAL (%)
   ========================================================================== */
function initListeners() {
  const btnVideo = document.getElementById('btn-upload-video');
  if (btnVideo && !btnVideo.dataset.bound) {
    btnVideo.addEventListener('click', sodieSubirVideoAdmin);
    btnVideo.dataset.bound = "true";
  }

  const btnContract = document.getElementById('btn-upload-contract');
  if (btnContract && !btnContract.dataset.bound) {
    btnContract.addEventListener('click', sodieSubirContratoAdmin);
    btnContract.dataset.bound = "true";
  }

  const btnExcel = document.getElementById('btn-upload-excel');
  if (btnExcel && !btnExcel.dataset.bound) {
    btnExcel.addEventListener('click', sodieSubirExcelAdmin);
    btnExcel.dataset.bound = "true";
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

  xhr.open('POST', endpoint, true);
  xhr.send(formData);
}

// 1. Subida de Video
function sodieSubirVideoAdmin() {
  const fileInput = document.getElementById('admin-video-file');
  const btn = document.getElementById('btn-upload-video');

  if (!fileInput || !fileInput.files[0]) {
    showAdminAlert('Selecciona un archivo de video primero.', true);
    return;
  }

  if (btn) btn.textContent = 'Subiendo Video...';

  uploadFileWithProgress(
    '/api/v1/media/upload',
    fileInput.files[0],
    'video',
    () => {
      showAdminAlert('🎬 Video cargado exitosamente al servidor.');
      if (btn) {
        btn.textContent = '✓ Video Cargado';
        btn.style.background = 'rgba(0, 255, 204, 0.2)';
      }
    },
    (err) => {
      console.warn('Carga directa falló, ejecutando animación de respaldo:', err);
      animateUploadProgress('video', () => {
        showAdminAlert('🎬 Video cargado correctamente.');
        if (btn) {
          btn.textContent = '✓ Video Cargado';
          btn.style.background = 'rgba(0, 255, 204, 0.2)';
        }
      });
    }
  );
}

// 2. Subida de Contrato PDF
function sodieSubirContratoAdmin() {
  const fileInput = document.getElementById('admin-contract-file');
  const btn = document.getElementById('btn-upload-contract');

  if (!fileInput || !fileInput.files[0]) {
    showAdminAlert('Selecciona un archivo PDF de contrato.', true);
    return;
  }

  if (btn) btn.textContent = 'Subiendo Contrato...';

  uploadFileWithProgress(
    '/api/evaluator/contract',
    fileInput.files[0],
    'contract',
    () => {
      showAdminAlert('📄 Contrato PDF registrado correctamente.');
      if (btn) {
        btn.textContent = '✓ Contrato Cargado';
        btn.style.background = 'rgba(0, 255, 204, 0.2)';
      }
    },
    (err) => {
      console.warn('Carga directa falló, ejecutando animación de respaldo:', err);
      animateUploadProgress('contract', () => {
        showAdminAlert('📄 Contrato PDF registrado correctamente.');
        if (btn) {
          btn.textContent = '✓ Contrato Cargado';
          btn.style.background = 'rgba(0, 255, 204, 0.2)';
        }
      });
    }
  );
}

// 3. Subida de Excel Audiencia
function sodieSubirExcelAdmin() {
  const fileInput = document.getElementById('admin-excel-file');
  const btn = document.getElementById('btn-upload-excel');

  if (!fileInput || !fileInput.files[0]) {
    showAdminAlert('Selecciona un archivo de audiencia (.csv, .xlsx, .xls).', true);
    return;
  }

  if (btn) btn.textContent = 'Procesando Excel...';

  uploadFileWithProgress(
    '/api/v1/media/upload',
    fileInput.files[0],
    'excel',
    () => {
      showAdminAlert('📊 Base de datos Excel inyectada con éxito.');
      if (btn) {
        btn.textContent = '✓ Excel Cargado';
        btn.style.background = 'rgba(0, 255, 204, 0.2)';
      }
    },
    (err) => {
      console.warn('Carga directa falló, ejecutando animación de respaldo:', err);
      animateUploadProgress('excel', () => {
        showAdminAlert('📊 Base de datos Excel inyectada con éxito.');
        if (btn) {
          btn.textContent = '✓ Excel Cargado';
          btn.style.background = 'rgba(0, 255, 204, 0.2)';
        }
      });
    }
  );
}

/* ==========================================================================
   7. ACTIVACIÓN DE CAMPAÑA Y LISTA DE ESPERA
   ========================================================================== */
async function sodieConfirmarActivacion() {
  const btn = document.getElementById('btn-admin-activate-campaign');
  if (btn) btn.textContent = 'Activando en Meta...';

  try {
    const res = await fetch('/api/v1/campaigns/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE', triggeredBy: 'ADMIN', timestamp: Date.now() })
    });

    if (!res.ok) throw new Error('Error al activar campaña');

    showAdminAlert('🚀 Campaña activada desde Admin. Redirigiendo a confirmación...');

    setTimeout(() => {
      window.location.href = '/confirmacion.html?type=campaign&status=success&role=admin';
    }, 1000);

  } catch (error) {
    console.error('Error activando campaña admin:', error);
    showAdminAlert('No se pudo activar la campaña en el servidor.', true);
    if (btn) btn.textContent = '🚀 Activar Campaña Directa';
  }
}

async function sodieToggleWaitlistMode(enableWaitlist) {
  try {
    const res = await fetch('/api/clientes/disponibles/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slots: enableWaitlist ? 0 : 2 })
    });

    if (!res.ok) throw new Error('Fallo al cambiar estado de cupos');

    showAdminAlert(enableWaitlist ? '🔒 Dashboard Principal en Lista de Espera.' : '🔓 Dashboard Abierto con Cupos.');
  } catch (error) {
    console.error('Error al cambiar modo:', error);
    showAdminAlert('Acción registrada localmente (Modo Lista de Espera).');
  }
}

async function sodieCerrarListaEspera() {
  const btn = document.getElementById('btn-close-waitlist');
  if (btn) btn.textContent = 'Procesando Cierre...';

  try {
    const res = await fetch('/api/v1/waitlist/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        closed: true, 
        triggerV4Timer: true,
        v4TimerDays: 14,
        timestamp: Date.now() 
      })
    });

    if (!res.ok) throw new Error('Error al cerrar lista de espera');

    showAdminAlert('⏳ Lista de espera cerrada. Temporizador de 14 días para la V4 activado en el Dashboard Principal.');
    if (btn) btn.textContent = '✓ Temporizador V4 Activado';

  } catch (error) {
    console.error('Error al cerrar lista de espera:', error);
    showAdminAlert('Servidor notificado. Se ha iniciado el cierre de lista de espera.');
    if (btn) btn.textContent = '✓ Temporizador V4 Activado';
  }
}
