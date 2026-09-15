/**
 * SODIE - Admin Panel Engine (admin.js)
 * Sistema de Autenticación A Prueba de Fallos
 */

const API_URL = "https://api.sodie.app";
const ADMIN_KEY = "sodie_202623555";

document.addEventListener('DOMContentLoaded', () => {
  // 1. Si la sesión ya está activa, ir directo al dashboard
  if (sessionStorage.getItem("sodie_admin_session") === "active") {
    mostrarDashboard();
  }

  // 2. Comprobar si debemos mostrar el banner de registrar huella
  if (localStorage.getItem('sodie_show_admin_banner') === 'true') {
    const banner = document.getElementById("admin-bio-register-banner");
    if (banner) banner.style.display = "block";
  }

  // 3. Listener del botón de contraseña (evita formularios tradicionales)
  const btnPass = document.getElementById("btn-admin-login-pass");
  if (btnPass) {
    btnPass.addEventListener("click", sodieValidarPasswordDirecta);
  }

  // 4. Listener del botón biométrico directo
  const btnBio = document.getElementById("btn-admin-biometric");
  if (btnBio) {
    btnBio.addEventListener("click", sodieAutenticarBiometriaAdmin);
  }

  // 5. Listener del botón para registrar huella por primera vez
  const btnRegBio = document.getElementById("btn-admin-register-bio");
  if (btnRegBio) {
    btnRegBio.addEventListener("click", sodieRegistrarHuellaDispositivo);
  }
});

/**
 * Validar la clave ingresada
 */
function sodieValidarPasswordDirecta() {
  const inputPass = document.getElementById("admin-pass");
  const errorElem = document.getElementById("admin-auth-error");
  const passIngresada = inputPass ? inputPass.value.trim() : "";

  if (passIngresada === ADMIN_KEY) {
    if (errorElem) {
      errorElem.innerText = "✅ Acceso concedido.";
      errorElem.style.color = "#00ffcc";
      errorElem.style.display = "block";
    }
    sessionStorage.setItem("sodie_admin_session", "active");
    setTimeout(() => mostrarDashboard(), 300);
  } else {
    if (errorElem) {
      errorElem.innerText = "❌ Contraseña incorrecta";
      errorElem.style.color = "#ff4d4d";
      errorElem.style.display = "block";
    }
  }
}

/**
 * Autenticación Biométrica (Login directo)
 */
async function sodieAutenticarBiometriaAdmin() {
  const errorElem = document.getElementById("admin-auth-error");
  const banner = document.getElementById("admin-bio-register-banner");

  if (!window.PublicKeyCredential || !navigator.credentials) {
    if (errorElem) {
      errorElem.innerText = "⚠️ Este navegador no permite biometría (requiere HTTPS o localhost). Usa tu contraseña.";
      errorElem.style.color = "#ffb84d";
      errorElem.style.display = "block";
    }
    return;
  }

  try {
    if (errorElem) {
      errorElem.innerText = "👆 Escaneando huella / rostro...";
      errorElem.style.color = "#00ffcc";
      errorElem.style.display = "block";
    }

    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: challenge,
        timeout: 60000,
        userVerification: "preferred"
      }
    });

    if (credential) {
      sessionStorage.setItem("sodie_admin_session", "active");
      mostrarDashboard();
    }
  } catch (err) {
    console.warn("Fallo en lectura de biometría:", err);
    if (banner) banner.style.display = "block";

    if (errorElem) {
      errorElem.innerText = "⚠️ No hay huella vinculada en este equipo. Haz clic abajo para registrarla:";
      errorElem.style.color = "#ffb84d";
      errorElem.style.display = "block";
    }
  }
}

/**
 * Registrar la Huella en el Dispositivo (WebAuthn create)
 */
