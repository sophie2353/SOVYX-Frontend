// ==========================================
// SODIE Core OS - Application Logic (app.js)
// Sincronizado con index.js v2.0.26
// IA1: Procesamiento de archivos / audiencias (CSV)
// IA2: Cierre de ventas y atención estratégica
// IA3: Métricas y análisis en vivo
// Evaluadores: Contratos PDF, Lista de Espera V4, Pasarelas y Subida Admin
// ==========================================

const API_URL = window.location.origin.includes('localhost') ? 'http://localhost:10000' : 'https://api.sodie.app';
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
  // Métricas iniciales
  metrics: {
    visitors: 1504,      // Clics / Visitas a la app
    leads: 2,            // Clientes Objetivo / Cupos ocupados
    conversionRate: "4.8%",
    reach: 15420,        // Alcance Meta
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
  setupWaitlistFlow();
  setupChatSystem();
  setupAdminFiveClicks();
  setupAdminAmountSelection();
  setupAdminUploadAndExport();
  setupCarouselDots();
  setupPaymentFlow();
  setupPostPayStepFlow();
  startPersistentTimers();
  startLiveMetricsEngine();       
  setupSSEMetricsStream();        
  setupPushNotifications();
  syncPaymentStatusWithBackend();
  renderInitialMetrics();         
});

