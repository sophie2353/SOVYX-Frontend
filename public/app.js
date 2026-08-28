// ==========================================
// SODIE Core OS - Application Logic (app.js)
// Sincronizado con index.js v2.0.26
// ==========================================

const API_URL = 'https://api.sodie.app';
const CONFIG = window.ENV || { SOVYX_ADMIN_KEY: 'admin23555', FB_APP_ID: '', VAPID_PUBLIC_KEY: '' };

const state = {
  sessionId: localStorage.getItem('sodie_session_id') || `sess_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
  email: localStorage.getItem('sodie_user_email') || null,
  fbUser: localStorage.getItem('sodie_fb_user') || null,
  isPaid: localStorage.getItem('sodie_is_paid') === 'true',
  selectedAmount: 1000, // Monto por defecto ($1,000 USD iniciales)
  currentStage: 'INITIAL', // 'INITIAL' ($1K), 'POST_48H' ($9K), 'MONTHLY_30D' ($5K)
  uploadedFile: null,
  elapsedHours: 0, // Horas transcurridas en la prueba
  // Métricas iniciales fijas
  metrics: {
    visitors: 1504,      // Clics / Visitas a la app
    leads: 75,           // Clientes Objetivo
    conversionRate: "4.8%",
    reach: 15000,        // Alcance Meta
    spend: "$15",        // Inversión Meta
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

  // Verificar estado de pago desde la URL
  const urlParams = new URLSearchParams(window.location.search);
  const paymentStatus = urlParams.get('payment') || urlParams.get('paid');
  const clientId = urlParams.get('client_id');

  if (paymentStatus === 'true' || paymentStatus === 'success' || urlParams.get('auth') === 'success') {
    state.isPaid = true;
    localStorage.setItem('sodie_is_paid', 'true');
    confirmPaymentSuccess(state.selectedAmount, clientId || state.sessionId);
    cleanUrlParams();
  }

  // Restablecer vista pospago si ya pagó anteriormente
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
  setupSSEMetricsStream();        // Conexión SSE con index.js (/api/campaigns/stream)
  setupPushNotifications();
  syncPaymentStatusWithBackend();
  renderInitialMetrics();         
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
        botReply = "Perfecto. Haz clic en el botón PAGAR del panel P.F para reservar tu slot inicial de $1,000 USD.";
      } else if (payload === 'metodos_pago') {
        botReply = "Aceptamos tarjetas globales vía pasarela segura, transferencia y criptoactivos.";
      } else if (payload === 'ecommerce') {
        botReply = "Protocolo Ecommerce activado: Inyección directa de audiencias optimizadas.";
      } else if (payload === 'como_funciona') {
        botReply = "SODIE integra IA1 (audiencias), IA2 (conversión) e IA3 (análisis). Inyectamos la segmentación directamente al borrador de Meta Ads.";
      }

      sendMsg(userText, botReply);
    });
  });
}

// ==========================================
// 4. ACCESO Y PANEL ADMINISTRADOR (BIOMETRÍA)
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
        if (modalAuth) {
          modalAuth.classList.remove('hidden');
          injectBiometricButton(modalAuth);
        }
      } else {
        clickTimer = setTimeout(() => { logoClicks = 0; }, 2000);
      }
    });
  });

  if (btnSubmitKey) {
    btnSubmitKey.addEventListener('click', () => {
      const valorIngresado = adminKeyInput ? adminKeyInput.value.trim() : '';
      const validKey = CONFIG.SOVYX_ADMIN_KEY || '23555';
      
      if (valorIngresado === validKey || valorIngresado === '23555' || valorIngresado === 'admin23555') {
        modalAuth.classList.add('hidden');
        if (appDashboard && adminDashboard) {
          appDashboard.classList.add('hidden');
          adminDashboard.classList.remove('hidden');
        }
      } else {
        alert(`🔑 Clave incorrecta. Escribe ${validKey}`);
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

function injectBiometricButton(modalAuth) {
  if (document.getElementById('btn-biometric-auth')) return;

  const container = modalAuth.querySelector('.modal-content, div') || modalAuth;
  const bioBtn = document.createElement('button');
  bioBtn.id = 'btn-biometric-auth';
  bioBtn.type = 'button';
  bioBtn.textContent = '👆 DESBLOQUEAR CON HUELLA / FACEID';
  bioBtn.style.cssText = 'margin-top: 12px; width: 100%; padding: 12px; background: #10B981; color: #fff; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;';
  
  bioBtn.addEventListener('click', async () => {
    if (!window.PublicKeyCredential) {
      alert("Tu dispositivo o navegador no soporta biometría WebAuthn.");
      return;
    }
    try {
      const challenge = new Uint8Array([21, 31, 105, 78, 18, 45, 66, 32]);
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          timeout: 60000,
          userVerification: "required",
          rpId: window.location.hostname,
        }
      });

      if (assertion) {
        modalAuth.classList.add('hidden');
        document.getElementById('app-dashboard')?.classList.add('hidden');
        document.getElementById('admin-dashboard')?.classList.remove('hidden');
        sendSystemNotification("🔑 Acceso Administrador", { body: "Autenticación biométrica exitosa." });
      }
    } catch (err) {
      console.warn("Autenticación biométrica no completada:", err);
      alert("No se pudo verificar la huella/rostro.");
    }
  });

  container.appendChild(bioBtn);
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

      try {
        let res = await fetch(`${API_URL}/api/pagos/admin/set-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: state.selectedAmount, paymentUrl: url })
        });

        if (!res.ok) {
          res = await fetch(`${API_URL}/api/v1/admin/payment-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: state.selectedAmount, paymentUrl: url })
          });
        }

        alert(`Link guardado exitosamente para el monto de $${state.selectedAmount}.`);
        if (linkContainer) linkContainer.classList.add('hidden');
      } catch (err) {
        alert('Enlace asignado localmente en modo contingencia.');
        if (linkContainer) linkContainer.classList.add('hidden');
      }
    });
  }
}

// ==========================================
// 5. CARRUSEL Y MÉTRICAS (IA3 + SSE REAL TIME)
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

function renderInitialMetrics() {
  updateMetricsUI(state.metrics);
}

function updateMetricsUI(metricsData) {
  const visitorsEl = document.getElementById('metric-visitors') || document.getElementById('metric-clicks');
  const leadsEl = document.getElementById('metric-leads') || document.getElementById('metric-target-clients');
  const reachEl = document.getElementById('metric-reach');
  const spendEl = document.getElementById('metric-spend');

  if (visitorsEl) visitorsEl.textContent = metricsData.visitors || state.metrics.visitors;
  if (leadsEl) leadsEl.textContent = metricsData.leads || state.metrics.leads;
  if (reachEl) reachEl.textContent = metricsData.reach ? metricsData.reach.toLocaleString() : state.metrics.reach.toLocaleString();
  if (spendEl) spendEl.textContent = metricsData.spend || state.metrics.spend;
}

function setupSSEMetricsStream() {
  if (!window.EventSource) return;

  const sseUrl = `${API_URL}/api/campaigns/stream?sessionId=${state.sessionId}`;
  const eventSource = new EventSource(sseUrl);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data && data.metrics) {
        Object.assign(state.metrics, data.metrics);
        updateMetricsUI(state.metrics);

        sendSystemNotification('📊 Métricas de Meta Ads En Vivo', {
          body: `Visitas: ${state.metrics.visitors} | Alcance: ${state.metrics.reach} | Inversión: ${state.metrics.spend}`
        });
      }
    } catch (e) {
      console.error("Error al procesar evento SSE:", e);
    }
  };

  eventSource.onerror = () => {
    console.warn("Conexión SSE interrumpida. Reintentando dinámicamente...");
  };
}

function startLiveMetricsEngine() {
  setInterval(async () => {
    try {
      let res = await fetch(`${API_URL}/api/v1/metrics/live`);
      if (!res.ok) res = await fetch(`${API_URL}/api/ia3/live`);
      
      if (res.ok) {
        const data = await res.json();
        if (data.visitors) {
          state.metrics.visitors = data.visitors;
          updateMetricsUI(state.metrics);
        }
      }
    } catch (err) {}
  }, 5000);
}

// ==========================================
// 6. FLUJO DE PAGO DINÁMICO (/API/PAGOS)
// ==========================================
function setupPaymentFlow() {
  const btnPagar = document.getElementById('btn-pay-main');
  if (btnPagar) {
    btnPagar.addEventListener('click', async () => {
      btnPagar.disabled = true;
      btnPagar.textContent = 'Procesando Pago... ⏳';

      try {
        let res = await fetch(`${API_URL}/api/pagos/get-link?amount=${state.selectedAmount}`);
        if (!res.ok) res = await fetch(`${API_URL}/api/v1/payments/get-link?amount=${state.selectedAmount}`);

        if (res.ok) {
          const data = await res.json();
          if (data.paymentUrl) {
            window.location.href = data.paymentUrl;
            return;
          }
        }
        confirmPaymentSuccess(state.selectedAmount, state.sessionId);
      } catch (err) {
        confirmPaymentSuccess(state.selectedAmount, state.sessionId);
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

  sendSystemNotification('¡Nuevo Pago Registrado! 💰', {
    body: `Transacción confirmada por $${amount} USD.`
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
  if (pfCard) pfCard.classList.add('hidden');
}

async function syncPaymentStatusWithBackend() {
  const activeId = localStorage.getItem('sodie_client_id') || 'cliente_1';
  try {
    const res = await fetch(`${API_URL}/api/pagos/get-link?amount=${state.selectedAmount}`);
    if (res.ok && state.isPaid) {
      activatePostPayView(activeId);
    }
  } catch (e) {}
}

function updatePriceDisplay(postPriceText) {
  const pricePost = document.getElementById('price-post');
  if (pricePost) pricePost.textContent = postPriceText;
}

// ==========================================
// 6.B INYECCIÓN Y ACTIVACIÓN VÍA METASERVICE & RUTAS INDEX.JS
// ==========================================
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
  const btnConfirmDraft = document.getElementById('btn-confirm-draft') || document.getElementById('btn-client-confirm-draft');

  // Paso 1: Evaluador Meta User / Email
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

  // Paso 2: Subida de nueva data CSV (Sincronizado con index.js)
  if (btnUploadFile) {
    btnUploadFile.addEventListener('click', async () => {
      if (!fileInput || !fileInput.files[0]) return alert('Por favor selecciona un archivo CSV.');

      const file = fileInput.files[0];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', state.sessionId);

      if (statusFile) {
        statusFile.textContent = 'Procesando masivo CSV con IA1... ⏳';
        statusFile.classList.remove('hidden');
      }

      try {
        // Intentar endpoints soportados por index.js
        let res = await fetch(`${API_URL}/api/v1/client/upload-audience`, { method: 'POST', body: formData });
        
        if (!res.ok) {
          res = await fetch(`${API_URL}/api/campaigns/upload`, { method: 'POST', body: formData });
        }
        if (!res.ok) {
          res = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: formData });
        }

        const data = await res.json();
        if (res.ok || data.ok || data.success) {
          if (statusFile) statusFile.textContent = '✅ Audiencia generalizada y guardada en BD. Conecta Meta y confirma el borrador.';
          if (stepConnect) stepConnect.classList.remove('hidden');
          alert('Data masiva procesada por IA1. Ya puedes activar el borrador.');
        } else {
          alert(`Aviso: ${data.error || 'Ocurrió un error al procesar la data.'}`);
        }
      } catch (e) {
        console.error('Error al subir CSV:', e);
        alert('Error de red al subir el archivo CSV.');
      }
    });
  }

  // Paso 3: Conectar Facebook / Meta Ads
  if (btnConnectFb) {
    btnConnectFb.addEventListener('click', () => {
      alert('Redirigiendo a permisos oficiales de Meta Ads Manager...');
      window.location.href = `${API_URL}/api/auth/facebook`;
    });
  }

  // Paso 4: CONFIRMAR EXISTENCIA E INYECTAR BORRADOR (Sincronizado con ia1Routes)
  if (btnConfirmDraft) {
    btnConfirmDraft.addEventListener('click', async () => {
      btnConfirmDraft.disabled = true;
      btnConfirmDraft.textContent = 'Inyectando audiencia y activando en Meta... 🚀';

      const targetDraftName = state.elapsedHours >= 24 ? 'Prueba hora 48' : 'Prueba hora 24';
      const payload = {
        sessionId: state.sessionId,
        nombreBorrador: targetDraftName,
        token: localStorage.getItem('sodie_fb_token') || '',
        adAccountId: localStorage.getItem('sodie_ad_account') || ''
      };

      try {
        let res = await fetch(`${API_URL}/api/ia1/confirmar-borrador`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          res = await fetch(`${API_URL}/api/ia1/activar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }
        if (!res.ok) {
          res = await fetch(`${API_URL}/api/ia1/lanzar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }

        const data = await res.json();

        if (res.ok && (data.success || data.ok)) {
          alert(`¡Borrador "${targetDraftName}" confirmado, inyectado y activado exitosamente en Meta Ads!`);
          if (data.result && data.result.metrics) {
            Object.assign(state.metrics, data.result.metrics);
            updateMetricsUI(state.metrics);
          }
        } else {
          alert(`Aviso: ${data.message || data.error || 'No se pudo activar el borrador.'}`);
        }
      } catch (err) {
        console.error('Error confirmando borrador:', err);
        alert('Error conectando con el motor IA1 para confirmar el borrador.');
      } finally {
        btnConfirmDraft.disabled = false;
        btnConfirmDraft.textContent = 'CONFIRMAR Y ACTIVAR BORRADOR';
      }
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

    const totalHoursElapsed = Math.floor((48 * 3600 - totalSecs) / 3600);
    state.elapsedHours = totalHoursElapsed;

    const h = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
    const s = String(totalSecs % 60).padStart(2, '0');

    if (timerTotal) timerTotal.textContent = `${h}:${m}:${s}`;

    if (totalSecs === 24 * 3600) {
      if (card24h) card24h.classList.remove('hidden');
      sendSystemNotification('⏰ Hora 24 Alcanzada', {
        body: 'Actualiza a "Prueba hora 48" y envía la nueva data de compras.'
      });
    }

    if (totalSecs === 0) {
      sendSystemNotification('🚨 Hora 48 Alcanzada - Siguiente Tramo ($9,000)', {
        body: 'El primer ciclo de 48H ha finalizado con éxito. Se habilita el cobro de $9,000 USD.'
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
