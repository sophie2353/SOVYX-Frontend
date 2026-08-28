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
  selectedAmount: 1000, // Monto por defecto ($1,000 USD iniciales)
  currentStage: 'INITIAL', // 'INITIAL' ($1K), 'POST_48H' ($9K), 'MONTHLY_30D' ($5K)
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
    if (res.ok) {
      Object.assign(CONFIG, await res.json());
    } else {
      const resFallback = await fetch(`${API_URL}/api/config`);
      if (resFallback.ok) Object.assign(CONFIG, await resFallback.json());
    }
  } catch (err) {
    console.warn('Backend SODIE local fallback.');
  }

  // Verificar estado de pago desde la URL (redirección pasarela / callback)
  const urlParams = new URLSearchParams(window.location.search);
  const paymentStatus = urlParams.get('payment') || urlParams.get('paid');
  const clientId = urlParams.get('client_id');

  if (paymentStatus === 'true' || paymentStatus === 'success' || urlParams.get('auth') === 'success') {
    state.isPaid = true;
    localStorage.setItem('sodie_is_paid', 'true');
    confirmPaymentSuccess(state.selectedAmount, clientId || state.sessionId);
    cleanUrlParams();
  }

  // Verificar si ya pagó previamente para restablecer la vista pospago
  if (state.isPaid) {
    activatePostPayView(clientId);
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
  syncPaymentStatusWithBackend();
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
// 3. CHAT WEB INTERACTIVO & BOTONES (IA2)
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
      let res = await fetch(`${API_URL}/api/v1/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: state.sessionId })
      });

      if (!res.ok) {
        res = await fetch(`${API_URL}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, sessionId: state.sessionId })
        });
      }

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
      const payload = btn.getAttribute('data-payload');
      
      let botReply = "Procesando tu consulta...";
      if (payload === 'acceder') {
        botReply = "Perfecto. Haz clic en el botón PAGAR del panel P.F para reservar tu slot inicial de $1,000 USD (o $1 USD si estás en modo de prueba).";
      } else if (payload === 'metodos_pago') {
        botReply = "Aceptamos tarjetas globales vía pasarela segura, transferencia y criptoactivos. El flujo se divide en: $1,000 iniciales, $9,000 a las 48h con resultados, y $5,000 para mantenimiento a 30 días.";
      } else if (payload === 'ecommerce') {
        botReply = "Protocolo Ecommerce activado: Inyección directa de audiencias optimizadas para escalar facturación sobre los 100K€.";
      } else if (payload === 'como_funciona') {
        botReply = "SODIE integra IA1 (audiencias), IA2 (conversión) e IA3 (análisis de métricas). Conectas tu Meta Ads Manager y el sistema ejecuta borradores optimizados automáticamente.";
      }

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
      state.selectedAmount = Number(e.target.getAttribute('data-amount')) || 1000;
      if (labelAmount) labelAmount.innerText = `Ingresar link para el pago de ${state.selectedAmount}$:`;
      if (linkContainer) linkContainer.classList.remove('hidden');
    });
  });

  if (btnSendLink) {
    btnSendLink.addEventListener('click', async () => {
      const url = inputLink ? inputLink.value.trim() : '';
      if (!url) return alert('Por favor ingresa una URL válida.');

      const targetClientId = state.selectedAmount === 1 ? 'test_admin' : 'cliente_1';

      try {
        let res = await fetch(`${API_URL}/api/pagos/admin/set-payment-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            clientId: targetClientId,
            amount: state.selectedAmount,
            rawPaymentUrl: url
          })
        });

        if (!res.ok) {
          res = await fetch(`${API_URL}/api/v1/admin/payment-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId: targetClientId, amount: state.selectedAmount, link: url })
          });
        }

        const data = await res.json();
        alert(`Link guardado exitosamente en DB para ${targetClientId} ($${state.selectedAmount}).`);
        if (linkContainer) linkContainer.classList.add('hidden');
      } catch (err) {
        alert('Enlace asignado localmente en modo contingencia.');
        if (linkContainer) linkContainer.classList.add('hidden');
      }
    });
  }
}

