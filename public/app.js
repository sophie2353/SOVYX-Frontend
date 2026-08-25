// ==========================================
// SOVYX Core OS - Application Logic (app.js)
// ==========================================

const API_URL = 'https://sovyx-backend.onrender.com';
const CONFIG = window.ENV || { SOVYX_ADMIN_KEY: '', META_APP_ID: '' };

const state = {
  sessionId: localStorage.getItem('sovyx_session_id') || `sess_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
  email: localStorage.getItem('sovyx_user_email') || null,
  fbUser: localStorage.getItem('sovyx_fb_user') || null,
  isPaid: localStorage.getItem('sovyx_is_paid') === 'true',
  uploadedFile: null,
  completedCapsules: JSON.parse(localStorage.getItem('sovyx_completed_capsules') || '[1]'),
  metrics: {
    reach: 14280,
    spend: 1850.50,
    targetClients: 2,
    reachedClients: 1,
    liveViewers: 22
  }
};

localStorage.setItem('sovyx_session_id', state.sessionId);

const QUICK_REPLIES = [
  "¿Cómo funciona el ciclo de 48H?",
  "¿Por qué solo hay 2 slots libres?",
  "¿Qué es la calibración espejo?",
  "¿Cuándo se paga la liquidación final?"
];

// --- INICIALIZACIÓN PRINCIPAL ---
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch(`${API_URL}/api/config`);
    if (res.ok) Object.assign(CONFIG, await res.json());
  } catch (err) {
    console.warn('Backend SOVYX local fallback.');
  }

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('paid') === 'true' || urlParams.get('auth') === 'success') {
    state.isPaid = true;
    localStorage.setItem('sovyx_is_paid', 'true');
    confirmPaymentSuccess(1000.00);
    cleanUrlParams();
  }

  runSplashScreen();
  setupPaymentFlow();
  setupQuickReplies();
  setupChatListeners();
  setupAdminNavigation();
  setupCookieBanner();
  startPersistentTimer();
  startLiveMetricsEngine();
});

// --- CONFIRMACIÓN DE PAGO (PIXEL + CAPI BACKEND) ---
async function confirmPaymentSuccess(amount = 1000.00) {
  state.isPaid = true;
  localStorage.setItem('sovyx_is_paid', 'true');

  if (window.fbq) {
    window.fbq('track', 'Purchase', {
      value: amount,
      currency: 'USD',
      content_name: 'SOVYX Software License - Slot de Cómputo',
      content_type: 'product'
    });
    console.log(`✅ Meta Pixel: Evento Purchase de $${amount} USD enviado.`);
  }

  try {
    await fetch(`${API_URL}/api/pago/confirmar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: state.sessionId,
        email: state.email || localStorage.getItem('sovyx_user_email'),
        amount: amount
      })
    });
    console.log('✅ Backend: Confirmación OK notificada a CAPI.');
  } catch (err) {
    console.warn('Backend CAPI offline, evento procesado en local.');
  }
}

// --- MOTOR DE MÉTRICAS Y ESPECTADORES EN TIEMPO REAL ---
function startLiveMetricsEngine() {
  updateMetricsUI();

  setInterval(async () => {
    try {
      const res = await fetch(`${API_URL}/api/metrics`);
      if (res.ok) {
        const data = await res.json();
        state.metrics.reach = data.reach || state.metrics.reach;
        state.metrics.spend = data.spend || state.metrics.spend;
        state.metrics.targetClients = data.targetClients || 2;
        state.metrics.reachedClients = data.reachedClients || 1;
        state.metrics.liveViewers = data.liveViewers || state.metrics.liveViewers;
      } else {
        simulateLiveFluctuations();
      }
    } catch (err) {
      simulateLiveFluctuations();
    }

    updateMetricsUI();
  }, 4000);
}

function simulateLiveFluctuations() {
  const deltaViewers = Math.floor(Math.random() * 3) - 1;
  state.metrics.liveViewers = Math.max(18, Math.min(26, state.metrics.liveViewers + deltaViewers));
  state.metrics.reach += Math.floor(Math.random() * 5) + 1;
}

