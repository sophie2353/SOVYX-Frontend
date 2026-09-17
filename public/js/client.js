/**
 * SODIE - Client Dashboard Engine (client.js)
 * Flujo Secuencial: Subida de Excel (ID + Horas) -> Pago por Hora/ID -> Confirmación -> Activación de Campaña
 */

/* ==========================================================================
   1. HELPERS Y CONFIGURACIÓN INICIAL
   ========================================================================== */
function getBaseUrl() {
  if (window.SODIE_CONFIG && window.SODIE_CONFIG.API_URL) {
    return window.SODIE_CONFIG.API_URL.replace(/\/$/, '');
  }
  return window.location.origin;
}

function initClientPersistAndNotifications() {
  const clientId = getClientId(); // Detecta CLIENT-#01, CLIENT-#02, etc.

  // Guardar en localStorage para visitas futuras directas (sin URL param)
  if (clientId) {
    localStorage.setItem('sodie_client_id', clientId);
  }

  // Lanzar Notificación Push / Guardado de PWA
  solicitarPermisoNotificacionesYAccesoDirecto(clientId);
}

function solicitarPermisoNotificacionesYAccesoDirecto(clientId) {
  // 1. Notificación Push de bienvenida en el teléfono
  if ('Notification' in window && Notification.permission !== 'granted') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification('SODIE AI - Dashboard Activo', {
          body: `Bienvenido ${clientId}. Tu acceso directo ha sido configurado.`,
          icon: '/assets/icon.png'
        });
      }
    });
  }

  // 2. Notificación en pantalla (Toast) para guardar en la pantalla de inicio del teléfono
  showToast(
    'Guarda tu Dashboard', 
    `Estás ingresando como ${clientId}. Añade esta página a tu pantalla de inicio para ingresar siempre a tu panel.`
  );
}

function getClientId() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramId = urlParams.get('clientId') || urlParams.get('client_id') || urlParams.get('id');
  if (paramId) return paramId;

  if (window.SODIE_CONFIG && window.SODIE_CONFIG.CLIENT_ID) {
    return window.SODIE_CONFIG.CLIENT_ID;
  }

  const container = document.getElementById('app-dashboard') || document.body;
  if (container && container.dataset.clientId) {
    return container.dataset.clientId;
  }

  return localStorage.getItem('sodie_client_id') || 'CLIENT-#01'; // Fallback por defecto
}

/* ==========================================================================
   2. ESTADO GLOBAL
   ========================================================================== */
const CLIENT_STATE = {
  clientId: null,
  currentHours: 24, // Hora por defecto para el cliente (24, 48 o 72)
  excelUploaded: false,
  paymentConfirmed: false,
  campaignActivated: false,
  activeModalidad: '3_CUOTAS',
  paidInstallments: [],
  timerInterval: null,
  elapsedSeconds: 0,
  startTimeStamp: null
};

document.addEventListener('DOMContentLoaded', () => {
  initClientDashboard();
  initClientPersistAndNotifications();
});

function initClientDashboard() {
  CLIENT_STATE.clientId = getClientId();
  
  const clientIdBadge = document.getElementById('client-id-badge');
  if (clientIdBadge) {
    clientIdBadge.textContent = `Cliente: ${CLIENT_STATE.clientId}`;
  }

  fetchClientMetrics();
  initGlobalTimer();
  checkCallbackStatus();
  setupEventListeners();
}

/* ==========================================================================
   3. EVENT LISTENERS DE INTERFAZ
   ========================================================================== */
function setupEventListeners() {
  // 1. Subir Excel (con ID + Horas)
  const btnUpload = document.getElementById('btn-client-upload-excel');
  if (btnUpload) {
    btnUpload.addEventListener('click', sodieFlujoInyeccionCliente);
  }

  // 2. Activar Campaña (Bloqueado hasta completar el pago)
  const btnActivate = document.getElementById('btn-client-activate-campaign');
  if (btnActivate) {
    btnActivate.addEventListener('click', sodieConfirmarActivacionCliente);
  }

  // 3. Enlaces de Pago dinamizados por ID de Cliente + Horas (24, 48, 72)
  const btnPayH24 = document.getElementById('btn-pay-hora24');
  if (btnPayH24) btnPayH24.addEventListener('click', (e) => sodieProcesarPago(e, 24));

  const btnPayH48 = document.getElementById('btn-pay-hora48');
  if (btnPayH48) btnPayH48.addEventListener('click', (e) => sodieProcesarPago(e, 48));

  const btnPayH72 = document.getElementById('btn-pay-hora72');
  if (btnPayH72) btnPayH72.addEventListener('click', (e) => sodieProcesarPago(e, 72));
}

