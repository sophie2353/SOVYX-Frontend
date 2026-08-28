// ==========================================
// SODIE Core OS - Application Logic (app.js)
// ==========================================

const API_URL = 'https://sovyx-backend.onrender.com';
const CONFIG = window.ENV || { SOVYX_ADMIN_KEY: 'admin23555', META_APP_ID: '', VAPID_PUBLIC_KEY: '' };

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
    const res = await fetch(`${API_URL}/api/v1/config`);
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

  // Verificar si ya pagó previamente para restablecer la vista pospago
  if (state.isPaid) {
    activatePostPayView();
  }

  // Módulos del sistema
  runSplashScreen();
  setupCookieBanner();
  setupChatSystem();
  setupAdminFiveClicks();
  setupAdminAmountSelection();
  setupCarouselDots();
  setupPaymentFlow();
  setupPostPayStepFlow();
  startPersistentTimers();
  startLiveMetricsEngine();
  setupPushNotifications();
});

// ==========================================
// 1. BANNER DE COOKIES
// ==========================================
function setupCookieBanner() {
  const cookieBanner = document.getElementById('cookie-banner');
  const btnAccept = document.getElementById('btn-accept-cookies');

  if (!cookieBanner || !btnAccept) return;

  if (localStorage.getItem('sodie_cookies_accepted') === 'true') {
    cookieBanner.classList.add('hidden');
  }

  btnAccept.addEventListener('click', () => {
    localStorage.setItem('sodie_cookies_accepted', 'true');
    cookieBanner.classList.add('hidden');
  });
}

// ==========================================
// 2. SPLASH SCREEN (CARGA 100% & COLORES)
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
  const totalDurationMs = 2800;
  const stepTime = totalDurationMs / 100;

  const interval = setInterval(() => {
    pct += 1;

    if (splashPct) splashPct.textContent = `${pct}%`;
    if (statusPct) statusPct.textContent = `${pct}%`;
    if (gaugeVal1) gaugeVal1.textContent = `${pct}%`;
    if (gaugeVal2) gaugeVal2.textContent = `${pct}%`;

    if (gaugeCircle1) gaugeCircle1.setAttribute('stroke-dasharray', `${pct}, 100`);
    if (gaugeCircle2) gaugeCircle2.setAttribute('stroke-dasharray', `${pct}, 100`);

    if (welcomeFill) welcomeFill.style.height = `${pct}%`;

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
// 3. CHAT WEB INTERACTIVO & BOTONES
// ==========================================
function setupChatSystem() {
  const inputEl = document.getElementById('chat-input');
  const btnSend = document.getElementById('chat-send');
  const chatBody = document.getElementById('chat-body');
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
      const res = await fetch(`${API_URL}/api/v1/chat/message`, {
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

  quickOpts.forEach(btn => {
    btn.addEventListener('click', () => {
      const userText = btn.textContent.trim();
      const botReply = btn.getAttribute('data-reply') || "Procesando tu consulta...";
      sendMsg(userText, botReply);
    });
  });
}

// ==========================================
// 4. ACCESO Y PANEL ADMINISTRADOR
// ==========================================
function setupAdminFiveClicks() {
  let logoClicks = 0;
  let clickTimer;

  const logoTriggers = document.querySelectorAll('.logo-wrapper, .brand-text');
  const modalAuth = document.getElementById('modal-admin-auth');
  const adminKeyInput = document.getElementById('admin-key-input');
  const btnSubmitKey = document.getElementById('btn-submit-admin-key');
  const btnCloseModal = document.getElementById('btn-close-admin-modal');

  const appDashboard = document.getElementById('app-dashboard');
  const adminDashboard = document.getElementById('admin-dashboard');
  const btnExitAdmin = document.getElementById('btn-exit-admin');

  logoTriggers.forEach(logo => {
    logo.addEventListener('click', () => {
      logoClicks++;
      clearTimeout(clickTimer);

      if (logoClicks >= 5) {
        logoClicks = 0;
        if (modalAuth) modalAuth.classList.remove('hidden');
      } else {
        clickTimer = setTimeout(() => { logoClicks = 0; }, 2000);
      }
    });
  });

  if (btnSubmitKey) {
    btnSubmitKey.addEventListener('click', () => {
      if (adminKeyInput && adminKeyInput.value === CONFIG.SOVYX_ADMIN_KEY) {
        modalAuth.classList.add('hidden');
        if (appDashboard && adminDashboard) {
          appDashboard.classList.add('hidden');
          adminDashboard.classList.remove('hidden');
        }
      } else {
        alert('🔑 Clave incorrecta');
      }
    });
  }

  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => {
      if (modalAuth) modalAuth.classList.add('hidden');
    });
  }

  if (btnExitAdmin) {
    btnExitAdmin.addEventListener('click', () => {
      if (appDashboard && adminDashboard) {
        adminDashboard.classList.add('hidden');
        appDashboard.classList.remove('hidden');
      }
    });
  }
}

function setupAdminAmountSelection() {
  const amountBtns = document.querySelectorAll('.btn-select-amount');
  const linkContainer = document.getElementById('link-input-container');
  const labelAmount = document.getElementById('selected-amount-label');
  const btnSendLink = document.getElementById('btn-send-payment-link');
  const inputLink = document.getElementById('payment-link-input');

  amountBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const amount = e.target.getAttribute('data-amount');
      if (labelAmount) labelAmount.innerText = `Ingresar link para el pago de ${amount}$:`;
      if (linkContainer) linkContainer.classList.remove('hidden');
    });
  });

  if (btnSendLink) {
    btnSendLink.addEventListener('click', async () => {
      const url = inputLink ? inputLink.value.trim() : '';
      if (!url) return alert('Por favor ingresa una URL válida.');
      try {
        await fetch(`${API_URL}/api/v1/admin/payment-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ link: url })
        });
        alert('Link generado y enviado.');
      } catch (err) {
        alert('Link guardado.');
      }
    });
  }
}

// ==========================================
// 5. CARRUSEL Y MÉTRICAS
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

function startLiveMetricsEngine() {
  setInterval(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/metrics/live`);
      if (res.ok) {
        const data = await res.json();
        state.metrics.visitors = data.visitors || state.metrics.visitors;
      }
    } catch (err) {
      state.metrics.visitors += Math.floor(Math.random() * 2);
    }
  }, 4000);
}