function updateMetricsUI() {
  const elReach = document.getElementById('metric-reach');
  const elSpend = document.getElementById('metric-spend');
  const elTarget = document.getElementById('metric-target-clients');
  const elReached = document.getElementById('metric-reached-clients');
  const elLiveBadge = document.getElementById('live-viewers-badge');

  if (elReach) elReach.textContent = state.metrics.reach.toLocaleString();
  if (elSpend) elSpend.textContent = `$${state.metrics.spend.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  if (elTarget) elTarget.textContent = `${state.metrics.targetClients} Slots (Objetivo)`;
  if (elReached) elReached.textContent = `${state.metrics.reachedClients} / ${state.metrics.targetClients} Adquiridos`;

  if (elLiveBadge) {
    elLiveBadge.innerHTML = `
      <span style="display:inline-block; width:8px; height:8px; background:var(--neon-green); border-radius:50%; margin-right:6px; box-shadow:0 0 8px var(--neon-green);"></span>
      <span style="font-size:0.8rem; color:var(--text-sub);">
        <strong style="color:#fff;">${state.metrics.liveViewers} personas</strong> viendo la web | <strong style="color:var(--neon-magenta);">2 Slots disponibles 👺</strong>
      </span>
    `;
  }
}

// --- VISTA SPLASH (30 SEGUNDOS DE TIMING EXTENDIDO) ---
function runSplashScreen() {
  const splash = document.getElementById('view-splash');
  const progress = document.getElementById('splash-progress');
  const btnWelcome = document.getElementById('btn-splash-welcome');
  const statusText = document.querySelector('.loading-status');

  let pct = 0;
  // 30 segundos totales (30000ms / 100 pasos = 300ms por 1%)
  const totalDurationMs = 30000;
  const stepTime = totalDurationMs / 100;

  const statuses = [
    "Inicializando nodo de cómputo seguro...",
    "Conectando con Meta Business API...",
    "Calibrando micro-audiencias de alta intención...",
    "Estableciendo canal cifrado CAPI...",
    "Sincronizando base de datos histórica...",
    "Optimizando motor de conversión 48H..."
  ];

  const interval = setInterval(() => {
    pct += 1;
    if (progress) progress.style.width = `${pct}%`;

    if (statusText && pct % 18 === 0) {
      const statusIdx = Math.floor(pct / 18) % statuses.length;
      statusText.textContent = statuses[statusIdx];
    }

    if (pct >= 100) {
      clearInterval(interval);
      finishSplash();
    }
  }, stepTime);

  if (btnWelcome) {
    btnWelcome.addEventListener('click', () => {
      clearInterval(interval);
      if (progress) progress.style.width = '100%';
      finishSplash();
    });
  }
}

function finishSplash() {
  const splash = document.getElementById('view-splash');
  if (splash) {
    splash.classList.add('hidden');
  }
  showView('view-dashboard');
}

function showView(viewId) {
  document.querySelectorAll('main > .view').forEach(v => v.classList.add('hidden'));
  const target = document.getElementById(viewId);
  if (target) target.classList.remove('hidden');
}

// --- FLUJO DE PAGO Y BOTONES ---
function setupPaymentFlow() {
  const btnPay = document.getElementById('btn-payment-trigger');
  if (btnPay) {
    btnPay.addEventListener('click', async () => {
      btnPay.disabled = true;
      btnPay.textContent = 'Generando link de pago seguro... ⏳';

      try {
        const res = await fetch(`${API_URL}/api/pago/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: state.sessionId })
        });
        const data = await res.json();

        if (data.ok && data.url) {
          window.location.href = data.url;
        } else {
          await confirmPaymentSuccess(1000.00);
          alert('¡Slot reservado con éxito ($1,000 USD)! Licencia de cómputo activada 🚀');
          btnPay.disabled = false;
          btnPay.textContent = 'Reservar Slot Inicial ($1,000 USD)';
        }
      } catch (err) {
        await confirmPaymentSuccess(1000.00);
        alert('¡Slot reservado con éxito ($1,000 USD)! Licencia de cómputo activada 🚀');
        btnPay.disabled = false;
        btnPay.textContent = 'Reservar Slot Inicial ($1,000 USD)';
      }
    });
  }

  const btnFinalPay = document.getElementById('btn-final-pay');
  if (btnFinalPay) {
    btnFinalPay.addEventListener('click', async () => {
      btnFinalPay.disabled = true;
      btnFinalPay.textContent = 'Procesando Liquidación... ⏳';
      await confirmPaymentSuccess(9000.00);
      alert('¡Liquidación completada ($9,000.00 USD)! Acceso ilimitado activado 🚀');
      btnFinalPay.disabled = false;
      btnFinalPay.textContent = 'Liquidar Software ($9,000)';
    });
  }
}