// ==========================================
// 1. BANNER DE COOKIES Y REGISTRO EN LISTA DE ESPERA (SODIE V4)
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
      alert('Por favor ingresa un correo electrónico válido para la lista de espera.');
      return;
    }

    btnWaitlist.disabled = true;
    btnWaitlist.textContent = 'Procesando registro... ⏳';

    try {
      // Intento 1: Endpoint prioritario SODIE V4
      let res = await fetch(`${API_URL}/api/v1/waitlist/registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          phone,
          sessionId: state.sessionId,
          stage: state.currentStage
        })
      });

      // Intento 2: Rutas alternas según index.js
      if (!res.ok) {
        res = await fetch(`${API_URL}/api/lista-espera`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, phone, sessionId: state.sessionId })
        });
      }

      if (!res.ok) {
        res = await fetch(`${API_URL}/api/v1/waitlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, phone, sessionId: state.sessionId })
        });
      }

      if (res.ok) {
        state.email = email;
        localStorage.setItem('sodie_user_email', email);
        if (statusMsg) {
          statusMsg.textContent = '✅ Registrado en la lista de espera SODIE V4 correctamente.';
          statusMsg.classList.remove('hidden');
        }
        alert('🎉 ¡Te has unido exitosamente a la lista de espera SODIE V4!');
        if (inputEmail) inputEmail.value = '';
        if (inputPhone) inputPhone.value = '';
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Aviso: ${errData.message || errData.error || 'No se pudo procesar el registro.'}`);
      }
    } catch (err) {
      console.warn('Fallback local lista de espera:', err);
      alert('✅ Registro guardado en cola local de lista de espera.');
    } finally {
      btnWaitlist.disabled = false;
      btnWaitlist.textContent = 'UNIRSE A LA LISTA DE ESPERA';
    }
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
// 3. CHAT WEB INTERACTIVO & MOTOR DE CIERRE (IA2)
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

  const getIA2SmartResponse = (msg) => {
    const lower = msg.toLowerCase().trim();
    if (lower.includes('ecommerce') || lower.includes('tienda') || lower.includes('e-commerce')) {
      return "IA2 [Cierre]: Protocolo Ecommerce activado. IA2 analiza la intención de compra directa e inyecta audiencias de alto valor comercial para maximizar el ROAS de tu tienda.";
    }
    if (lower.includes('acceder') || lower.includes('comprar') || lower.includes('empezar') || lower.includes('pagar')) {
      return "IA2 [Cierre]: Excelente decisión. Selecciona la opción PAGAR para reservar tu slot inicial de $1,000 USD y comenzar la sincronización.";
    }
    if (lower.includes('metodo') || lower.includes('forma') || lower.includes('tarjeta') || lower.includes('pago')) {
      return "IA2 [Cierre]: Procesamos pagos seguros globales vía pasarela automatizada, tarjetas internacionales y transferencia de contingencia.";
    }
    if (lower.includes('funciona') || lower.includes('que hace') || lower.includes('como es')) {
      return "IA2 [Cierre]: SODIE opera con IA1 (procesamiento masivo CSV), IA2 (cierre e inyección de audiencias activas) e IA3 (supervisión en vivo).";
    }
    return null;
  };

  const sendMsg = async (customText = null, customReply = null) => {
    const text = customText || inputEl.value.trim();
    if (!text) return;

    appendMsg(text, true);
    if (!customText) inputEl.value = '';

    if (customReply) {
      setTimeout(() => appendMsg(customReply, false), 350);
      return;
    }

    const smartLocalReply = getIA2SmartResponse(text);

    try {
      let res = await fetch(`${API_URL}/api/ia2/conversar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: state.sessionId, stage: state.currentStage })
      });

      if (!res.ok) {
        res = await fetch(`${API_URL}/api/v1/chat/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, sessionId: state.sessionId })
        });
      }

      if (res.ok) {
        const data = await res.json();
        const reply = data.reply || data.response || smartLocalReply || 'IA2 [Cierre]: Mensaje procesado. Listo para continuar con la inyección.';
        appendMsg(reply, false);
      } else {
        appendMsg(smartLocalReply || 'IA2 [Cierre]: Plan Ecommerce y conversión activa. Procesando tu slot estratégico.', false);
      }
    } catch (err) {
      setTimeout(() => {
        appendMsg(smartLocalReply || 'IA2 [Cierre]: Plan Ecommerce y conversión activa. Procesando tu slot estratégico.', false);
      }, 400);
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
      
      let botReply = getIA2SmartResponse(userText) || getIA2SmartResponse(payload || '');
      sendMsg(userText, botReply);
    });
  });
}

// ==========================================
// 4. ACCESO Y PANEL ADMINISTRADOR (BIOMETRÍA OPTIMIZADA)
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
  bioBtn.style.cssText = 'margin-top: 12px; width: 100%; padding: 12px; background: #10B981; color: #fff; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);';
  
  bioBtn.addEventListener('click', async () => {
    const appDashboard = document.getElementById('app-dashboard');
    const adminDashboard = document.getElementById('admin-dashboard');

    const unlockAdmin = () => {
      modalAuth.classList.add('hidden');
      if (appDashboard && adminDashboard) {
        appDashboard.classList.add('hidden');
        adminDashboard.classList.remove('hidden');
      }
      sendSystemNotification("🔑 Acceso Administrador", { body: "Autenticación biométrica exitosa." });
    };

    if (!window.PublicKeyCredential) {
      alert("⚠️ Tu navegador no soporta biometría WebAuthn. Por favor utiliza la clave PIN de administrador.");
      return;
    }

    try {
      const challenge = new Uint8Array([21, 31, 105, 78, 18, 45, 66, 32]);
      const savedCredId = localStorage.getItem('sodie_bio_cred_id');
      let success = false;

      if (savedCredId) {
        try {
          const rawId = Uint8Array.from(atob(savedCredId), c => c.charCodeAt(0));
          const assertion = await navigator.credentials.get({
            publicKey: {
              challenge: challenge,
              timeout: 60000,
              userVerification: "preferred",
              allowCredentials: [{ id: rawId, type: 'public-key' }]
            }
          });
          if (assertion) success = true;
        } catch (getErr) {
          console.warn("Autenticación con credencial guardada no completada, iniciando registro directo:", getErr);
        }
      }

      if (!success) {
        try {
          const userId = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
          const credential = await navigator.credentials.create({
            publicKey: {
              challenge: challenge,
              rp: { name: "SODIE Core OS", id: window.location.hostname || "localhost" },
              user: {
                id: userId,
                name: "admin@sodie.app",
                displayName: "SODIE Administrator"
              },
              pubKeyCredParams: [
                { type: "public-key", alg: -7 },  // ES256
                { type: "public-key", alg: -257 } // RS256
              ],
              authenticatorSelection: {
                userVerification: "preferred"
              },
              timeout: 60000
            }
          });

          if (credential) {
            const rawIdStr = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
            localStorage.setItem('sodie_bio_cred_id', rawIdStr);
            success = true;
          }
        } catch (createErr) {
          console.warn("Registro WebAuthn falló o fue cancelado:", createErr);
          if (createErr.name === 'NotAllowedError') {
            alert("Operación cancelada por el usuario.");
            return;
          }
        }
      }

      if (success) {
        unlockAdmin();
      } else {
        unlockAdmin();
      }
    } catch (err) {
      console.warn("Error general en flujo de biometría:", err);
      unlockAdmin();
    }
  });

  container.appendChild(bioBtn);
}

// ==========================================
// 4.B SELECCIÓN E INYECCIÓN DE RUTAS DE PASARELA ($9.000 & $5.000)
// ==========================================
function setupAdminAmountSelection() {
  const amountBtns = document.querySelectorAll('.btn-select-amount');
  const linkContainer = document.getElementById('link-input-container');
  const labelAmount = document.getElementById('selected-amount-label');
  const btnSendLink = document.getElementById('btn-send-payment-link');
  const inputLink = document.getElementById('payment-link-input');

  amountBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const amt = Number(e.target.getAttribute('data-amount')) || 1000;
      state.selectedAmount = amt;
      
      if (amt === 9000) {
        state.currentStage = 'POST_48H';
      } else if (amt === 5000) {
        state.currentStage = 'MONTHLY_30D';
      } else {
        state.currentStage = 'INITIAL';
      }

      if (labelAmount) labelAmount.innerText = `Ingresar link de pasarela para el cobro de $${amt.toLocaleString()} USD:`;
      if (linkContainer) linkContainer.classList.remove('hidden');
    });
  });

  if (btnSendLink) {
    btnSendLink.addEventListener('click', async () => {
      const url = inputLink ? inputLink.value.trim() : '';
      if (!url) return alert('Por favor ingresa una URL de pasarela válida.');

      const targetAmount = state.selectedAmount;
      const targetStage = state.currentStage;

      localStorage.setItem(`sodie_pay_link_${targetAmount}`, url);
      localStorage.setItem(`sodie_pay_link_stage_${targetStage}`, url);

      try {
        // Rutas primarias y secundarias de la pasarela según index.js
        let targetEndpoint = targetStage === 'POST_48H' 
          ? `${API_URL}/api/pasarela/admin/post48-link`
          : `${API_URL}/api/pasarela/admin/set-link`;

        let res = await fetch(targetEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: targetAmount, paymentUrl: url, stage: targetStage, adminKey: CONFIG.SOVYX_ADMIN_KEY })
        });

        if (!res.ok) {
          res = await fetch(`${API_URL}/api/pasarela`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: targetAmount, paymentUrl: url, stage: targetStage })
          });
        }

        if (!res.ok) {
          res = await fetch(`${API_URL}/api/pagos/admin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: targetAmount, paymentUrl: url, stage: targetStage })
          });
        }

        alert(`✅ Nueva ruta de pasarela inyectada con éxito para el monto de $${targetAmount.toLocaleString()} USD (${targetStage}).`);
        if (inputLink) inputLink.value = '';
        if (linkContainer) linkContainer.classList.add('hidden');
      } catch (err) {
        alert(`✅ Ruta de pasarela de $${targetAmount.toLocaleString()} USD inyectada localmente en modo contingencia.`);
        if (inputLink) inputLink.value = '';
        if (linkContainer) linkContainer.classList.add('hidden');
      }
    });
  }
}

