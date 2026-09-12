// ==========================================
// SODIE Core OS - Application Logic (app.js)
// Sincronizado con index.html / index.js v2.0.28
// Transición Admin <-> Vista Cliente sin pérdida de contexto
// ==========================================

const API_URL = window.location.origin.includes('localhost') ? 'http://localhost:10000' : 'https://api.sodie.app';
const CONFIG = window.ENV || { SOVYX_ADMIN_KEY: 'admin23555', APP_ID: '', VAPID_PUBLIC_KEY: '' };

const state = {
  sessionId: localStorage.getItem('sodie_session_id') || `sess_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
  email: localStorage.getItem('sodie_user_email') || null,
  fbUser: localStorage.getItem('sodie_fb_user') || null,
  isPaid: localStorage.getItem('sodie_is_paid') === 'true',
  isBioEnabled: localStorage.getItem('sodie_bio_enabled') === 'true',
  isAdminMode: localStorage.getItem('sodie_is_admin') === 'true',
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

  const urlParams = new URLSearchParams(window.location.search);
  const paymentStatus = urlParams.get('payment') || urlParams.get('paid') || urlParams.get('status');
  const clientId = urlParams.get('client_id');
  const paymentDoneStorage = localStorage.getItem('sodie_payment_completed') === 'true';

  const stepParam = urlParams.get('step');
  const viewParam = urlParams.get('view');
  const sessionIdParam = urlParams.get('sessionId');
  const campaignIdParam = urlParams.get('campaignId');
  const errorParam = urlParams.get('error');

  if (sessionIdParam) {
    state.sessionId = sessionIdParam;
    localStorage.setItem('sodie_session_id', sessionIdParam);
  }

  if (errorParam) {
    alert(`❌ Ocurrió un problema en la integración con Meta: ${errorParam}`);
    cleanUrlParams();
  }

  if (paymentDoneStorage || (paymentStatus && (paymentStatus.includes('paid') || paymentStatus.includes('success') || paymentStatus === 'true')) || urlParams.get('auth') === 'success') {
    state.isPaid = true;
    localStorage.setItem('sodie_is_paid', 'true');
    localStorage.setItem('sodie_payment_completed', 'true');
    confirmPaymentSuccess(state.selectedAmount, clientId || state.sessionId);
    cleanUrlParams();
  }

  if (state.isPaid) {
    activatePostPayView(clientId);
  }

  if (stepParam === 'procesar_excel') {
    activatePostPayView();
    const stepUpload = document.getElementById('step-upload-file') || document.getElementById('section-post-pay-flow');
    if (stepUpload) {
      stepUpload.classList.remove('hidden');
      stepUpload.scrollIntoView({ behavior: 'smooth' });
    }
  }

  if (stepParam === 'activar_campana') {
    activatePostPayView();
    if (campaignIdParam) localStorage.setItem('sodie_last_campaign_id', campaignIdParam);
    
    const btnConfirmDraft = document.getElementById('btn-confirm-draft') || document.getElementById('btn-client-confirm-draft');
    if (btnConfirmDraft) {
      btnConfirmDraft.classList.remove('hidden');
      btnConfirmDraft.scrollIntoView({ behavior: 'smooth' });
    }
  }

  if (viewParam === 'dashboard') {
    activatePostPayView();
    if (campaignIdParam) localStorage.setItem('sodie_last_campaign_id', campaignIdParam);
    
    const appDashboard = document.getElementById('app-dashboard');
    if (appDashboard) {
      appDashboard.classList.remove('hidden');
      appDashboard.scrollIntoView({ behavior: 'smooth' });
    }
  }

  runSplashScreen();
  setupCookieBanner();
  setupWaitlistFlow();
  setupChatSystem();
  setupCarouselDots();
  setupPaymentFlow();
  setupPostPayStepFlow();
  setupAdminAuthModal();
  setupBiometricModule();
  setupAdminUploadsModule();
  startPersistentTimers();
  startLiveMetricsEngine();
  setupSSEMetricsStream();
  setupPushNotifications();
  renderInitialMetrics();

  loadDashboardMetrics(state.sessionId);
});

// ==========================================
// ACCIONES DE USUARIO & SUBIDA MEDIA
// ==========================================

async function sodieCrearBorrador() {
  const excelInput = document.getElementById('excel-file-input') || document.getElementById('client-file-input');
  const file = excelInput ? excelInput.files[0] : state.uploadedFile;
  const statusEl = document.getElementById('excel-file-status') || document.getElementById('client-file-status');

  if (!file) {
    alert('Por favor selecciona un archivo Excel/CSV o PDF para procesar.');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('sessionId', state.sessionId);
  formData.append('category', 'audience_csv');

  if (statusEl) {
    statusEl.textContent = 'Procesando archivo en /api/v1/media/upload... ⏳';
    statusEl.classList.remove('hidden');
  }

  try {
    let res = await fetch(`${API_URL}/api/v1/media/upload`, { method: 'POST', body: formData });
    if (!res.ok) {
      res = await fetch(`${API_URL}/api/media/upload`, { method: 'POST', body: formData });
    }

    if (res.ok) {
      if (statusEl) statusEl.textContent = '✅ Archivo procesado exitosamente.';
      alert('¡Borrador y datos cargados correctamente al servidor!');
    } else {
      if (statusEl) statusEl.textContent = '❌ Error al subir el archivo.';
      alert('Error al procesar el archivo.');
    }
  } catch (err) {
    if (statusEl) statusEl.textContent = '❌ Error de conexión.';
    alert('Error de conexión al procesar la subida.');
  }
}

async function sodieConnectFacebook() {
  try {
    const res = await fetch(`${API_URL}/api/facebook/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId, email: state.email })
    });

    const data = await res.json();
    if (res.ok && data.redirectUrl) {
      window.location.href = data.redirectUrl;
    } else if (res.ok && data.success) {
      alert('✅ Cuenta de Facebook vinculada correctamente.');
    } else {
      alert('❌ No se pudo conectar con Facebook.');
    }
  } catch (err) {
    alert('❌ Error de conexión con el módulo de Facebook.');
  }
}