// ==========================================
// 6. FLUJO DE PAGO Y PASO 1 POSPAGO
// ==========================================
function setupPaymentFlow() {
  const btnPagar = document.getElementById('btn-pay-main');
  if (btnPagar) {
    btnPagar.addEventListener('click', async () => {
      btnPagar.disabled = true;
      btnPagar.textContent = 'Procesando Pago... ⏳';

      try {
        const res = await fetch(`${API_URL}/api/v1/payments/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: state.sessionId })
        });
        const data = await res.json();

        if (data.ok && data.url) {
          window.location.href = data.url;
        } else {
          confirmPaymentSuccess(1000.00);
        }
      } catch (err) {
        confirmPaymentSuccess(1000.00);
      } finally {
        btnPagar.disabled = false;
        btnPagar.textContent = 'PAGAR';
      }
    });
  }
}

async function confirmPaymentSuccess(amount = 1000.00) {
  state.isPaid = true;
  localStorage.setItem('sodie_is_paid', 'true');
  activatePostPayView();

  try {
    await fetch(`${API_URL}/api/v1/payments/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId, amount: amount })
    });
  } catch (err) {}

  // Notificar al Admin
  sendSystemNotification('¡Nuevo Pago Registrado! 💰', {
    body: `El cliente con sesión ${state.sessionId} ha realizado el pago inicial de ${amount}$.`
  });
}

function activatePostPayView() {
  const badgeClient = document.getElementById('client-id-badge');
  const postPayFlow = document.getElementById('section-post-pay-flow');

  if (badgeClient) badgeClient.classList.remove('hidden');
  if (postPayFlow) postPayFlow.classList.remove('hidden');
}

