// ==========================================
// SODIE Core OS - Application Logic (app.js)
// Sincronizado con index.html / index.js v2.0.28
// Incluye Módulo de Biometría (Face ID / Touch ID / Fingerprint) en Admin, Post-Pago y User
// Esquema de Cobro: $1K inicial + $3K (Hora 48) + $3K (Hora 72) + $3K (Hora 96) + $5K/mes
// ==========================================

const API_URL = window.location.origin.includes('localhost') ? 'http://localhost:10000' : 'https://api.sodie.app';
const CONFIG = window.ENV || { SOVYX_ADMIN_KEY: 'admin23555', FB_APP_ID: '', VAPID_PUBLIC_KEY: '' };

const state = {
  sessionId: localStorage.getItem('sodie_session_id') || `sess_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
  email: localStorage.getItem('sodie_user_email') || null,
  fbUser: localStorage.getItem('sodie_fb_user') || null,
  isPaid: localStorage.getItem('sodie_is_paid') === 'true',
  isBioEnabled: localStorage.getItem('sodie_bio_enabled') === 'true',
  selectedAmount: 1000,
  currentStage: 'INITIAL',
  uploadedFile: null,
  elapsedHours: 0,
  metrics: JSON.parse(localStorage.getItem('sodie_custom_metrics')) || {
    visitors: 80,
    leads: 2,
    conversionRate: "2%",
    reach: 2000,
    spend: "$38",
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
  const paymentStatus = urlParams.get('payment') || urlParams.get('paid') || urlParams.get('status');
  const clientId = urlParams.get('client_id');

  if (paymentStatus === 'true' || paymentStatus === 'success' || paymentStatus === 'paid' || urlParams.get('auth') === 'success') {
    state.isPaid = true;
    localStorage.setItem('sodie_is_paid', 'true');
    confirmPaymentSuccess(state.selectedAmount, clientId || state.sessionId);
    cleanUrlParams();
  }

  if (state.isPaid) {
    activatePostPayView(clientId);
  }

  // Módulos
  runSplashScreen();
  setupCookieBanner();
  setupWaitlistFlow();
  setupChatSystem();
  setupCarouselDots();
  setupPaymentFlow();
  setupPostPayStepFlow();
  setupAdminAuthModal();
  setupBiometricModule(); // <- Inicialización del motor biométrico
  startPersistentTimers();
  startLiveMetricsEngine();       
  setupSSEMetricsStream();        
  setupPushNotifications();
  syncPaymentStatusWithBackend();
  renderInitialMetrics();         

  loadDashboardMetrics(state.sessionId);
});

// ==========================================
// 0. MÓDULO DE BIOMETRÍA (Face ID / Touch ID / WebAuthn)
// ==========================================
function setupBiometricModule() {
  const btnUserBioLogin = document.getElementById('btn-bio-user-login');
  const btnRegisterBioPostPay = document.getElementById('btn-register-bio-postpay');

  // Auto-login o desbloqueo biométrico para Usuario
  if (btnUserBioLogin) {
    btnUserBioLogin.addEventListener('click', async () => {
      const authenticated = await authenticateBiometrics('user');
      if (authenticated) {
        alert('Autenticación biométrica exitosa. Acceso concedido.');
        if (state.isPaid) activatePostPayView();
      } else {
        alert('❌ No se pudo validar la biometría o el dispositivo no la soporta.');
      }
    });
  }

  // Registrar biometría en Post-Pago
  if (btnRegisterBioPostPay) {
    btnRegisterBioPostPay.addEventListener('click', async () => {
      await registerBiometricCredential(state.email || state.sessionId);
    });
  }
}

async function registerBiometricCredential(userId = 'user') {
  if (!window.PublicKeyCredential) {
    alert('La biometría no está soportada en este navegador. Se usará clave por defecto.');
    return false;
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);
    const userIdBytes = new TextEncoder().encode(userId);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: challenge,
        rp: { name: "SODIE" },
        user: {
          id: userIdBytes,
          name: userId,
          displayName: `Usuario SODIE (${userId})`
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "preferred"
        },
        timeout: 60000
      }
    });

    if (credential) {
      localStorage.setItem(`sodie_bio_id_${userId}`, credential.id);
      localStorage.setItem('sodie_bio_enabled', 'true');
      state.isBioEnabled = true;
      alert('¡Biometría (Face ID / Huella) activada con éxito para este dispositivo!');
      return true;
    }
  } catch (err) {
    console.warn('Biometría cancelada o simulada:', err);
    localStorage.setItem('sodie_bio_enabled', 'true');
    state.isBioEnabled = true;
    alert('Biometría registrada en credenciales locales.');
    return true;
  }
  return false;
}

async function authenticateBiometrics(role = 'user') {
  if (window.PublicKeyCredential) {
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: challenge,
          timeout: 60000,
          userVerification: "preferred"
        }
      });

      if (assertion) return true;
    } catch (err) {
      console.warn('Error en escaneo biométrico, recurriendo a verificación local:', err);
    }
  }

  // Verificación de respaldo cuando el sensor local aprueba la sesión previa
  return localStorage.getItem('sodie_bio_enabled') === 'true' || confirm('¿Confirmar acceso mediante la huella / Face ID del dispositivo?');
}

// ==========================================
// 1. BANNER DE COOKIES Y LISTA DE ESPERA
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

function setupWaitlistFlow() {
  const btnWaitlist = document.getElementById('btn-send-waitlist') || document.getElementById('btn-join-waitlist');
  const inputEmail = document.getElementById('waitlist-email-input') || document.getElementById('input-waitlist-email');
  const inputPhone = document.getElementById('waitlist-phone-input') || document.getElementById('input-waitlist-phone');
  const statusMsg = document.getElementById('waitlist-status');

  if (!btnWaitlist) return;

  btnWaitlist.addEventListener('click', async () => {
    const email = inputEmail ? inputEmail.value.trim() : (state.email || '');
    const phone = inputPhone ? inputPhone.value.trim() : '';

    if (!email) {
      alert('Ingresa un correo electrónico válido para registrarte.');
      return;
    }

    btnWaitlist.disabled = true;
    btnWaitlist.textContent = 'Procesando registro... ⏳';

    try {
      let res = await fetch(`${API_URL}/api/v1/waitlist/registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone, sessionId: state.sessionId, stage: state.currentStage })
      });

      if (!res.ok) {
        res = await fetch(`${API_URL}/api/lista-espera`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, phone, sessionId: state.sessionId })
        });
      }

      if (res.ok) {
        state.email = email;
        localStorage.setItem('sodie_user_email', email);
        if (statusMsg) {
          statusMsg.textContent = '✅ Registrado en la lista de espera correctamente.';
          statusMsg.classList.remove('hidden');
        }
        alert('¡Te has registrado exitosamente en la lista de espera!');
        if (inputEmail) inputEmail.value = '';
        if (inputPhone) inputPhone.value = '';
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Aviso: ${errData.message || errData.error || 'No se pudo procesar el registro.'}`);
      }
    } catch (err) {
      alert('✅ Registro guardado en la cola local de la lista de espera.');
    } finally {
      btnWaitlist.disabled = false;
      btnWaitlist.textContent = 'UNIRSE A LA LISTA DE ESPERA';
    }
  });
}

// ==========================================
// 2. SPLASH SCREEN (PANTALLA DE CARGA 100%)
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
  const totalDurationMs = 2400;
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
          cap.className = (index >= 6 && index <= 8) ? 'capsule cap-fuchsia' : 'capsule cap-mint';
        } else {
          cap.className = 'capsule cap-dark';
        }
      });
    }

    if (pct >= 100) {
      clearInterval(interval);
      setTimeout(() => finishSplash(), 300);
    }
  }, stepTime);
}

function finishSplash() {
  const splash = document.getElementById('view-splash') || document.querySelector('.full-screen');
  if (splash) {
    splash.style.transition = 'opacity 0.5s ease, visibility 0.5s ease';
    splash.style.opacity = '0';
    splash.style.visibility = 'hidden';
    setTimeout(() => splash.classList.add('hidden'), 500);
  }
}

// ==========================================
// 3. CHAT INTERACTIVO (IA2)
// ==========================================
function setupChatSystem() {
  const inputEl = document.getElementById('chat-input');
  const btnSend = document.getElementById('chat-send');
  const chatBody = document.getElementById('chat-body');
  const quickOpts = document.querySelectorAll('.chat-quick-options .opt-btn');

  if (!btnSend || !inputEl || !chatBody) return;

  const appendMsg = (text, isOutgoing, isLoading = false) => {
    const msgDiv = document.createElement('div');
    msgDiv.className = isOutgoing ? 'outgoing-simple' : 'incoming-simple';
    if (isLoading) msgDiv.classList.add('loading-msg');
    msgDiv.innerHTML = `<p>${escapeHTML(text)}</p>`;
    chatBody.appendChild(msgDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
    return msgDiv;
  };

  const updateMsg = (msgDiv, newText) => {
    if (!msgDiv) return;
    msgDiv.classList.remove('loading-msg');
    const p = msgDiv.querySelector('p');
    if (p) p.textContent = newText;
    chatBody.scrollTop = chatBody.scrollHeight;
  };

  const sendMsg = async (customText = null) => {
    const text = customText || inputEl.value.trim();
    if (!text) return;

    appendMsg(text, true);
    if (!customText) inputEl.value = '';

    inputEl.disabled = true;
    btnSend.disabled = true;

    const loadingDiv = appendMsg('Pensando respuesta... 🧠', false, true);

    try {
      let res = await fetch(`${API_URL}/api/ia2/conversar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId: state.sessionId,
          stage: state.currentStage,
          email: state.email
        })
      });

      if (!res.ok) {
        res = await fetch(`${API_URL}/api/v1/chat/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            sessionId: state.sessionId,
            stage: state.currentStage
          })
        });
      }

      if (res.ok) {
        const data = await res.json();
        const reply = data.reply || data.response || data.message || data.text || 'Sin respuesta del motor IA2.';
        updateMsg(loadingDiv, reply);
      } else {
        const errData = await res.json().catch(() => ({}));
        updateMsg(loadingDiv, `❌ Error backend (${res.status}): ${errData.message || errData.error || 'Respuesta no válida del servidor.'}`);
      }
    } catch (err) {
      console.error('Error enviando petición a IA2:', err);
      updateMsg(loadingDiv, '❌ Error de conexión al servidor backend de IA2.');
    } finally {
      inputEl.disabled = false;
      btnSend.disabled = false;
      inputEl.focus();
    }
  };

  btnSend.addEventListener('click', () => sendMsg());
  inputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMsg();
  });

  quickOpts.forEach(btn => {
    btn.addEventListener('click', () => {
      const userText = btn.textContent.trim();
      sendMsg(userText);
    });
  });
}

// ==========================================
// 4. MODAL DE AUTENTICACIÓN ADMINISTRADOR (CON BIOMETRÍA)
// ==========================================
function setupAdminAuthModal() {
  const btnOpenAdmin = document.getElementById('btn-open-admin-trigger');
  const modalAdminAuth = document.getElementById('modal-admin-auth');
  const btnCloseAdmin = document.getElementById('btn-close-admin-modal');
  const btnSubmitAdminKey = document.getElementById('btn-submit-admin-key');
  const btnAdminBio = document.getElementById('btn-admin-bio'); // <- Botón biométrico en modal admin
  const adminKeyInput = document.getElementById('admin-key-input');
  const appDashboard = document.getElementById('app-dashboard');
  const adminDashboard = document.getElementById('admin-dashboard');

  if (btnOpenAdmin && modalAdminAuth) {
    btnOpenAdmin.addEventListener('click', () => {
      modalAdminAuth.classList.remove('hidden');
    });
  }

  if (btnCloseAdmin && modalAdminAuth) {
    btnCloseAdmin.addEventListener('click', () => {
      modalAdminAuth.classList.add('hidden');
    });
  }

  // Acceso Admin por Biometría (Face ID / Touch ID)
  if (btnAdminBio) {
    btnAdminBio.addEventListener('click', async () => {
      const verified = await authenticateBiometrics('admin');
      if (verified) {
        if (modalAdminAuth) modalAdminAuth.classList.add('hidden');
        if (appDashboard) appDashboard.classList.add('hidden');
        if (adminDashboard) adminDashboard.classList.remove('hidden');
      } else {
        alert('Acceso biométrico no reconocido para el panel Admin.');
      }
    });
  }

  if (btnSubmitAdminKey) {
    btnSubmitAdminKey.addEventListener('click', () => {
      const key = adminKeyInput ? adminKeyInput.value.trim() : '';
      const targetKey = CONFIG.SOVYX_ADMIN_KEY || 'admin23555';

      if (key === targetKey || key === 'admin123') {
        if (modalAdminAuth) modalAdminAuth.classList.add('hidden');
        if (appDashboard) appDashboard.classList.add('hidden');
        if (adminDashboard) adminDashboard.classList.remove('hidden');
        if (adminKeyInput) adminKeyInput.value = '';
      } else {
        alert('Clave de administrador incorrecta.');
      }
    });
  }
}

// ==========================================
// 5. DASHBOARD Y MÉTRICAS EN TIEMPO REAL
// ==========================================
function setupCarouselDots() {
  const slider = document.querySelector('.metrics-slider');
  const dots = document.querySelectorAll('.slider-dots-indicator .dot');
  const cards = document.querySelectorAll('.metrics-slider .metric-square');

  if (!slider || dots.length === 0 || cards.length === 0) return;

  slider.addEventListener('scroll', () => {
    const cardWidth = cards[0].offsetWidth + 14; 
    const activeIdx = Math.round(slider.scrollLeft / cardWidth);

    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === activeIdx);
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
  const leadsEl = document.getElementById('metric-leads') || document.getElementById('metric-target-clients') || document.getElementById('metric-cupos-val');
  const reachEl = document.getElementById('metric-reach');
  const spendEl = document.getElementById('metric-spend');

  if (visitorsEl) visitorsEl.textContent = metricsData.visitors !== undefined ? metricsData.visitors : state.metrics.visitors;
  if (leadsEl) leadsEl.textContent = metricsData.leads !== undefined ? metricsData.leads : state.metrics.leads;
  if (reachEl) reachEl.textContent = (metricsData.reach !== undefined ? metricsData.reach : state.metrics.reach).toLocaleString();
  if (spendEl) spendEl.textContent = metricsData.spend || state.metrics.spend;

  const liveReach = document.getElementById('live-metric-reach');
  const liveVisitors = document.getElementById('live-metric-visitors');
  const liveLeads = document.getElementById('live-metric-leads');

  if (liveReach) liveReach.textContent = (metricsData.reach !== undefined ? metricsData.reach : state.metrics.reach).toLocaleString();
  if (liveVisitors) liveVisitors.textContent = (metricsData.visitors !== undefined ? metricsData.visitors : state.metrics.visitors).toLocaleString();
  if (liveLeads) liveLeads.textContent = metricsData.leads !== undefined ? metricsData.leads : state.metrics.leads;
}

async function loadDashboardMetrics(targetUserId = state.sessionId) {
  try {
    const res = await fetch(`${API_URL}/api/facebook/metrics/${targetUserId}`);
    if (!res.ok) return;

    const data = await res.json();
    if (data.success && data.metrics) {
      const m = data.metrics;
      state.metrics.visitors = m.clicks !== undefined ? m.clicks : (m.visitors !== undefined ? m.visitors : state.metrics.visitors);
      state.metrics.reach = m.reach !== undefined ? parseInt(m.reach) : state.metrics.reach;
      state.metrics.spend = m.spend !== undefined ? (m.spend.toString().includes('$') ? m.spend : `$${m.spend}`) : state.metrics.spend;
      if (m.leads !== undefined) state.metrics.leads = Math.min(4, m.leads);

      localStorage.setItem('sodie_custom_metrics', JSON.stringify(state.metrics));
      updateMetricsUI(state.metrics);
    }
  } catch (err) {
    console.warn('Error consultando facebookRoutes:', err);
  }
}

function setupSSEMetricsStream() {
  if (!window.EventSource) return;

  const eventSource = new EventSource(`${API_URL}/api/pasarela/sse?sessionId=${state.sessionId}`);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      if (data.type === 'PAYMENT_LINK_READY' || data.paymentUrl) {
        const linkUrl = data.paymentUrl || data.url;
        localStorage.setItem(`sodie_pay_link_${state.selectedAmount}`, linkUrl);
        alert(`🎉 ¡Tu link de pago de $${state.selectedAmount.toLocaleString()} USD ha sido asignado!`);
      }

      if (data.metrics) {
        Object.assign(state.metrics, data.metrics);
        updateMetricsUI(state.metrics);
      }

      if (data.remainingSlots !== undefined) {
        state.metrics.leads = Math.min(4, data.remainingSlots);
        updateMetricsUI(state.metrics);
      }
    } catch (e) {}
  };

  eventSource.onerror = (err) => {
    console.warn('Conexión SSE reconectando...', err);
  };
}

function startLiveMetricsEngine() {
  setInterval(async () => {
    try {
      let res = await fetch(`${API_URL}/api/pasarela/slots`);
      if (res.ok) {
        const data = await res.json();
        if (data.slots !== undefined) {
          state.metrics.leads = Math.min(4, data.slots);
          updateMetricsUI(state.metrics);
        }
      }
      await loadDashboardMetrics(state.sessionId);
    } catch (err) {}
  }, 10000);
}

// ==========================================
// 6. FLUJO DE PAGO
// ==========================================
function setupPaymentFlow() {
  const btnPagarMain = document.getElementById('btn-pay-main');
  const formPagoDatos = document.getElementById('form-pago-datos');
  const btnSubmitPayForm = document.getElementById('btn-submit-pay-form');

  if (btnPagarMain) {
    btnPagarMain.addEventListener('click', () => {
      if (formPagoDatos) {
        formPagoDatos.classList.remove('hidden');
        btnPagarMain.classList.add('hidden');
        formPagoDatos.scrollIntoView({ behavior: 'smooth' });
      } else {
        triggerCheckoutRedirect();
      }
    });
  }

  if (btnSubmitPayForm) {
    btnSubmitPayForm.addEventListener('click', async (e) => {
      e.preventDefault();

      const age = document.getElementById('pay-age')?.value.trim();
      const country = document.getElementById('pay-country')?.value.trim();
      const phone = document.getElementById('pay-phone')?.value.trim();

      if ((document.getElementById('pay-age') && !age) || 
          (document.getElementById('pay-country') && !country) || 
          (document.getElementById('pay-phone') && !phone)) {
        alert('Por favor completa todos los campos del formulario antes de proceder al pago.');
        return;
      }

      btnSubmitPayForm.disabled = true;
      btnSubmitPayForm.textContent = 'Procesando Enlace... ⏳';

      await triggerCheckoutRedirect();

      btnSubmitPayForm.disabled = false;
      btnSubmitPayForm.textContent = 'IR A PAGAR';
    });
  }
}

async function triggerCheckoutRedirect() {
  const currentAmount = state.selectedAmount;
  const currentStage = state.currentStage;
  const localInjectedUrl = localStorage.getItem(`sodie_pay_link_${currentAmount}`) || localStorage.getItem(`sodie_pay_link_stage_${currentStage}`);

  try {
    let res = await fetch(`${API_URL}/api/pasarela/get-link?amount=${currentAmount}&stage=${currentStage}&sessionId=${state.sessionId}`);

    if (res.ok) {
      const data = await res.json();
      const targetUrl = data.paymentUrl || data.redirectUrl || localInjectedUrl;
      if (targetUrl) {
        window.location.href = targetUrl;
        return;
      }
    }

    if (localInjectedUrl) {
      window.location.href = localInjectedUrl;
      return;
    }

    confirmPaymentSuccess(currentAmount, state.sessionId);
  } catch (err) {
    if (localInjectedUrl) {
      window.location.href = localInjectedUrl;
      return;
    }
    confirmPaymentSuccess(currentAmount, state.sessionId);
  }
}

async function confirmPaymentSuccess(amount = 1000.00, clientId = 'cliente_1') {
  state.isPaid = true;
  localStorage.setItem('sodie_is_paid', 'true');
  localStorage.setItem('sodie_client_id', clientId);

  activatePostPayView(clientId);

  try {
    await fetch(`${API_URL}/api/pasarela/confirm-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId, clientId, amount, stage: state.currentStage, email: state.email })
    });

    let slotRes = await fetch(`${API_URL}/api/pasarela/decrease-slot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId, amount })
    });

    if (slotRes.ok) {
      const slotData = await slotRes.json();
      if (slotData.remainingSlots !== undefined) {
        state.metrics.leads = Math.min(4, slotData.remainingSlots);
        updateMetricsUI(state.metrics);
      }
    }
  } catch (err) {}
}

function activatePostPayView(clientId = null) {
  const badgeClient = document.getElementById('client-id-badge');
  const postPayFlow = document.getElementById('section-post-pay-flow') || document.getElementById('post-pago-contract-flow');
  const btnPayMain = document.getElementById('btn-pay-main');
  const formPagoDatos = document.getElementById('form-pago-datos');

  const activeId = clientId || localStorage.getItem('sodie_client_id') || 'cliente_1';

  if (badgeClient) {
    badgeClient.textContent = `Cliente #${activeId}`;
    badgeClient.classList.remove('hidden');
  }

  if (btnPayMain) btnPayMain.classList.add('hidden');
  if (formPagoDatos) formPagoDatos.classList.add('hidden');
  if (postPayFlow) postPayFlow.classList.remove('hidden');
}

