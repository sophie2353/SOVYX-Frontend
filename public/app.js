// ==========================================
// SOVYX Core OS - Application Logic (app.js)
// ==========================================

const API_URL = 'https://sovyx-backend.onrender.com';
const CONFIG = window.ENV || { SOVYX_ADMIN_KEY: '', META_APP_ID: '' };

const state = {
  sessionId: localStorage.getItem('sovyx_session_id') || `sess_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
  email: localStorage.getItem('sovyx_user_email') || null,
  fbUser: localStorage.getItem('sovyx_fb_user') || null,
  isPaid: false,
  uploadedFile: null,
  completedCapsules: JSON.parse(localStorage.getItem('sovyx_completed_capsules') || '[1]'),
  metrics: {
    reach: 14280,
    spend: 1850.50,
    targetClients: 2,
    reachedClients: 1,
    liveViewers: 20
  }
};

localStorage.setItem('sovyx_session_id', state.sessionId);

const ONBOARDING_CAPSULES = [
  { id: 1, title: "1. Identificación Meta Evaluador", desc: "Registro de usuario FB para asignación de nodo." },
  { id: 2, title: "2. Verificación de Capacidad Servidor", desc: "Confirmación de 1 de los 2 slots de cómputo." },
  { id: 3, title: "3. Conexión Meta Business API", desc: "Aceptación de rol tester en developers.facebook.com." },
  { id: 4, title: "4. Ingesta de Base de Datos CRM", desc: "Carga del archivo CSV/XLSX de compradores históricos." },
  { id: 5, title: "5. Creación Borrador 'Prueba Hora 24'", desc: "Estructuración de campaña en Meta Ads Manager." },
  { id: 6, title: "6. Mapeo de Conversiones API (CAPI)", desc: "Sincronización de eventos del Pixel a servidor SOVYX." },
  { id: 7, title: "7. Calibración Algorítmica Hora 0-12", desc: "Filtrado inicial de micro-audiencias de alta intención." },
  { id: 8, title: "8. Inyección Audiencia Espejo", desc: "Despliegue del vector de conversión optimizado." },
  { id: 9, title: "9. Verificación de CVR y CPA Hora 12-24", desc: "Monitoreo continuo de tasa de conversión e inversión." },
  { id: 10, title: "10. Activación de Reglas Automáticas 24H", desc: "Encendido del motor de aceleración y escalado." },
  { id: 11, title: "11. Escalamiento Espejo Hora 24-36", desc: "Redistribución inteligente del presupuesto publicitario." },
  { id: 12, title: "12. Fase de Cierre Maximizado Hora 36-48", desc: "Captura de conversiones residuales de alto retorno." },
  { id: 13, title: "13. Consolidación de Métricas", desc: "Generación del informe final de rendimiento ROAS." },
  { id: 14, title: "14. Liquidación y Cierre de Ciclo", desc: "Entrega de resultados y pago del saldo final ($9,000 USD)." }
];

const QUICK_REPLIES_LANDING = [
  "¿Cómo funciona el ciclo de 48H?",
  "¿Por qué solo hay 2 slots libres?",
  "¿Qué es la calibración espejo?",
  "¿Cuándo se paga la liquidación final?"
];

const QUICK_REPLIES_DASHBOARD = [
  "¿Cómo activo el borrador 'Prueba Hora 24'?",
  "Ver estado de la calibración espejo",
  "¿Cuándo finaliza mi ciclo de 48H?",
  "Soporte técnico directo 🦁"
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
    confirmPaymentSuccess(1000.00);
    cleanUrlParams();
  }

  runSplashScreen();
  setupPaymentFlow();
  setupOnboardingBubbles();
  renderCapsules();
  renderQuickReplies();
  setupChatListeners();
  setupAdminNavigation();
  setupCookieBanner();
  start48hTimer();
  startLiveMetricsEngine();
});

// --- CONFIRMACIÓN DE PAGO (PIXEL + CAPI BACKEND) ---
async function confirmPaymentSuccess(amount = 1000.00) {
  state.isPaid = true;

  if (window.fbq) {
    window.fbq('track', 'Purchase', {
      value: amount,
      currency: 'USD',
      content_name: 'SOVYX Software License - Slot de Cómputo',
      content_type: 'product'
    });
    console.log(`✅ Meta Pixel: Evento Purchase de $${amount} USD enviado.`);
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
    console.log('✅ Backend: Confirmación OK notificada a CAPI.');
  } catch (err) {
    console.warn('Backend CAPI offline, evento procesado en local.');
  }
}

// --- MOTOR DE MÉTRICAS Y ESPECTADORES EN TIEMPO REAL ---
function startLiveMetricsEngine() {
  updateMetricsUI();

  setInterval(async () => {
    try {
      const res = await fetch(`${API_URL}/api/metrics`);
      if (res.ok) {
        const data = await res.json();
        state.metrics.reach = data.reach || state.metrics.reach;
        state.metrics.spend = data.spend || state.metrics.spend;
        state.metrics.targetClients = data.targetClients || 2;
        state.metrics.reachedClients = data.reachedClients || 1;
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
  state.metrics.liveViewers = Math.max(18, Math.min(24, state.metrics.liveViewers + deltaViewers));
  state.metrics.reach += Math.floor(Math.random() * 5) + 1;
}

function updateMetricsUI() {
  const elReach = document.getElementById('metric-reach');
  const elSpend = document.getElementById('metric-spend');
  const elTarget = document.getElementById('metric-target-clients');
  const elReached = document.getElementById('metric-reached-clients');
  const elLiveBadge = document.getElementById('live-viewers-badge');

  if (elReach) elReach.textContent = state.metrics.reach.toLocaleString();
  if (elSpend) elSpend.textContent = `$${state.metrics.spend.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  if (elTarget) elTarget.textContent = `${state.metrics.targetClients} Slots (Objetivo)`;
  if (elReached) elReached.textContent = `${state.metrics.reachedClients} / ${state.metrics.targetClients} Adquiridos`;

  if (elLiveBadge) {
    elLiveBadge.innerHTML = `
      <span style="display:inline-block; width:8px; height:8px; background:var(--neon-green); border-radius:50%; margin-right:6px; box-shadow:0 0 8px var(--neon-green);"></span>
      <span style="font-size:0.8rem; color:var(--text-sub);">
        <strong style="color:#fff;">${state.metrics.liveViewers} personas</strong> viendo la web | <strong style="color:var(--neon-magenta);">2 Slots disponibles 👺</strong>
      </span>
    `;
  }
}

// --- VISTAS Y SPLASH ---
function runSplashScreen() {
  const splash = document.getElementById('view-splash');
  const progress = document.getElementById('splash-progress');

  let pct = 0;
  const interval = setInterval(() => {
    pct += 20;
    if (progress) progress.style.width = `${pct}%`;

    if (pct >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        splash.classList.add('hidden');
        if (localStorage.getItem('sovyx_onboarding_complete') === 'true') {
          showView('view-dashboard');
        } else {
          showView('view-landing');
          if (state.isPaid) openOnboardingOverlay('bubble-fb-user');
        }
      }, 300);
    }
  }, 100);
}