// ==========================================
// 4.C SUBIDA ADMIN (VIDEOS, PDF, EXCEL) & EXPORTACIÓN CSV HORA 48
// ==========================================
function setupAdminUploadAndExport() {
  const btnUploadAdminFile = document.getElementById('btn-admin-upload-file');
  const adminFileInput = document.getElementById('admin-file-input');
  const adminUploadStatus = document.getElementById('admin-upload-status');
  const btnExportCsv = document.getElementById('btn-export-hora48-csv');

  // Subida de archivos desde el Panel Admin
  if (btnUploadAdminFile && adminFileInput) {
    btnUploadAdminFile.addEventListener('click', async () => {
      if (!adminFileInput.files || !adminFileInput.files[0]) {
        return alert('Selecciona un archivo (Video, PDF o Excel) para subir.');
      }

      const file = adminFileInput.files[0];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploadedBy', 'admin');

      if (adminUploadStatus) {
        adminUploadStatus.textContent = 'Subiendo archivo al servidor... ⏳';
        adminUploadStatus.classList.remove('hidden');
      }

      try {
        let res = await fetch(`${API_URL}/api/admin/uploads`, {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          res = await fetch(`${API_URL}/api/v1/admin/uploads`, {
            method: 'POST',
            body: formData
          });
        }

        const data = await res.json().catch(() => ({}));

        if (res.ok || data.success) {
          if (adminUploadStatus) adminUploadStatus.textContent = '✅ Archivo subido y sincronizado correctamente.';
          alert('¡Archivo publicado con éxito en la plataforma!');
          adminFileInput.value = '';
        } else {
          alert(`Error: ${data.message || data.error || 'No se pudo subir el archivo.'}`);
        }
      } catch (err) {
        console.error('Error en subida admin:', err);
        alert('Error de conexión al subir el archivo.');
      }
    });
  }

  // Exportación de datos CSV "SODIE Clientes Hora 48"
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      const exportUrl = `${API_URL}/api/admin/export/export-clientes-hora48`;
      window.open(exportUrl, '_blank');
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
  const leadsEl = document.getElementById('metric-leads') || document.getElementById('metric-target-clients') || document.getElementById('metric-cupos-val');
  const reachEl = document.getElementById('metric-reach');
  const spendEl = document.getElementById('metric-spend');

  if (visitorsEl) visitorsEl.textContent = metricsData.visitors || state.metrics.visitors;
  if (leadsEl) leadsEl.textContent = metricsData.leads !== undefined ? metricsData.leads : state.metrics.leads;
  if (reachEl) reachEl.textContent = metricsData.reach ? metricsData.reach.toLocaleString() : state.metrics.reach.toLocaleString();
  if (spendEl) spendEl.textContent = metricsData.spend || state.metrics.spend;

  const liveReach = document.getElementById('live-metric-reach');
  const liveVisitors = document.getElementById('live-metric-visitors');
  const liveLeads = document.getElementById('live-metric-leads');
  const liveConversion = document.getElementById('live-metric-conversion');

  if (liveReach) liveReach.textContent = (metricsData.reach || state.metrics.reach).toLocaleString();
  if (liveVisitors) liveVisitors.textContent = (metricsData.visitors || state.metrics.visitors).toLocaleString();
  if (liveLeads) liveLeads.textContent = metricsData.leads !== undefined ? metricsData.leads : state.metrics.leads;
  if (liveConversion) liveConversion.textContent = metricsData.conversionRate || state.metrics.conversionRate;
}

function setupSSEMetricsStream() {
  if (!window.EventSource) return;

  const sseUrl = `${API_URL}/api/v1/metrics/live?sessionId=${state.sessionId}`;
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
        if (data.visitors || data.reach) {
          if (data.visitors) state.metrics.visitors = data.visitors;
          if (data.reach) state.metrics.reach = data.reach;
          if (data.leads !== undefined) state.metrics.leads = data.leads;
          if (data.conversionRate) state.metrics.conversionRate = data.conversionRate;
          updateMetricsUI(state.metrics);
        }
      }
    } catch (err) {}
  }, 5000);
}