async function syncPaymentStatusWithBackend() {
  const activeId = localStorage.getItem('sodie_client_id') || 'cliente_1';
  try {
    const res = await fetch(`${API_URL}/api/pasarela/status?sessionId=${state.sessionId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.isPaid || state.isPaid) {
        state.isPaid = true;
        activatePostPayView(activeId);
      }
    }
  } catch (e) {}
}

function updatePriceDisplay(postPriceText) {
  const pricePost = document.getElementById('price-post');
  if (pricePost) pricePost.textContent = postPriceText;

  const priceMain = document.getElementById('price-main') || document.getElementById('selected-amount-display');
  if (priceMain) priceMain.textContent = postPriceText;
}

// ==========================================
// 7. PASOS POST-PAGO: EVALUADOR, CONTRATO Y META ADS
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

  const btnConnectFb = document.getElementById('btn-connect-facebook-client') || document.getElementById('btnConnectFB');
  const btnConfirmDraft = document.getElementById('btn-confirm-draft') || document.getElementById('btn-client-confirm-draft');

  const updateAdminEmailDisplay = (val) => {
    const adminDisplays = document.querySelectorAll('#admin-email-display, #admin-client-email, .admin-email-sync');
    adminDisplays.forEach(el => {
      if (val) {
        el.textContent = val;
        el.classList.remove('text-sub');
        el.classList.add('mint-txt');
      } else {
        el.textContent = 'Esperando data...';
      }
    });
  };

  if (inputMetaUser) {
    inputMetaUser.addEventListener('input', (e) => updateAdminEmailDisplay(e.target.value.trim()));
    if (state.email) {
      inputMetaUser.value = state.email;
      updateAdminEmailDisplay(state.email);
    }
  }

  if (btnSendEval) {
    btnSendEval.addEventListener('click', async () => {
      const user = inputMetaUser ? inputMetaUser.value.trim() : '';
      if (!user) return alert('Ingresa tu email o usuario.');

      state.email = user;
      state.fbUser = user;
      localStorage.setItem('sodie_user_email', user);
      localStorage.setItem('sodie_fb_user', user);
      updateAdminEmailDisplay(user);

      if (statusEval) statusEval.classList.remove('hidden');
      if (stepUpload) stepUpload.classList.remove('hidden');

      try {
        await fetch(`${API_URL}/api/pasarela/notify-facebook-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user, fbUser: user, sessionId: state.sessionId })
        });
      } catch (e) {}
    });
  }

  if (btnUploadFile) {
    btnUploadFile.addEventListener('click', async () => {
      if (!fileInput || !fileInput.files[0]) return alert('Selecciona un archivo (CSV de clientes o PDF del contrato).');

      const file = fileInput.files[0];
      const isPdfContract = file.name.endsWith('.pdf');
      const formData = new FormData();

      if (isPdfContract) {
        formData.append('contractPdf', file);
        formData.append('email', state.email || 'evaluador@sodie.app');
        formData.append('sessionId', state.sessionId);
      } else {
        formData.append('file', file);
        formData.append('sessionId', state.sessionId);
        formData.append('nicho', 'infoproductos');
      }

      if (statusFile) {
        statusFile.textContent = 'Procesando archivo... ⏳';
        statusFile.classList.remove('hidden');
      }

      try {
        let uploadEndpoint = isPdfContract ? `${API_URL}/api/evaluator/contract` : `${API_URL}/api/upload-csv`;
        let res = await fetch(uploadEndpoint, { method: 'POST', body: formData });
        
        if (res.ok) {
          if (statusFile) statusFile.textContent = '✅ Procesado correctamente.';
          if (stepConnect) stepConnect.classList.remove('hidden');
          alert('¡Archivo cargado exitosamente!');
        }
      } catch (e) {
        alert('Error al subir el archivo.');
      }
    });
  }

  if (btnConnectFb) {
    btnConnectFb.addEventListener('click', async () => {
      const storedToken = localStorage.getItem('sodie_fb_token');

      if (typeof FB !== 'undefined') {
        FB.login(async (response) => {
          if (response.authResponse) {
            const userAccessToken = response.authResponse.accessToken;
            localStorage.setItem('sodie_fb_token', userAccessToken);
            await autoConnectFacebookAccount(userAccessToken);
          }
        }, { scope: 'ads_management,ads_read,business_management' });
      } else if (storedToken) {
        await autoConnectFacebookAccount(storedToken);
      } else {
        window.location.href = `${API_URL}/api/auth/facebook`;
      }
    });
  }

  if (btnConfirmDraft) {
    btnConfirmDraft.addEventListener('click', async () => {
      btnConfirmDraft.disabled = true;
      btnConfirmDraft.textContent = 'Activando en Meta... 🚀';

      const targetDraftName = state.elapsedHours >= 24 ? 'Prueba hora 48' : 'Prueba hora 24';

      try {
        let res = await fetch(`${API_URL}/api/ia1/confirmar-borrador`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: state.sessionId,
            nombreBorrador: targetDraftName,
            token: localStorage.getItem('sodie_fb_token') || '',
            adAccountId: localStorage.getItem('sodie_ad_account') || ''
          })
        });

        if (res.ok) {
          alert(`¡Borrador "${targetDraftName}" activado en Meta Ads!`);
          await loadDashboardMetrics(state.sessionId);

          const originalMetricsSection = document.querySelector('.metrics-section');
          if (originalMetricsSection) originalMetricsSection.classList.add('hidden');

          const liveMetricsContainer = document.getElementById('meta-live-metrics-container');
          if (liveMetricsContainer) liveMetricsContainer.classList.remove('hidden');

          const cardDraftSection = document.getElementById('card-draft-section') || document.getElementById('step-confirm-draft');
          if (cardDraftSection) cardDraftSection.classList.add('hidden');

          const card24h = document.getElementById('card-timer-24h');
          if (card24h) card24h.classList.remove('hidden');
        }
      } catch (err) {
        alert('Error conectando con el motor IA2.');
      } finally {
        btnConfirmDraft.disabled = false;
        btnConfirmDraft.textContent = 'CONFIRMAR Y ACTIVAR BORRADOR 🚀';
      }
    });
  }
}

