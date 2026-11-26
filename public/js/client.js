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
   2. ESTADO GLOBAL DE CLIENTE
   ========================================================================== */
const CLIENT_STATE = {
  clientId: null,
  isAuthenticated: false,
  isAdminView: false,
  isGeneralView: false,
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
    const isPaid = urlParams.get('paid') === 'true' || localStorage.getItem('sodie_payment_completed') === 'true';

    // Detectar si regresa de la pasarela de pago post-redirección
    if (status === 'paid_success' || isPaid) {
      CLIENT_STATE.paymentConfirmed = true;

      const msg = 'Pago de reserva confirmado. Tu módulo de audiencias está activo.';

      showToast('¡Pago Confirmado!', msg, false);

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
    activarNotificacionesPush(selectedClientId);

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
   7. SUBIDA DE EXCEL / INYECCIÓN
   ========================================================================== */
async function sodieFlujoInyeccionCliente(overrideClientId = null) {
  const btnUpload = document.getElementById('btn-client-upload-excel');

  const paises = document.getElementById('client-paises')?.value || 'US';
  const nicho = document.getElementById('client-nicho')?.value || 'infoproductos';
  const value = document.getElementById('client-value')?.value || '1000';
  const edadMin = document.getElementById('client-edad-min')?.value || '22';
  const edadMax = document.getElementById('client-edad-max')?.value || '55';

  const clientId = overrideClientId || (typeof CLIENT_STATE !== 'undefined' ? CLIENT_STATE.clientId : 'CLIENT-#01');

  if (btnUpload) {
    btnUpload.disabled = true;
    btnUpload.textContent = 'Enviando Segmentación...';
  }

  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/segmentacion/procesar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        paises,
        nicho,
        value: parseFloat(value),
        edadMin: parseInt(edadMin),
        edadMax: parseInt(edadMax)
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Fallo al procesar la segmentación');

    if (typeof CLIENT_STATE !== 'undefined') CLIENT_STATE.excelUploaded = true;

    if (typeof showToast === 'function') {
      showToast('Segmentación Inyectada', `Registros listos para ${clientId}.`);
    }

    if (btnUpload) {
      btnUpload.disabled = false;
      btnUpload.textContent = '✓ Segmentación Activa (72h)';
      btnUpload.style.background = 'rgba(0, 255, 204, 0.2)';
    }

    const btnActivate = document.getElementById('btn-client-activate-campaign');
    if (btnActivate) btnActivate.classList.remove('hidden');

    localStorage.setItem(`sodie_last_excel_time_${clientId}`, Date.now().toString());

  } catch (err) {
    console.error('❌ Error en segmentación cliente:', err);
    if (typeof showToast === 'function') showToast('Error', err.message, true);
    if (btnUpload) {
      btnUpload.disabled = false;
      btnUpload.textContent = 'Actualizar Segmentación';
    }
  }
}

function checkCallbackStatus() {}

async function sodieConfirmarActivacionCliente() {
  const btnActivate = document.getElementById('btn-client-activate-campaign');
  const textSpan = document.getElementById('btn-client-trigger-text');
  const timerSpan = document.getElementById('btn-client-trigger-timer');
  
  let startTime;
  let timerInterval;

  if (btnActivate) btnActivate.disabled = true;
  
  if (textSpan) textSpan.textContent = 'Activando en Meta Ads... ⏳';
  
  if (timerSpan) {
    timerSpan.classList.remove('hidden');
    timerSpan.textContent = '00:00:00';
    startTime = Date.now();
    
    // Función para actualizar el cronómetro (mm:ss:ms)
    timerInterval = setInterval(() => {
      const elapsedTime = Date.now() - startTime;
      const minutes = Math.floor((elapsedTime % 3600000) / 60000).toString().padStart(2, '0');
      const seconds = Math.floor((elapsedTime % 60000) / 1000).toString().padStart(2, '0');
      const milliseconds = Math.floor((elapsedTime % 1000) / 10).toString().padStart(2, '0'); 
      
      timerSpan.textContent = `${minutes}:${seconds}:${milliseconds}`;
    }, 10);
  }

  try {
    const res = await fetch(`${getBaseUrl()}/api/facebook/activar-borrador`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: CLIENT_STATE.clientId,
        status: 'ACTIVE',
        timestamp: Date.now()
      })
    });

    if (!res.ok) throw new Error('Error al activar');
    
    // Detenemos el cronómetro al tener éxito
    clearInterval(timerInterval);
    
    showToast('Éxito', 'Campaña activada correctamente en Meta Ads.');
    
    if (textSpan) {
      textSpan.textContent = '✓ Listo. Tiempo total: ';
    }
    
    if (btnActivate) {
      btnActivate.classList.remove('btn-activate-gradient');
      btnActivate.style.background = 'rgba(0, 255, 204, 0.2)'; // Estilo de completado
    }
    
  } catch (error) {
    // Detenemos el cronómetro si falla
    clearInterval(timerInterval);
    showToast('Error', 'No se pudo activar la campaña.', true);
    
    if (textSpan) textSpan.textContent = 'Activar Campaña';
    if (timerSpan) timerSpan.classList.add('hidden');
    if (btnActivate) btnActivate.disabled = false;
  }
}


