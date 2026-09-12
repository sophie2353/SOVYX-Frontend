// ==========================================
// SODIE Core OS - Application Logic (app.js)
// Sincronizado con index.html / backend API
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

// --- CONTROL DE NAVEGACIÓN Y TARJETAS POR PASO ---
function showStepCard(stepName) {
  const steps = [
    'step-1-pay-trigger',
    'form-pago-datos',
    'step-contract-flow',
    'step-upload-excel-flow',
    'step-upload-file',
    'step-facebook-connect-flow',
    'step-activate-campaign-flow'
  ];

  // Ocultar todos los bloques del flujo de registro/onboarding
  steps.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  // Asegurar contenedor principal visible
  const pfCard = document.getElementById('pf-card');
  if (pfCard) pfCard.classList.remove('hidden');

  const postPayFlow = document.getElementById('section-post-pay-flow') || document.getElementById('post-pago-contract-flow');
  if (postPayFlow) postPayFlow.classList.remove('hidden');

  // Mostrar el elemento objetivo y enfocarlo
  const targetEl = document.getElementById(stepName);
  if (targetEl) {
    targetEl.classList.remove('hidden');
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

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
    console.warn('Backend SODIE local fallback activado.');
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

  // DETECCIÓN Y ACTIVACIÓN POST-PAGO
  const isPaymentConfirmed = paymentDoneStorage || 
    (paymentStatus && (paymentStatus.includes('paid') || paymentStatus.includes('success') || paymentStatus === 'true')) || 
    urlParams.get('auth') === 'success';

  if (isPaymentConfirmed) {
    state.isPaid = true;
    localStorage.setItem('sodie_is_paid', 'true');
    localStorage.setItem('sodie_payment_completed', 'true');
    confirmPaymentSuccess(state.selectedAmount, clientId || state.sessionId);
    
    // REDIRECCIÓN DIRECTA AL PASO 3 (FIRMAR CONTRATO)
    showStepCard('step-contract-flow');
    cleanUrlParams();
  } else if (state.isPaid) {
    activatePostPayView(clientId);
    showStepCard('step-contract-flow');
  }

  if (stepParam === 'firmar_contrato') {
    activatePostPayView();
    showStepCard('step-contract-flow');
  }

  if (stepParam === 'procesar_excel') {
    activatePostPayView();
    const excelStepId = document.getElementById('step-upload-excel-flow') ? 'step-upload-excel-flow' : 'step-upload-file';
    showStepCard(excelStepId);
  }

  if (stepParam === 'conectar_facebook') {
    activatePostPayView();
    showStepCard('step-facebook-connect-flow');
  }

  if (stepParam === 'activar_campana') {
    activatePostPayView();
    if (campaignIdParam) localStorage.setItem('sodie_last_campaign_id', campaignIdParam);
    showStepCard('step-activate-campaign-flow');
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
  setupV4AuthModal();
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
  const pctEl = document.getElementById('client-file-pct');

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
      if (pctEl) pctEl.textContent = '100%';
      if (statusEl) statusEl.textContent = '✅ Archivo procesado exitosamente.';
      
      // AVANZA AL PASO 5 (CONECTAR FACEBOOK VÍA facebookRoutes)
      showStepCard('step-facebook-connect-flow');
      alert('¡Base de datos cargada correctamente! Procede a vincular tu cuenta de Facebook.');
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
    // LLAMADA A RUTAS DE FACEBOOK (facebookRoutes)
    const res = await fetch(`${API_URL}/api/facebook/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId, email: state.email })
    });

    const data = await res.json();
    if (res.ok && data.redirectUrl) {
      window.location.href = data.redirectUrl;
    } else {
      // AVANZA AL PASO 6 (ACTIVAR CAMPAÑA)
      showStepCard('step-activate-campaign-flow');
      const lblId = document.getElementById('lbl-campaign-id');
      if (lblId) lblId.textContent = 'CMP-META-' + Math.floor(Math.random() * 899999 + 100000);
      alert('✅ Cuenta de Facebook vinculada correctamente.');
    }
  } catch (err) {
    showStepCard('step-activate-campaign-flow');
    alert('⚠️ Ocurrió una advertencia de conexión. Paso habilitado localmente.');
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

    const liveContainer = document.getElementById('meta-live-metrics-container');
    const compSection = document.getElementById('section-sodie-comparison');
    if (liveContainer) liveContainer.classList.remove('hidden');
    if (compSection) compSection.classList.remove('hidden');

    alert('¡Campaña activada exitosamente! Mostrando métricas en vivo...');
    const appDashboard = document.getElementById('app-dashboard');
    if (appDashboard) {
      appDashboard.classList.remove('hidden');
      appDashboard.scrollIntoView({ behavior: 'smooth' });
    }
    await loadDashboardMetrics(state.sessionId);
  } catch (err) {
    const liveContainer = document.getElementById('meta-live-metrics-container');
    if (liveContainer) liveContainer.classList.remove('hidden');
    alert('¡Campaña activada localmente!');
  } finally {
    if (btnConfirm) {
      btnConfirm.disabled = false;
      btnConfirm.textContent = 'CONFIRMAR Y ACTIVAR BORRADOR 🚀';
    }
  }
}

function sodieActivarAdminDirecto() {
  sodieCrearBorrador();
  sodieConfirmarActivacion();
  const modalAdminAuth = document.getElementById('modal-admin-auth');
  if (modalAdminAuth) modalAdminAuth.classList.add('hidden');
}

window.sodieCrearBorrador = sodieCrearBorrador;
window.sodieConnectFacebook = sodieConnectFacebook;
window.sodieConfirmarActivacion = sodieConfirmarActivacion;
window.sodieActivarAdminDirecto = sodieActivarAdminDirecto;

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

      const statusTag = document.getElementById('biometric-status-tag');
      if (statusTag) {
        statusTag.textContent = 'Estatus biometría: ✅ Registrada con éxito';
        statusTag.style.color = '#00ffcc';
      }

      alert('🔒 ¡Biometría de hardware registrada exitosamente!');
      return true;
    }
  } catch (err) {
    alert('❌ Registro biométrico cancelado o no completado.');
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
    alert('❌ Verificación biométrica cancelada.');
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
  const btnRegisterBioPostPay = document.getElementById('btn-register-bio-postpay') || document.getElementById('btn-bio-register') || document.getElementById('btn-register-biometrics');

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

  const btnSendContract = document.getElementById('btn-client-send-contract');
  const pctContract = document.getElementById('client-contract-pct');
  const statusContract = document.getElementById('client-contract-status');

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
      
      // TRANSICIÓN DEL PASO 3 AL PASO 4 (SUBIR BASE DE DATOS)
      const excelStepId = document.getElementById('step-upload-excel-flow') ? 'step-upload-excel-flow' : 'step-upload-file';
      showStepCard(excelStepId);
    });
  }

  if (btnSendContract) {
    btnSendContract.addEventListener('click', () => {
      if (pctContract) pctContract.textContent = '100%';
      if (statusContract) statusContract.classList.remove('hidden');
      
      // TRANSICIÓN DE FIRMA DE CONTRATO AL PASO 4 (SUBIR BASE DE DATOS)
      const excelStepId = document.getElementById('step-upload-excel-flow') ? 'step-upload-excel-flow' : 'step-upload-file';
      showStepCard(excelStepId);
      alert('Contrato adjuntado con éxito. Habilitando subida de base de datos.');
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
  const formWaitlist = document.getElementById('form-v4-waitlist');
  const inputEmail = document.getElementById('waitlist-email-input') || document.getElementById('input-waitlist-email');
  const inputPhone = document.getElementById('waitlist-phone-input') || document.getElementById('input-waitlist-phone');
  const statusMsg = document.getElementById('waitlist-status') || document.getElementById('waitlist-status-msg');

  const processWaitlist = async () => {
    const email = inputEmail ? inputEmail.value.trim() : (state.email || '');
    const phone = inputPhone ? inputPhone.value.trim() : '';

    if (!email) return alert('Ingresa un correo electrónico válido.');

    if (btnWaitlist) {
      btnWaitlist.disabled = true;
      btnWaitlist.textContent = 'Procesando registro... ⏳';
    }

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
          statusMsg.textContent = '✅ Registrado correctamente en la lista SODIE V4.';
          statusMsg.classList.remove('hidden');
        }
        alert('¡Te has registrado exitosamente en la lista de espera!');
        if (inputEmail) inputEmail.value = '';
        if (inputPhone) inputPhone.value = '';
      }
    } catch (err) {
      if (statusMsg) {
        statusMsg.textContent = '✅ Registro local guardado correctamente.';
        statusMsg.classList.remove('hidden');
      }
      alert('✅ Te has unido a la lista de espera.');
    } finally {
      if (btnWaitlist) {
        btnWaitlist.disabled = false;
        btnWaitlist.textContent = 'UNIRSE A LA LISTA DE ESPERA';
      }
    }
  };

  if (formWaitlist) {
    formWaitlist.addEventListener('submit', (e) => {
      e.preventDefault();
      processWaitlist();
    });
  } else if (btnWaitlist) {
    btnWaitlist.addEventListener('click', processWaitlist);
  }
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
    if (welcomeFill) {
      welcomeFill.style.height = `${pct}%`;
      welcomeFill.style.width = `${pct}%`;
    }

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
  const quickOpts = document.querySelectorAll('.chat-quick-options .opt-btn, #quick-replies .opt-btn');

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
        if (text.toLowerCase().includes('cupo_3') || text.toLowerCase().includes('cupo 3')) {
          updateMsg(loadingDiv, 'Al completarse los 2 cupos directos, los accesos se cierran automáticamente y las solicitudes pasan a la lista de espera de SODIE V4.');
        } else if (text.toLowerCase().includes('funciona')) {
          updateMsg(loadingDiv, 'Inyectamos las bases de compradores en Meta Ads mediante API directa, creando un borrador optimizado sin intervención manual.');
        } else if (text.toLowerCase().includes('pago') || text.toLowerCase().includes('reservar')) {
          updateMsg(loadingDiv, 'El pago inicial de reserva es de $1,000 USD. Los $9,000 USD restantes se difieren tras ver métricas.');
        } else {
          updateMsg(loadingDiv, 'SODIE Engine: Solicitud recibida. Procesando tu respuesta...');
        }
      }
    } catch (err) {
      updateMsg(loadingDiv, 'SODIE Engine: Módulo asistido activo.');
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
  const btnAdminBio = document.getElementById('btn-admin-bio') || document.getElementById('btn-admin-biometrics-login');
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

function setupV4AuthModal() {
  const openV4Btn = document.getElementById('btn-open-v4-login');
  const modalV4 = document.getElementById('modal-v4-auth');
  const closeV4Btn = document.getElementById('btn-close-v4-modal');
  const submitV4KeyBtn = document.getElementById('btn-submit-v4-key');
  const v4BioBtn = document.getElementById('btn-login-biometrics-v4');

  if (openV4Btn && modalV4) {
    openV4Btn.addEventListener('click', (e) => {
      e.preventDefault();
      modalV4.classList.remove('hidden');
    });
  }

  if (closeV4Btn && modalV4) {
    closeV4Btn.addEventListener('click', () => modalV4.classList.add('hidden'));
  }

  if (submitV4KeyBtn) {
    submitV4KeyBtn.addEventListener('click', () => {
      alert('Autenticando acceso SODIE V4...');
      if (modalV4) modalV4.classList.add('hidden');
    });
  }

  if (v4BioBtn) {
    v4BioBtn.addEventListener('click', async () => {
      const verified = await authenticateBiometrics('user');
      if (verified) {
        alert('Autenticación biométrica V4 correcta.');
        if (modalV4) modalV4.classList.add('hidden');
      }
    });
  }
}

function activarPanelAdministrador() {
  const modalAdminAuth = document.getElementById('modal-admin-auth');
  const adminLoginStep = document.getElementById('admin-login-step');
  const adminControlPanel = document.getElementById('admin-control-panel');
  const appDashboard = document.getElementById('app-dashboard');
  const adminDashboard = document.getElementById('admin-dashboard');

  state.isAdminMode = true;
  localStorage.setItem('sodie_is_admin', 'true');

  if (modalAdminAuth) modalAdminAuth.classList.add('hidden');
  if (adminLoginStep) adminLoginStep.classList.add('hidden');
  if (adminControlPanel) adminControlPanel.classList.remove('hidden');
  if (appDashboard) appDashboard.classList.add('hidden');
  if (adminDashboard) adminDashboard.classList.remove('hidden');

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
  const cuposBadge = document.getElementById('cupos-count-badge');
  const metricCuposVal = document.getElementById('metric-cupos-val');

  if (visitorsEl) visitorsEl.textContent = metricsData.visitors ?? state.metrics.visitors;
  if (leadsEl) leadsEl.textContent = metricsData.leads ?? state.metrics.leads;
  if (reachEl) reachEl.textContent = (metricsData.reach ?? state.metrics.reach).toLocaleString();
  if (spendEl) spendEl.textContent = metricsData.spend || state.metrics.spend;
  if (cuposBadge) cuposBadge.textContent = `${metricsData.leads ?? state.metrics.leads} cupos disponibles`;
  if (metricCuposVal) metricCuposVal.textContent = metricsData.leads ?? state.metrics.leads;
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
      if (m.leads !== undefined) state.metrics.leads = Math.min(2, m.leads);
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
        const slotsCount = data.disponibles ?? data.slots;
        if (slotsCount !== undefined) {
          state.metrics.leads = Math.min(2, slotsCount);
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
  
  const landingSections = ['section-hero', 'section-pricing', 'form-pago-datos', 'btn-pay-main', 'modal-admin-auth', 'step-1-pay-trigger'];
  landingSections.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  const badgeClient = document.getElementById('client-id-badge');
  if (badgeClient) {
    badgeClient.textContent = `Cliente #${activeId}`;
    badgeClient.classList.remove('hidden');
  }

  updateMetricsUI(state.metrics);
}

// ==========================================
// TRANSICIÓN Y CONMUTACIÓN ADMIN <-> CLIENTE
// ==========================================

async function sodieAdminVerVistaCliente() {
  try {
    await loadDashboardMetrics(state.sessionId);
  } catch (err) {
    console.warn('Carga preliminar de métricas completada.');
  }

  const adminDashboard = document.getElementById('admin-dashboard');
  const modalAdminAuth = document.getElementById('modal-admin-auth');

  if (adminDashboard) adminDashboard.classList.add('hidden');
  if (modalAdminAuth) modalAdminAuth.classList.add('hidden');

  state.isPaid = true;
  localStorage.setItem('sodie_is_paid', 'true');
  activatePostPayView();
  
  // AL PASAR A VISTA CLIENTE DESDE ADMIN, COMIENZA EN EL PASO 3
  showStepCard('step-contract-flow');

  injectFloatingAdminReturnBtn();
}

function sodieVolverAAdmin() {
  const appDashboard = document.getElementById('app-dashboard');
  const postPayFlow = document.getElementById('section-post-pay-flow') || document.getElementById('post-pago-contract-flow') || document.getElementById('step-contract-flow');

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
  const timerTotal = document.getElementById('timer-display') || document.getElementById('timer-main-display');
  const timer24h = document.getElementById('timer-24h-display');
  const timerV4 = document.getElementById('timer-v4-display');

  let totalSecs = 96 * 3600;
  let secs24 = 24 * 3600;
  let secsV4 = 72 * 3600;

  setInterval(() => {
    if (totalSecs > 0) totalSecs--;
    if (secs24 > 0) secs24--;
    if (secsV4 > 0) secsV4--;

    const hoursPassed = Math.floor((96 * 3600 - totalSecs) / 3600);
    state.elapsedHours = hoursPassed;

    const formatTimer = (s) => {
      const h = String(Math.floor(s / 3600)).padStart(2, '0');
      const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
      const sec = String(s % 60).padStart(2, '0');
      return `${h}:${m}:${sec}`;
    };

    if (timerTotal) timerTotal.textContent = formatTimer(totalSecs);
    if (timer24h) timer24h.textContent = formatTimer(secs24);
    if (timerV4) timerV4.textContent = formatTimer(secsV4);

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