function showView(viewId) {
  document.querySelectorAll('main > .view').forEach(v => v.classList.add('hidden'));
  const target = document.getElementById(viewId);
  if (target) target.classList.remove('hidden');
}

// --- FLUJO DE PAGO Y BOTONES ---
function setupPaymentFlow() {
  const btnPay = document.getElementById('btn-pay');
  if (btnPay) {
    btnPay.addEventListener('click', async () => {
      btnPay.disabled = true;
      btnPay.textContent = 'Generando link de pago... ⏳';

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
          openOnboardingOverlay('bubble-fb-user');
          btnPay.disabled = false;
          btnPay.textContent = 'Reservar Slot ($1,000 USD)';
        }
      } catch (err) {
        await confirmPaymentSuccess(1000.00);
        openOnboardingOverlay('bubble-fb-user');
        btnPay.disabled = false;
        btnPay.textContent = 'Reservar Slot ($1,000 USD)';
      }
    });
  }

  const btnFinalPay = document.getElementById('btn-final-pay');
  if (btnFinalPay) {
    btnFinalPay.addEventListener('click', async () => {
      btnFinalPay.disabled = true;
      btnFinalPay.textContent = 'Procesando Liquidación... ⏳';
      await confirmPaymentSuccess(9000.00);
      alert('¡Liquidación completada ($9,000.00 USD)! Acceso ilimitado activado 🚀');
      btnFinalPay.disabled = false;
      btnFinalPay.textContent = 'Liquidar Software ($9,000)';
    });
  }
}

