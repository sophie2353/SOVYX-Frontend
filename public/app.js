// Configuración de Tokens y Llaves del Frontend
const CONFIG = {
  SOVYX_ADMIN_KEY: 'admin23555' // Cambia esto por tu contraseña deseada
};

const API_URL = 'https://sovyx-backend.onrender.com';

// Genera o recupera un sessionId único en localStorage
function getOrCreateSessionId() {
  let id = localStorage.getItem('./sovyxDatabase');
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
  timerInterval: null
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

// Alterna visibilidad de vistas
function setView(targetView) {
  Object.keys(views).forEach(key => {
    if (views[key]) views[key].classList.add('hidden');
  });
  if (views[targetView]) views[targetView].classList.remove('hidden');
}

// Carga del Splash Screen
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

// Inicialización de la app
window.addEventListener('DOMContentLoaded', () => {
  const targetView = state.email ? 'postPayPreMeta' : 'landing';
  runSplashScreen(targetView);
  setupChatListeners();
  initAdminMode();
});

// LÓGICA DE ADMINISTRADOR Y MODOS
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

// Acción: Reservar Slot / Obtener Link de Pago
document.getElementById('btn-pay')?.addEventListener('click', async () => {
  try {
    const res = await fetch(`${API_URL}/api/pagos/link`);
    const data = await res.json();
    if (data.paymentUrl) {
      window.location.href = data.paymentUrl;
    }
  } catch (err) {
    console.error('Error al solicitar link de pago:', err);
  }
});

// Formulario Post-Pago -> Envío a IA1 + Conectar Meta
document.getElementById('form-ia1-setup')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const datosIA1 = {
    clientesObjetivo: document.getElementById('input-clientes').value,
    presupuestoDiario: document.getElementById('input-presupuesto').value,
    edad: document.getElementById('input-edad').value,
    nicho: document.getElementById('input-nicho').value,
    pais: document.getElementById('input-pais').value,
    genero: document.getElementById('select-genero').value,
    idioma: document.getElementById('input-idioma').value,
    ciudad: document.getElementById('input-ciudad').value
  };

  const userToken = 'EAAB_MOCK_TOKEN_META';

  try {
    await fetch(`${API_URL}/api/pagos/conectar-meta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: state.email, userToken })
    });

    await fetch(`${API_URL}/api/pagos/iniciar-ciclo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: state.email, 
        sessionId: state.sessionId,
        datosFormularioIA1: datosIA1 
      })
    });

    state.cicloInicio = new Date();
    setView('dashboard');
    start48hTimer(state.cicloInicio);

  } catch (err) {
    console.error('Error al guardar configuración e iniciar ciclo:', err);
    alert('Hubo un problema al procesar la configuración. Intenta nuevamente.');
  }
});

// Temporizador de 48 horas
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

// Lógica de Chat Web
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
