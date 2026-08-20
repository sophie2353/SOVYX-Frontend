const API_URL = 'https://sovyx-backend.onrender.com';
const CONFIG = window.ENV || { SOVYX_ADMIN_KEY: '', META_APP_ID: '' };

function getOrCreateSessionId() {
  let id = localStorage.getItem('sovyx_session_id');
  if (!id) {
    id = 'sess_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    localStorage.setItem('sovyx_session_id', id);
  }
  return id;
}

const state = {
  email: new URLSearchParams(window.location.search).get('email') || '',
  sessionId: getOrCreateSessionId(),
  cicloInicio: null,
  timerInterval: null,
  statusPollInterval: null,
  selectedFile: null
};

let logoClickCount = 0;
const urlParams = new URLSearchParams(window.location.search);
const isAdminMode = urlParams.get('mode') === 'admin' || urlParams.get('admin') === 'true';

const views = {
  splash: document.getElementById('view-splash'),
  landing: document.getElementById('view-landing'),
  postPayPreMeta: document.getElementById('view-postpay-premeta'),
  dashboard: document.getElementById('view-dashboard'),
  adminClients: document.getElementById('view-admin-clients')
};

function setView(targetView) {
  Object.keys(views).forEach(key => {
    if (views[key]) views[key].classList.add('hidden');
  });
  if (views[targetView]) views[targetView].classList.remove('hidden');
}

function runSplashScreen(nextView) {
  const progressBar = document.getElementById('splash-progress');
  let progress = 0;

  const interval = setInterval(() => {
    progress += 4;
    if (progressBar) progressBar.style.width = `${progress}%`;

    if (progress >= 100) {
      clearInterval(interval);
      views.splash.classList.add('hidden');
      setView(nextView);
    }
  }, 40);
}

window.addEventListener('DOMContentLoaded', async () => {
  // 1. Cargar variables de entorno dinámicas desde Render
  try {
    const res = await fetch(`${API_URL}/api/config`);
    const data = await res.json();
    Object.assign(CONFIG, data);
  } catch (err) {
    console.error('Error cargando configuración dinámica:', err);
  }

  // 2. Inicializar la app
  const targetView = state.email ? 'postPayPreMeta' : 'landing';
  runSplashScreen(targetView);
  setupOnboardingFlow();
  setupDataFileUploaders();
  setupChatListeners();
  initAdminMode();
  setupCookieBanner();
});