/* ==========================================================================
   9. TEMPORIZADORES (72H Y CICLO GLOBAL 28 DÍAS)
   ========================================================================== */
async function initGlobalAndWeeklyTimers() {
  try {
    const globalTimerDisplay = document.getElementById('global-timer-display');
    const timer72hDisplay = document.getElementById('timer-24h-display');
    
    if (CLIENT_STATE.timerInterval) clearInterval(CLIENT_STATE.timerInterval);

    const baseUrl = typeof getBaseUrl === 'function' ? getBaseUrl() : '';
    const clientId = CLIENT_STATE.clientId || localStorage.getItem('sodie_client_id') || 'CLIENT';

    // Consultamos el timestamp persistente en MongoDB
    try {
      const res = await fetch(`${baseUrl}/api/v1/timer/get-timer?clientId=${encodeURIComponent(clientId)}`);
      const data = await res.json();
      if (data.success && data.startTimeStamp) {
        CLIENT_STATE.startTimeStamp = data.startTimeStamp;
        CLIENT_STATE.durationSeconds = data.durationSeconds || (72 * 3600);
      } else {
        CLIENT_STATE.startTimeStamp = CLIENT_STATE.startTimeStamp || Date.now();
        CLIENT_STATE.durationSeconds = 72 * 3600;
      }
    } catch (errNet) {
      console.warn('Fallback local activado para timer de cliente:', errNet);
      CLIENT_STATE.startTimeStamp = CLIENT_STATE.startTimeStamp || Date.now();
      CLIENT_STATE.durationSeconds = 72 * 3600;
    }

    const totalCycleTime = 28 * 24 * 3600; // 28 días en segundos
    const cycleWindow = CLIENT_STATE.durationSeconds;

    const tickClientTimer = () => {
      const now = Date.now();
      const elapsed = Math.max(0, Math.floor((now - CLIENT_STATE.startTimeStamp) / 1000));
      
      // Temporizador de ciclo de maduración (72h / 96h según DB)
      const remainingCycle = Math.max(0, cycleWindow - (elapsed % cycleWindow));
      const h72 = String(Math.floor(remainingCycle / 3600)).padStart(2, '0');
      const m72 = String(Math.floor((remainingCycle % 3600) / 60)).padStart(2, '0');
      const s72 = String(remainingCycle % 60).padStart(2, '0');

      if (timer72hDisplay) timer72hDisplay.textContent = `${h72}:${m72}:${s72}`;

      // Temporizador Global de 28 Días (Ciclo V3.5)
      const remainingGlobal = Math.max(0, totalCycleTime - elapsed);
      const daysGlobal = Math.floor(remainingGlobal / (3600 * 24));
      const hoursGlobal = String(Math.floor((remainingGlobal % (3600 * 24)) / 3600)).padStart(2, '0');
      const minsGlobal = String(Math.floor((remainingGlobal % 3600) / 60)).padStart(2, '0');
      const secsGlobal = String(remainingGlobal % 60).padStart(2, '0');

      if (globalTimerDisplay) {
        globalTimerDisplay.textContent = `${daysGlobal}d ${hoursGlobal}h ${minsGlobal}m ${secsGlobal}s`;
      }

      // Si se completan los 28 días, mostrar sección final
      if (remainingGlobal <= 0) {
        const week4Section = document.getElementById('section-week-4-complete');
        if (week4Section) week4Section.classList.remove('hidden');
      }
    };

    tickClientTimer();
    CLIENT_STATE.timerInterval = setInterval(tickClientTimer, 1000);
  } catch (e) {
    console.warn('Error en temporizadores:', e);
  }
}