/* ==========================================================================
   4. NOTIFICACIONES Y UI FEEDBACK
   ========================================================================== */
function showToast(title, body, isError = false) {
  const toast = document.getElementById('toast-notification');
  const toastTitle = document.getElementById('toast-title');
  const toastBody = document.getElementById('toast-body');

  if (!toast || !toastTitle || !toastBody) return;

  toastTitle.textContent = title;
  toastBody.textContent = body;
  toast.style.borderColor = isError ? '#ff4d4d' : '#00ffcc';

  toast.classList.remove('hidden');
  toast.style.display = 'block';

  setTimeout(() => {
    toast.classList.add('hidden');
    toast.style.display = 'none';
  }, 4000);
}

/* ==========================================================================
   5. MÉTRICAS DE RENDIMIENTO (/api/facebook/metrics)
   ========================================================================== */
async function fetchClientMetrics() {
  const elSpend = document.getElementById('metric-spend');
  const elReach = document.getElementById('metric-reach');
  const elVisitors = document.getElementById('metric-visitors');

  try {
    const res = await fetch(`${getBaseUrl()}/api/facebook/metrics?clientId=${encodeURIComponent(CLIENT_STATE.clientId)}`);
    if (!res.ok) throw new Error('Error al cargar métricas');
    const data = await res.json();

    if (data) {
      if (elSpend) elSpend.textContent = `$${data.spend || 0}`;
      if (elReach) elReach.textContent = (data.reach || 0).toLocaleString();
      if (elVisitors) elVisitors.textContent = data.visitors || 0;
    }
  } catch (error) {
    if (elSpend) elSpend.textContent = '$0';
    if (elReach) elReach.textContent = '0';
    if (elVisitors) elVisitors.textContent = '0';
  }
}

/* ==========================================================================
   6. PASO 1: SUBIDA DE EXCEL DE AUDIENCIA (ENVÍA CLIENT ID + HORAS)
   ========================================================================== */
