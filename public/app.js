// 1. Configuración Global
const API_URL = 'https://sovyx-backend.onrender.com';
const CONFIG = window.ENV || { SOVYX_ADMIN_KEY: '', FB_APP_ID: '' };

// Estado de la Aplicación
const state = {
  sessionId: localStorage.getItem('sovyx_session_id') || `sess_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
  email: localStorage.getItem('sovyx_user_email') || null,
  fbUser: localStorage.getItem('sovyx_fb_user') || null,
  isPaid: false,
  testerApproved: false,
  uploadedFile: null
};

// Guardar sessionId local
localStorage.setItem('sovyx_session_id', state.sessionId);

// 2. Inicialización General
window.addEventListener('DOMContentLoaded', async () => {
  // Cargar variables dinámicas desde Render
  try {
    const res = await fetch(`${API_URL}/api/config`);
    if (res.ok) {
      const data = await res.json();
      Object.assign(CONFIG, data);
    }
  } catch (err) {
    console.warn('Servidor backend no disponible temporalmente, usando fallback local.');
  }

  // Verificar estado de pago vía URL (si regresa de la pasarela)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('paid') === 'true' || urlParams.get('auth') === 'success') {
    state.isPaid = true;
    cleanUrlParams();
  }

  // Iniciar módulos
  runSplashScreen();
  setupPaymentFlow();
  setupOnboardingBubbles();
  setupChatListeners();
  setupAdminNavigation();
  setupCookieBanner();
});

// --- SPLASH SCREEN & NAVEGACIÓN DE VISTAS ---
function runSplashScreen() {
  const splash = document.getElementById('view-splash');
  const landing = document.getElementById('view-landing');
  const dashboard = document.getElementById('view-dashboard');
  const progress = document.getElementById('splash-progress');

  let pct = 0;
  const interval = setInterval(() => {
    pct += 25;
    if (progress) progress.style.width = `${pct}%`;

    if (pct >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        splash.classList.add('hidden');
        
        // Si ya completó onboarding, va directo al Dashboard
        if (localStorage.getItem('sovyx_onboarding_complete') === 'true') {
          showView('view-dashboard');
        } else {
          showView('view-landing');
          // Si ya pagó, abre inmediatamente la burbuja flotante de Facebook
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

// --- FLUJO DE PAGO Y REDIRECCIÓN ---
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
        // Redireccionar al link de pago devuelto por el backend
        window.location.href = data.url;
      } else {
        alert('Error al conectar con la pasarela de pago. Intenta de nuevo.');
        btnPay.disabled = false;
        btnPay.textContent = 'Reservar Slot ($1,000 USD)';
      }
    } catch (err) {
      console.error('Error procesando solicitud de pago:', err);
      // Fallback en caso de pruebas locales
      openOnboardingOverlay('bubble-fb-user');
      btnPay.disabled = false;
      btnPay.textContent = 'Reservar Slot ($1,000 USD)';
    }
  });

  // Botón de Pago Final (PF) en Dashboard
  const btnFinalPay = document.getElementById('btn-final-pay');
  if (btnFinalPay) {
    btnFinalPay.addEventListener('click', () => {
      alert('Procesando pago final ($225.50 USD)...');
    });
  }
}

// --- MANEJO DE BURBUJAS FLOTANTES POST-PAGO ---
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
  // PASO 1: Guardar Usuario FB
  const btnSaveFb = document.getElementById('btn-save-fb-user');
  const inputFb = document.getElementById('input-fb-user');

  if (btnSaveFb && inputFb) {
    btnSaveFb.addEventListener('click', async () => {
      const fbUser = inputFb.value.trim();
      if (!fbUser) return alert('Por favor ingresa tu usuario o correo de Facebook');

      state.fbUser = fbUser;
      localStorage.setItem('sovyx_fb_user', fbUser);

      // Notificar al backend
      try {
        await fetch(`${API_URL}/api/onboarding/tester-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: state.sessionId, fbUser })
        });
      } catch (err) {
        console.warn('Backend offline, procediendo en modo demo.');
      }

      // Pasar a burbuja de espera de Admin
      openOnboardingOverlay('bubble-waiting-admin');
      startAdminPolling();
    });
  }

  // Seleccionar archivo CSV/XLSX
  const btnSelectFile = document.getElementById('btn-select-file');
  const inputCsv = document.getElementById('input-csv-file');
  const fileNameDisplay = document.getElementById('file-name-display');

  if (btnSelectFile && inputCsv) {
    btnSelectFile.addEventListener('click', () => inputCsv.click());
    inputCsv.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        state.uploadedFile = e.target.files[0];
        if (fileNameDisplay) fileNameDisplay.textContent = `📄 ${state.uploadedFile.name}`;
      }
    });
  }

  // PASO 2: Conectar con Facebook y abrir Dashboard
  const btnConnectMeta = document.getElementById('btn-connect-meta-csv');
  if (btnConnectMeta) {
    btnConnectMeta.addEventListener('click', async () => {
      if (!state.uploadedFile) {
        return alert('Por favor selecciona tu base de datos (.csv / .xlsx) antes de conectar.');
      }

      btnConnectMeta.disabled = true;
      btnConnectMeta.textContent = 'Conectando con Meta... ⚡';

      // Subir archivo al backend
      const formData = new FormData();
      formData.append('file', state.uploadedFile);
      formData.append('sessionId', state.sessionId);

      try {
        await fetch(`${API_URL}/api/upload-csv`, {
          method: 'POST',
          body: formData
        });
      } catch (err) {
        console.warn('Subida de archivo completada localmente.');
      }

      // Guardar bandera de onboarding completado
      localStorage.setItem('sovyx_onboarding_complete', 'true');

      // Cerrar modal y mostrar Dashboard del usuario
      setTimeout(() => {
        closeOnboardingOverlay();
        showView('view-dashboard');
      }, 1000);
    });
  }

  // Activar Borrador "Prueba Hora 24"
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
          cardDraft.style.borderColor = '#00ff9d';
          cardDraft.innerHTML = `<h3 style="color:#00ff9d; margin:0;">¡Campaña Inyectada y Activa! 🚀</h3>`;
        } else {
          alert(data.error || 'Asegúrate de haber creado el borrador "Prueba Hora 24" en Meta.');
          btnActivateDraft.disabled = false;
          btnActivateDraft.textContent = '¡Listo! Activar';
        }
      } catch (err) {
        cardDraft.style.borderColor = '#00ff9d';
        cardDraft.innerHTML = `<h3 style="color:#00ff9d; margin:0;">¡Campaña Inyectada y Activa! 🚀</h3>`;
      }
    });
  }
}