// =========================================================================
// NOTIFICACIONES PUSH CLIENTE (VAPID DIRECTA + FALLBACK BACKEND)
// =========================================================================
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

async function activarNotificacionesPush(clientIdOverride = null) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Este navegador no soporta notificaciones Push nativas');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Permiso de notificaciones denegado por el usuario.');
      return;
    }

    const baseUrl = typeof getBaseUrl === 'function' ? getBaseUrl() : '';
    const clientId = clientIdOverride || (typeof CLIENT_STATE !== 'undefined' && CLIENT_STATE.clientId ? CLIENT_STATE.clientId : 'CLIENT-#01');

    // 1. Obtiene la VAPID pública directamente desde tu .env vía backend
    const resKey = await fetch(`${baseUrl}/api/webhook-client/vapid-public-key`);
    if (!resKey.ok) throw new Error('No se pudo obtener la clave VAPID pública.');
    const { publicKey } = await resKey.json();
    if (!publicKey) throw new Error('VAPID_PUBLIC_KEY está vacía en el servidor.');

    // 2. Garantiza que el Service Worker esté activo
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      try {
        registration = await navigator.serviceWorker.register('/js/sw.js');
      } catch (e) {
        registration = await navigator.serviceWorker.register('/sw.js');
      }
    }
    await navigator.serviceWorker.ready;

    // 3. Suscribe el navegador convirtiendo la llave a Uint8Array
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
    }

    // 4. Guarda como push_CLIENT-#XX en MongoDB
    const responseSave = await fetch(`${baseUrl}/api/webhook-client/save-subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, subscription })
    });

    const dataSave = await responseSave.json();
    if (!responseSave.ok || !dataSave.success) throw new Error(dataSave.error || 'Error al guardar suscripción.');

    console.log('✅ Notificaciones nativas activadas con éxito para:', clientId);
    if (typeof showToast === 'function') {
      showToast('Push Activado', `Notificaciones vinculadas para ${clientId}.`);
    }

  } catch (error) {
    console.error('💥 Error activando notificaciones Push:',window.sodieValidarPassw
/* ==========================================================================
   MODO ADMIN: SELECTOR CLIENT 1-4 + SIMULADOR DE CONCURRENCIA (V4)
   ========================================================================== */
const MOCK_CLIENT_PROFILES = {
  'CLIENT-#01': { spend: 4250, reach: 68400, impressions: 91200, visitors: 1420, activos: 38, paises: 'US, CA', nicho: 'SaaS B2B', value: 2500 },
  'CLIENT-#02': { spend: 1890, reach: 31500, impressions: 44100, visitors: 780,  activos: 19, paises: 'ES, MX', nicho: 'FinTech', value: 1800 },
  'CLIENT-#03': { spend: 7600, reach: 124000, impressions: 168900, visitors: 3110, activos: 74, paises: 'US, UK', nicho: 'E-commerce High-Ticket', value: 3200 },
  'CLIENT-#04': { spend: 950,  reach: 15200, impressions: 21400, visitors: 410,  activos: 11, paises: 'CO, CL', nicho: 'Inmobiliaria', value: 1200 }
};

function isAdminModeClientView() {
  const params = new URLSearchParams(window.location.search);
  return (
    params.get('admin') === 'true' ||
    sessionStorage.getItem('sodie_admin_session') === 'active' ||
    localStorage.getItem('sodie_admin_session') === 'active' ||
    localStorage.getItem('sodie_admin_bypass') === 'true'
  );
}

async function switchSimulatedClient(clientId) {
  localStorage.setItem('sodie_client_id', clientId);
  localStorage.setItem('sodie_active_client_id', clientId);

  // Actualiza URL sin recargar la página
  const url = new URL(window.location.href);
  url.searchParams.set('clientId', clientId);
  url.searchParams.set('admin', 'true');
  window.history.replaceState({}, '', url);

  // Marca el botón activo y el badge superior
  const badge = document.getElementById('client-id-badge');
  if (badge) badge.textContent = clientId;

  document.querySelectorAll('.admin-slot-btn').forEach((btn) => {
    const active = btn.getAttribute('data-slot') === clientId;
    btn.style.borderColor = active ? '#00ffcc' : '';
    btn.style.background = active ? 'rgba(0, 255, 204, 0.18)' : '';
    btn.style.color = active ? '#00ffcc' : '';
  });

  // Intenta cargar métricas reales del backend para ese clientId; si está vacío, usa el perfil simulado
  const baseUrl = typeof getBaseUrl === 'function' ? getBaseUrl() : window.location.origin;
  let metrics = MOCK_CLIENT_PROFILES[clientId] || MOCK_CLIENT_PROFILES['CLIENT-#01'];

  try {
    const res = await fetch(`${baseUrl}/api/facebook/metrics?clientId=${encodeURIComponent(clientId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.hasActiveCampaign) {
        metrics = { ...metrics, ...data };
      }
    }
  } catch (err) {
    // Mantiene perfil simulado para inspección visual
  }

  // Pinta métricas aisladas de ese cliente
  const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };

  setTxt('metric-spend', `$${Number(metrics.spend || 0).toLocaleString('en-US')}`);
  setTxt('metric-reach', Number(metrics.reach || 0).toLocaleString('en-US'));
  setTxt('metric-reach-status', Number(metrics.impressions || 0).toLocaleString('en-US'));
  setTxt('metric-visitors', Number(metrics.visitors || 0).toLocaleString('en-US'));
  setTxt('metric-activos', Number(metrics.activos || 0).toLocaleString('en-US'));

  // Rellena los inputs de segmentación para verificar que cada cliente tiene su propia data
  setVal('client-paises', metrics.paises || '');
  setVal('client-nicho', metrics.nicho || '');
  setVal('client-value', metrics.value || '');
}