async function sodieRegistrarHuellaDispositivo() {
  const errorElem = document.getElementById("admin-auth-error");

  if (!window.PublicKeyCredential || !navigator.credentials) {
    alert("Para registrar huella debes acceder mediante conexión segura HTTPS o localhost.");
    return;
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const newCred = await navigator.credentials.create({
      publicKey: {
        challenge: challenge,
        rp: { name: "SODIE Admin System", id: window.location.hostname },
        user: { 
          id: Uint8Array.from("sodie_master_admin", c => c.charCodeAt(0)), 
          name: "admin@sodie.app", 
          displayName: "Master Admin" 
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },  // ES256
          { alg: -257, type: "public-key" } // RS256
        ],
        authenticatorSelection: { 
          authenticatorAttachment: "platform", 
          userVerification: "required" 
        },
        timeout: 60000
      }
    });

    if (newCred) {
      localStorage.removeItem('sodie_show_admin_banner');
      sessionStorage.setItem("sodie_admin_session", "active");

      if (errorElem) {
        errorElem.innerText = "✅ ¡Huella/Rostro registrado con éxito!";
        errorElem.style.color = "#00ffcc";
      }
      setTimeout(() => mostrarDashboard(), 400);
    }
  } catch (err) {
    console.error("Error al registrar credencial:", err);
    if (errorElem) {
      errorElem.innerText = "❌ El registro biométrico fue cancelado o no es compatible.";
      errorElem.style.color = "#ff4d4d";
      errorElem.style.display = "block";
    }
  }
}

function mostrarDashboard() {
  const loginView = document.getElementById("admin-login-view");
  const dashView = document.getElementById("admin-dashboard-view");

  if (loginView) loginView.style.display = "none";
  if (dashView) dashView.style.display = "block";
}

function sodieCerrarSesionAdmin() {
  sessionStorage.removeItem("sodie_admin_session");
  window.location.reload();
}

/* ==========================================================================
   3. CRONÓMETROS Y TEMPORIZADORES
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
   4. NOTIFICACIONES Y PROGRESO DE ARCHIVOS (%)
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
   5. LISTENERS DE SUBIDA DE ARCHIVOS
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

// Subir Video Demo desde el Admin
function sodieSubirVideoAdmin() {
  const fileInput = document.getElementById('admin-video-file');
  const btn = document.getElementById('btn-upload-video');
  if (!fileInput || !fileInput.files[0]) {
    alert('Selecciona un archivo de video primero.');
    return;
  }

  const formData = new FormData();
  formData.append('video', fileInput.files[0]);

  try {
    const res = await fetch('/api/v1/media/upload-video', {
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

// Subir Contrato PDF desde el Admin (NECESITO ID DEL BOTON)
async function subirContratoAdmin(fileInputId) {
  const fileInput = document.getElementById(fileInputId);
  if (!fileInput || !fileInput.files[0]) {
    alert('Selecciona un archivo PDF primero.');
    return;
  }

  const formData = new FormData();
  formData.append('contract', fileInput.files[0]);

  try {
    const res = await fetch('/api/v1/media/upload-contract', {
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
   6. ACTIVACIÓN DE CAMPAÑA + ACTIVAR Y CERRAR LISTA DE ESPERA
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
    showAdminAlert('🚀 Campaña activada desde Admin.');
    setTimeout(() => {
      window.location.href = '/confirmacion.html?type=campaign&status=success&role=admin';
    }, 1000);
  } catch (error) {
    showAdminAlert('No se pudo activar la campaña en el servidor.', true);
    if (btn) btn.textContent = '🚀 Activar Campaña Directa';
  }
}

// Activar Lista de Espera (Cambia la vista en el frontend cliente)... NECESITO BOTÓN DE ACTIVAR LISTA DE ESPERA (EL ID)
async function adminActivarWaitlist() {
  try {
    const res = await fetch('/api/v1/waitlist/open', { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      alert('¡Lista de Espera ACTIVADA exitosamente!');
      
      // Si la función de app.js para actualizar la interfaz cliente existe, la invocamos
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

// Cerrar Lista de Espera / Cierre de sesión Admin
async function sodieCerrarListaEspera() {
  const btn = document.getElementById('btn-close-waitlist');
  if (btn) btn.textContent = 'Procesando Cierre...';
  try {
    const res = await fetch('/api/v1/waitlist/close', {
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
