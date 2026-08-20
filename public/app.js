const API_URL = 'https://sovyx-backend.onrender.com';

// Genera o recupera un sessionId único en localStorage
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
  timerInterval: null
};

const views = {
  splash: document.getElementById('view-splash'),
  landing: document.getElementById('view-landing'),
  postPayPreMeta: document.getElementById('view-postpay-premeta'),
  dashboard: document.getElementById('view-dashboard')
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
});

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

// Manejo del Formulario Post-Pago -> Envío de respuestas a IA1 + Conectar Meta
document.getElementById('form-ia1-setup')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Captura de los 8 parámetros del formulario
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
    // 1. Conectar Meta en Backend
    await fetch(`${API_URL}/api/pagos/conectar-meta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: state.email, userToken })
    });

    // 2. Enviar los datos del formulario a la IA1 e iniciar ciclo de 48h
    await fetch(`${API_URL}/api/pagos/iniciar-ciclo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: state.email, 
        sessionId: state.sessionId,
        datosFormularioIA1: datosIA1 
      })
    });

    // 3. Pasar al Dashboard y arrancar temporizador
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

  // Renderizar mensaje saliente
  appendMessage(text, 'outgoing');
  chatInput.value = '';

  // Enviar a POST /api/chat/message con la estructura de tu router
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