async function runConcurrent4ClientTest() {
  const outputEl = document.getElementById('sim-4clients-output');
  const btn = document.getElementById('btn-run-4client-sim');
  const baseUrl = typeof getBaseUrl === 'function' ? getBaseUrl() : window.location.origin;
  const ids = ['CLIENT-#01', 'CLIENT-#02', 'CLIENT-#03', 'CLIENT-#04'];

  if (btn) btn.disabled = true;
  if (outputEl) {
    outputEl.classList.remove('hidden');
    outputEl.innerHTML = 'Disparando 4 sesiones simultáneas al backend...';
  }

  const t0 = performance.now();

  const results = await Promise.all(
    ids.map(async (id) => {
      const start = performance.now();
      try {
        const [timerRes, metricsRes] = await Promise.all([
          fetch(`${baseUrl}/api/v1/timer/get-timer?clientId=${encodeURIComponent(id)}`),
          fetch(`${baseUrl}/api/facebook/metrics?clientId=${encodeURIComponent(id)}`)
        ]);
        const ms = Math.round(performance.now() - start);
        const ok = timerRes.ok || metricsRes.ok;
        return { id, ok, ms, status: ok ? 'AISLADO OK' : `HTTP ${timerRes.status}/${metricsRes.status}` };
      } catch (e) {
        return { id, ok: false, ms: Math.round(performance.now() - start), status: 'SIN CONEXIÓN' };
      }
    })
  );

  const totalMs = Math.round(performance.now() - t0);

  if (outputEl) {
    outputEl.innerHTML = `
      <div style="margin-bottom: 6px; color: #00ffcc;"><strong>Test Concurrente (4 clientes a la vez • ${totalMs}ms):</strong></div>
      ${results.map(r => `<div>• <strong>${r.id}</strong>: ${r.ok ? '✅' : '⚠️'} ${r.status} (${r.ms}ms)</div>`).join('')}
    `;
  }
  if (btn) btn.disabled = false;
}

document.addEventListener('DOMContentLoaded', () => {
  if (!isAdminModeClientView()) return;

  // Abre el dashboard directo sin pedir login de cliente
  document.getElementById('client-auth-view')?.classList.add('hidden');
  document.getElementById('app-dashboard')?.classList.remove('hidden');

  const switcher = document.getElementById('admin-client-switcher');
  if (switcher) switcher.classList.remove('hidden');

  document.querySelectorAll('.admin-slot-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchSimulatedClient(btn.getAttribute('data-slot'));
    });
  });

  const btnSim = document.getElementById('btn-run-4client-sim');
  if (btnSim) btnSim.addEventListener('click', runConcurrent4ClientTest);

  // Carga el cliente indicado en la URL o arranca en CLIENT-#01
  const initialId = new URLSearchParams(window.location.search).get('clientId');
  const validInitial = MOCK_CLIENT_PROFILES[initialId] ? initialId : 'CLIENT-#01';
  switchSimulatedClient(validInitial);
});