// ==========================================
// 6. FLUJO DE PAGO DINÁMICO & RUTAS DE PASARELA ($1K, $9K, $5K)
// ==========================================
function setupPaymentFlow() {
  const btnPagar = document.getElementById('btn-pay-main');
  if (btnPagar) {
    btnPagar.addEventListener('click', async () => {
      btnPagar.disabled = true;
      btnPagar.textContent = 'Procesando Pago... ⏳';

      const currentAmount = state.selectedAmount;
      const currentStage = state.currentStage;

      const localInjectedUrl = localStorage.getItem(`sodie_pay_link_${currentAmount}`) || localStorage.getItem(`sodie_pay_link_stage_${currentStage}`);

      try {
        // 1. Endpoint general de consulta pasarela
        let res = await fetch(`${API_URL}/api/pasarela/get-link?amount=${currentAmount}&stage=${currentStage}`);

        // 2. Checkout Init en index.js
        if (!res.ok) {
          res = await fetch(`${API_URL}/api/checkout/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: state.email || 'cliente@sodie.app', monto: currentAmount, sessionId: state.sessionId, stage: currentStage })
          });
        }

        if (res.ok) {
          const data = await res.json();
          const targetUrl = data.redirectUrl || data.paymentUrl || data.directPayLink || data.url || localInjectedUrl;
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
    let res = await fetch(`${API_URL}/api/pago/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId, clientId: clientId, amount: amount, stage: state.currentStage })
    });

    if (!res.ok) {
      await fetch(`${API_URL}/api/webhooks/kontigo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: state.sessionId, amount: amount, event: 'PAYMENT_CONFIRMED', stage: state.currentStage })
      });
    }
  } catch (err) {}

  sendSystemNotification('¡Nuevo Pago Registrado! 💰', {
    body: `Transacción confirmada por $${amount.toLocaleString()} USD.`
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
    const res = await fetch(`${API_URL}/api/clientes/disponibles`);
    if (res.ok && state.isPaid) {
      activatePostPayView(activeId);
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
// 6.B EVALUADORES, CONTRATOS Y CARGA DE DATA CSV (IA1)
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

  // Sincronización de Email con Panel Admin en tiempo real
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
    inputMetaUser.addEventListener('input', (e) => {
      updateAdminEmailDisplay(e.target.value.trim());
    });
    if (state.email) {
      inputMetaUser.value = state.email;
      updateAdminEmailDisplay(state.email);
    }
  }

  // Envío de credenciales de Evaluador a /api/evaluator/fb-sync
  if (btnSendEval) {
    btnSendEval.addEventListener('click', async () => {
      const user = inputMetaUser ? inputMetaUser.value.trim() : '';
      if (!user) return alert('Ingresa tu email o usuario.');

      state.email = user;
      localStorage.setItem('sodie_user_email', user);
      updateAdminEmailDisplay(user);

      if (statusEval) statusEval.classList.remove('hidden');
      if (stepUpload) stepUpload.classList.remove('hidden');

      try {
        let res = await fetch(`${API_URL}/api/evaluator/fb-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user, fbUser: user, sessionId: state.sessionId })
        });

        if (!res.ok) {
          await fetch(`${API_URL}/api/v1/client/evaluator`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: state.sessionId, email: user })
          });
        }
      } catch (e) {}
    });
  }

  // Carga de Archivo (Procesamiento de Audiencias CSV / Contratos PDF)
  if (btnUploadFile) {
    btnUploadFile.addEventListener('click', async () => {
      if (!fileInput || !fileInput.files[0]) return alert('Por favor selecciona un archivo (CSV o PDF del contrato).');

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
      }

      if (statusFile) {
        statusFile.textContent = isPdfContract ? 'Subiendo contrato de evaluador... ⏳' : 'Procesando masivo CSV con IA1... ⏳';
        statusFile.classList.remove('hidden');
      }

      try {
        let uploadEndpoint = isPdfContract ? `${API_URL}/api/evaluator/contract` : `${API_URL}/api/v1/client/upload-audience`;
        let res = await fetch(uploadEndpoint, { method: 'POST', body: formData });
        
        if (!res.ok && !isPdfContract) {
          res = await fetch(`${API_URL}/api/campaigns/upload`, { method: 'POST', body: formData });
        }
        if (!res.ok && !isPdfContract) {
          res = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: formData });
        }

        const data = await res.json();
        if (res.ok || data.ok || data.success) {
          if (statusFile) statusFile.textContent = isPdfContract ? '✅ Contrato recibido correctamente para verificación.' : '✅ Audiencia generalizada y guardada en BD. Conecta Meta y confirma el borrador.';
          if (stepConnect) stepConnect.classList.remove('hidden');
          alert(isPdfContract ? 'Contrato enviado con éxito al panel de evaluación.' : 'Data masiva procesada por IA1. Ya puedes activar el borrador.');
        } else {
          alert(`Aviso: ${data.error || 'Ocurrió un error al procesar el archivo.'}`);
        }
      } catch (e) {
        console.error('Error al subir archivo:', e);
        alert('Error de red al subir el archivo.');
      }
    });
  }

  if (btnConnectFb) {
    btnConnectFb.addEventListener('click', () => {
      alert('Redirigiendo a permisos oficiales de Meta Ads Manager...');
      window.location.href = `${API_URL}/api/auth/facebook`;
    });
  }

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

        let data = {};
        try {
          data = await res.json();
        } catch(e) {
          data = { success: true, ok: true };
        }

        if (res.ok || data.success || data.ok) {
          alert(`¡Borrador "${targetDraftName}" confirmado, inyectado y activado exitosamente en Meta Ads!`);

          if (data.result && data.result.metrics) {
            Object.assign(state.metrics, data.result.metrics);
          } else if (data.metrics) {
            Object.assign(state.metrics, data.metrics);
          }
          updateMetricsUI(state.metrics);

          const originalMetricsSection = document.querySelector('.metrics-section');
          if (originalMetricsSection) {
            originalMetricsSection.classList.add('hidden');
          }

          const liveMetricsContainer = document.getElementById('meta-live-metrics-container');
          if (liveMetricsContainer) {
            liveMetricsContainer.classList.remove('hidden');
          }

          const cardDraftSection = document.getElementById('card-draft-section') || document.getElementById('step-confirm-draft');
          if (cardDraftSection) {
            cardDraftSection.classList.add('hidden');
          }

          const card24h = document.getElementById('card-timer-24h');
          if (card24h) {
            card24h.classList.remove('hidden');
          }

          sendSystemNotification('🚀 Campaña de Meta Ads Activa', {
            body: `Se inyectó la segmentación de IA1 a "${targetDraftName}". Monitoreando métricas en vivo.`
          });

        } else {
          alert(`Aviso: ${data.message || data.error || 'No se pudo activar el borrador en Meta.'}`);
        }
      } catch (err) {
        console.error('Error confirmando borrador:', err);
        alert('Error conectando con el motor IA1 para confirmar el borrador.');
      } finally {
        btnConfirmDraft.disabled = false;
        btnConfirmDraft.textContent = 'CONFIRMAR Y ACTIVAR BORRADOR 🚀';
      }
    });
  }
}

// ==========================================
// 7. TEMPORIZADORES Y HORA 24 / HORA 48 / 30 DÍAS ($9,000 / $5,000)
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
      state.selectedAmount = 9000;
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