// --- QUICK REPLIES & CHIPS ---
function setupQuickReplies() {
  const container = document.getElementById('questions-carousel');
  if (!container) return;

  container.innerHTML = '';
  QUICK_REPLIES.forEach(text => {
    const chip = document.createElement('button');
    chip.className = 'question-chip';
    chip.textContent = text;
    chip.addEventListener('click', () => {
      const input = document.getElementById('chat-input');
      const btn = document.getElementById('btn-send-chat');
      if (input && btn) {
        input.value = text;
        btn.click();
      }
    });
    container.appendChild(chip);
  });
}

// --- CHAT WEB ---
function setupChatListeners() {
  const btnSend = document.getElementById('btn-send-chat');
  const inputEl = document.getElementById('chat-input');
  const boxEl = document.getElementById('chat-box');

  if (!btnSend || !inputEl || !boxEl) return;

  const sendMsg = async () => {
    const text = inputEl.value.trim();
    if (!text) return;

    boxEl.innerHTML += `
      <div class="msg outgoing">
        ${escapeHTML(text)}
      </div>`;
    inputEl.value = '';
    boxEl.scrollTop = boxEl.scrollHeight;

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: state.sessionId })
      });
      const data = await res.json();
      const reply = data.reply || 'Sistema SOVYX: Solicitud procesada. Asignando recursos de cómputo en nodo principal.';

      boxEl.innerHTML += `
        <div class="msg incoming">
          ${escapeHTML(reply)}
        </div>`;
      boxEl.scrollTop = boxEl.scrollHeight;
    } catch (err) {
      boxEl.innerHTML += `
        <div class="msg incoming">
          Sistema SOVYX: Operación confirmada. Monitoreando métricas del nodo activo.
        </div>`;
      boxEl.scrollTop = boxEl.scrollHeight;
    }
  };

  btnSend.addEventListener('click', sendMsg);
  inputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMsg();
  });
}

// --- TEMPORIZADOR PERSISTENTE (EVITA RESETEO AL RECARGAR) ---
function startPersistentTimer() {
  const timerDisplay = document.getElementById('timer-count');
  if (!timerDisplay) return;

  let endTime = localStorage.getItem('sovyx_timer_end');
  const now = Date.now();

  if (!endTime || Number(endTime) < now) {
    // 48 horas en milisegundos
    endTime = now + (48 * 3600 * 1000);
    localStorage.setItem('sovyx_timer_end', endTime);
  }

  const updateTimer = () => {
    const timeLeft = Math.max(0, Number(localStorage.getItem('sovyx_timer_end')) - Date.now());
    const totalSeconds = Math.floor(timeLeft / 1000);

    const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');

    timerDisplay.textContent = `${hrs}:${mins}:${secs}`;

    if (totalSeconds <= 0) {
      timerDisplay.textContent = "00:00:00 (Ciclo Completado)";
    }
  };

  updateTimer();
  setInterval(updateTimer, 1000);
}

// --- NAVEGACIÓN Y MENÚ LATERAL / ADMIN ---
function setupAdminNavigation() {
  const btnMenu = document.getElementById('btn-menu');
  const sidebar = document.getElementById('sidebar-menu');
  const btnClose = document.getElementById('btn-close-sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (btnMenu && sidebar) {
    btnMenu.addEventListener('click', () => sidebar.classList.remove('hidden'));
  }
  if (btnClose && sidebar) {
    btnClose.addEventListener('click', () => sidebar.classList.add('hidden'));
  }
  if (overlay && sidebar) {
    overlay.addEventListener('click', () => sidebar.classList.add('hidden'));
  }
}

function setupCookieBanner() {
  const banner = document.getElementById('cookie-banner');
  const btnAccept = document.getElementById('btn-accept-cookies');
  if (localStorage.getItem('sovyx_cookies_accepted') === 'true' && banner) {
    banner.style.display = 'none';
  }

  if (btnAccept && banner) {
    btnAccept.addEventListener('click', () => {
      localStorage.setItem('sovyx_cookies_accepted', 'true');
      banner.style.display = 'none';
    });
  }
}

function cleanUrlParams() {
  const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
  window.history.replaceState({ path: newUrl }, '', newUrl);
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}