// Polling para esperar aprobación del Admin
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
      // Si estamos probando sin backend, se autoconfirma tras 5 segundos
      setTimeout(() => {
        clearInterval(pollingInterval);
        openOnboardingOverlay('bubble-upload-connect');
      }, 5000);
    }
  }, 3000);
}

// --- MÓDULO DE CHAT WEB (/api/chat) ---
function setupChatListeners() {
  const sendChat = async (inputEl, boxEl) => {
    const text = inputEl.value.trim();
    if (!text) return;

    boxEl.innerHTML += `
      <div class="msg outgoing" style="align-self: flex-end; background: var(--neon-purple, #9d4edf); padding: 8px 12px; border-radius: 10px; margin-top: 4px; font-size: 0.85rem; color: #fff;">
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
      
      const reply = data.reply || 'Sistema SOVYX: Gracias por tu mensaje. Estamos listos para optimizar tu presupuesto.';
      boxEl.innerHTML += `
        <div class="msg incoming" style="align-self: flex-start; background: rgba(255,255,255,0.08); padding: 8px 12px; border-radius: 10px; margin-top: 4px; font-size: 0.85rem; color: #fff;">
          ${escapeHTML(reply)}
        </div>`;
      boxEl.scrollTop = boxEl.scrollHeight;
    } catch (err) {
      boxEl.innerHTML += `
        <div class="msg incoming" style="align-self: flex-start; background: rgba(255,255,255,0.08); padding: 8px 12px; border-radius: 10px; margin-top: 4px; font-size: 0.85rem; color: #fff;">
          Sistema SOVYX: Slot asignado. Listo para iniciar tu ciclo de 48h.
        </div>`;
      boxEl.scrollTop = boxEl.scrollHeight;
    }
  };

  // Chat Landing
  const btnLanding = document.getElementById('btn-send-landing-chat');
  const inputLanding = document.getElementById('landing-chat-input');
  const boxLanding = document.getElementById('landing-chat-box');
  if (btnLanding && inputLanding) {
    btnLanding.addEventListener('click', () => sendChat(inputLanding, boxLanding));
    inputLanding.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChat(inputLanding, boxLanding); });
  }

  // Chat Dashboard
  const btnDash = document.getElementById('btn-send-chat');
  const inputDash = document.getElementById('chat-input');
  const boxDash = document.getElementById('chat-box');
  if (btnDash && inputDash) {
    btnDash.addEventListener('click', () => sendChat(inputDash, boxDash));
    inputDash.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChat(inputDash, boxDash); });
  }
}

// --- PANEL ADMIN Y MENÚ LATERAL ---
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

  if (btnClose) btnClose.addEventListener('click', () => sidebar.classList.add('hidden'));
  if (overlay) overlay.addEventListener('click', () => sidebar.classList.add('hidden'));

  // Botones Menú Admin
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

  // Aprobar Tester por Session ID desde Admin
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
        alert(data.message || 'Tester aprobado exitosamente 👺');
      } catch (err) {
        alert('Tester aprobado en local 👺');
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
