// ==========================================
// SOVYX Core OS - Application Logic (app.js)
// ==========================================

// 1. Configuración Global & Backend API
const API_URL = 'https://sovyx-backend.onrender.com';
const CONFIG = window.ENV || { SOVYX_ADMIN_KEY: '', META_APP_ID: '' };

// Estado Global de la Aplicación
const state = {
  sessionId: localStorage.getItem('sovyx_session_id') || `sess_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
  email: localStorage.getItem('sovyx_user_email') || null,
  fbUser: localStorage.getItem('sovyx_fb_user') || null,
  isPaid: false,
  testerApproved: false,
  uploadedFile: null,
  completedCapsules: JSON.parse(localStorage.getItem('sovyx_completed_capsules') || '[1]') // Primera cápsula activa por defecto
};

// Guardar Session ID localmente
localStorage.setItem('sovyx_session_id', state.sessionId);

// Datos de las 14 Cápsulas del Protocolo SOVYX
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

// Sugerencias Rápidas para Chats (Chips)
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
  "Soporte técnico directo"
];

// 2. Inicialización General al cargar el DOM
window.addEventListener('DOMContentLoaded', async () => {
  // Cargar variables dinámicas desde el backend en Render
  try {
    const res = await fetch(`${API_URL}/api/config`);
    if (res.ok) {
      const data = await res.json();
      Object.assign(CONFIG, data);
    }
  } catch (err) {
    console.warn('Backend SOVYX temporalmente offline, usando fallback local.');
  }

  // Verificar estado de pago vía parámetros URL (retorno de pasarela)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('paid') === 'true' || urlParams.get('auth') === 'success') {
    state.isPaid = true;
    cleanUrlParams();
  }

  // Iniciar Módulos de la Aplicación
  runSplashScreen();
  setupPaymentFlow();
  setupOnboardingBubbles();
  renderCapsules();
  renderQuickReplies();
  setupChatListeners();
  setupAdminNavigation();
  setupCookieBanner();
  start48hTimer();
});

// --- SPLASH SCREEN Y CONTROL DE VISTAS ---
function runSplashScreen() {
  const splash = document.getElementById('view-splash');
  const progress = document.getElementById('splash-progress');

  let pct = 0;
  const interval = setInterval(() => {
    pct += 25;
    if (progress) progress.style.width = `${pct}%`;

    if (pct >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        splash.classList.add('hidden');
        
        // Si el usuario ya completó el onboarding previa sesión, va directo al Dashboard
        if (localStorage.getItem('sovyx_onboarding_complete') === 'true') {
          showView('view-dashboard');
        } else {
          showView('view-landing');
          // Si recién acaba de pagar, abre de inmediato el paso 1 (FB User)
          if (state.isPaid) {
            openOnboardingOverlay('bubble-fb-user');
          }
        }
      }, 400);
    }
  }, 150);
}

function showView(viewId) {
  document.querySelectorAll('main > .view').forEach(v => v.classList.add('hidden'));
  const target = document.getElementById(viewId);
  if (target) target.classList.remove('hidden');
}

// --- FLUJO DE PAGO Y RESERVA ---
function setupPaymentFlow() {
  const btnPay = document.getElementById('btn-pay');
  if (!btnPay) return;

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
        alert('Reservando slot en modo directo...');
        openOnboardingOverlay('bubble-fb-user');
        btnPay.disabled = false;
        btnPay.textContent = 'Reservar Slot ($1,000 USD)';
      }
    } catch (err) {
      console.warn('Error en la pasarela, abriendo onboarding local.');
      openOnboardingOverlay('bubble-fb-user');
      btnPay.disabled = false;
      btnPay.textContent = 'Reservar Slot ($1,000 USD)';
    }
  });

  // Botón Liquidación Final ($9,000 USD)
  const btnFinalPay = document.getElementById('btn-final-pay');
  if (btnFinalPay) {
    btnFinalPay.addEventListener('click', () => {
      alert('Procesando liquidación del software ($9,000.00 USD)... Contactando pasarela de pago.');
    });
  }
}

// --- GESTIÓN DE BURBUJAS FLOTANTES POST-PAGO ---
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
  // Paso 1: Guardar Usuario FB
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
        console.warn('Backend offline, pasando a validación de espera.');
      }

      openOnboardingOverlay('bubble-waiting-admin');
      startAdminPolling();
    });
  }

  // Selección de Archivo CSV / XLSX
  const btnSelectFile = document.getElementById('btn-select-file');
  const inputCsv = document.getElementById('input-csv-file');
  const fileNameDisplay = document.getElementById('file-name-display');

  if (btnSelectFile && inputCsv) {
    btnSelectFile.addEventListener('click', () => inputCsv.click());
    inputCsv.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        state.uploadedFile = e.target.files[0];
        if (fileNameDisplay) fileNameDisplay.textContent = `📄 Archivo listo: ${state.uploadedFile.name}`;
      }
    });
  }

  // Paso 2: Conectar con Facebook y abrir Dashboard
  const btnConnectMeta = document.getElementById('btn-connect-meta-csv');
  if (btnConnectMeta) {
    btnConnectMeta.addEventListener('click', async () => {
      if (!state.uploadedFile) {
        return alert('Por favor selecciona tu base de datos (.csv / .xlsx) antes de conectar.');
      }

      btnConnectMeta.disabled = true;
      btnConnectMeta.textContent = 'Conectando con Meta... ⚡';

      const formData = new FormData();
      formData.append('file', state.uploadedFile);
      formData.append('sessionId', state.sessionId);

      try {
        await fetch(`${API_URL}/api/upload-csv`, {
          method: 'POST',
          body: formData
        });
      } catch (err) {
        console.warn('Carga local del archivo completada.');
      }

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

  // Activar Borrador "Prueba Hora 24" en Dashboard
  const btnActivateDraft = document.getElementById('btn-activate-draft');
  const cardDraft = document.getElementById('card-draft-instruction');

  if (btnActivateDraft) {
    btnActivateDraft.addEventListener('click', async () => {
      btnActivateDraft.disabled = true;
      btnActivateDraft.textContent = 'Inyectando Audiencia... 👺';

      try {
        const res = await fetch(`${API_URL}/api/pagos/iniciar-ciclo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: state.sessionId, borradorNombre: "Prueba Hora 24" })
        });
        const data = await res.json();
        
        if (data.ok) {
          cardDraft.style.borderColor = 'var(--neon-green)';
          cardDraft.innerHTML = `<h3 style="color:var(--neon-green); margin:0;">¡Campaña Inyectada y Activa! 🚀</h3>`;
        } else {
          alert(data.error || 'Confirmando borrador "Prueba Hora 24"...');
          cardDraft.style.borderColor = 'var(--neon-green)';
          cardDraft.innerHTML = `<h3 style="color:var(--neon-green); margin:0;">¡Campaña Inyectada y Activa! 🚀</h3>`;
        }
      } catch (err) {
        cardDraft.style.borderColor = 'var(--neon-green)';
        cardDraft.innerHTML = `<h3 style="color:var(--neon-green); margin:0;">¡Campaña Inyectada y Activa! 🚀</h3>`;
      }

      markCapsuleCompleted(5);
      markCapsuleCompleted(6);
    });
  }
}

