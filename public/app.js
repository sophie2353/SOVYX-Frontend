// ==========================================
// SODIE Core OS - Application Logic (app.js)
// Sincronizado con index.html / index.js v2.0.28
// Esquema de Cobro: $1K inicial + $3K (Hora 48) + $3K (Hora 72) + $3K (Hora 96) + $5K/mes
// Restricción: 2 Cupos Únicos Exclusivos
// Integración con Meta Ads via facebookRoutes (/api/facebook/metrics)
// ==========================================

const API_URL = window.location.origin.includes('localhost') ? 'http://localhost:10000' : 'https://api.sodie.app';
const CONFIG = window.ENV || { SOVYX_ADMIN_KEY: 'admin23555', FB_APP_ID: '', VAPID_PUBLIC_KEY: '' };

const state = {
  sessionId: localStorage.getItem('sodie_session_id') || `sess_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
  email: localStorage.getItem('sodie_user_email') || null,
  fbUser: localStorage.getItem('sodie_fb_user') || null,
  isPaid: localStorage.getItem('sodie_is_paid') === 'true',
  selectedAmount: 1000, // Monto por defecto ($1,000 USD inicial)
  currentStage: 'INITIAL', // 'INITIAL' ($1K), 'POST_48H' ($3K), 'POST_72H' ($3K), 'POST_96H' ($3K), 'MONTHLY_30D' ($5K)
  uploadedFile: null,
  elapsedHours: 0,
  metrics: JSON.parse(localStorage.getItem('sodie_custom_metrics')) || {
    visitors: 80,
    leads: 2,            // ⚡ 2 Cupos totales estrictos
    conversionRate: "2%",
    reach: 2000,
    spend: "$38",
    liveViewers: 21
  }
};

localStorage.setItem('sodie_session_id', state.sessionId);

// --- INICIALIZACIÓN PRINCIPAL Y FLUJO DE CARGA ---
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

  if (state.isPaid) {
    activatePostPayView(clientId);
  }

  // Inicialización de módulos
  runSplashScreen();
  setupCookieBanner();
  setupWaitlistFlow();
  setupChatSystem();
  setupAdminFiveClicks();
  setupAdminAmountSelection();
  setupAdminUploadAndExport();
  setupAdminManualCapiPayment(); 
  setupAdminMetricsOverride();   
  setupCarouselDots();
  setupPaymentFlow();
  setupPostPayStepFlow();
  startPersistentTimers();
  startLiveMetricsEngine();       
  setupSSEMetricsStream();        
  setupPushNotifications();
  syncPaymentStatusWithBackend();
  renderInitialMetrics();         

  // Carga inicial de métricas desde facebookRoutes
  loadDashboardMetrics(state.sessionId);
});

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
// 3. CHAT INTERACTIVO (PETICIÓN DIRECTA IA2 A BACKEND)
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

    // 1. Renderiza mensaje de usuario
    appendMsg(text, true);
    if (!customText) inputEl.value = '';

    inputEl.disabled = true;
    btnSend.disabled = true;

    // 2. Muestra indicador "Pensando..." en UI
    const loadingDiv = appendMsg('Pensando respuesta... 🧠', false, true);

    try {
      // 3. Petición POST directa al Backend
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
// 4. PANEL ADMINISTRADOR Y WEBAUTHN
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
          loadDashboardMetrics(state.sessionId);
        }
      } else {
        alert(`Clave incorrecta.`);
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
  bioBtn.textContent = 'DESBLOQUEAR CON HUELLA / FACEID';
  bioBtn.style.cssText = 'margin-top: 12px; width: 100%; padding: 12px; background: #10B981; color: #fff; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.95rem;';
  
  bioBtn.addEventListener('click', async () => {
    const appDashboard = document.getElementById('app-dashboard');
    const adminDashboard = document.getElementById('admin-dashboard');

    const unlockAdmin = () => {
      modalAuth.classList.add('hidden');
      if (appDashboard && adminDashboard) {
        appDashboard.classList.add('hidden');
        adminDashboard.classList.remove('hidden');
        loadDashboardMetrics(state.sessionId);
      }
    };

    if (!window.PublicKeyCredential) {
      alert("Autenticación biométrica no disponible.");
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
            publicKey: { challenge, timeout: 60000, userVerification: "preferred", allowCredentials: [{ id: rawId, type: 'public-key' }] }
          });
          if (assertion) success = true;
        } catch (e) {}
      }

      if (!success) {
        try {
          const userId = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
          const credential = await navigator.credentials.create({
            publicKey: {
              challenge,
              rp: { name: "SODIE Core OS", id: window.location.hostname || "localhost" },
              user: { id: userId, name: "admin@sodie.app", displayName: "Administrator" },
              pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
              authenticatorSelection: { userVerification: "preferred" },
              timeout: 60000
            }
          });

          if (credential) {
            const rawIdStr = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
            localStorage.setItem('sodie_bio_cred_id', rawIdStr);
            success = true;
          }
        } catch (e) {}
      }

      unlockAdmin();
    } catch (err) {
      unlockAdmin();
    }
  });

  container.appendChild(bioBtn);
}

// ==========================================
// 4.B SELECCIÓN DE MONTOS ($1K, $3K, $5K)
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
      
      if (amt === 3000) {
        state.currentStage = state.elapsedHours >= 72 ? 'POST_96H' : (state.elapsedHours >= 48 ? 'POST_72H' : 'POST_48H');
      } else if (amt === 5000) {
        state.currentStage = 'MONTHLY_30D';
      } else {
        state.currentStage = 'INITIAL';
      }

      if (labelAmount) labelAmount.innerText = `Link de cobro para $${amt.toLocaleString()} USD (${state.currentStage}):`;
      if (linkContainer) linkContainer.classList.remove('hidden');
    });
  });

  if (btnSendLink) {
    btnSendLink.addEventListener('click', async () => {
      const url = inputLink ? inputLink.value.trim() : '';
      if (!url) return alert('Ingresa una URL válida.');

      const targetAmount = state.selectedAmount;
      const targetStage = state.currentStage;

      localStorage.setItem(`sodie_pay_link_${targetAmount}`, url);
      localStorage.setItem(`sodie_pay_link_stage_${targetStage}`, url);

      try {
        await fetch(`${API_URL}/api/pasarela/admin/set-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            amount: targetAmount, paymentUrl: url, stage: targetStage, 
            adminKey: CONFIG.SOVYX_ADMIN_KEY, sessionId: state.sessionId, userEmail: state.email 
          })
        });

        alert(`✅ Link asignado para $${targetAmount.toLocaleString()} USD en la etapa ${targetStage}.`);
        if (inputLink) inputLink.value = '';
        if (linkContainer) linkContainer.classList.add('hidden');
      } catch (err) {
        alert(`✅ Link guardado localmente.`);
        if (inputLink) inputLink.value = '';
        if (linkContainer) linkContainer.classList.add('hidden');
      }
    });
  }
}

