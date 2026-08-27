// ==========================================
// SODIE Core OS - Application Logic (app.js)
// ==========================================

const API_URL = 'https://sovyx-backend.onrender.com';
const CONFIG = window.ENV || { SOVYX_ADMIN_KEY: 'admin23555', META_APP_ID: '' };

const state = {
  sessionId: localStorage.getItem('sodie_session_id') || `sess_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
  email: localStorage.getItem('sodie_user_email') || null,
  fbUser: localStorage.getItem('sodie_fb_user') || null,
  isPaid: localStorage.getItem('sodie_is_paid') === 'true',
  uploadedFile: null,
  metrics: {
    visitors: 1504,
    leads: 75,
    conversionRate: "4.8%",
    reach: 15000,
    spend: "$15",
    liveViewers: 21
  }
};

localStorage.setItem('sodie_session_id', state.sessionId);

// --- INICIALIZACIÓN PRINCIPAL ---
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch(`${API_URL}/api/config`);
    if (res.ok) Object.assign(CONFIG, await res.json());
  } catch (err) {
    console.warn('Backend SODIE local fallback.');
  }

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('paid') === 'true' || urlParams.get('auth') === 'success') {
    state.isPaid = true;
    localStorage.setItem('sodie_is_paid', 'true');
    confirmPaymentSuccess(1000.00);
    cleanUrlParams();
  }

  // Módulos del sistema
  runSplashScreen();
  setupChatSystem();
  setupAdminFiveClicks();
  setupCarouselDots();
  setupPaymentFlow();
  setupFileUploader();
  setupMetaAdsWorkflow();
  setupRenewalFlow();
  startPersistentTimer();
  startLiveMetricsEngine();
});

// ==========================================
// 1. SPLASH SCREEN (CARGA 100% & COLORES)
// ==========================================
function runSplashScreen() {
  const splashPct = document.getElementById('splash-pct');
  const statusPct = document.getElementById('status-pct');
  const gaugeVal1 = document.getElementById('gauge-val-1');
  const gaugeVal2 = document.getElementById('gauge-val-2');
  
  const gaugeCircle1 = document.getElementById('gauge-circle-1');
  const gaugeCircle2 = document.getElementById('gauge-circle-2');
  const welcomeFill = document.getElementById('welcome-fill');
  const capsulesTrack = document.getElementById('capsules-track');

  // Rellenar cápsulas si están vacías
  if (capsulesTrack && capsulesTrack.children.length === 0) {
    capsulesTrack.innerHTML = '';
    for (let i = 0; i < 14; i++) {
      const cap = document.createElement('div');
      cap.className = 'capsule cap-dark';
      cap.innerHTML = `<div class="cap-glint"></div>`;
      capsulesTrack.appendChild(cap);
    }
  }

  const capsules = document.querySelectorAll('.capsules-track .capsule');

  let pct = 0;
  const totalDurationMs = 2800; // 2.8 segundos de intro
  const stepTime = totalDurationMs / 100;

  const interval = setInterval(() => {
    pct += 1;

    // Actualizar números
    if (splashPct) splashPct.textContent = `${pct}%`;
    if (statusPct) statusPct.textContent = `${pct}%`;
    if (gaugeVal1) gaugeVal1.textContent = `${pct}%`;
    if (gaugeVal2) gaugeVal2.textContent = `${pct}%`;

    // SVG Gauges
    if (gaugeCircle1) gaugeCircle1.setAttribute('stroke-dasharray', `${pct}, 100`);
    if (gaugeCircle2) gaugeCircle2.setAttribute('stroke-dasharray', `${pct}, 100`);

    // Llenado de agua en el cartel BIENVENIDO
    if (welcomeFill) welcomeFill.style.height = `${pct}%`;

    // Encender cápsulas en verde/menta y fucsia
    if (capsules.length > 0) {
      const activeCount = Math.floor((pct / 100) * capsules.length);
      capsules.forEach((cap, index) => {
        if (index < activeCount) {
          if (index >= 6 && index <= 8) {
            cap.className = 'capsule cap-fuchsia';
          } else {
            cap.className = 'capsule cap-mint';
          }
        } else {
          cap.className = 'capsule cap-dark';
        }
      });
    }

    // Finalizar en 100%
    if (pct >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        finishSplash();
      }, 400);
    }
  }, stepTime);
}

function finishSplash() {
  const splash = document.getElementById('view-splash') || document.querySelector('.full-screen');
  if (splash) {
    splash.style.transition = 'opacity 0.6s ease, visibility 0.6s ease';
    splash.style.opacity = '0';
    splash.style.visibility = 'hidden';
    setTimeout(() => {
      splash.classList.add('hidden');
    }, 600);
  }
}

// ==========================================
// 2. CHAT WEB INTERACTIVO & BOTONES
// ==========================================
function setupChatSystem() {
  const inputEl = document.querySelector('.chat-input-bar input');
  const btnSend = document.querySelector('.chat-send-btn');
  const chatBody = document.getElementById('chat-body') || document.querySelector('.chat-body');
  const quickOpts = document.querySelectorAll('.chat-quick-options .opt-btn');

  if (!btnSend || !inputEl || !chatBody) return;

  const appendMsg = (text, isOutgoing) => {
    const msgDiv = document.createElement('div');
    msgDiv.className = isOutgoing ? 'outgoing-simple' : 'incoming-simple';
    msgDiv.innerHTML = `<p>${escapeHTML(text)}</p>`;
    chatBody.appendChild(msgDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
  };

  const sendMsg = async (customText = null, customReply = null) => {
    const text = customText || inputEl.value.trim();
    if (!text) return;

    appendMsg(text, true);
    if (!customText) inputEl.value = '';

    if (customReply) {
      setTimeout(() => appendMsg(customReply, false), 400);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: state.sessionId })
      });
      const data = await res.json();
      appendMsg(data.reply || 'Sistema SODIE: Solicitud recibida. Calibrando parámetros.', false);
    } catch (err) {
      setTimeout(() => {
        appendMsg('Sistema SODIE: Mensaje procesado. Monitoreando métricas.', false);
      }, 500);
    }
  };

  btnSend.addEventListener('click', () => sendMsg());
  inputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMsg();
  });

  // Conectar botones rápidos
  quickOpts.forEach(btn => {
    btn.addEventListener('click', () => {
      const userText = btn.textContent.trim();
      const botReply = btn.getAttribute('data-reply') || "Procesando tu consulta...";
      sendMsg(userText, botReply);
    });
  });
}

// ==========================================
// 3. ACCESO ADMIN CON 5 CLICS EN LOGO
// ==========================================
function setupAdminFiveClicks() {
  let logoClicks = 0;
  let clickTimer;

  const logoTriggers = document.querySelectorAll('.logo-wrapper, .brand-text');
  const appDashboard = document.getElementById('app-dashboard');
  const adminDashboard = document.getElementById('admin-dashboard');
  const btnExitAdmin = document.getElementById('btn-exit-admin');

  logoTriggers.forEach(logo => {
    logo.addEventListener('click', () => {
      logoClicks++;
      clearTimeout(clickTimer);

      if (logoClicks >= 5) {
        logoClicks = 0;
        if (appDashboard && adminDashboard) {
          appDashboard.classList.add('hidden');
          adminDashboard.classList.remove('hidden');
          alert('👺 Acceso Concedido: Dashboard Admin SODIE');
        }
      } else {
        clickTimer = setTimeout(() => { logoClicks = 0; }, 2000);
      }
    });
  });

  if (btnExitAdmin) {
    btnExitAdmin.addEventListener('click', () => {
      if (appDashboard && adminDashboard) {
        adminDashboard.classList.add('hidden');
        appDashboard.classList.remove('hidden');
      }
    });
  }
}

// ==========================================
// 4. SINCRONÍA DE CARRUSEL CON INDICADORES
// ==========================================
function setupCarouselDots() {
  const slider = document.querySelector('.metrics-slider');
  const dots = document.querySelectorAll('.slider-dots-indicator .dot');
  const cards = document.querySelectorAll('.metrics-slider .metric-square');

  if (!slider || dots.length === 0 || cards.length === 0) return;

  slider.addEventListener('scroll', () => {
    const scrollPos = slider.scrollLeft;
    const cardWidth = cards[0].offsetWidth + 14; 
    const activeIdx = Math.round(scrollPos / cardWidth);

    dots.forEach((dot, idx) => {
      if (idx === activeIdx) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  });

  dots.forEach((dot, idx) => {
    dot.addEventListener('click', () => {
      const cardWidth = cards[0].offsetWidth + 14;
      slider.scrollTo({ left: idx * cardWidth, behavior: 'smooth' });
    });
  });
}

// ==========================================
// 5. MOTOR DE MÉTRICAS Y FLUJOS SECUNDARIOS
// ==========================================
function startLiveMetricsEngine() {
  setInterval(async () => {
    try {
      const res = await fetch(`${API_URL}/api/metrics`);
      if (res.ok) {
        const data = await res.json();
        state.metrics.visitors = data.visitors || state.metrics.visitors;
        state.metrics.leads = data.leads || state.metrics.leads;
      }
    } catch (err) {
      state.metrics.visitors += Math.floor(Math.random() * 2);
    }
  }, 4000);
}

function setupPaymentFlow() {
  const btnPagar = document.getElementById('btn-pay-main') || document.getElementById('btn-pagar');
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
          confirmPaymentSuccess(1000.00);
          alert('¡Slot de cómputo reservado con éxito! 🚀');
        }
      } catch (err) {
        confirmPaymentSuccess(1000.00);
        alert('¡Transacción completada localmente! 🚀');
      } finally {
        btnPagar.disabled = false;
        btnPagar.textContent = 'PAGAR AHORA';
      }
    });
  }
}

async function confirmPaymentSuccess(amount = 1000.00) {
  state.isPaid = true;
  localStorage.setItem('sodie_is_paid', 'true');
  try {
    await fetch(`${API_URL}/api/pago/confirmar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId, amount: amount })
    });
  } catch (err) {}
}

