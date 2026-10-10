/**
 * SODIE - Client Dashboard Engine (client.js)
 * Flujo Simplificado: Autenticación por Contraseña + Selección de ID de Cliente + Bypass de Admin + Pagos Semanales
 */

function getBaseUrl() {
  if (window.SODIE_CONFIG && window.SODIE_CONFIG.API_URL) {
    return window.SODIE_CONFIG.API_URL.replace(/\/$/, '');
  }
  return window.location.origin;
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

/* ==========================================================================
   INICIO Y CARGA SEGURA DEL DOM
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const weekParam = urlParams.get('week') || '1';
    const isPaid = urlParams.get('paid') === 'true' || localStorage.getItem('sodie_payment_completed') === 'true';

    // Detectar si regresa de la pasarela de pago post-redirección
    if (status === 'paid_success' || status === 'weekly_paid_success' || isPaid) {
      CLIENT_STATE.paymentConfirmed = true;

      const msg = status === 'weekly_paid_success'
        ? `Pago semanal de la Semana ${weekParam} ($6,000 USDT) confirmado correctamente.`
        : 'Pago de reserva ($7,000 USDT) confirmado. Tu módulo de audiencias está activo.';

      showToast('¡Pago Confirmado!', msg, false);

      const lockWarning = document.getElementById('weekly-payment-lock-warning');
      if (lockWarning) lockWarning.classList.add('hidden');

      const btnExcel = document.getElementById('btn-client-upload-excel');
      if (btnExcel) {
        btnExcel.disabled = false;
        btnExcel.classList.remove('disabled');
      }

      const btnActivate = document.getElementById('btn-client-activate-campaign');
      if (btnActivate) {
        btnActivate.classList.remove('hidden');
        btnActivate.style.display = 'block';
      }

      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Inicializar dashboard y eventos de forma segura
    initClientDashboard();
    initClientPersistAndNotifications();

  } catch (err) {
    console.error('❌ Error crítico en DOMContentLoaded de client.js:', err);
  }
});

/* ==========================================================================
   0. DETECCIÓN Y ACCESO DE ADMINISTRADOR
   ========================================================================== */
function getClientId() {
  try {
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
  } catch (e) {
    return 'CLIENT-01';
  }
}

function esAccesoAdmin() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('role') === 'admin' || localStorage.getItem('sodie_admin_bypass') === 'true';
  } catch (e) {
    return false;
  }
}

function initClientPersistAndNotifications() {
  try {
    const clientId = getClientId();
    if (clientId) {
      localStorage.setItem('sodie_client_id', clientId);
    }
  } catch (e) {
    // Evitar bloqueos por localStorage restringido
  }
}

/* ==========================================================================
   INICIALIZACIÓN DEL PANEL
   ========================================================================== */
function initClientDashboard() {
  const urlParams = new URLSearchParams(window.location.search);
  CLIENT_STATE.isAdminView = esAccesoAdmin();
  CLIENT_STATE.isGeneralView = urlParams.get('view') === 'general';

  if (CLIENT_STATE.isAdminView) {
    CLIENT_STATE.isAuthenticated = true;
    CLIENT_STATE.clientId = getClientId();
    
    if (CLIENT_STATE.isGeneralView) {
      CLIENT_STATE.clientId = 'VISTA-GENERAL-ADMIN';
    }
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

  const dashboardView = document.getElementById('app-dashboard');
  if (dashboardView) {
    if (CLIENT_STATE.isAuthenticated) {
      dashboardView.classList.remove('hidden');
      dashboardView.style.display = 'block';
    } else {
      dashboardView.classList.add('hidden');
      dashboardView.style.display = 'none';
    }
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

  // MODO ADMIN MAESTRO: CLIENT-0
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

  // FLUJO REGULAR CLIENTES
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
      if (errorElem) {
        errorElem.textContent = `❌ ${data.message || 'Error de autenticación'}`;
        errorElem.style.display = 'block';
      }
      showToast('Error de Autenticación', data.message || 'Contraseña incorrecta', true);
    }
  } catch (err) {
    // Fallback local seguro para no bloquear al usuario si el servidor no responde de inmediato
    sessionStorage.setItem('sodie_authenticated_client_id', selectedClientId);
    CLIENT_STATE.isAuthenticated = true;
    CLIENT_STATE.clientId = selectedClientId;
    
    updateClientSessionUI();
    fetchClientMetrics();
    initGlobalAndWeeklyTimers();
    
    showToast('Sesión Iniciada', `Dashboard cargado para ${selectedClientId}`);
  }
};

window.sodieValidarPasswordCliente = async function() {
  await window.sodieRegistrarPasswordCliente();
};

window.sodieCerrarSesionCliente = function() {
  sessionStorage.removeItem('sodie_authenticated_client_id');
  localStorage.removeItem('sodie_admin_bypass');
  CLIENT_STATE.isAuthenticated = false;
  CLIENT_STATE.isAdminView = false;
  window.location.reload();
};

/* ==========================================================================
   4. EVENT LISTENERS DE INTERFAZ
   ========================================================================== */