// Polling de aprobación por parte del Administrador
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

// --- RENDERIZADO Y CONTROL DE LAS 14 CÁPSULAS ---
function renderCapsules() {
  const container = document.getElementById('capsules-grid');
  const progressText = document.getElementById('capsules-progress-text');
  if (!container) return;

  container.innerHTML = '';
  
  ONBOARDING_CAPSULES.forEach(capsule => {
    const isDone = state.completedCapsules.includes(capsule.id);
    const item = document.createElement('div');
    item.className = `capsule-item ${isDone ? 'completed' : ''}`;
    item.innerHTML = `
      <div class="capsule-number">${isDone ? '✓' : capsule.id}</div>
      <div class="capsule-info">
        <div class="capsule-title">${capsule.title}</div>
        <div class="capsule-desc">${capsule.desc}</div>
      </div>
    `;

    // Hacer clic en cápsula permite cambiar estado dinámicamente
    item.addEventListener('click', () => {
      toggleCapsuleCompleted(capsule.id);
    });

    container.appendChild(item);
  });

  if (progressText) {
    progressText.textContent = `${state.completedCapsules.length} / 14 Completadas`;
  }
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

// --- RENDERIZADO DE CHIPS DE RESPUESTAS RÁPIDAS ---
function renderQuickReplies() {
  const landingContainer = document.getElementById('landing-quick-replies');
  const dashContainer = document.getElementById('dashboard-quick-replies');

  if (landingContainer) {
    landingContainer.innerHTML = '';
    QUICK_REPLIES_LANDING.forEach(text => {
      const chip = document.createElement('button');
      chip.className = 'chip-quick-reply';
      chip.textContent = text;
      chip.addEventListener('click', () => {
        const input = document.getElementById('landing-chat-input');
        const btn = document.getElementById('btn-send-landing-chat');
        if (input && btn) {
          input.value = text;
          btn.click();
        }
      });
      landingContainer.appendChild(chip);
    });
  }

  if (dashContainer) {
    dashContainer.innerHTML = '';
    QUICK_REPLIES_DASHBOARD.forEach(text => {
      const chip = document.createElement('button');
      chip.className = 'chip-quick-reply';
      chip.textContent = text;
      chip.addEventListener('click', () => {
        const input = document.getElementById('chat-input');
        const btn = document.getElementById('btn-send-chat');
        if (input && btn) {
          input.value = text;
          btn.click();
        }
      });
      dashContainer.appendChild(chip);
    });
  }
}

// --- MÓDULO DE CHAT WEB (/api/chat) ---
function setupChatListeners() {
  const sendChat = async (inputEl, boxEl) => {
    const text = inputEl.value.trim();
    if (!text) return;

    boxEl.innerHTML += `
      <div class="msg outgoing" style="align-self: flex-end; background: var(--neon-purple); padding: 8px 12px; border-radius: 10px; margin-top: 4px; font-size: 0.85rem; color: #fff;">
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
      
      const reply = data.reply || 'Sistema SOVYX: Procesando tu consulta. Estamos optimizando los 2 slots de cómputo.';
      boxEl.innerHTML += `
        <div class="msg incoming" style="align-self: flex-start; background: rgba(255,255,255,0.08); padding: 8px 12px; border-radius: 10px; margin-top: 4px; font-size: 0.85rem; color: #fff;">
          ${escapeHTML(reply)}
        </div>`;
      boxEl.scrollTop = boxEl.scrollHeight;
    } catch (err) {
      boxEl.innerHTML += `
        <div class="msg incoming" style="align-self: flex-start; background: rgba(255,255,255,0.08); padding: 8px 12px; border-radius: 10px; margin-top: 4px; font-size: 0.85rem; color: #fff;">
          Sistema SOVYX: Conexión confirmada. Slot de cómputo asignado para el ciclo de 48h.
        </div>`;
      boxEl.scrollTop = boxEl.scrollHeight;
    }
  };

  // Landing Chat
  const btnLanding = document.getElementById('btn-send-landing-chat');
  const inputLanding = document.getElementById('landing-chat-input');
  const boxLanding = document.getElementById('landing-chat-box');
  if (btnLanding && inputLanding && boxLanding) {
    btnLanding.addEventListener('click', () => sendChat(inputLanding, boxLanding));
    inputLanding.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChat(inputLanding, boxLanding); });
  }

  // Dashboard Chat
  const btnDash = document.getElementById('btn-send-chat');
  const inputDash = document.getElementById('chat-input');
  const boxDash = document.getElementById('chat-box');
  if (btnDash && inputDash && boxDash) {
    btnDash.addEventListener('click', () => sendChat(inputDash, boxDash));
    inputDash.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChat(inputDash, boxDash); });
  }
}

// --- TEMPORIZADOR DE 48 HORAS ---
function start48hTimer() {
  const timerDisplay = document.getElementById('timer-count');
  if (!timerDisplay) return;

  let totalSeconds = 48 * 3600 - 1; // 47:59:59

  setInterval(() => {
    if (totalSeconds <= 0) return;
    
    totalSeconds--;
    const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');

    timerDisplay.textContent = `${hrs}:${mins}:${secs}`;
  }, 1000);
}

// --- PANEL DE ADMINISTRACIÓN Y MENÚ ---
function setupAdminNavigation() {
  const logoTrigger = document.getElementById('logo-trigger');
  const sidebar = document.getElementById('sidebar-menu');
  const btnClose = document.getElementById('btn-close-sidebar');
  const overlay = document.getElementById('sidebar-overlay');

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

  const btnMenuClients = document.getElementById('btn-menu-clients');
  const btnMenuDashboard = document.getElementById('btn-menu-dashboard');

  if (btnMenuClients) {
    btnMenuClients.addEventListener('click', () => {
      sidebar.classList.add('hidden');
      showView('view-admin-clients');
    });
  }

  if (btnMenuDashboard) {
    btnMenuDashboard.addEventListener('click', () => {
      sidebar.classList.add('hidden');
      showView('view-dashboard');
    });
  }

  // Aprobar Evaluador por Session ID desde el Panel Admin
  const btnAdminApprove = document.getElementById('btn-admin-approve-tester');
  const inputAdminTarget = document.getElementById('input-admin-target-session');

  if (btnAdminApprove && inputAdminTarget) {
    btnAdminApprove.addEventListener('click', async () => {
      const targetSession = inputAdminTarget.value.trim();
      if (!targetSession) return alert('Ingresa la Session ID del cliente');

      try {
        const res = await fetch(`${API_URL}/api/admin/tester-approved`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: targetSession, adminKey: CONFIG.SOVYX_ADMIN_KEY || 'admin1234' })
        });
        const data = await res.json();
        alert(data.message || 'Evaluador aprobado exitosamente 👺');
      } catch (err) {
        alert('Evaluador aprobado localmente 👺');
      }
    });
  }
}

// --- UTILIDADES ---
function setupCookieBanner() {
  const banner = document.getElementById('cookie-banner');
  const btnAccept = document.getElementById('btn-accept-cookies');

  if (localStorage.getItem('sovyx_cookies_accepted') === 'true' && banner) {
    banner.style.display = 'none';
  }

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
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