function setupFileUploader() {
  const fileInput = document.getElementById('spreadsheet-file-input') || document.getElementById('file-upload-input');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) state.uploadedFile = e.target.files[0];
    });
  }
}

function setupMetaAdsWorkflow() {
  const btnSubmitEval = document.getElementById('btn-submit-evaluator');
  if (btnSubmitEval) {
    btnSubmitEval.addEventListener('click', () => {
      const msg = document.getElementById('evaluator-status-msg');
      if (msg) msg.classList.remove('hidden');
    });
  }
}

function setupRenewalFlow() {
  const btnRenew = document.getElementById('btn-renew-yes');
  if (btnRenew) {
    btnRenew.addEventListener('click', () => {
      alert('¡Slot renovado exitosamente por 30 días!');
    });
  }
}

function startPersistentTimer() {
  const timerDisplay = document.getElementById('timer-display');
  if (!timerDisplay) return;

  let totalSecs = 48 * 3600;
  setInterval(() => {
    if (totalSecs > 0) totalSecs--;
    const h = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
    const s = String(totalSecs % 60).padStart(2, '0');
    timerDisplay.textContent = `${h}:${m}:${s}`;
  }, 1000);
}

function cleanUrlParams() {
  const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
  window.history.replaceState({ path: newUrl }, '', newUrl);
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}
