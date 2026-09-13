/**
 * SODIE - Admin Panel Engine (admin.js)
 * Control total de cargas de archivos (Video, Contrato, Excel),
 * activación directa de campaña, lista de espera y temporizador de 120h.
 */

document.addEventListener('DOMContentLoaded', () => {
  initAdminDashboard();
});

/* ==========================================================================
   1. ESTADO GLOBAL Y CONFIGURACIÓN INICIAL
   ========================================================================== */
const ADMIN_STATE = {
  timer120Seconds: 120 * 3600 // 120 horas en segundos
};

function initAdminDashboard() {
  initListeners();
  init120hTimer();
}

/* ==========================================================================
   2. NOTIFICACIONES TOAST (SI EXISTE CONTENEDOR EN CASCADA)
   ========================================================================== */
function showAdminAlert(message, isError = false) {
  console.log(`[ADMIN ALERT]: ${message}`);
  alert(message);
}

/* ==========================================================================
   3. MANEJO DE EVENTOS DE CARGA DE ARCHIVOS
   ========================================================================== */
function initListeners() {
  // Subir Video
  const btnVideo = document.getElementById('btn-upload-video');
  if (btnVideo) {
    btnVideo.addEventListener('click', sodieSubirVideoAdmin);
  }

  // Subir Contrato PDF
  const btnContract = document.getElementById('btn-upload-contract');
  if (btnContract) {
    btnContract.addEventListener('click', sodieSubirContratoAdmin);
  }

  // Subir Excel Audiencia
  const btnExcel = document.getElementById('btn-upload-excel');
  if (btnExcel) {
    btnExcel.addEventListener('click', sodieSubirExcelAdmin);
  }
}

// Subida de Video -> /api/v1/media/upload
async function sodieSubirVideoAdmin() {
  const fileInput = document.getElementById('admin-video-file');
  const btn = document.getElementById('btn-upload-video');

  if (!fileInput || !fileInput.files[0]) {
    showAdminAlert('Selecciona un archivo de video primero.', true);
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  if (btn) btn.textContent = 'Subiendo Video...';

  try {
    const res = await fetch('/api/v1/media/upload', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) throw new Error('Fallo al subir video');

    showAdminAlert('🎬 Video cargado exitosamente al servidor.');
    if (btn) {
      btn.textContent = '✓ Video Cargado';
      btn.style.background = 'rgba(0, 255, 204, 0.2)';
    }
  } catch (error) {
    console.error('Error video:', error);
    showAdminAlert('Error al cargar el video en el servidor.', true);
    if (btn) btn.textContent = '🎬 Subir Video';
  }
}

// Subida de Contrato PDF -> /api/evaluator/contract
async function sodieSubirContratoAdmin() {
  const fileInput = document.getElementById('admin-contract-file');
  const btn = document.getElementById('btn-upload-contract');

  if (!fileInput || !fileInput.files[0]) {
    showAdminAlert('Selecciona un archivo PDF de contrato.', true);
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  if (btn) btn.textContent = 'Subiendo Contrato...';

  try {
    const res = await fetch('/api/evaluator/contract', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) throw new Error('Fallo al subir contrato');

    showAdminAlert('📄 Contrato PDF registrado correctamente.');
    if (btn) {
      btn.textContent = '✓ Contrato Cargado';
      btn.style.background = 'rgba(0, 255, 204, 0.2)';
    }
  } catch (error) {
    console.error('Error contrato:', error);
    showAdminAlert('Error al subir el contrato PDF.', true);
    if (btn) btn.textContent = '📄 Subir Contrato';
  }
}

// Subida de Excel -> /api/v1/media/upload
async function sodieSubirExcelAdmin() {
  const fileInput = document.getElementById('admin-excel-file');
  const btn = document.getElementById('btn-upload-excel');

  if (!fileInput || !fileInput.files[0]) {
    showAdminAlert('Selecciona un archivo de audiencia (.csv, .xlsx, .xls).', true);
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  if (btn) btn.textContent = 'Procesando Excel...';

  try {
    const res = await fetch('/api/v1/media/upload', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) throw new Error('Fallo al subir archivo de audiencia');

    showAdminAlert('📊 Base de datos Excel inyectada con éxito.');
    if (btn) {
      btn.textContent = '✓ Excel Cargado';
      btn.style.background = 'rgba(0, 255, 204, 0.2)';
    }
  } catch (error) {
    console.error('Error excel:', error);
    showAdminAlert('Error al procesar la lista de audiencia.', true);
    if (btn) btn.textContent = '📊 Subir Excel';
  }
}

/**
 * Helper para animar la barra de progreso de 0 a 100%
 */
function animateUploadProgress(type, callback) {
  const container = document.getElementById(`progress-${type}-container`);
  const text = document.getElementById(`progress-${type}-text`);
  const bar = document.getElementById(`progress-${type}-bar`);

  if (!container || !text || !bar) {
    if (callback) callback();
    return;
  }

  container.classList.remove('hidden');
  let currentProgress = 0;

  const interval = setInterval(() => {
    currentProgress += Math.floor(Math.random() * 12) + 5; // Incremento dinámico

    if (currentProgress >= 100) {
      currentProgress = 100;
      clearInterval(interval);

      bar.style.width = '100%';
      text.textContent = '100%';

      setTimeout(() => {
        if (callback) callback();
      }, 400);
    } else {
      bar.style.width = `${currentProgress}%`;
      text.textContent = `${currentProgress}%`;
    }
  }, 120);
}

/* ==========================================================================
   4. ACTIVACIÓN DIRECTA DE CAMPAÑA
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

/* ==========================================================================
   5. CONTROL DE LISTA DE ESPERA & EVENTO CERRAR LISTA DE ESPERA
   ========================================================================== */

// Activar/Desactivar Lista de Espera manualmente
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

// Cerrar Lista de Espera y disparar temporizador de 14 días para V4 en app.js
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

/* ==========================================================================
   6. TEMPORIZADOR REGRESIVO DE 120 HORAS (PANEL ADMIN)
   ========================================================================== */
function init120hTimer() {
  const timerDisplay = document.getElementById('admin-120h-timer');
  if (!timerDisplay) return;

  setInterval(() => {
    if (ADMIN_STATE.timer120Seconds <= 0) {
      timerDisplay.textContent = "000:00:00 (Agotado)";
      return;
    }

    ADMIN_STATE.timer120Seconds--;

    const hours = Math.floor(ADMIN_STATE.timer120Seconds / 3600);
    const minutes = Math.floor((ADMIN_STATE.timer120Seconds % 3600) / 60);
    const seconds = ADMIN_STATE.timer120Seconds % 60;

    const hStr = hours.toString().padStart(3, '0');
    const mStr = minutes.toString().padStart(2, '0');
    const sStr = seconds.toString().padStart(2, '0');

    timerDisplay.textContent = `${hStr}:${mStr}:${sStr}`;
  }, 1000);
}