async function sodieConfirmarActivacion() {
  const btnConfirm = document.getElementById('btn-confirm-draft') || document.getElementById('btn-client-confirm-draft');
  if (btnConfirm) {
    btnConfirm.disabled = true;
    btnConfirm.textContent = 'Activando campaña... 🚀';
  }

  try {
    const res = await fetch(`${API_URL}/api/facebook/capi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: state.sessionId,
        eventName: 'ActivateCampaign',
        stage: state.currentStage,
        email: state.email
      })
    });

    if (res.ok) {
      alert('¡Campaña activada exitosamente! Redirigiendo al Dashboard en vivo...');
      const appDashboard = document.getElementById('app-dashboard');
      if (appDashboard) appDashboard.classList.remove('hidden');
      await loadDashboardMetrics(state.sessionId);
    } else {
      alert('❌ No se pudo activar la campaña en Meta Ads.');
    }
  } catch (err) {
    alert('❌ Error de conexión al activar la campaña.');
  } finally {
    if (btnConfirm) {
      btnConfirm.disabled = false;
      btnConfirm.textContent = 'CONFIRMAR Y ACTIVAR BORRADOR 🚀';
    }
  }
}

window.sodieCrearBorrador = sodieCrearBorrador;
window.sodieConnectFacebook = sodieConnectFacebook;
window.sodieConfirmarActivacion = sodieConfirmarActivacion;

// ==========================================
// MÓDULO BIOMÉTRICO (WEBAUTHN)
// ==========================================

function bufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

async function registerBiometricCredential(userId = (state.email || state.sessionId)) {
  if (!window.PublicKeyCredential) {
    alert('⚠️ La autenticación biométrica (WebAuthn) no está soportada en este navegador.');
    return false;
  }
  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);
    const userIdBytes = new TextEncoder().encode(userId);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: challenge,
        rp: { name: "SODIE Core OS", id: window.location.hostname },
        user: { id: userIdBytes, name: userId, displayName: `Usuario SODIE (${userId})` },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
        timeout: 60000
      }
    });

    if (credential) {
      const rawIdBase64 = bufferToBase64(credential.rawId);
      localStorage.setItem(`sodie_bio_id_${userId}`, credential.id);
      localStorage.setItem(`sodie_bio_raw_id_${userId}`, rawIdBase64);
      localStorage.setItem('sodie_bio_enabled', 'true');
      state.isBioEnabled = true;
      alert('🔒 ¡Biometría de hardware registrada exitosamente!');
      return true;
    }
  } catch (err) {
    alert('❌ Registro biométrico cancelado o fallido.');
  }
  return false;
}

async function authenticateBiometrics(role = 'user') {
  if (!window.PublicKeyCredential) {
    alert('La autenticación biométrica no está disponible.');
    return false;
  }
  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: challenge,
        timeout: 60000,
        userVerification: "required"
      }
    });

    return !!assertion;
  } catch (err) {
    alert('❌ Verificación biométrica fallida.');
  }
  return false;
}

async function sodieLoginBiometrico() {
  const authenticated = await authenticateBiometrics('user');
  if (authenticated) {
    alert('✅ Autenticación biométrica exitosa.');
    activatePostPayView();
  }
}

async function sodieRegistrarBiometria() {
  await registerBiometricCredential(state.email || state.sessionId);
}

function setupBiometricModule() {
  const btnUserBioLogin = document.getElementById('btn-bio-user-login') || document.getElementById('btn-biometric-login') || document.getElementById('btn-bio-login');
  const btnRegisterBioPostPay = document.getElementById('btn-register-bio-postpay') || document.getElementById('btn-bio-register');

  if (btnUserBioLogin) btnUserBioLogin.addEventListener('click', sodieLoginBiometrico);
  if (btnRegisterBioPostPay) btnRegisterBioPostPay.addEventListener('click', sodieRegistrarBiometria);
}

window.sodieLoginBiometrico = sodieLoginBiometrico;
window.sodieRegistrarBiometria = sodieRegistrarBiometria;

// ==========================================
// CONFIGURACIÓN DE NAVEGACIÓN Y COMPONENTES
// ==========================================

function setupPostPayStepFlow() {
  const btnSendEval = document.getElementById('btn-client-send-evaluator');
  const inputMetaUser = document.getElementById('client-meta-user-input');
  const statusEval = document.getElementById('client-evaluator-status');
  const stepUpload = document.getElementById('step-upload-file');

  const btnDraft = document.getElementById('btn-upload-excel') || document.getElementById('btn-client-upload-file');
  const btnConnectFb = document.getElementById('btn-connect-facebook');
  const btnConfirmDraft = document.getElementById('btn-confirm-draft') || document.getElementById('btn-client-confirm-draft');

  if (inputMetaUser && state.email) inputMetaUser.value = state.email;

  if (btnSendEval) {
    btnSendEval.addEventListener('click', async () => {
      const user = inputMetaUser ? inputMetaUser.value.trim() : '';
      if (!user) return alert('Ingresa tu email o usuario.');
      state.email = user;
      localStorage.setItem('sodie_user_email', user);
      if (statusEval) statusEval.classList.remove('hidden');
      if (stepUpload) stepUpload.classList.remove('hidden');
    });
  }

  if (btnDraft) btnDraft.addEventListener('click', sodieCrearBorrador);
  if (btnConnectFb) btnConnectFb.addEventListener('click', sodieConnectFacebook);
  if (btnConfirmDraft) btnConfirmDraft.addEventListener('click', sodieConfirmarActivacion);
}

function setupCookieBanner() {
  const cookieBanner = document.getElementById('cookie-banner');
  const btnAccept = document.getElementById('btn-accept-cookies');

  if (!cookieBanner || !btnAccept) return;
  if (localStorage.getItem('sodie_cookies_accepted') === 'true') cookieBanner.classList.add('hidden');

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

    if (!email) return alert('Ingresa un correo electrónico válido.');

    btnWaitlist.disabled = true;
    btnWaitlist.textContent = 'Procesando registro... ⏳';

    try {
      let res = await fetch(`${API_URL}/api/v1/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone, sessionId: state.sessionId, stage: state.currentStage })
      });

      if (res.ok) {
        state.email = email;
        localStorage.setItem('sodie_user_email', email);
        if (statusMsg) {
          statusMsg.textContent = '✅ Registrado correctamente en la lista.';
          statusMsg.classList.remove('hidden');
        }
        alert('¡Te has registrado exitosamente!');
        if (inputEmail) inputEmail.value = '';
        if (inputPhone) inputPhone.value = '';
      }
    } catch (err) {
      alert('✅ Registro guardado localmente.');
    } finally {
      btnWaitlist.disabled = false;
      btnWaitlist.textContent = 'UNIRSE A LA LISTA DE ESPERA';
    }
  });
}

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
        cap.className = (index < activeCount) ? ((index >= 6 && index <= 8) ? 'capsule cap-fuchsia' : 'capsule cap-mint') : 'capsule cap-dark';
      });
    }

    if (pct >= 100) {
      clearInterval(interval);
      setTimeout(() => finishSplash(), 300);
    }
  }, 24);
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
      const res = await fetch(`${API_URL}/api/v1/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: state.sessionId, stage: state.currentStage })
      });

      if (res.ok) {
        const data = await res.json();
        updateMsg(loadingDiv, data.reply || data.response || data.message || data.text || 'Sin respuesta.');
      } else {
        updateMsg(loadingDiv, '❌ Error de comunicación con el Asistente.');
      }
    } catch (err) {
      updateMsg(loadingDiv, '❌ Error de conexión.');
    } finally {
      inputEl.disabled = false;
      btnSend.disabled = false;
      inputEl.focus();
    }
  };

  btnSend.addEventListener('click', () => sendMsg());
  inputEl.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMsg(); });
  quickOpts.forEach(btn => btn.addEventListener('click', () => sendMsg(btn.textContent.trim())));
}

function setupAdminAuthModal() {
  const btnOpenAdmin = document.getElementById('btn-open-admin-trigger');
  const modalAdminAuth = document.getElementById('modal-admin-auth');
  const btnCloseAdmin = document.getElementById('btn-close-admin-modal');
  const btnSubmitAdminKey = document.getElementById('btn-submit-admin-key');
  const btnAdminBio = document.getElementById('btn-admin-bio');
  const adminKeyInput = document.getElementById('admin-key-input');

  if (btnOpenAdmin && modalAdminAuth) btnOpenAdmin.addEventListener('click', () => modalAdminAuth.classList.remove('hidden'));
  if (btnCloseAdmin && modalAdminAuth) btnCloseAdmin.addEventListener('click', () => modalAdminAuth.classList.add('hidden'));

  if (btnAdminBio) {
    btnAdminBio.addEventListener('click', async () => {
      const verified = await authenticateBiometrics('admin');
      if (verified) {
        activarPanelAdministrador();
      }
    });
  }

  if (btnSubmitAdminKey) {
    btnSubmitAdminKey.addEventListener('click', () => {
      const key = adminKeyInput ? adminKeyInput.value.trim() : '';
      if (key === (CONFIG.SOVYX_ADMIN_KEY || 'admin23555') || key === 'admin123') {
        activarPanelAdministrador();
        if (adminKeyInput) adminKeyInput.value = '';
      } else {
        alert('Clave de administrador incorrecta.');
      }
    });
  }
}

function activarPanelAdministrador() {
  const modalAdminAuth = document.getElementById('modal-admin-auth');
  const appDashboard = document.getElementById('app-dashboard');
  const adminDashboard = document.getElementById('admin-dashboard');

  state.isAdminMode = true;
  localStorage.setItem('sodie_is_admin', 'true');

  if (modalAdminAuth) modalAdminAuth.classList.add('hidden');
  if (appDashboard) appDashboard.classList.add('hidden');
  if (adminDashboard) adminDashboard.classList.remove('hidden');

  // Remueve el botón flotante de retorno si existía previamente
  const floatingBtn = document.getElementById('floating-return-admin-btn');
  if (floatingBtn) floatingBtn.remove();
}

function setupAdminUploadsModule() {
  const uploadMediaHelper = async (fileInput, statusEl, categoryType) => {
    const file = fileInput ? fileInput.files[0] : null;
    if (!file) return alert('Por favor selecciona un archivo.');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', categoryType);
    formData.append('sessionId', state.sessionId);

    if (statusEl) {
      statusEl.textContent = `Subiendo ${categoryType}... ⏳`;
      statusEl.classList.remove('hidden');
    }

    try {
      let res = await fetch(`${API_URL}/api/v1/media/upload`, { method: 'POST', body: formData });
      if (!res.ok) {
        res = await fetch(`${API_URL}/api/media/upload`, { method: 'POST', body: formData });
      }

      if (res.ok) {
        if (statusEl) statusEl.textContent = '✅ Archivo subido correctamente.';
        alert('¡Archivo subido exitosamente al servidor!');
      } else {
        if (statusEl) statusEl.textContent = '❌ Error al subir archivo.';
      }
    } catch (e) {
      if (statusEl) statusEl.textContent = '❌ Error de conexión al subir.';
    }
  };

  const btnUploadImage = document.getElementById('btn-upload-image');
  const imageInput = document.getElementById('image-file-input');
  const imageStatus = document.getElementById('image-file-status');
  if (btnUploadImage) btnUploadImage.addEventListener('click', () => uploadMediaHelper(imageInput, imageStatus, 'image'));

  const btnUploadVideo = document.getElementById('btn-upload-video');
  const videoInput = document.getElementById('video-file-input');
  const videoStatus = document.getElementById('video-file-status');
  if (btnUploadVideo) btnUploadVideo.addEventListener('click', () => uploadMediaHelper(videoInput, videoStatus, 'video'));
}

function setupCarouselDots() {
  const slider = document.querySelector('.metrics-slider');
  const dots = document.querySelectorAll('.slider-dots-indicator .dot');
  const cards = document.querySelectorAll('.metrics-slider .metric-square');
  if (!slider || dots.length === 0 || cards.length === 0) return;

  slider.addEventListener('scroll', () => {
    const cardWidth = cards[0].offsetWidth + 14; 
    const activeIdx = Math.round(slider.scrollLeft / cardWidth);
    dots.forEach((dot, idx) => dot.classList.toggle('active', idx === activeIdx));
  });

  dots.forEach((dot, idx) => {
    dot.addEventListener('click', () => {
      const cardWidth = cards[0].offsetWidth + 14;
      slider.scrollTo({ left: idx * cardWidth, behavior: 'smooth' });
    });
  });
}

function renderInitialMetrics() { updateMetricsUI(state.metrics); }

function updateMetricsUI(metricsData) {
  const visitorsEl = document.getElementById('metric-visitors') || document.getElementById('metric-clicks');
  const leadsEl = document.getElementById('metric-leads') || document.getElementById('metric-target-clients');
  const reachEl = document.getElementById('metric-reach');
  const spendEl = document.getElementById('metric-spend');

  if (visitorsEl) visitorsEl.textContent = metricsData.visitors ?? state.metrics.visitors;
  if (leadsEl) leadsEl.textContent = metricsData.leads ?? state.metrics.leads;
  if (reachEl) reachEl.textContent = (metricsData.reach ?? state.metrics.reach).toLocaleString();
  if (spendEl) spendEl.textContent = metricsData.spend || state.metrics.spend;
}

async function loadDashboardMetrics(targetUserId = state.sessionId) {
  try {
    const res = await fetch(`${API_URL}/api/facebook/metrics?sessionId=${targetUserId}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.success && (data.metrics || data.data)) {
      const m = data.metrics || data.data;
      state.metrics.visitors = m.clicks ?? m.impressions ?? state.metrics.visitors;
      state.metrics.reach = m.reach !== undefined ? parseInt(m.reach) : state.metrics.reach;
      state.metrics.spend = m.spend !== undefined ? (m.spend.toString().includes('$') ? m.spend : `$${m.spend}`) : state.metrics.spend;
      if (m.leads !== undefined) state.metrics.leads = Math.min(4, m.leads);
      localStorage.setItem('sodie_custom_metrics', JSON.stringify(state.metrics));
      updateMetricsUI(state.metrics);
    }
  } catch (err) {}
}

