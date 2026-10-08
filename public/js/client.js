/**
 * SODIE - Client Dashboard Engine (client.js)
 * Flujo Simplificado: Autenticación por Contraseña + Selección de ID de Cliente + Bypass de Admin
 */

function getBaseUrl() {
  if (window.SODIE_CONFIG && window.SODIE_CONFIG.API_URL) {
    return window.SODIE_CONFIG.API_URL.replace(/\/$/, '');
  }
  return window.location.origin;
}

/* ==========================================================================
   0. DETECCIÓN Y ACCESO DE ADMINISTRADOR
   ========================================================================== */
function getClientId() {
  const sessionClientId = sessionStorage.getItem('sodie_authenticated_client_id');
  if (sessionClientId) return sessionClientId;

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

  return localStorage.getItem('sodie_client_id') || 'CLIENT-01';
}

function initClientPersistAndNotifications() {
  const clientId = getClientId();

  if (clientId) {
    localStorage.setItem('sodie_client_id', clientId);
  }

  solicitarPermisoNotificacionesYAccesoDirecto(clientId);
}

function solicitarPermisoNotificacionesYAccesoDirecto(clientId) {
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

  showToast(
    'Guarda tu Dashboard', 
    `Estás ingresando como ${clientId}. Añade esta página a tu pantalla de inicio para ingresar siempre a tu panel.`
  );
}

/* ==========================================================================
   2. ESTADO GLOBAL DE CLIENTE
   ========================================================================== */
const CLIENT_STATE = {
  clientId: null,
  isAuthenticated: false,
  isAdminView: false,
  isGeneralView: false,
  currentWeek: 1,
  excelUploaded: false,
  paymentConfirmed: false,
  campaignActivated: false,
  timerInterval: null,
  elapsedSeconds: 0,
  startTimeStamp: null
};

document.addEventListener('DOMContentLoaded', () => {
  initClientDashboard();
  initClientPersistAndNotifications();
});

function initClientDashboard() {
  const urlParams = new URLSearchParams(window.location.search);
  CLIENT_STATE.isAdminView = esAccesoAdmin();
  CLIENT_STATE.isGeneralView = urlParams.get('view') === 'general';

  // Si se accede en modo Administrador, omitimos autenticación
  if (CLIENT_STATE.isAdminView) {
    CLIENT_STATE.isAuthenticated = true;
    CLIENT_STATE.clientId = getClientId();
    
    if (CLIENT_STATE.isGeneralView) {
      CLIENT_STATE.clientId = 'VISTA-GENERAL-ADMIN';
    }

    showToast('Modo Admin Activo', `Inspeccionando vista: ${CLIENT_STATE.clientId}`);
  } else {
    CLIENT_STATE.clientId = getClientId();

    if (sessionStorage.getItem('sodie_authenticated_client_id')) {
      CLIENT_STATE.isAuthenticated = true;
      CLIENT_STATE.clientId = sessionStorage.getItem('sodie_authenticated_client_id');
    }
  }

  updateClientSessionUI();
  fetchClientMetrics();
  initGlobalAndWeeklyTimers();
  checkCallbackStatus();
  setupEventListeners();
}

function updateClientSessionUI() {
  const clientIdBadge = document.getElementById('client-id-badge');
  if (clientIdBadge) {
    if (CLIENT_STATE.isAdminView) {
      clientIdBadge.textContent = `Modo Admin | Vista: ${CLIENT_STATE.clientId} 🔓`;
      clientIdBadge.style.color = '#00FFCC';
    } else {
      clientIdBadge.textContent = `Cliente: ${CLIENT_STATE.clientId} ${CLIENT_STATE.isAuthenticated ? '🔒 (Sesión Activa)' : '⚠️ (Sin Autenticar)'}`;
    }
  }

  const authView = document.getElementById('client-auth-view');
  if (authView) {
    authView.style.display = CLIENT_STATE.isAuthenticated ? 'none' : 'block';
  }

  const dashboardView = document.getElementById('client-dashboard-content') || document.getElementById('app-dashboard');
  if (dashboardView && CLIENT_STATE.isAuthenticated) {
    dashboardView.style.display = 'block';
  }
}