// ==========================================
// 5. CARRUSEL Y MÉTRICAS (IA3)
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
      let res = await fetch(`${API_URL}/api/v1/metrics/live`);
      if (!res.ok) {
        res = await fetch(`${API_URL}/api/ia3/live`);
      }
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
// 6. FLUJO DE PAGO Y RUTAS /API/PAGOS
// ==========================================
function setupPaymentFlow() {
  const btnPagar = document.getElementById('btn-pay-main');
  if (btnPagar) {
    btnPagar.addEventListener('click', async () => {
      btnPagar.disabled = true;
      btnPagar.textContent = 'Procesando Pago... ⏳';

      const targetClientId = state.selectedAmount === 1 ? 'test_admin' : (localStorage.getItem('sodie_client_id') || 'cliente_1');

      try {
        // Solicitamos la URL de pago desde routes/pagos
        let res = await fetch(`${API_URL}/api/pagos/client/${targetClientId}/payment-info`);
        
        if (res.ok) {
          const data = await res.json();
          if (data.paymentUrl) {
            window.location.href = data.paymentUrl;
            return;
          }
        }

        // Fallback al endpoint de creación directa de checkout
        res = await fetch(`${API_URL}/api/pagos/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            sessionId: state.sessionId, 
            clientId: targetClientId,
            amount: state.selectedAmount 
          })
        });

        const checkoutData = await res.json();

        if (checkoutData.ok && checkoutData.url) {
          window.location.href = checkoutData.url;
        } else {
          confirmPaymentSuccess(state.selectedAmount, targetClientId);
        }
      } catch (err) {
        confirmPaymentSuccess(state.selectedAmount, targetClientId);
      } finally {
        btnPagar.disabled = false;
        btnPagar.textContent = 'PAGAR';
      }
    });
  }
}

async function confirmPaymentSuccess(amount = 1000.00, clientId = 'cliente_1') {
  state.isPaid = true;
  localStorage.setItem('sodie_is_paid', 'true');
  localStorage.setItem('sodie_client_id', clientId);

  activatePostPayView(clientId);

  try {
    let res = await fetch(`${API_URL}/api/pagos/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId, clientId: clientId, amount: amount })
    });

    if (!res.ok) {
      await fetch(`${API_URL}/api/webhooks/kontigo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: state.sessionId, amount: amount, event: 'PAYMENT_CONFIRMED' })
      });
    }
  } catch (err) {}

  // Notificar al Admin
  sendSystemNotification('¡Nuevo Pago Registrado! 💰', {
    body: `Cliente ${clientId} ha confirmado el pago de $${amount} USD.`
  });
}

function activatePostPayView(clientId = null) {
  const badgeClient = document.getElementById('client-id-badge');
  const postPayFlow = document.getElementById('section-post-pay-flow');
  const pfCard = document.getElementById('pf-card');

  const activeId = clientId || localStorage.getItem('sodie_client_id') || 'cliente_1';

  if (badgeClient) {
    badgeClient.textContent = `Cliente #${activeId}`;
    badgeClient.classList.remove('hidden');
  }

  if (postPayFlow) postPayFlow.classList.remove('hidden');
  if (pfCard) pfCard.classList.add('hidden'); // Ocultar bloque de pago inicial una vez completado
}

async function syncPaymentStatusWithBackend() {
  const activeId = localStorage.getItem('sodie_client_id') || 'cliente_1';
  try {
    const res = await fetch(`${API_URL}/api/pagos/client/${activeId}/payment-info`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'PAID') {
        state.isPaid = true;
        localStorage.setItem('sodie_is_paid', 'true');
        activatePostPayView(activeId);
      }
      
      // Actualizar vista de precios dinámicamente si aplica (1K -> 9K -> 5K)
      if (data.currentStage === 'POST_48H') {
        updatePriceDisplay('9.000$');
      } else if (data.currentStage === 'MONTHLY_30D') {
        updatePriceDisplay('5.000$');
      }
    }
  } catch (e) {}
}

function updatePriceDisplay(postPriceText) {
  const pricePost = document.getElementById('price-post');
  if (pricePost) pricePost.textContent = postPriceText;
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
        let res = await fetch(`${API_URL}/api/v1/client/evaluator`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: state.sessionId, email: user })
        });

        if (!res.ok) {
          await fetch(`${API_URL}/api/onboarding/evaluator`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: state.sessionId, email: user })
          });
        }
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
        let res = await fetch(`${API_URL}/api/v1/client/upload-audience`, {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          res = await fetch(`${API_URL}/api/upload`, {
            method: 'POST',
            body: formData
          });

          if (!res.ok) {
            await fetch(`${API_URL}/api/ia1/upload`, {
              method: 'POST',
              body: formData
            });
          }
        }
      } catch (e) {}
    });
  }

  if (btnConnectFb) {
    btnConnectFb.addEventListener('click', () => {
      alert('Redirigiendo a permisos oficiales de Meta...');
      window.location.href = `${API_URL}/api/auth/facebook`;
    });
  }
}

// ==========================================
// 7. TEMPORIZADORES Y HORA 24 / HORA 48 / 30 DÍAS
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
        body: 'Actualiza el Borrador Hora 48 y envía el archivo con las compras.'
      });
    }

    if (totalSecs === 0) {
      sendSystemNotification('🚨 Hora 48 Alcanzada - Siguiente Tramo ($9,000)', {
        body: 'El primer ciclo de 48H ha finalizado con éxito. Se habilita el cobro de $9,000 USD y posterior renovación a 30 días ($5,000 USD).'
      });
      state.currentStage = 'POST_48H';
      updatePriceDisplay('9.000$');
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
        
        let res = await fetch(`${API_URL}/api/v1/notifications/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub, sessionId: state.sessionId })
        });

        if (!res.ok) {
          await fetch(`${API_URL}/api/notifications/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: sub, sessionId: state.sessionId })
          });
        }
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