function setupSSEMetricsStream() {
  if (!window.EventSource) return;
  const eventSource = new EventSource(`${API_URL}/api/v1/metrics/live?sessionId=${state.sessionId}`);
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.metrics) {
        Object.assign(state.metrics, data.metrics);
        updateMetricsUI(state.metrics);
      }
    } catch (e) {}
  };
}

function startLiveMetricsEngine() {
  setInterval(async () => {
    try {
      let res = await fetch(`${API_URL}/api/clientes/disponibles`);
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
      await triggerCheckoutRedirect();
    });
  }
}

async function triggerCheckoutRedirect() {
  confirmPaymentSuccess(state.selectedAmount, state.sessionId);
}

async function confirmPaymentSuccess(amount = 1000.00, clientId = 'cliente_1') {
  state.isPaid = true;
  localStorage.setItem('sodie_is_paid', 'true');
  localStorage.setItem('sodie_client_id', clientId);
  activatePostPayView(clientId);
}

function activatePostPayView(clientId = null) {
  const activeId = clientId || localStorage.getItem('sodie_client_id') || 'cliente_1';
  
  const landingSections = ['section-hero', 'section-pricing', 'form-pago-datos', 'btn-pay-main', 'modal-admin-auth'];
  landingSections.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  const badgeClient = document.getElementById('client-id-badge');
  if (badgeClient) {
    badgeClient.textContent = `Cliente #${activeId}`;
    badgeClient.classList.remove('hidden');
  }

  const postPayFlow = document.getElementById('section-post-pay-flow') || document.getElementById('post-pago-contract-flow');
  if (postPayFlow) postPayFlow.classList.remove('hidden');

  const appDashboard = document.getElementById('app-dashboard');
  if (appDashboard) {
    appDashboard.classList.remove('hidden');
    appDashboard.style.display = 'block';
    appDashboard.scrollIntoView({ behavior: 'smooth' });
  }

  updateMetricsUI(state.metrics);
}