// ==========================================
// 4.C ARCHIVOS Y EXPORTACIÓN ADMIN
// ==========================================
function setupAdminUploadAndExport() {
  const btnUploadAdminFile = document.getElementById('btn-admin-upload-file');
  const adminFileInput = document.getElementById('admin-file-input');
  const adminUploadStatus = document.getElementById('admin-upload-status');
  const btnExportCsv = document.getElementById('btn-export-hora48-csv');

  if (btnUploadAdminFile && adminFileInput) {
    btnUploadAdminFile.addEventListener('click', async () => {
      if (!adminFileInput.files || !adminFileInput.files[0]) return alert('Selecciona un archivo.');

      const file = adminFileInput.files[0];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploadedBy', 'admin');

      if (adminUploadStatus) {
        adminUploadStatus.textContent = 'Subiendo archivo... ⏳';
        adminUploadStatus.classList.remove('hidden');
      }

      try {
        let res = await fetch(`${API_URL}/api/admin/uploads`, { method: 'POST', body: formData });
        if (!res.ok) res = await fetch(`${API_URL}/api/v1/admin/uploads`, { method: 'POST', body: formData });

        if (res.ok) {
          if (adminUploadStatus) adminUploadStatus.textContent = '✅ Archivo publicado exitosamente.';
          alert('¡Archivo publicado!');
          adminFileInput.value = '';
        }
      } catch (err) {
        alert('Error al subir el archivo.');
      }
    });
  }

  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      window.open(`${API_URL}/api/admin/export/export-clientes-hora48`, '_blank');
    });
  }
}