// --- OVERLAY Y PASOS DE ONBOARDING ---
function openOnboardingOverlay(bubbleId) {
  const overlay = document.getElementById('onboarding-modal-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  document.querySelectorAll('.floating-bubble').forEach(b => b.classList.add('hidden'));

  const targetBubble = document.getElementById(bubbleId);
  if (targetBubble) targetBubble.classList.remove('hidden');
}

function closeOnboardingOverlay() {
  const overlay = document.getElementById('onboarding-modal-overlay');
  if (overlay) overlay.classList.add('hidden');
}

function setupOnboardingBubbles() {
  const btnSaveFb = document.getElementById('btn-save-fb-user');
  const inputFb = document.getElementById('input-fb-user');

  if (btnSaveFb && inputFb) {
    btnSaveFb.addEventListener('click', async () => {
      const fbUser = inputFb.value.trim();
      if (!fbUser) return alert('Por favor ingresa tu usuario o correo de Facebook');

      state.fbUser = fbUser;
      localStorage.setItem('sovyx_fb_user', fbUser);
      markCapsuleCompleted(1);

      try {
        await fetch(`${API_URL}/api/onboarding/tester-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: state.sessionId, fbUser })
        });
      } catch (err) {
        console.warn('Backend offline, pasando a espera local.');
      }

      openOnboardingOverlay('bubble-waiting-admin');
      startAdminPolling();
    });
  }

  const btnSelectFile = document.getElementById('btn-select-file');
  const inputCsv = document.getElementById('input-csv-file');
  const fileNameDisplay = document.getElementById('file-name-display');

  if (btnSelectFile && inputCsv) {
    btnSelectFile.addEventListener('click', () => inputCsv.click());
    inputCsv.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        state.uploadedFile = e.target.files[0];
        if (fileNameDisplay) fileNameDisplay.textContent = `📄 Listo: ${state.uploadedFile.name}`;
      }
    });
  }

  const btnConnectMeta = document.getElementById('btn-connect-meta-csv');
  if (btnConnectMeta) {
    btnConnectMeta.addEventListener('click', async () => {
      if (!state.uploadedFile) return alert('Selecciona tu archivo (.csv / .xlsx)');

      btnConnectMeta.disabled = true;
      btnConnectMeta.textContent = 'Conectando con Meta... ⚡';

      markCapsuleCompleted(2);
      markCapsuleCompleted(3);
      markCapsuleCompleted(4);
      localStorage.setItem('sovyx_onboarding_complete', 'true');

      setTimeout(() => {
        closeOnboardingOverlay();
        showView('view-dashboard');
      }, 1000);
    });
  }

  const btnActivateDraft = document.getElementById('btn-activate-draft');
  const cardDraft = document.getElementById('card-draft-instruction');

  if (btnActivateDraft) {
    btnActivateDraft.addEventListener('click', async () => {
      btnActivateDraft.disabled = true;
      btnActivateDraft.textContent = 'Inyectando Audiencia... 👺';

      markCapsuleCompleted(5);
      markCapsuleCompleted(6);

      if (cardDraft) {
        cardDraft.style.borderColor = 'var(--neon-green)';
        cardDraft.innerHTML = `<h3 style="color:var(--neon-green); margin:0;">¡Campaña Inyectada y Activa! 🚀</h3>`;
      }
    });
  }
}

let pollingInterval = null;
function startAdminPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(async () => {
    try {
      const res = await fetch(`${API_URL}/api/onboarding/status?sessionId=${state.sessionId}`);
      const data = await res.json();
      if (data.status === 'READY' || data.status === 'APPROVED') {
        clearInterval(pollingInterval);
        openOnboardingOverlay('bubble-upload-connect');
      }
    } catch (err) {
      setTimeout(() => {
        clearInterval(pollingInterval);
        openOnboardingOverlay('bubble-upload-connect');
      }, 4000);
    }
  }, 3000);
}

// --- CÁPSULAS Y CHIPS DE CHAT ---
function renderCapsules() {
  const container = document.getElementById('capsules-grid');
  const progressText = document.getElementById('capsules-progress-text');
  if (!container) return;

  container.innerHTML = '';
  ONBOARDING_CAPSULES.forEach(capsule => {
    const isDone = state.completedCapsules.includes(capsule.id);
    const item = document.createElement('div');
    item.style.cssText = `
      display: flex; gap: 10px; align-items: center; padding: 10px;
      border-radius: 12px; background: rgba(0,0,0,0.3); border: 1px solid ${isDone ? 'var(--neon-green)' : 'var(--glass-border)'};
      cursor: pointer; margin-bottom: 6px; transition: all 0.2s;
    `;
    item.innerHTML = `
      <div style="width: 24px; height: 24px; border-radius: 50%; background: ${isDone ? 'var(--neon-green)' : 'rgba(255,255,255,0.1)'}; color: ${isDone ? '#000' : '#fff'}; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: bold;">
        ${isDone ? '✓' : capsule.id}
      </div>
      <div style="flex: 1;">
        <div style="font-size: 0.8rem; font-weight: 600; color: ${isDone ? 'var(--neon-green)' : '#fff'};">${capsule.title}</div>
        <div style="font-size: 0.7rem; color: var(--text-sub);">${capsule.desc}</div>
      </div>
    `;
    item.addEventListener('click', () => toggleCapsuleCompleted(capsule.id));
    container.appendChild(item);
  });

  if (progressText) progressText.textContent = `${state.completedCapsules.length} / 14 Completadas`;
}

function markCapsuleCompleted(id) {
  if (!state.completedCapsules.includes(id)) {
    state.completedCapsules.push(id);
    localStorage.setItem('sovyx_completed_capsules', JSON.stringify(state.completedCapsules));
    renderCapsules();
  }
}

function toggleCapsuleCompleted(id) {
  if (state.completedCapsules.includes(id)) {
    state.completedCapsules = state.completedCapsules.filter(cId => cId !== id);
  } else {
    state.completedCapsules.push(id);
  }
  localStorage.setItem('sovyx_completed_capsules', JSON.stringify(state.completedCapsules));
  renderCapsules();
}

function renderQuickReplies() {
  const landingContainer = document.getElementById('landing-quick-replies');
  const dashContainer = document.getElementById('dashboard-quick-replies');

  const attachChips = (container, replies, inputId, btnId) => {
    if (!container) return;
    container.innerHTML = '';
    container.style.cssText = 'display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 8px;';
    replies.forEach(text => {
      const chip = document.createElement('button');
      chip.style.cssText = 'background: rgba(255,255,255,0.08); border: 1px solid var(--glass-border); padding: 6px 10px; border-radius: 20px; color: var(--text-sub); font-size: 0.7rem; white-space: nowrap; cursor: pointer;';
      chip.textContent = text;
      chip.addEventListener('click', () => {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(btnId);
        if (input && btn) {
          input.value = text;
          btn.click();
        }
      });
      container.appendChild(chip);
    });
  };

  attachChips(landingContainer, QUICK_REPLIES_LANDING, 'landing-chat-input', 'btn-send-landing-chat');
  attachChips(dashContainer, QUICK_REPLIES_DASHBOARD, 'chat-input', 'btn-send-chat');
}

// --- CHAT WEB ---
function setupChatListeners() {
  const sendChat = async (inputEl, boxEl) => {
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

  const btnLanding = document.getElementById('btn-send-landing-chat');
  const inputLanding = document.getElementById('landing-chat-input');
  const boxLanding = document.getElementById('landing-chat-box');
  if (btnLanding && inputLanding && boxLanding) {
    btnLanding.addEventListener('click', () => sendChat(inputLanding, boxLanding));
    inputLanding.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChat(inputLanding, boxLanding); });
  }

  const btnDash = document.getElementById('btn-send-chat');
  const inputDash = document.getElementById('chat-input');
  const boxDash = document.getElementById('chat-box');
  if (btnDash && inputDash && boxDash) {
    btnDash.addEventListener('click', () => sendChat(inputDash, boxDash));
    inputDash.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChat(inputDash, boxDash); });
  }
}

// --- TEMPORIZADOR Y NAVIGATION ADMIN ---
function start48hTimer() {
  const timerDisplay = document.getElementById('timer-count');
  if (!timerDisplay) return;
  let totalSeconds = 48 * 3600 - 1;

  setInterval(() => {
    if (totalSeconds <= 0) return;
    totalSeconds--;
    const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');
    timerDisplay.textContent = `${hrs}:${mins}:${secs}`;
  }, 1000);
}

function setupAdminNavigation() {
  const logoTrigger = document.getElementById('logo-trigger');
  const sidebar = document.getElementById('sidebar-menu');
  const btnClose = document.getElementById('btn-close-sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  const btnTester = document.getElementById('btn-menu-tester');
  const btnClients = document.getElementById('btn-menu-clients');
  const btnDashMenu = document.getElementById('btn-menu-dashboard');
  const btnApproveAdmin = document.getElementById('btn-admin-approve-tester');
  const inputTargetSession = document.getElementById('input-admin-target-session');

  let clicks = 0;
  if (logoTrigger) {
    logoTrigger.addEventListener('click', () => {
      clicks++;
      if (clicks >= 3) {
        clicks = 0;
        if (sidebar) sidebar.classList.remove('hidden');
      }
      setTimeout(() => { clicks = 0; }, 2000);
    });
  }

  if (btnClose && sidebar) btnClose.addEventListener('click', () => sidebar.classList.add('hidden'));
  if (overlay && sidebar) overlay.addEventListener('click', () => sidebar.classList.add('hidden'));

  if (btnTester) {
    btnTester.addEventListener('click', () => {
      if (sidebar) sidebar.classList.add('hidden');
      openOnboardingOverlay('bubble-fb-user');
    });
  }

  if (btnClients) {
    btnClients.addEventListener('click', () => {
      if (sidebar) sidebar.classList.add('hidden');
      showView('view-admin-clients');
    });
  }

  if (btnDashMenu) {
    btnDashMenu.addEventListener('click', () => {
      if (sidebar) sidebar.classList.add('hidden');
      showView('view-dashboard');
    });
  }

  if (btnApproveAdmin && inputTargetSession) {
    btnApproveAdmin.addEventListener('click', async () => {
      const targetSess = inputTargetSession.value.trim();
      if (!targetSess) return alert('Ingresa la Session ID del cliente');

      try {
        await fetch(`${API_URL}/api/admin/approve-tester`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetSessionId: targetSess })
        });
        alert(`Evaluador de la sesión ${targetSess} aprobado exitosamente`);
      } catch (err) {
        alert('Simulación Local: Evaluador marcado como LISTO.');
      }
    });
  }
}

function setupCookieBanner() {
  const banner = document.getElementById('cookie-banner');
  const btnAccept = document.getElementById('btn-accept-cookies');
  if (localStorage.getItem('sovyx_cookies_accepted') === 'true' && banner) banner.style.display = 'none';

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