/* ==========================================================================
   3. AUTENTICACIÓN POR CONTRASEÑA E ID DE CLIENTE
   ========================================================================== */
window.sodieRegistrarPasswordCliente = async function() {
  const idInput = document.getElementById('client-id-input') || document.getElementById('client-id-select');
  const passInput = document.getElementById('client-register-pass') || document.getElementById('client-pass-input');
  const errorElem = document.getElementById('client-auth-error');

  const password = passInput ? passInput.value.trim() : '';
  let selectedClientId = idInput ? idInput.value.trim().toUpperCase() : getClientId();

  if (!selectedClientId) selectedClientId = 'CLIENT-01';

  if (!password) {
    showToast('Campo Requerido', 'Ingresa una contraseña para ingresar.', true);
    return;
  }

  // =========================================================================
  // 🤠 MODO ADMIN MAESTRO: CLIENT-0 (O CLIENT-ID-0)
  // Permite ingresar directamente a la vista de cliente sin restricciones
  // =========================================================================
  if (selectedClientId === 'CLIENT-0' || selectedClientId === 'CLIENT-ID-0' || selectedClientId === 'CLIENT-#0') {
    sessionStorage.setItem('sodie_authenticated_client_id', 'CLIENT-0');
    localStorage.setItem('sodie_admin_bypass', 'true');
    
    CLIENT_STATE.isAuthenticated = true;
    CLIENT_STATE.clientId = 'CLIENT-0';

    updateClientSessionUI();
    fetchClientMetrics();
    initGlobalAndWeeklyTimers();

    showToast('Acceso Admin Maestro', 'Iniciaste sesión como CLIENT-0 👑');
    return;
  }

  // =========================================================================
  // FLUJO REGULAR CLIENTES: Registro inicial / Autenticación
  // =========================================================================
  try {
    const response = await fetch(`${getBaseUrl()}/api/client/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: selectedClientId, password })
    });

    const data = await response.json();

    if (data.success || response.ok) {
      sessionStorage.setItem('sodie_authenticated_client_id', selectedClientId);
      CLIENT_STATE.isAuthenticated = true;
      CLIENT_STATE.clientId = selectedClientId;

      updateClientSessionUI();
      fetchClientMetrics();
      initGlobalAndWeeklyTimers();

      showToast('¡Acceso Concedido!', `Bienvenido a tu Dashboard: ${selectedClientId}`);
    } else {
      // Si la API indica que ya está registrado, intentamos hacer login automático
      if (data.message && data.message.includes('ya fue registrado')) {
        await sodieValidarPasswordCliente();
        return;
      }

      if (errorElem) {
        errorElem.textContent = `❌ ${data.message}`;
        errorElem.style.display = 'block';
      }
      showToast('Error de Autenticación', data.message, true);
    }
  } catch (err) {
    // Fallback de desarrollo
    sessionStorage.setItem('sodie_authenticated_client_id', selectedClientId);
    CLIENT_STATE.isAuthenticated = true;
    CLIENT_STATE.clientId = selectedClientId;
    
    updateClientSessionUI();
    fetchClientMetrics();
    initGlobalAndWeeklyTimers();
    
    showToast('Sesión Iniciada', `Dashboard cargado para ${selectedClientId}`);
  }
};

window.sodieCerrarSesionCliente = function() {
  sessionStorage.removeItem('sodie_authenticated_client_id');
  localStorage.removeItem('sodie_admin_bypass');
  CLIENT_STATE.isAuthenticated = false;
  CLIENT_STATE.isAdminView = false;
  window.location.reload();
};

/* ==========================================================================
   4. EVENT LISTENERS DE INTERFAZ Y BINDINGS DE SELECTORES
   ========================================================================== */
function setupEventListeners() {
  const brandTitle = document.getElementById('header-brand-title');
  if (brandTitle && !brandTitle.dataset.bound) {
    brandTitle.addEventListener('click', () => {
      window.location.reload();
    });
    brandTitle.dataset.bound = "true";
  }

  const btnLoginPass = document.getElementById('btn-client-pass-login') || document.getElementById('btn-client-login');
  if (btnLoginPass && !btnLoginPass.dataset.bound) {
    btnLoginPass.addEventListener('click', (e) => {
      e.preventDefault();
      window.sodieValidarPasswordCliente();
    });
    btnLoginPass.dataset.bound = "true";
  }

  const inputPass = document.getElementById('client-pass-input') || document.getElementById('client-pass');
  if (inputPass && !inputPass.dataset.bound) {
    inputPass.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        window.sodieValidarPasswordCliente();
      }
    });
    inputPass.dataset.bound = "true";
  }

  const btnUpload = document.getElementById('btn-client-upload-excel');
  if (btnUpload && !btnUpload.dataset.bound) {
    btnUpload.addEventListener('click', (e) => {
      e.preventDefault();
      sodieFlujoInyeccionCliente();
    });
    btnUpload.dataset.bound = "true";
  }

  const cardInjectionFlow = document.getElementById('card-injection-flow');
  if (cardInjectionFlow && !cardInjectionFlow.dataset.bound) {
    cardInjectionFlow.addEventListener('click', (e) => {
      e.preventDefault();
      sodieFlujoInyeccionCliente();
    });
    cardInjectionFlow.dataset.bound = "true";
  }

  const btnActivate = document.getElementById('btn-client-activate-campaign');
  if (btnActivate && !btnActivate.dataset.bound) {
    btnActivate.addEventListener('click', (e) => {
      e.preventDefault();
      sodieConfirmarActivacionCliente();
    });
    btnActivate.dataset.bound = "true";
  }

  const btnPaySemana1 = document.getElementById('btn-pay-semana1');
  if (btnPaySemana1 && !btnPaySemana1.dataset.bound) {
    btnPaySemana1.addEventListener('click', (e) => sodieProcesarPagoSemanal(e, 1));
    btnPaySemana1.dataset.bound = "true";
  }

  const btnPaySemana2 = document.getElementById('btn-pay-semana2');
  if (btnPaySemana2 && !btnPaySemana2.dataset.bound) {
    btnPaySemana2.addEventListener('click', (e) => sodieProcesarPagoSemanal(e, 2));
    btnPaySemana2.dataset.bound = "true";
  }

  const btnPaySemana3 = document.getElementById('btn-pay-semana3');
  if (btnPaySemana3 && !btnPaySemana3.dataset.bound) {
    btnPaySemana3.addEventListener('click', (e) => sodieProcesarPagoSemanal(e, 3));
    btnPaySemana3.dataset.bound = "true";
  }

  const metricsSlider = document.getElementById('metrics-slider');
  if (metricsSlider && !metricsSlider.dataset.bound) {
    metricsSlider.addEventListener('input', (e) => {
      const val = e.target.value;
      const metricActivos = document.getElementById('metric-activos');
      if (metricActivos) metricActivos.textContent = `${val}% Proyectado`;
    });
    metricsSlider.dataset.bound = "true";
  }
}

/* ==========================================================================
   5. NOTIFICACIONES Y UI FEEDBACK
   ========================================================================== */
function showToast(title, body, isError = false) {
  const toast = document.getElementById('toast-notification');
  const toastTitle = document.getElementById('toast-title');
  const toastBody = document.getElementById('toast-body');

  if (!toast || !toastTitle || !toastBody) return;

  toastTitle.textContent = title;
  toastBody.textContent = body;
  toast.style.borderColor = isError ? '#ff007a' : '#00ffcc';

  toast.classList.remove('hidden');
  toast.style.display = 'block';

  setTimeout(() => {
    toast.classList.add('hidden');
    toast.style.display = 'none';
  }, 4000);
}

/* ==========================================================================
   6. MÉTRICAS DE RENDIMIENTO Y ACTUALIZACIÓN DINÁMICA
   ========================================================================== */
async function fetchClientMetrics() {
  const elSpend = document.getElementById('metric-spend');
  const elReach = document.getElementById('metric-reach');
  const elVisitors = document.getElementById('metric-visitors');

  const elSpendStatus = document.getElementById('metric-spend-status');
  const elReachStatus = document.getElementById('metric-reach-status');
  const elActivos = document.getElementById('metric-activos');

  try {
    const res = await fetch(`${getBaseUrl()}/api/facebook/metrics?clientId=${encodeURIComponent(CLIENT_STATE.clientId)}`);
    if (!res.ok) throw new Error('Error al cargar métricas');
    const data = await res.json();

    if (data) {
      if (elSpend) elSpend.textContent = `$${(data.spend || 0).toLocaleString()}`;
      if (elReach) elReach.textContent = (data.reach || 0).toLocaleString();
      if (elVisitors) elVisitors.textContent = (data.visitors || 0).toLocaleString();

      if (elSpendStatus) elSpendStatus.textContent = '🟢 Presupuesto en optimización';
      if (elReachStatus) elReachStatus.textContent = '🟢 Cobertura activa';
      if (elActivos) elActivos.textContent = `${data.activos || 1} Campaña(s) Activa(s)`;
    }
  } catch (error) {
    if (elSpend) elSpend.textContent = '$0';
    if (elReach) elReach.textContent = '0';
    if (elVisitors) elVisitors.textContent = '0';

    if (elSpendStatus) elSpendStatus.textContent = '⚪ Esperando activación';
    if (elReachStatus) elReachStatus.textContent = '⚪ Sin tráfico registrado';
    if (elActivos) elActivos.textContent = '0 Campañas';
  }
}

/* ==========================================================================
   7. PASO 1: SUBIDA DIARIA DE EXCEL DE AUDIENCIA (24 HOURS)
   ========================================================================== */
async function sodieFlujoInyeccionCliente() {
  const fileInput = document.getElementById('client-file-input');
  const btnUpload = document.getElementById('btn-client-upload-excel');

  if (!CLIENT_STATE.isAuthenticated) {
    showToast('Autenticación Requerida', 'Debes iniciar sesión para subir audiencias.', true);
    return;
  }

  if (!fileInput || !fileInput.files || !fileInput.files[0]) {
    showToast('Archivo Requerido', 'Por favor selecciona un archivo de audiencia (.csv, .xlsx, .xls).', true);
    return;
  }

  const elapsedDays = Math.floor(CLIENT_STATE.elapsedSeconds / 86400);
  if (elapsedDays >= 7 && !CLIENT_STATE.paymentConfirmed && !CLIENT_STATE.isAdminView) {
    showToast('Pago Requerido', 'Debes liquidar la cuota semanal ($6,000 USDT) para habilitar la inyección.', true);
    const lockWarning = document.getElementById('weekly-payment-lock-warning');
    if (lockWarning) lockWarning.classList.remove('hidden');
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('clientId', CLIENT_STATE.clientId);

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
    showToast('Audiencia Inyectada', `Excel cargado exitosamente para ${CLIENT_STATE.clientId}. Recargando ciclo de 24h.`);

    if (btnUpload) {
      btnUpload.textContent = '✓ Excel Cargado Hoy';
      btnUpload.style.background = 'rgba(0, 255, 204, 0.2)';
    }

    localStorage.setItem(`sodie_last_excel_time_${CLIENT_STATE.clientId}`, Date.now().toString());

    const btnActivate = document.getElementById('btn-client-activate-campaign');
    if (btnActivate) {
      btnActivate.classList.remove('hidden');
    }

  } catch (error) {
    showToast('Error de Carga', 'No se pudo subir el archivo al servidor.', true);
    if (btnUpload) {
      btnUpload.textContent = 'Subir Excel (Paso Diario)';
      btnUpload.disabled = false;
    }
  }
}

/* ==========================================================================
   8. PASO 2: CONFIRMACIÓN Y REGISTRO DE PAGO SEMANAL ($6,000 USDT)
   ========================================================================== */


/* ==========================================================================
   9. PASO 3: REVISIÓN DE CALLBACK DE REDIRECCIÓN
   ========================================================================== */
function checkCallbackStatus() {
  const urlParams = new URLSearchParams(window.location.search);
  const status = urlParams.get('status');
  const type = urlParams.get('type');

  if (status === 'success' || status === 'confirmed') {
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
   10. PASO 4: ACTIVACIÓN DE CAMPAÑA FINAL EN META ADS
   ========================================================================== */
async function sodieConfirmarActivacionCliente() {
  if (!CLIENT_STATE.isAuthenticated) {
    showToast('Autenticación Requerida', 'Ingresa con tu contraseña de cliente para activar la campaña.', true);
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
        week: CLIENT_STATE.currentWeek,
        status: 'ACTIVE',
        timestamp: Date.now()
      })
    });

    if (!res.ok) throw new Error('Error al enviar orden de activación');

    showToast('Éxito', 'Campaña activada correctamente en Meta Ads.');

    if (btnActivate) {
      btnActivate.textContent = '✓ Campaña Activa';
      btnActivate.style.background = 'rgba(0, 255, 204, 0.3)';
    }

    fetchClientMetrics();

  } catch (error) {
    showToast('Error', 'No se pudo activar la campaña en el servidor.', true);
    if (btnActivate) {
      btnActivate.textContent = 'Activar Campaña';
      btnActivate.disabled = false;
    }
  }
}

/* ==========================================================================
   11. TEMPORIZADORES EN TIEMPO REAL CON NOTIFICACIÓN BACKEND (24H / 7 DÍAS)
   ========================================================================== */
function initGlobalAndWeeklyTimers() {
  const globalTimerDisplay = document.getElementById('global-timer-display');
  const timer24hDisplay = document.getElementById('timer-24h-display');
  const timerWeeklyPayDisplay = document.getElementById('timer-weekly-pay-display');

  if (CLIENT_STATE.timerInterval) clearInterval(CLIENT_STATE.timerInterval);

  const savedStartTime = localStorage.getItem(`sodie_timer_start_${CLIENT_STATE.clientId}`);
  const parsedStart = parseInt(savedStartTime, 10);

  if (savedStartTime && !isNaN(parsedStart)) {
    CLIENT_STATE.startTimeStamp = parsedStart;
  } else {
    CLIENT_STATE.startTimeStamp = Date.now();
    localStorage.setItem(`sodie_timer_start_${CLIENT_STATE.clientId}`, CLIENT_STATE.startTimeStamp.toString());
  }

  const MAX_GLOBAL_SECONDS = 28 * 86400;
  const SECONDS_24H = 24 * 3600;
  const SECONDS_WEEK = 7 * 86400;

  const updateTimerTick = async () => {
    const now = Date.now();
    CLIENT_STATE.elapsedSeconds = Math.max(0, Math.floor((now - CLIENT_STATE.startTimeStamp) / 1000));

    if (CLIENT_STATE.elapsedSeconds >= MAX_GLOBAL_SECONDS) {
      CLIENT_STATE.elapsedSeconds = MAX_GLOBAL_SECONDS;
      const sectionComplete = document.getElementById('section-week-4-complete');
      if (sectionComplete) sectionComplete.classList.remove('hidden');
      if (CLIENT_STATE.timerInterval) clearInterval(CLIENT_STATE.timerInterval);
    }

    const gDays = Math.floor(CLIENT_STATE.elapsedSeconds / 86400);
    const gHours = Math.floor((CLIENT_STATE.elapsedSeconds % 86400) / 3600).toString().padStart(2, '0');
    const gMins = Math.floor((CLIENT_STATE.elapsedSeconds % 3600) / 60).toString().padStart(2, '0');
    const gSecs = (CLIENT_STATE.elapsedSeconds % 60).toString().padStart(2, '0');

    if (globalTimerDisplay) {
      globalTimerDisplay.textContent = `${gDays}d ${gHours}h ${gMins}m ${gSecs}s`;
    }

    const lastExcelTime = localStorage.getItem(`sodie_last_excel_time_${CLIENT_STATE.clientId}`);
    const parsedExcelTime = parseInt(lastExcelTime, 10);
    let dailyElapsed = 0;

    if (lastExcelTime && !isNaN(parsedExcelTime)) {
      dailyElapsed = Math.floor((now - parsedExcelTime) / 1000);
    } else {
      dailyElapsed = CLIENT_STATE.elapsedSeconds % SECONDS_24H;
    }

    const remaining24h = Math.max(0, SECONDS_24H - (dailyElapsed % SECONDS_24H));
    const dHours = Math.floor(remaining24h / 3600).toString().padStart(2, '0');
    const dMins = Math.floor((remaining24h % 3600) / 60).toString().padStart(2, '0');
    const dSecs = (remaining24h % 60).toString().padStart(2, '0');

    if (timer24hDisplay) {
      timer24hDisplay.textContent = `${dHours}:${dMins}:${dSecs}`;
    }

    // Notificación al backend cada 24 horas
    if (remaining24h === 0) {
      const lastNotify24 = localStorage.getItem(`sodie_notify_24h_${CLIENT_STATE.clientId}`);
      if (!lastNotify24 || (now - parseInt(lastNotify24, 10)) > 60000) {
        localStorage.setItem(`sodie_notify_24h_${CLIENT_STATE.clientId}`, now.toString());
        notificarTriggerBackend('24H_CYCLE', { elapsedDays: gDays });
      }
    }

    const weekElapsed = CLIENT_STATE.elapsedSeconds % SECONDS_WEEK;
    const remainingWeek = SECONDS_WEEK - weekElapsed;

    const wDays = Math.floor(remainingWeek / 86400).toString().padStart(2, '0');
    const wHours = Math.floor((remainingWeek % 86400) / 3600).toString().padStart(2, '0');
    const wMins = Math.floor((remainingWeek % 86400) / 60).toString().padStart(2, '0');
    const wSecs = (remainingWeek % 60).toString().padStart(2, '0');

    if (timerWeeklyPayDisplay) {
      timerWeeklyPayDisplay.textContent = `${wDays}d ${wHours}h ${wMins}m ${wSecs}s`;
    }

    // Notificación al backend al cumplir ciclo de 7 Días
    if (remainingWeek === 0) {
      const lastNotify7d = localStorage.getItem(`sodie_notify_7d_${CLIENT_STATE.clientId}`);
      if (!lastNotify7d || (now - parseInt(lastNotify7d, 10)) > 60000) {
        localStorage.setItem(`sodie_notify_7d_${CLIENT_STATE.clientId}`, now.toString());
        notificarTriggerBackend('WEEKLY_CYCLE', { currentWeek: CLIENT_STATE.currentWeek });
      }
    }

    if (gDays >= 7 && !CLIENT_STATE.paymentConfirmed && !CLIENT_STATE.isAdminView) {
      const lockWarning = document.getElementById('weekly-payment-lock-warning');
      if (lockWarning) lockWarning.classList.remove('hidden');
    }
  };

  updateTimerTick();
  CLIENT_STATE.timerInterval = setInterval(updateTimerTick, 1000);
}

async function notificarTriggerBackend(type, details = {}) {
  try {
    const endpoint = type === '24H_CYCLE' 
      ? '/api/webhook-client/timer/push-24h' 
      : '/api/webhook-client/timer/push-day7';

    await fetch(`${getBaseUrl()}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: CLIENT_STATE.clientId,
        timerId: `TIMER-${CLIENT_STATE.clientId}`,
        type: type,
        timestamp: Date.now(),
        details: details
      })
    });
  } catch (err) {
    // Error silencioso
  }
}