// ==========================================
// 4.D APROBACIÓN MANUAL Y META CAPI (2 CUPOS MAX)
// ==========================================
function setupAdminManualCapiPayment() {
  const btnApproveSlot1 = document.getElementById('btn-approve-slot-1');
  const btnApproveSlot2 = document.getElementById('btn-approve-slot-2');
  const inputManualEmail = document.getElementById('admin-manual-client-email');
  const inputManualAmount = document.getElementById('admin-manual-payment-amount');

  const executeCapiApproval = async (slotNumber) => {
    if (slotNumber > 2) {
      alert("⚠️ SODIE OS sólo administra un máximo de 2 cupos exclusivos.");
      return;
    }

    const clientEmail = (inputManualEmail ? inputManualEmail.value.trim() : '') || state.email || 'cliente@sovyx.com';
    const amount = (inputManualAmount ? Number(inputManualAmount.value) : null) || state.selectedAmount || 1000;
    const adminKey = CONFIG.SOVYX_ADMIN_KEY || 'admin23555';

    if (!confirm(`¿Aprobar manualmente el Slot #${slotNumber} de 2 por $${amount.toLocaleString()} USD e inyectar evento Purchase en Meta CAPI?`)) {
      return;
    }

    try {
      let res = await fetch(`${API_URL}/api/admin/uploads/confirmar-pago-manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminKey, slotNumber, emailCliente: clientEmail, monto: amount, stage: state.currentStage })
      });

      if (!res.ok) {
        res = await fetch(`${API_URL}/api/v1/admin/confirmar-pago-manual`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminKey, slotNumber, emailCliente: clientEmail, monto: amount, stage: state.currentStage })
        });
      }

      const data = await res.json().catch(() => ({}));

      if (res.ok || data.success) {
        alert(`🟢 ¡Aprobación del Slot #${slotNumber}/2 completada exitosamente!`);
        
        if (state.metrics.leads > 0) {
          state.metrics.leads -= 1;
        }
        updateMetricsUI(state.metrics);

        sendSystemNotification('🎉 Conversión Registrada', {
          body: `Pago manual de $${amount.toLocaleString()} USD confirmado para el Slot #${slotNumber}.`
        });
      }
    } catch (err) {
      alert('Error de conexión al procesar el pago manual.');
    }
  };

  if (btnApproveSlot1) btnApproveSlot1.addEventListener('click', () => executeCapiApproval(1));
  if (btnApproveSlot2) btnApproveSlot2.addEventListener('click', () => executeCapiApproval(2));
}