// PASO 1 Y 2 DEL ONBOARDING (TESTER + POLLING)
function setupOnboardingFlow() {
  const btnSaveFbUser = document.getElementById('btn-save-fb-user');

  btnSaveFbUser?.addEventListener('click', async () => {
    const fbUser = document.getElementById('input-fb-user').value.trim();
    if (!fbUser) return alert('Por favor ingresa tu usuario o correo de Facebook 🤠');

    try {
      await fetch(`${API_URL}/api/onboarding/tester-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: state.sessionId, fbUser })
      });

      document.getElementById('step-fb-user').classList.add('hidden');
      document.getElementById('step-waiting-admin').classList.remove('hidden');

      startStatusPolling();
    } catch (err) {
      console.error('Error enviando datos de FB:', err);
      // Fallback local en caso de fallar backend inicial
      document.getElementById('step-fb-user').classList.add('hidden');
      document.getElementById('step-waiting-admin').classList.remove('hidden');
      startStatusPolling();
    }
  });
}

function startStatusPolling() {
  if (state.statusPollInterval) clearInterval(state.statusPollInterval);

  state.statusPollInterval = setInterval(async () => {
    try {
      const res = await fetch(`${API_URL}/api/onboarding/status?sessionId=${state.sessionId}`);
      const data = await res.json();

      if (data.status === 'READY') {
        clearInterval(state.statusPollInterval);
        document.getElementById('step-waiting-admin').classList.add('hidden');
        document.getElementById('step-connect-and-upload').classList.remove('hidden');
        alert('¡Acceso concedido! Acepta la invitación en Meta y continúa 👺');
      }
    } catch (err) {
      console.error('Error en polling de estado:', err);
    }
  }, 3000);
}

// PASO 3: ARCHIVOS + OAUTH META
function setupDataFileUploaders() {
  const fileInput = document.getElementById('input-csv-file');
  const selectFileBtn = document.getElementById('btn-select-file');
  const fileNameDisplay = document.getElementById('file-name-display');

  selectFileBtn?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      state.selectedFile = file;
      if (fileNameDisplay) fileNameDisplay.innerText = `📄 Archivo listo: ${file.name}`;
    }
  });

  document.getElementById('btn-connect-meta-csv')?.addEventListener('click', async () => {
    if (!state.selectedFile) {
      alert('Por favor sube la hoja de cálculo (.csv o .xlsx) con tus clientes previos primero 🤠');
      return;
    }

    const formData = new FormData();
    formData.append('file', state.selectedFile);
    formData.append('sessionId', state.sessionId);

    try {
      await fetch(`${API_URL}/api/upload-csv`, {
        method: 'POST',
        body: formData
      });

      // Redirección OAuth Meta Real
      const redirectUri = encodeURIComponent(`${API_URL}/api/auth/facebook/callback`);
      const metaAuthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${CONFIG.FB_APP_ID}&redirect_uri=${redirectUri}&scope=ads_management,email&state=${state.sessionId}`;

      window.location.href = metaAuthUrl;

    } catch (err) {
      console.error('Error procesando archivo:', err);
      setView('dashboard');
    }
  });

  // BOTÓN DASHBOARD: ACTIVAR BORRADOR
  document.getElementById('btn-activate-draft')?.addEventListener('click', async () => {
    try {
      await fetch(`${API_URL}/api/pagos/iniciar-ciclo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId: state.sessionId,
          borradorNombre: "Prueba Hora 24"
        })
      });

      state.cicloInicio = new Date();
      start48hTimer(state.cicloInicio);

      const instructionCard = document.getElementById('card-draft-instruction');
      if (instructionCard) {
        instructionCard.style.borderColor = 'var(--neon-green)';
        instructionCard.innerHTML = `
          <h3 style="font-size: 1rem; color: var(--neon-green);">¡Borrador Vinculado Activo! 👺</h3>
          <p style="font-size: 0.8rem; color: var(--text-sub); margin-top: 4px;">
            SOVYX inyectó la audiencia en "Prueba Hora 24". Se re-optimizará automáticamente a las 24h.
          </p>
        `;
      }

      alert('¡Sistema SOVYX activado en Meta Ads! 🚀');

    } catch (err) {
      console.error('Error iniciando el ciclo:', err);
      state.cicloInicio = new Date();
      start48hTimer(state.cicloInicio);
      alert('¡Modo de prueba iniciado! Temporizador de 48h corriendo 🤠');
    }
  });
}

// MODO ADMIN Y APROBACIÓN DE TESTERS
function initAdminMode() {
  const hamburgerBtn = document.getElementById('btn-hamburger');
  const isAlreadyAuthenticated = sessionStorage.getItem('sovyx_admin_auth') === 'true';

  if (isAlreadyAuthenticated) {
    hamburgerBtn?.classList.remove('hidden');
  }

  const requestAdminAccess = () => {
    if (sessionStorage.getItem('sovyx_admin_auth') === 'true') {
      hamburgerBtn?.classList.remove('hidden');
      setView('adminClients');
      return;
    }

    const inputKey = prompt('🔑 Ingrese la SOVYX_ADMIN_KEY:');

    if (inputKey === CONFIG.SOVYX_ADMIN_KEY) {
      sessionStorage.setItem('sovyx_admin_auth', 'true');
      hamburgerBtn?.classList.remove('hidden');
      alert('Acceso concedido 👺. Modo Admin activado.');
      setView('adminClients');
    } else if (inputKey !== null) {
      alert('Contraseña incorrecta. Acceso denegado ❌');
    }
  };

  if (isAdminMode && !isAlreadyAuthenticated) {
    requestAdminAccess();
  }

  document.getElementById('logo-trigger')?.addEventListener('click', () => {
    logoClickCount++;
    if (logoClickCount >= 5) {
      logoClickCount = 0;
      requestAdminAccess();
    }
  });

  // Botón Admin para aprobar Tester
  document.getElementById('btn-admin-approve-tester')?.addEventListener('click', async () => {
    const targetSessionId = document.getElementById('input-admin-target-session').value.trim();
    if (!targetSessionId) return alert('Ingresa la Session ID del cliente 🤠');

    try {
      await fetch(`${API_URL}/api/admin/tester-approved`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId: targetSessionId,
          adminKey: CONFIG.SOVYX_ADMIN_KEY 
        })
      });
      alert(`Session ${targetSessionId} aprobada exitosamente 👺`);
    } catch (err) {
      console.error('Error aprobando desde admin:', err);
    }
  });

  setupSidebarEvents();
}

function setupSidebarEvents() {
  const sidebar = document.getElementById('sidebar-menu');
  const btnHamburger = document.getElementById('btn-hamburger');
  const btnClose = document.getElementById('btn-close-sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  const toggleSidebar = (show) => {
    if (show) sidebar?.classList.remove('hidden');
    else sidebar?.classList.add('hidden');
  };

  btnHamburger?.addEventListener('click', () => toggleSidebar(true));
  btnClose?.addEventListener('click', () => toggleSidebar(false));
  overlay?.addEventListener('click', () => toggleSidebar(false));

  document.getElementById('btn-menu-tester')?.addEventListener('click', () => {
    toggleSidebar(false);
    setView('postPayPreMeta');
  });

  document.getElementById('btn-menu-clients')?.addEventListener('click', () => {
    toggleSidebar(false);
    setView('adminClients');
  });

  document.getElementById('btn-menu-dashboard')?.addEventListener('click', () => {
    toggleSidebar(false);
    setView('dashboard');
  });
}

// TEMPORIZADOR DE 48 HORAS
function start48hTimer(startTime) {
  const targetTime = new Date(startTime).getTime() + (48 * 60 * 60 * 1000);
  const timerDisplay = document.getElementById('timer-count');

  if (state.timerInterval) clearInterval(state.timerInterval);

  state.timerInterval = setInterval(() => {
    const now = new Date().getTime();
    const diff = targetTime - now;

    if (diff <= 0) {
      clearInterval(state.timerInterval);
      if (timerDisplay) timerDisplay.innerText = "00:00:00";
      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (timerDisplay) {
      timerDisplay.innerText = 
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
  }, 1000);
}

// CHAT WEB
function setupChatListeners() {
  const chatInput = document.getElementById('chat-input');
  const btnSend = document.getElementById('btn-send-chat');

  btnSend?.addEventListener('click', handleSendMessage);
  chatInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSendMessage();
  });
}

async function handleSendMessage() {
  const chatInput = document.getElementById('chat-input');
  const text = chatInput.value.trim();

  if (!text) return;

  appendMessage(text, 'outgoing');
  chatInput.value = '';

  try {
    const response = await fetch(`${API_URL}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        mensaje: text, 
        sessionId: state.sessionId 
      })
    });
    
    const data = await response.json();
    const botReply = data.respuesta || data.mensaje || data.texto || data.reply || (typeof data === 'string' ? data : JSON.stringify(data));

    appendMessage(botReply, 'incoming');

  } catch (err) {
    appendMessage("Error de conexión con el motor de chat.", 'incoming');
    console.error('Error enviando mensaje:', err);
  }
}

function appendMessage(text, type) {
  const chatBox = document.getElementById('chat-box');
  if (!chatBox) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = `msg ${type}`;
  msgDiv.innerText = text;
  chatBox.appendChild(msgDiv);
  
  chatBox.scrollTop = chatBox.scrollHeight;
}

function setupCookieBanner() {
  const cookieBanner = document.getElementById('cookie-banner');
  const btnAccept = document.getElementById('btn-accept-cookies');

  if (localStorage.getItem('sovyx_cookies_accepted') === 'true') {
    if (cookieBanner) cookieBanner.style.display = 'none';
  }

  btnAccept?.addEventListener('click', () => {
    localStorage.setItem('sovyx_cookies_accepted', 'true');
    if (cookieBanner) cookieBanner.style.display = 'none';
  });
}