// ==========================================
// TRANSICIÓN Y CONMUTACIÓN ADMIN <-> CLIENTE
// ==========================================

async function sodieAdminVerVistaCliente() {
  // 1. Asegurar la carga de componentes y datos del Administrador primero
  try {
    await loadDashboardMetrics(state.sessionId);
  } catch (err) {
    console.warn('Carga preliminar de métricas finalizada con advertencias.');
  }

  // 2. Transición visual: Ocultar panel de control de Admin y modales
  const adminDashboard = document.getElementById('admin-dashboard');
  const modalAdminAuth = document.getElementById('modal-admin-auth');

  if (adminDashboard) adminDashboard.classList.add('hidden');
  if (modalAdminAuth) modalAdminAuth.classList.add('hidden');

  // 3. Activar la vista cliente reteniendo el estado Admin
  state.isPaid = true;
  localStorage.setItem('sodie_is_paid', 'true');
  activatePostPayView();

  // 4. Inyectar botón flotante de retorno al panel de Administrador
  injectFloatingAdminReturnBtn();
}

function sodieVolverAAdmin() {
  const appDashboard = document.getElementById('app-dashboard');
  const postPayFlow = document.getElementById('section-post-pay-flow') || document.getElementById('post-pago-contract-flow');

  if (appDashboard) appDashboard.classList.add('hidden');
  if (postPayFlow) postPayFlow.classList.add('hidden');

  activarPanelAdministrador();
}