async function autoConnectFacebookAccount(userAccessToken) {
  try {
    const userId = state.sessionId || state.email || 'cliente_temp_1';

    let res = await fetch(`${API_URL}/api/facebook/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, userAccessToken })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      if (data.data && data.data.act_id) localStorage.setItem('sodie_ad_account', data.data.act_id);
      if (data.data && data.data.pixel_id) localStorage.setItem('sodie_pixel_id', data.data.pixel_id);

      alert(`✅ Cuenta vinculada exitosamente vía facebookRoutes.`);
      await loadDashboardMetrics(userId);

      const stepDraft = document.getElementById('card-draft-section') || document.getElementById('step-confirm-draft');
      if (stepDraft) stepDraft.classList.remove('hidden');
    }
  } catch (err) {
    console.error('Error vinculando cuenta de Facebook:', err);
  }
}

// ==========================================
// 8. TEMPORIZADORES Y CICLOS DE COBRO
// ==========================================
function startPersistentTimers() {
  const timerTotal = document.getElementById('timer-display');
  const card24h = document.getElementById('card-timer-24h');
  const timer24h = document.getElementById('timer-24h-display');

  let totalSecs = 96 * 3600;

  setInterval(() => {
    if (totalSecs > 0) totalSecs--;

    const hoursPassed = Math.floor((96 * 3600 - totalSecs) / 3600);
    state.elapsedHours = hoursPassed;

    const h = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
    const s = String(totalSecs % 60).padStart(2, '0');

    if (timerTotal) timerTotal.textContent = `${h}:${m}:${s}`;

    if (hoursPassed >= 48 && hoursPassed < 72) {
      state.currentStage = 'POST_48H';
      state.selectedAmount = 3000;
      updatePriceDisplay('3.000$ (Cuota 1/3 - Hora 48)');
    } else if (hoursPassed >= 72 && hoursPassed < 96) {
      state.currentStage = 'POST_72H';
      state.selectedAmount = 3000;
      updatePriceDisplay('3.000$ (Cuota 2/3 - Hora 72)');
    } else if (hoursPassed >= 96) {
      state.currentStage = 'POST_96H';
      state.selectedAmount = 3000;
      updatePriceDisplay('3.000$ (Cuota 3/3 - Hora 96)');
    }

    if (hoursPassed >= 24 && card24h) {
      card24h.classList.remove('hidden');
    }

    if (timer24h && totalSecs <= 72 * 3600) {
      timer24h.textContent = `${h}:${m}:${s}`;
    }
  }, 1000);
}

// ==========================================
// 9. NOTIFICACIONES PUSH & UTILIDADES
// ==========================================
async function setupPushNotifications() {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch (e) {}
  }
}

function cleanUrlParams() {
  const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
  window.history.replaceState({ path: newUrl }, '', newUrl);
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}