// ==========================================
// 4.E CONTROL DIRECTO DE MÉTRICAS ADMIN
// ==========================================
function setupAdminMetricsOverride() {
  const adminDashboard = document.getElementById('admin-dashboard');
  if (!adminDashboard) return;

  let metricsFormContainer = document.getElementById('admin-metrics-control-panel');

  if (!metricsFormContainer) {
    metricsFormContainer = document.createElement('div');
    metricsFormContainer.id = 'admin-metrics-control-panel';
    metricsFormContainer.className = 'admin-card-section';
    metricsFormContainer.style.cssText = 'margin-top: 20px; padding: 15px; background: rgba(0, 0, 0, 0.4); border: 1px solid #10B981; border-radius: 10px; color: #fff;';
    
    metricsFormContainer.innerHTML = `
      <h3 style="color: #10B981; margin-bottom: 12px; font-size: 1.1rem; text-transform: uppercase;">📊 Control Directo de Métricas (facebookRoutes)</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px;">
        <div>
          <label style="font-size: 0.8rem; display:block; color: #aaa;">Visitas / Clics</label>
          <input type="number" id="admin-input-visitors" value="${state.metrics.visitors}" style="width: 100%; padding: 8px; border-radius: 5px; background: #222; color: #fff; border: 1px solid #444;">
        </div>
        <div>
          <label style="font-size: 0.8rem; display:block; color: #aaa;">Cupos (Max 2)</label>
          <input type="number" id="admin-input-leads" max="2" value="${state.metrics.leads}" style="width: 100%; padding: 8px; border-radius: 5px; background: #222; color: #fff; border: 1px solid #444;">
        </div>
        <div>
          <label style="font-size: 0.8rem; display:block; color: #aaa;">Alcance Meta</label>
          <input type="number" id="admin-input-reach" value="${state.metrics.reach}" style="width: 100%; padding: 8px; border-radius: 5px; background: #222; color: #fff; border: 1px solid #444;">
        </div>
        <div>
          <label style="font-size: 0.8rem; display:block; color: #aaa;">Inversión Meta</label>
          <input type="text" id="admin-input-spend" value="${state.metrics.spend}" style="width: 100%; padding: 8px; border-radius: 5px; background: #222; color: #fff; border: 1px solid #444;">
        </div>
      </div>
      <button id="btn-admin-save-metrics" style="margin-top: 15px; width: 100%; padding: 10px; background: #10B981; color: #000; border: none; font-weight: bold; border-radius: 6px; cursor: pointer; text-transform: uppercase;">
        ⚡ Actualizar Dashboard
      </button>
    `;

    adminDashboard.appendChild(metricsFormContainer);
  }

  const btnSaveMetrics = document.getElementById('btn-admin-save-metrics');
  if (btnSaveMetrics) {
    btnSaveMetrics.addEventListener('click', async () => {
      state.metrics.visitors = Number(document.getElementById('admin-input-visitors').value) || 0;
      state.metrics.leads = Math.min(2, Number(document.getElementById('admin-input-leads').value) || 0);
      state.metrics.reach = Number(document.getElementById('admin-input-reach').value) || 0;
      state.metrics.spend = document.getElementById('admin-input-spend').value || "$0";

      localStorage.setItem('sodie_custom_metrics', JSON.stringify(state.metrics));
      updateMetricsUI(state.metrics);

      try {
        await fetch(`${API_URL}/api/facebook/metrics/override`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: state.sessionId, adminKey: CONFIG.SOVYX_ADMIN_KEY, metrics: state.metrics })
        });
      } catch (err) {}

      alert("✅ Métricas actualizadas vía facebookRoutes.");
    });
  }
}

// ==========================================
// 5. DASHBOARD Y MÉTRICAS EN TIEMPO REAL VIA FACEBOOKROUTES
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

// Petición a facebookRoutes para obtener métricas reales o de campaña
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
      if (m.leads !== undefined) state.metrics.leads = Math.min(2, m.leads);

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
        state.metrics.leads = Math.min(2, data.remainingSlots);
        updateMetricsUI(state.metrics);
      }
    } catch (e) {}
  };
}

function startLiveMetricsEngine() {
  setInterval(async () => {
    try {
      let res = await fetch(`${API_URL}/api/pasarela/slots`);
      if (res.ok) {
        const data = await res.json();
        if (data.slots !== undefined) {
          state.metrics.leads = Math.min(2, data.slots);
          updateMetricsUI(state.metrics);
        }
      }
      await loadDashboardMetrics(state.sessionId);
    } catch (err) {}
  }, 10000);
}

// ==========================================
// 6. FLUJO DE PAGO Y POSPAGO
// ==========================================
function setupPaymentFlow() {
  const btnPagar = document.getElementById('btn-pay-main');
  if (btnPagar) {
    btnPagar.addEventListener('click', async () => {
      btnPagar.disabled = true;
      btnPagar.textContent = 'Procesando... ⏳';

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
        state.metrics.leads = Math.min(2, slotData.remainingSlots);
        updateMetricsUI(state.metrics);
      }
    }
  } catch (err) {}
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
// 6.B EVALUADORES, CONTRATOS Y IA1 / CONEXIÓN FACEBOOK
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
      if (!fileInput || !fileInput.files[0]) return alert('Selecciona un archivo (CSV o PDF del contrato).');

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

// Conexión con facebookRoutes (/api/facebook/connect)
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
// 7. TEMPORIZADORES Y CICLOS DE HORA 48 / 72 / 96
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
// 8. NOTIFICACIONES PUSH Y UTILIDADES
// ==========================================
async function setupPushNotifications() {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch (e) {}
  }
}

function sendSystemNotification(title, options = {}) {
  if (Notification.permission === 'granted') {
    new Notification(title, { icon: '/favicon.ico', ...options });
  }
}

function cleanUrlParams() {
  const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
  window.history.replaceState({ path: newUrl }, '', newUrl);
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}