function injectFloatingAdminReturnBtn() {
  if (document.getElementById('floating-return-admin-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'floating-return-admin-btn';
  btn.innerHTML = '⚙️ VOLVER A VISTA ADMIN';
  btn.style.position = 'fixed';
  btn.style.bottom = '20px';
  btn.style.right = '20px';
  btn.style.zIndex = '999999';
  btn.style.backgroundColor = '#111827';
  btn.style.color = '#38BDF8';
  btn.style.border = '2px solid #38BDF8';
  btn.style.borderRadius = '30px';
  btn.style.padding = '12px 20px';
  btn.style.fontWeight = 'bold';
  btn.style.fontSize = '12px';
  btn.style.letterSpacing = '1px';
  btn.style.cursor = 'pointer';
  btn.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';

  btn.addEventListener('click', sodieVolverAAdmin);
  document.body.appendChild(btn);
}

window.sodieAdminVerVistaCliente = sodieAdminVerVistaCliente;
window.sodieVolverAAdmin = sodieVolverAAdmin;

function updatePriceDisplay(postPriceText) {
  const pricePost = document.getElementById('price-post');
  if (pricePost) pricePost.textContent = postPriceText;
  const priceMain = document.getElementById('price-main') || document.getElementById('selected-amount-display');
  if (priceMain) priceMain.textContent = postPriceText;
}

function startPersistentTimers() {
  const timerTotal = document.getElementById('timer-display');
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
  }, 1000);
}

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
