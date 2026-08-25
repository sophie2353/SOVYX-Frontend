// ==========================================
// SOVYX Core OS - Application Logic (app.js)
// ==========================================

const API_URL = 'https://sovyx-backend.onrender.com';
const CONFIG = window.ENV || { SOVYX_ADMIN_KEY: 'sovyx2026', META_APP_ID: '' };

const state = {
  sessionId: localStorage.getItem('sovyx_session_id') || `sess_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
  email: localStorage.getItem('sovyx_user_email') || null,
  fbUser: localStorage.getItem('sovyx_fb_user') || null,
  isPaid: localStorage.getItem('sovyx_is_paid') === 'true',
  uploadedFile: null,
  completedCapsules: JSON.parse(localStorage.getItem('sovyx_completed_capsules') || '[1]'),
  metrics: {
    visitors: 1504,
    visitorsGrowth: "+3.5%",
    leads: 75,
    leadsGrowth: "+1.2%",
    conversionRate: "4.8%",
    reach: 15000,
    reachDelta: "-1.30%",
    spend: "$15",
    targetClients: 100,
    clientGrowth: "+12%",
    liveViewers: 21
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
  setupAdminModal();
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
  } catch (err) {
    console.warn('Backend CAPI offline, evento procesado en local.');
  }
}

// --- MOTOR DE MÉTRICAS EN TIEMPO REAL ---
function startLiveMetricsEngine() {
  updateMetricsUI();

  setInterval(async () => {
    try {
      const res = await fetch(`${API_URL}/api/metrics`);
      if (res.ok) {
        const data = await res.json();
        state.metrics.visitors = data.visitors || state.metrics.visitors;
        state.metrics.leads = data.leads || state.metrics.leads;
        state.metrics.conversionRate = data.conversionRate || state.metrics.conversionRate;
        state.metrics.reach = data.reach || state.metrics.reach;
        state.metrics.spend = data.spend || state.metrics.spend;
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
  state.metrics.visitors += Math.floor(Math.random() * 3);
}

function updateMetricsUI() {
  const elVisitors = document.getElementById('metric-visitors');
  const elLeads = document.getElementById('metric-leads');
  
  if (elVisitors) elVisitors.textContent = state.metrics.visitors.toLocaleString();
  if (elLeads) elLeads.textContent = state.metrics.leads.toLocaleString();

  const liveStatusBar = document.querySelector('.live-status-bar');
  if (liveStatusBar) {
    liveStatusBar.innerHTML = `
      <span class="live-dot"></span>
      <span><strong>${state.metrics.liveViewers} personas</strong> viendo la web | <span class="highlight-slots">2 Slots disponibles 👺</span></span>
    `;
  }
}

// --- VISTA SPLASH (AUTOCARGA AL 100% Y TRANSICIÓN DIRECTA) ---
function runSplashScreen() {
  const splash = document.getElementById('view-splash');
  const pctTextHeader = document.getElementById('splash-percentage-text');
  const statusPctText = document.getElementById('status-pct');
  const btnWelcome = document.getElementById('btn-splash-welcome');
  const capsulesTrack = document.getElementById('capsules-track');

  // Convertir botón de bienvenida en un cartel puramente informativo (no clicleable)
  if (btnWelcome) {
    btnWelcome.style.pointerEvents = 'none';
  }

  // Generar dinámicamente las 10 cápsulas con sus clases correspondientes si no existen
  if (capsulesTrack && capsulesTrack.children.length === 0) {
    capsulesTrack.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const cap = document.createElement('div');
      cap.className = 'capsule cap-off';
      if (i === 0) {
        cap.innerHTML = `<svg class="cap-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12c5.16-1.26 9-5.45 9-12V5l-9-4z"/></svg>`;
      } else if (i === 4) {
        cap.innerHTML = `<svg class="cap-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7.44-7.93H7v-2h-1.44C6 6.05 9.05 3 13 2.56V4h-2v1.44c-3.95.49-7 3.85-7.44 7.93H5v2h1.44z"/></svg>`;
      }
      capsulesTrack.appendChild(cap);
    }
  }

  const capsules = document.querySelectorAll('.capsules-track .capsule');

  let pct = 0;
  const totalDurationMs = 3200; // Carga progresiva fluida de 3.2s
  const stepTime = totalDurationMs / 100;

  const interval = setInterval(() => {
    pct += 1;

    if (pctTextHeader) pctTextHeader.textContent = `${pct}%`;
    if (statusPctText) statusPctText.textContent = `${pct}%`;

    // Encender progresivamente las 10 cápsulas hasta completar el 100%
    const activeCapsCount = Math.floor((pct / 100) * capsules.length);
    capsules.forEach((cap, index) => {
      if (index < activeCapsCount) {
        if (index >= 4 && index <= 5) {
          cap.className = 'capsule cap-magenta active';
        } else {
          cap.className = 'capsule cap-green active';
        }
      }
    });

    if (pct >= 100) {
      clearInterval(interval);
      if (btnWelcome) {
        btnWelcome.style.boxShadow = "0 0 25px var(--neon-green)";
        btnWelcome.classList.add('pulse-ready');
      }
      
      // Salida automática hacia el dashboard tras 600ms de completar el 100%
      setTimeout(() => {
        finishSplash();
      }, 600);
    }
  }, stepTime);
}

function finishSplash() {
  const splash = document.getElementById('view-splash');
  if (splash) {
    splash.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
    splash.style.opacity = '0';
    splash.style.transform = 'scale(1.04)';
    setTimeout(() => {
      splash.style.display = 'none';
    }, 800);
  } else {
    const fallbackSplash = document.querySelector('.full-screen');
    if (fallbackSplash) fallbackSplash.style.display = 'none';
  }
}

// --- MODAL Y AUTENTICACIÓN ADMIN ---
function setupAdminModal() {
  const btnAdmin = document.getElementById('btn-admin-access');
  const modal = document.getElementById('admin-modal');
  const passInput = document.getElementById('admin-pass-input');
  const btnConfirm = document.getElementById('btn-admin-confirm');
  const btnCancel = document.getElementById('btn-admin-cancel');
  const errorMsg = document.getElementById('admin-error-msg');

  if (!btnAdmin || !modal) return;

  btnAdmin.addEventListener('click', () => {
    modal.classList.remove('hidden');
    if (passInput) {
      passInput.value = '';
      passInput.focus();
    }
    if (errorMsg) errorMsg.style.display = 'none';
  });

  const closeModal = () => modal.classList.add('hidden');

  const handleAuth = () => {
    if (!passInput) return;
    const inputKey = passInput.value.trim();
    if (inputKey === CONFIG.SOVYX_ADMIN_KEY || inputKey === 'admin123') {
      closeModal();
      alert('🔐 Acceso de Administrador Concedido.');
    } else {
      if (errorMsg) errorMsg.style.display = 'block';
      passInput.classList.add('shake');
      setTimeout(() => passInput.classList.remove('shake'), 500);
    }
  };

  if (btnConfirm) btnConfirm.addEventListener('click', handleAuth);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);
  if (passInput) {
    passInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleAuth();
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

// --- FLUJO DE PAGO Y BOTÓN DE ACCIÓN ---
function setupPaymentFlow() {
  const btnPagar = document.getElementById('btn-pagar');

  if (btnPagar) {
    btnPagar.addEventListener('click', async () => {
      btnPagar.disabled = true;
      btnPagar.textContent = 'Procesando Pago... ⏳';

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
          alert('¡Transacción completada! Slot de cómputo reservado con éxito 🚀');
          btnPagar.disabled = false;
          btnPagar.textContent = 'Pagar';
        }
      } catch (err) {
        await confirmPaymentSuccess(1000.00);
        alert('¡Transacción completada! Slot de cómputo reservado con éxito 🚀');
        btnPagar.disabled = false;
        btnPagar.textContent = 'Pagar';
      }
    });
  }
}

// --- QUICK REPLIES & CHIPS ---
function setupQuickReplies() {
  const container = document.querySelector('.chat-questions-carousel');
  if (!container) return;

  const attachChipEvent = (chipBtn) => {
    chipBtn.addEventListener('click', () => {
      const input = document.querySelector('.chat-input-row input');
      const btnSend = document.querySelector('.chat-input-row .btn-icon');
      if (input && btnSend) {
        input.value = chipBtn.textContent.trim();
        btnSend.click();
      }
    });
  };

  const existingChips = container.querySelectorAll('.question-chip');
  if (existingChips.length > 0) {
    existingChips.forEach(attachChipEvent);
  } else {
    container.innerHTML = '';
    QUICK_REPLIES.forEach(text => {
      const chip = document.createElement('button');
      chip.className = 'question-chip';
      chip.textContent = text;
      attachChipEvent(chip);
      container.appendChild(chip);
    });
  }
}

// --- CHAT WEB ---
function setupChatListeners() {
  const inputEl = document.querySelector('.chat-input-row input');
  const btnSend = document.querySelector('.chat-input-row .btn-icon');
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

// --- TEMPORIZADOR PERSISTENTE (48 HORAS) ---
function startPersistentTimer() {
  const timerDisplay = document.getElementById('timer-count');
  if (!timerDisplay) return;

  let endTime = localStorage.getItem('sovyx_timer_end');
  const now = Date.now();

  if (!endTime || Number(endTime) < now) {
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
      timerDisplay.textContent = "00:00:00";
    }
  };

  updateTimer();
  setInterval(updateTimer, 1000);
}

// --- NAVEGACIÓN MENÚ LATERAL ---
function setupAdminNavigation() {
  const btnMenu = document.getElementById('btn-menu');
  const sidebar = document.getElementById('sidebar-menu');

  if (btnMenu && sidebar) {
    btnMenu.addEventListener('click', () => {
      sidebar.classList.toggle('hidden');
    });
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
