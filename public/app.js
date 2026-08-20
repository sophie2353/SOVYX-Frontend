const API_URL = 'https://sovyx-backend.onrender.com';

const state = {
  email: new URLSearchParams(window.location.search).get('email') || '',
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

// Ejecuta la barra de carga inicial
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

// Inicialización del flujo
window.addEventListener('DOMContentLoaded', () => {
  const targetView = state.email ? 'postPayPreMeta' : 'landing';
  runSplashScreen(targetView);
  setupChatListeners();
});

// Acción: Obtener link de pago (Vista 1)
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

// Acción: Conectar Meta tras pagar (Vista 3)
document.getElementById('btn-connect-meta')?.addEventListener('click', async () => {
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
      body: JSON.stringify({ email: state.email, segmentacionInicial: {} })
    });

    state.cicloInicio = new Date();
    setView('dashboard');
    start48hTimer(state.cicloInicio);

  } catch (err) {
    console.error('Error durante la activación:', err);
  }
});

// Lógica del Temporizador de 48 Horas
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

// LÓGICA DE CHAT WEB
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

  // 1. Renderizar mensaje enviado
  appendMessage(text, 'outgoing');
  chatInput.value = '';

  // 2. Petición POST a /api/chat
  try {
    const response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, email: state.email })
    });
    
    const data = await response.json();
    
    // 3. Renderizar respuesta del servidor
    appendMessage(data.reply || 'Respuesta recibida sin texto.', 'incoming');

  } catch (err) {
    appendMessage("Error de conexión al enviar el mensaje.", 'incoming');
    console.error('Error enviando mensaje al chat:', err);
  }
}

function appendMessage(text, type) {
  const chatBox = document.getElementById('chat-box');
  if (!chatBox) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = `msg ${type}`;
  msgDiv.innerText = text;
  chatBox.appendChild(msgDiv);
  
  // Auto-scroll
  chatBox.scrollTop = chatBox.scrollHeight;
}