async function sodieFlujoInyeccionCliente() {
  const fileInput = document.getElementById('client-file-input');
  const btnUpload = document.getElementById('btn-client-upload-excel');

  if (!fileInput || !fileInput.files || !fileInput.files[0]) {
    showToast('Archivo Requerido', 'Por favor selecciona un archivo (.csv, .xlsx, .xls).', true);
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('clientId', CLIENT_STATE.clientId);
  formData.append('hours', CLIENT_STATE.currentHours); // Horas (24, 48, 72)

  if (btnUpload) {
    btnUpload.textContent = 'Procesando Excel...';
    btnUpload.disabled = true;
  }

  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/media/upload`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) throw new Error('Fallo al subir el archivo');

    CLIENT_STATE.excelUploaded = true;
    showToast('Audiencia Inyectada', `Excel cargado para ${CLIENT_STATE.clientId} (Hora ${CLIENT_STATE.currentHours}). Procede con el pago de la cuota.`);

    if (btnUpload) {
      btnUpload.textContent = '✓ Excel Cargado';
      btnUpload.style.background = 'rgba(0, 255, 204, 0.2)';
    }

    // Scroll suave hacia la sección de pagos
    const paymentSection = document.getElementById('payment-options-container');
    if (paymentSection) {
      paymentSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

  } catch (error) {
    console.error('Error subiendo audiencia:', error);
    showToast('Error de Carga', 'No se pudo subir el archivo al servidor.', true);
    if (btnUpload) {
      btnUpload.textContent = 'Subir Excel';
      btnUpload.disabled = false;
    }
  }
}

/* ==========================================================================
   7. PASO 2: PROCESAMIENTO DE PAGO SEGÚN ID DE CLIENTE Y HORAS (24, 48, 72)
   ========================================================================== */
async function sodieProcesarPago(event, hours) {
  if (event) event.preventDefault();

  if (!CLIENT_STATE.excelUploaded) {
    showToast('Paso Requerido', 'Primero debes subir el archivo Excel de audiencia.', true);
    const fileInput = document.getElementById('client-file-input');
    if (fileInput) fileInput.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  CLIENT_STATE.currentHours = hours;
  showToast('Iniciando Pago', `Generando checkout para ${CLIENT_STATE.clientId} (Hora ${hours})...`);

  try {
    // Solicitud a la pasarela incluyendo clientId y hours
    const res = await fetch(`${getBaseUrl()}/api/pasarela/get-link?clientId=${encodeURIComponent(CLIENT_STATE.clientId)}&hours=${hours}`);
    
    if (!res.ok) throw new Error('No se pudo conectar con la pasarela de pago');
    const data = await res.json();

    if (!data.success || !data.blocks || data.blocks.length === 0) {
      throw new Error(data.error || 'No se obtuvieron enlaces de pago válidos.');
    }

    const currentBlock = data.blocks[0];

    if (currentBlock && currentBlock.url) {
      window.location.href = currentBlock.url;
    } else {
      window.location.href = `/confirmacion.html?type=payment&hours=${hours}&clientId=${encodeURIComponent(CLIENT_STATE.clientId)}&status=success`;
    }

  } catch (error) {
    console.error('Error al procesar pago:', error);
    showToast('Error de Pasarela', error.message || 'No se pudo conectar con la pasarela de pago.', true);
  }
}

/* ==========================================================================
   8. PASO 3: CONFIRMACIÓN DE PAGO (RETORNO DE CONFIRMACION.HTML) Y ACTIVACIÓN
   ========================================================================== */
function checkCallbackStatus() {
  const urlParams = new URLSearchParams(window.location.search);
  const type = urlParams.get('type');
  const status = urlParams.get('status');
  const hours = urlParams.get('hours') || urlParams.get('quota');

  if (status === 'success' || status === 'confirmed') {
    if (type === 'payment' || hours) {
      CLIENT_STATE.paymentConfirmed = true;
      CLIENT_STATE.excelUploaded = true;
      if (hours) CLIENT_STATE.currentHours = parseInt(hours, 10);

      showToast('Pago Confirmado', `Pago registrado para ${CLIENT_STATE.clientId} (Hora ${hours || 'activa'}). Ahora puedes activar la campaña.`);

      // HABILITAR Y DESPLEGAR EL BOTÓN ACTIVAR CAMPAÑA
      const btnActivate = document.getElementById('btn-client-activate-campaign');
      if (btnActivate) {
        btnActivate.classList.remove('hidden');
        btnActivate.style.display = 'block';
        btnActivate.disabled = false;
        btnActivate.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      // Marcar cuota/hora como pagada en la interfaz
      if (hours) {
        const btnQuota = document.getElementById(`btn-pay-hora${hours}`);
        if (btnQuota) {
          btnQuota.textContent = `✓ Hora ${hours} Pagada`;
          btnQuota.style.background = 'rgba(0, 255, 204, 0.25)';
          btnQuota.onclick = null;
        }
      }
    }

    if (type === 'campaign') {
      CLIENT_STATE.campaignActivated = true;
      const btnActivate = document.getElementById('btn-client-activate-campaign');
      if (btnActivate) {
        btnActivate.classList.remove('hidden');
        btnActivate.textContent = '✓ Campaña en Ejecución';
        btnActivate.style.background = 'rgba(0, 255, 204, 0.3)';
        btnActivate.disabled = true;
      }
      showToast('Campaña en Ejecución', 'Tráfico e inyección activos en Meta Ads.');
      fetchClientMetrics();
    }
  }
}

/* ==========================================================================
   9. PASO 4: ACTIVACIÓN DE CAMPAÑA FINAL EN META ADS
   ========================================================================== */
async function sodieConfirmarActivacionCliente() {
  if (!CLIENT_STATE.paymentConfirmed && !CLIENT_STATE.campaignActivated) {
    showToast('Acceso Restringido', 'Debes completar el pago de la cuota antes de activar la campaña.', true);
    return;
  }

  const btnActivate = document.getElementById('btn-client-activate-campaign');
  if (btnActivate) {
    btnActivate.textContent = 'Activando en Meta Ads...';
    btnActivate.disabled = true;
  }

  try {
    const res = await fetch(`${getBaseUrl()}/api/facebook/activar-campana`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: CLIENT_STATE.clientId,
        hours: CLIENT_STATE.currentHours,
        status: 'ACTIVE',
        timestamp: Date.now()
      })
    });

    if (!res.ok) throw new Error('Error al enviar orden de activación');

    showToast('Éxito', 'Campaña activada correctamente.');

    setTimeout(() => {
      window.location.href = `/confirmacion.html?type=campaign&status=success&clientId=${encodeURIComponent(CLIENT_STATE.clientId)}`;
    }, 1000);

  } catch (error) {
    console.error('Error activando campaña:', error);
    showToast('Error', 'No se pudo activar la campaña en el servidor.', true);
    if (btnActivate) {
      btnActivate.textContent = 'Activar Campaña';
      btnActivate.disabled = false;
    }
  }
}

/* ==========================================================================
   10. TEMPORIZADORES EN TIEMPO REAL
   ========================================================================== */
function initGlobalTimer() {
  const globalTimerDisplay = document.getElementById('global-timer-display');
  const timer24hDisplay = document.getElementById('timer-24h-display');
  const timerPostDisplay = document.getElementById('timer-post-display');

  if (CLIENT_STATE.timerInterval) clearInterval(CLIENT_STATE.timerInterval);

  const savedStartTime = localStorage.getItem(`sodie_timer_start_${CLIENT_STATE.clientId}`);
  if (savedStartTime) {
    CLIENT_STATE.startTimeStamp = parseInt(savedStartTime, 10);
  } else {
    CLIENT_STATE.startTimeStamp = Date.now();
    localStorage.setItem(`sodie_timer_start_${CLIENT_STATE.clientId}`, CLIENT_STATE.startTimeStamp.toString());
  }

  const MAX_SECONDS = 96 * 3600;
  const SECONDS_24H = 24 * 3600;

  const updateTimerTick = () => {
    const now = Date.now();
    CLIENT_STATE.elapsedSeconds = Math.floor((now - CLIENT_STATE.startTimeStamp) / 1000);

    if (CLIENT_STATE.elapsedSeconds >= MAX_SECONDS) {
      CLIENT_STATE.elapsedSeconds = MAX_SECONDS;
      if (CLIENT_STATE.timerInterval) clearInterval(CLIENT_STATE.timerInterval);
    }

    const h = Math.floor(CLIENT_STATE.elapsedSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((CLIENT_STATE.elapsedSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (CLIENT_STATE.elapsedSeconds % 60).toString().padStart(2, '0');
    const timeFormatted = `${h}:${m}:${s}`;

    if (globalTimerDisplay) globalTimerDisplay.textContent = timeFormatted;

    if (CLIENT_STATE.elapsedSeconds <= SECONDS_24H) {
      if (timer24hDisplay) timer24hDisplay.textContent = timeFormatted;
    } else {
      if (timer24hDisplay) timer24hDisplay.textContent = "24:00:00 (Completado)";
    }

    if (CLIENT_STATE.elapsedSeconds > SECONDS_24H) {
      const postSeconds = CLIENT_STATE.elapsedSeconds - SECONDS_24H;
      const ph = Math.floor(postSeconds / 3600).toString().padStart(2, '0');
      const pm = Math.floor((postSeconds % 3600) / 60).toString().padStart(2, '0');
      const ps = (postSeconds % 60).toString().padStart(2, '0');
      if (timerPostDisplay) timerPostDisplay.textContent = `${ph}:${pm}:${ps}`;
    } else {
      if (timerPostDisplay) timerPostDisplay.textContent = "00:00:00 (En Espera)";
    }
  };

  updateTimerTick();
  CLIENT_STATE.timerInterval = setInterval(updateTimerTick, 1000);
}