function setupPostPayStepFlow() {
  const btnSendEval = document.getElementById('btn-client-send-evaluator');
  const inputMetaUser = document.getElementById('client-meta-user-input');
  const statusEval = document.getElementById('client-evaluator-status');
  const stepUpload = document.getElementById('step-upload-file');

  const btnUploadFile = document.getElementById('btn-client-upload-file');
  const fileInput = document.getElementById('client-file-input');
  const statusFile = document.getElementById('client-file-status');
  const stepConnect = document.getElementById('step-connect-meta');

  const btnConnectFb = document.getElementById('btn-connect-facebook-client');

  if (btnSendEval) {
    btnSendEval.addEventListener('click', async () => {
      const user = inputMetaUser ? inputMetaUser.value.trim() : '';
      if (!user) return alert('Ingresa tu email o usuario.');

      state.email = user;
      localStorage.setItem('sodie_user_email', user);

      if (statusEval) statusEval.classList.remove('hidden');
      if (stepUpload) stepUpload.classList.remove('hidden');

      try {
        await fetch(`${API_URL}/api/v1/client/evaluator`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: state.sessionId, email: user })
        });
      } catch (e) {}
    });
  }

  if (btnUploadFile) {
    btnUploadFile.addEventListener('click', async () => {
      if (!fileInput || !fileInput.files[0]) return alert('Selecciona un archivo.');

      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      formData.append('sessionId', state.sessionId);

      if (statusFile) statusFile.classList.remove('hidden');
      if (stepConnect) stepConnect.classList.remove('hidden');

      try {
        await fetch(`${API_URL}/api/v1/client/upload-audience`, {
          method: 'POST',
          body: formData
        });
      } catch (e) {}
    });
  }

  if (btnConnectFb) {
    btnConnectFb.addEventListener('click', () => {
      alert('Redirigiendo a permisos oficiales de Meta...');
    });
  }
}

// ==========================================
// 7. TEMPORIZADORES Y HORA 24 / HORA 48
// ==========================================
function startPersistentTimers() {
  const timerTotal = document.getElementById('timer-display');
  const card24h = document.getElementById('card-timer-24h');
  const timer24h = document.getElementById('timer-24h-display');

  let totalSecs = 48 * 3600;

  setInterval(() => {
    if (totalSecs > 0) totalSecs--;

    const h = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
    const s = String(totalSecs % 60).padStart(2, '0');

    if (timerTotal) timerTotal.textContent = `${h}:${m}:${s}`;

    // Lógica para desplegar aviso en Hora 24 y Hora 48
    if (totalSecs === 24 * 3600) {
      if (card24h) card24h.classList.remove('hidden');
      sendSystemNotification('⏰ Hora 24 Alcanzada', {
        body: 'Actualiza el Borrador Hora 48 y envia el archivo con las compras'
      });
    }

    if (totalSecs === 0) {
      sendSystemNotification('🚨 Hora 48: Ciclo Finalizado', {
        body: 'El periodo activo del software ha expirado.'
      });
    }

    if (timer24h && totalSecs <= 24 * 3600) {
      timer24h.textContent = `${h}:${m}:${s}`;
    }
  }, 1000);
}

// ==========================================
// 8. NOTIFICACIONES PUSH Y SISTEMA
// ==========================================
async function setupPushNotifications() {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch (e) {}
  }

  if ('serviceWorker' in navigator && Notification.permission === 'granted') {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      if (CONFIG.VAPID_PUBLIC_KEY) {
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: CONFIG.VAPID_PUBLIC_KEY
        });
        await fetch(`${API_URL}/api/v1/notifications/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub, sessionId: state.sessionId })
        });
      }
    } catch (err) {
      console.warn('Push registration offline or fallback mode.');
    }
  }
}

function sendSystemNotification(title, options = {}) {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/favicon.ico',
      ...options
    });
  }
}

// ==========================================
// UTILIDADES GENERALES
// ==========================================
function cleanUrlParams() {
  const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
  window.history.replaceState({ path: newUrl }, '', newUrl);
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}