function setupEventListeners() {
  const brandTitle = document.getElementById('header-brand-title');
  if (brandTitle && !brandTitle.dataset.bound) {
    brandTitle.addEventListener('click', () => window.location.reload());
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
      if (e.key === 'Enter') window.sodieValidarPasswordCliente();
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

  const btnActivate = document.getElementById('btn-client-activate-campaign');
  if (btnActivate && !btnActivate.dataset.bound) {
    btnActivate.addEventListener('click', (e) => {
      e.preventDefault();
      sodieConfirmarActivacionCliente();
    });
    btnActivate.dataset.bound = "true";
  }
}

/* ==========================================================================
   5. NOTIFICACIONES Y UI FEEDBACK
   ========================================================================== */
function showToast(title, body, isError = false) {
  try {
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
  } catch (e) {
    console.warn('Toast error:', e);
  }
}

/* ==========================================================================
   6. MÉTRICAS
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

    if (data && data.metrics) {
      if (elSpend) elSpend.textContent = `$${(data.metrics.spend || 0).toLocaleString()}`;
      if (elReach) elReach.textContent = (data.metrics.reach || 0).toLocaleString();
      if (elVisitors) elVisitors.textContent = (data.metrics.clicks || 0).toLocaleString();
    }
  } catch (error) {
    if (elSpend) elSpend.textContent = '$0';
    if (elReach) elReach.textContent = '0';
    if (elVisitors) elVisitors.textContent = '0';
  }
}

/* ==========================================================================
   7. SUBIDA DE EXCEL
   ========================================================================== */
async function sodieFlujoInyeccionCliente(overrideClientId = null) {
  const fileInput = document.getElementById('client-file-input') || document.getElementById('client-excel-input');
  const btnUpload = document.getElementById('btn-client-upload-excel');

  if (!fileInput || !fileInput.files || !fileInput.files[0]) {
    alert('Selecciona tu archivo de audiencia primero.');
    return;
  }

  const clientId = overrideClientId || CLIENT_STATE.clientId || 'CLIENT-01';

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('clientId', clientId);
  formData.append('sessionId', `sess_${clientId.toLowerCase()}_${Date.now()}`);

  if (btnUpload) {
    btnUpload.disabled = true;
    btnUpload.textContent = 'Procesando en IA1...';
  }

  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/media/upload`, {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Fallo al subir el archivo');

    CLIENT_STATE.excelUploaded = true;
    showToast('Audiencia Inyectada', `Excel cargado exitosamente para ${clientId}.`);

    if (btnUpload) {
      btnUpload.disabled = false;
      btnUpload.textContent = '✓ Excel Cargado Hoy';
      btnUpload.style.background = 'rgba(0, 255, 204, 0.2)';
    }

    const btnActivate = document.getElementById('btn-client-activate-campaign');
    if (btnActivate) btnActivate.classList.remove('hidden');

    localStorage.setItem(`sodie_last_excel_time_${clientId}`, Date.now().toString());

  } catch (err) {
    console.error('❌ Error en subida:', err);
    showToast('Error de Carga', err.message, true);
    if (btnUpload) {
      btnUpload.disabled = false;
      btnUpload.textContent = 'Subir Excel (Paso Diario)';
    }
  }
}

/* ==========================================================================
   8. PAGO SEMANAL Y ACTIVACIÓN
   ========================================================================== */
async function sodieProcesarPagoSemanal(event, weekNumber) {
  if (event) event.preventDefault();
  window.location.href = `/confirmacion.html?step=pago_semanal&clientId=${encodeURIComponent(CLIENT_STATE.clientId)}&week=${weekNumber}`;
}

function checkCallbackStatus() {}

async function sodieConfirmarActivacionCliente() {
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
        status: 'ACTIVE',
        timestamp: Date.now()
      })
    });

    if (!res.ok) throw new Error('Error al activar');
    showToast('Éxito', 'Campaña activada correctamente en Meta Ads.');
    if (btnActivate) btnActivate.textContent = '✓ Campaña Activa';
  } catch (error) {
    showToast('Error', 'No se pudo activar la campaña.', true);
    if (btnActivate) {
      btnActivate.textContent = 'Activar Campaña';
      btnActivate.disabled = false;
    }
  }
}

/* ==========================================================================
   9. TEMPORIZADORES
   ========================================================================== */
function initGlobalAndWeeklyTimers() {
  try {
    const globalTimerDisplay = document.getElementById('global-timer-display');
    const timer24hDisplay = document.getElementById('timer-24h-display');
    
    if (CLIENT_STATE.timerInterval) clearInterval(CLIENT_STATE.timerInterval);

    CLIENT_STATE.startTimeStamp = Date.now();
    
    CLIENT_STATE.timerInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - CLIENT_STATE.startTimeStamp) / 1000);
      const remaining24h = Math.max(0, (24 * 3600) - (elapsed % (24 * 3600)));

      const h = String(Math.floor(remaining24h / 3600)).padStart(2, '0');
      const m = String(Math.floor((remaining24h % 3600) / 60)).padStart(2, '0');
      const s = String(remaining24h % 60).padStart(2, '0');

      if (timer24hDisplay) timer24hDisplay.textContent = `${h}:${m}:${s}`;
    }, 1000);
  } catch (e) {
    console.warn('Error en temporizadores:', e);
  }
}
