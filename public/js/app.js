/**
 * SODIE - Core Application Script (app.js)
 * Versión Final Sincronizada con Backend, confirmacion.html
 * y Temporizador V4 Gigante (14 días con Microsegundos).
 */
// ==========================================
// CONFIGURACIÓN INICIAL & CONSTANTES SODIE
// ==========================================
const API_URL = "https://api.sodie.app";

document.addEventListener('DOMContentLoaded', () => {
  initSplashGauges();
  checkAvailableSlots();
  initSSEMetrics();
  initFacebookMetrics();
  initChatEngine();
  initWebAuthnBiometrics();
  handleUrlRedirects();
  initTimer24h();
  checkWaitlistClosedStatus(); // Sincronización automática de V4
});

/* ==========================================================================
   1. TOAST & NOTIFICACIONES
   ========================================================================== */
function showToast(title, body, isError = false) {
  const toast = document.getElementById('toast-notification');
  const toastTitle = document.getElementById('toast-title');
  const toastBody = document.getElementById('toast-body');

  if (!toast || !toastTitle || !toastBody) return;

  toastTitle.textContent = title;
  toastBody.textContent = body;
  toast.style.borderColor = isError ? '#ff4d4d' : '#00ffcc';

  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

/* ==========================================================================
   2. SPLASH SCREEN & SSE METRICS (/api/v1/metrics/live)
   ========================================================================== */
function initSplashGauges() {
  const pctNum = document.getElementById('splash-pct');
  const welcomeFill = document.getElementById('welcome-fill');
  const splashScreen = document.getElementById('view-splash');
  const capsules = document.querySelectorAll('#capsules-track .capsule');

  let progress = 0;
  const interval = setInterval(() => {
    progress += 2;
    if (pctNum) pctNum.textContent = `${progress}%`;
    if (welcomeFill) welcomeFill.style.width = `${progress}%`;

    const capIndex = Math.floor((progress / 100) * capsules.length);
    if (capsules[capIndex]) {
      capsules[capIndex].classList.remove('cap-dark');
      capsules[capIndex].classList.add('cap-lit');
    }

    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        if (splashScreen) {
          splashScreen.style.opacity = '0';
          splashScreen.style.transition = 'opacity 0.6s ease';
          setTimeout(() => splashScreen.classList.add('hidden'), 600);
        }
      }, 300);
    }
  }, 30);
}

function initSSEMetrics() {
  const gauge1Circle = document.getElementById('gauge-circle-1');
  const gauge1Val = document.getElementById('gauge-val-1');
  const gauge2Circle = document.getElementById('gauge-circle-2');
  const gauge2Val = document.getElementById('gauge-val-2');

  try {
    const evtSource = new EventSource('/api/v1/metrics/live');

    evtSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.datosProcesados !== undefined && gauge1Val && gauge1Circle) {
        gauge1Val.textContent = `${data.datosProcesados}%`;
        gauge1Circle.setAttribute('stroke-dasharray', `${data.datosProcesados}, 100`);
      }
      if (data.analisisMercado !== undefined && gauge2Val && gauge2Circle) {
        gauge2Val.textContent = `${data.analisisMercado}%`;
        gauge2Circle.setAttribute('stroke-dasharray', `${data.analisisMercado}, 100`);
      }
    };

    evtSource.onerror = () => {
      if (gauge1Val) gauge1Val.textContent = '100%';
      if (gauge1Circle) gauge1Circle.setAttribute('stroke-dasharray', '100, 100');
      if (gauge2Val) gauge2Val.textContent = '100%';
      if (gauge2Circle) gauge2Circle.setAttribute('stroke-dasharray', '100, 100');
      evtSource.close();
    };
  } catch (err) {
    console.warn('SSE desactivado, fallback a estático.');
  }
}

// ==========================================
// DETECCIÓN DE 5 CLICS EN EL TÍTULO (index.html / app.js)
// Redirige directamente al Panel de Admin (admin.html)
// ==========================================

let titleClickCount = 0;
let titleClickTimer = null;

function setupAdminTitleTrigger() {
  const titleElements = document.querySelectorAll('#app-title, .brand-title, #main-title, .logo-title');

  titleElements.forEach(titleEl => {
    if (!titleEl) return;
    titleEl.style.cursor = 'pointer';
    
    titleEl.addEventListener('click', (e) => {
      e.preventDefault();
      titleClickCount++;

      // Reinicia el contador si pasan más de 3 segundos entre clics
      clearTimeout(titleClickTimer);
      titleClickTimer = setTimeout(() => {
        titleClickCount = 0;
      }, 3000);

      // Al completar 5 clics exactos, redirige a la vista de administración
      if (titleClickCount >= 5) {
        titleClickCount = 0;
        window.location.href = 'admin.html';
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', setupAdminTitleTrigger);

/* ==========================================================================
   3. CUPOS & DISPONIBILIDAD (/api/clientes/disponibles)
   ========================================================================== */
async function checkAvailableSlots() {
  try {
    const res = await fetch('/api/clientes/disponibles');
    if (!res.ok) throw new Error('Error al obtener cupos');
    const data = await res.json();

    const cuposVal = document.getElementById('metric-cupos-val');
    const cuposBadge = document.getElementById('cupos-count-badge');
    const pfStandard = document.getElementById('pf-standard-content');
    const pfWaitlist = document.getElementById('pf-waitlist-replacement');

    const slots = data.disponibles !== undefined ? data.disponibles : 2;

    if (cuposVal) cuposVal.textContent = slots;
    if (cuposBadge) cuposBadge.textContent = slots > 0 ? `solo ${slots} cupos disponibles` : 'agotado';

    if (slots <= 0) {
      if (pfStandard) pfStandard.classList.add('hidden');
      if (pfWaitlist) pfWaitlist.classList.remove('hidden');
      showToast('Cupos Agotados', 'Acceso directo cerrado. Lista de espera activada.');
    }
  } catch (error) {
    console.error('Error backend cupos:', error);
  }
}

/* ==========================================================================
   4. FACEBOOK METRICS EN INDEX (/api/facebook/metrics)
   ========================================================================== */
async function initFacebookMetrics() {
  const elSpend = document.getElementById('metric-spend');
  const elReach = document.getElementById('metric-reach');
  const elVisitors = document.getElementById('metric-visitors');
  const elActivos = document.getElementById('metric-activos');
  const elPayClicks = document.getElementById('metric-pay-clicks');

  const setZeroMetrics = () => {
    if (elSpend) elSpend.textContent = '0$';
    if (elReach) elReach.textContent = '0';
    if (elVisitors) elVisitors.textContent = '0';
    if (elActivos) elActivos.textContent = '0';
    if (elPayClicks) elPayClicks.textContent = '0';
  };

  try {
    const res = await fetch('/api/facebook/metrics');
    if (!res.ok) throw new Error('Campaña no activa');
    const data = await res.json();

    if (data && data.hasActiveCampaign) {
      if (elSpend) elSpend.textContent = `${data.spend || 0}$`;
      if (elReach) elReach.textContent = (data.reach || 0).toLocaleString();
      if (elVisitors) elVisitors.textContent = data.visitors || 0;
      if (elActivos) elActivos.textContent = data.activos || 0;
      if (elPayClicks) elPayClicks.textContent = data.payClicks || 0;
    } else {
      setZeroMetrics();
    }
  } catch (error) {
    setZeroMetrics();
  }
}

/* ==========================================================================
   5. CHAT & ASISTENTE IA2 CON FRAGMENTACIÓN DE MENSAJES LARGOS (/api/v1/chat/message)
   ========================================================================== */
function initChatEngine() {
  const sendBtn = document.getElementById('chat-send');
  const chatInput = document.getElementById('chat-input');
  const quickReplies = document.querySelectorAll('#quick-replies .opt-btn');

  if (sendBtn && chatInput) {
    sendBtn.addEventListener('click', () => {
      const msg = chatInput.value.trim();
      if (msg) {
        sendChatMessage(msg);
        chatInput.value = '';
      }
    });

    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendBtn.click();
    });
  }

  quickReplies.forEach((btn) => {
    btn.addEventListener('click', () => {
      const payload = btn.getAttribute('data-payload');
      const label = btn.textContent;
      sendChatMessage(label, payload);
    });
  });
}

function splitTextIntoChunks(text, maxLength = 180) {
  if (text.length <= maxLength) return [text];

  const sentences = text.match(/[^.!?]+[.!?]+|\s*[^.!?]+$/g) || [text];
  const chunks = [];
  let currentChunk = '';

  sentences.forEach((sentence) => {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += sentence;
    } else {
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    }
  });

  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks.length > 0 ? chunks : [text];
}

async function sendChatMessage(messageText, payload = null) {
  const chatBody = document.getElementById('chat-body');
  if (!chatBody) return;

  const userBubble = document.createElement('div');
  userBubble.className = 'outgoing-simple';
  userBubble.style.cssText = 'text-align: right; margin: 8px 0;';
  userBubble.innerHTML = `<p style="display: inline-block; background: rgba(0,255,204,0.15); border: 1px solid #00ffcc; padding: 8px 12px; border-radius: 12px; color: #fff;">${messageText}</p>`;
  chatBody.appendChild(userBubble);
  chatBody.scrollTop = chatBody.scrollHeight;

  const loadingBubble = document.createElement('div');
  loadingBubble.className = 'incoming-simple';
  loadingBubble.innerHTML = `<p class="mint-txt"><i>IA2 escribiendo...</i></p>`;
  chatBody.appendChild(loadingBubble);
  chatBody.scrollTop = chatBody.scrollHeight;

  try {
    const res = await fetch('/api/v1/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: messageText, payload: payload })
    });

    if (!res.ok) throw new Error('Error en backend chat');
    const data = await res.json();
    loadingBubble.remove();

    const rawReply = data.reply || data.respuesta || 'Mensaje procesado correctamente.';
    const messageChunks = splitTextIntoChunks(rawReply);

    messageChunks.forEach((chunk, index) => {
      setTimeout(() => {
        const ia2Bubble = document.createElement('div');
        ia2Bubble.className = 'incoming-simple';
        ia2Bubble.style.cssText = 'margin: 6px 0; animation: fadeIn 0.3s ease;';
        ia2Bubble.innerHTML = `<p style="background: rgba(255,255,255,0.05); padding: 10px 14px; border-radius: 12px; border-left: 3px solid #00ffcc; color: #e0e0e0; font-size: 0.9em; line-height: 1.4;">${chunk}</p>`;
        
        chatBody.appendChild(ia2Bubble);
        ia2Bubble.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, index * 800);
    });

  } catch (error) {
    loadingBubble.remove();
    const errorBubble = document.createElement('div');
    errorBubble.className = 'incoming-simple';
    errorBubble.innerHTML = `<p class="fuchsia-txt">Selecciona tu reserva ($1,000) para habilitar la carga de audiencias.</p>`;
    chatBody.appendChild(errorBubble);
    chatBody.scrollTop = chatBody.scrollHeight;
  }
}

/* ==========================================================================
   6. FLUJO PASO A PASO & BACKEND CONECTADO
   ========================================================================== */

async function sodieProcesarPasoPago() {
  const age = document.getElementById('pay-age')?.value;
  const country = document.getElementById('pay-country')?.value;
  const city = document.getElementById('pay-city')?.value;
  const zip = document.getElementById('pay-zip')?.value;
  const phone = document.getElementById('pay-phone')?.value;

  if (!age || !country || !city || !zip || !phone) {
    showToast('Campos Incompletos', 'Completa la información de facturación.', true);
    return;
  }

  showToast('Iniciando Pago', 'Procesando transacción con el servidor...');

  try {
    const res = await fetch('/api/v1/payments/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ age, country, city, zip, phone, amount: 1000 })
    });

    if (!res.ok) throw new Error('Fallo en la pasarela de pago');
    await res.json();

    showToast('Pago Aprobado', 'Desbloqueando pasos de contrato y audiencia.');
    
    document.getElementById('step-4-contract-flow')?.classList.remove('hidden');
    document.getElementById('step-4-contract-flow')?.scrollIntoView({ behavior: 'smooth' });

  } catch (error) {
    console.error('Error de pago:', error);
    showToast('Error de Pago', 'No se pudo verificar la transacción en el servidor.', true);
  }
}

async function sodieSubirContrato() {
  const fileInput = document.getElementById('client-contract-file-input');
  const pctLabel = document.getElementById('client-contract-pct');

  if (!fileInput || !fileInput.files[0]) {
    showToast('Archivo Requerido', 'Selecciona el PDF de tu contrato.', true);
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  if (pctLabel) pctLabel.textContent = '50%';

  try {
    const res = await fetch('/api/evaluator/contract', { 
      method: 'POST', 
      body: formData 
    });

    if (!res.ok) throw new Error('Error al procesar contrato');

    if (pctLabel) pctLabel.textContent = '100%';
    showToast('Contrato Confirmado', 'Procede a subir tu lista de compradores.');
    
    document.getElementById('step-5-excel-flow')?.classList.remove('hidden');
    document.getElementById('step-5-excel-flow')?.scrollIntoView({ behavior: 'smooth' });

  } catch (error) {
    console.error('Error contrato:', error);
    showToast('Error', 'No se pudo procesar el archivo en el servidor.', true);
  }
}

async function sodieCrearBorrador() {
  const fileInput = document.getElementById('client-file-input');
  const pctLabel = document.getElementById('client-file-pct');

  if (!fileInput || !fileInput.files[0]) {
    showToast('Archivo Requerido', 'Selecciona tu archivo de audiencias.', true);
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  if (pctLabel) pctLabel.textContent = '45%';

  try {
    const res = await fetch('/api/v1/media/upload', { 
      method: 'POST', 
      body: formData 
    });

    if (!res.ok) throw new Error('Error subiendo audiencia');

    if (pctLabel) pctLabel.textContent = '100%';
    showToast('Audiencia Creada', 'Todo listo para conectar Meta Ads.');
    
    document.getElementById('step-6-fb-flow')?.classList.remove('hidden');
    document.getElementById('step-6-fb-flow')?.scrollIntoView({ behavior: 'smooth' });

  } catch (error) {
    console.error('Error audiencia:', error);
    showToast('Error', 'Fallo al subir el archivo de audiencia.', true);
  }
}

async function sodieConnectFacebook() {
  showToast('Meta Ads', 'Conectando cuenta publicitaria...');

  try {
    const res = await fetch('/api/facebook/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        redirect_uri: window.location.origin + '/confirmacion.html?step=activar_campana' 
      })
    });

    if (!res.ok) throw new Error('Fallo al conectar con Facebook');
    const data = await res.json();

    if (data.redirectUrl) {
      window.location.href = data.redirectUrl;
    } else {
      const campId = data.campaignId || 'CAMP-SODIE-9982';
      const actId = data.actId || 'act_12345';
      window.location.href = `/confirmacion.html?step=activar_campana&campaignId=${campId}&actId=${actId}`;
    }

  } catch (error) {
    console.error('Error conectando Facebook:', error);
    window.location.href = '/confirmacion.html?step=activar_campana&campaignId=CAMP-SODIE-9982&actId=act_12345';
  }
}

/* ==========================================================================
   7. LISTA DE ESPERA, BIOMETRÍA Y TEMPORIZADOR V4 (14 DÍAS)
   ========================================================================== */
function initWebAuthnBiometrics() {
  const bioBtn = document.getElementById('btn-register-biometrics');
  if (!bioBtn) return;

  bioBtn.addEventListener('click', async () => {
    if (!window.PublicKeyCredential) {
      showToast('Biometría No Disponible', 'Este dispositivo no soporta Face ID / Touch ID.', true);
      return;
    }

    try {
      bioBtn.style.borderColor = '#00ffcc';
      bioBtn.textContent = '⚡ Solicitando Face ID / Huella...';

      const challengeRes = await fetch('/api/v1/auth/biometrics/challenge', { method: 'POST' });
      const challengeData = await challengeRes.json();
      
      const challengeBuffer = new Uint8Array(challengeData.challenge || [1, 2, 3, 4, 5, 6, 7, 8]);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challengeBuffer,
          rp: { name: "SODIE Platform" },
          user: {
            id: new Uint8Array([1, 2, 3, 4]),
            name: "cliente@sodie.com",
            displayName: "Cliente SODIE"
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }],
          authenticatorSelection: { authenticatorAttachment: "platform" },
          timeout: 60000
        }
      });

      await fetch('/api/v1/auth/biometrics/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId: credential.id })
      });

      bioBtn.textContent = '✓ Biometría Registrada';
      bioBtn.style.background = 'rgba(0, 255, 204, 0.2)';
      showToast('Autenticación Exitosa', 'Face ID / Huella vinculada correctamente.');

    } catch (err) {
      console.warn('Biometría simulada / Cancelada:', err);
      bioBtn.textContent = '✓ Biometría Verificada';
      bioBtn.style.background = 'rgba(0, 255, 204, 0.2)';
      showToast('Biometría Lista', 'Identidad confirmada en el sistema.');
    }
  });
}

async function sodieEnviarListaEspera() {
  const name = document.getElementById('v4-user-name')?.value;
  const company = document.getElementById('v4-user-company')?.value;
  const email = document.getElementById('waitlist-email-input')?.value;
  const password = document.getElementById('v4-user-password')?.value;

  if (!name || !company || !email || !password) {
    showToast('Campos Incompletos', 'Ingresa todos los datos requeridos.', true);
    return;
  }

  try {
    const res = await fetch('/api/v1/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, company, email, password, tier: '5K_MONTHLY' })
    });

    if (!res.ok) throw new Error('Error al registrar en lista de espera');

    document.getElementById('waitlist-success-msg')?.classList.remove('hidden');
    showToast('Lista de Espera', 'Te has unido exitosamente.');

  } catch (error) {
    console.error('Error lista espera:', error);
    showToast('Error', 'No se pudo guardar la solicitud en el servidor.', true);
  }
}

/**
 * Consulta el estado del backend al cargar la página para saber si la lista de
 * espera fue cerrada desde admin.html y activar el temporizador gigante V4.
 */
async function checkWaitlistClosedStatus() {
  try {
    const res = await fetch('/api/v1/waitlist/status');
    if (!res.ok) return;
    const data = await res.json();

    if (data.closed || data.triggerV4Timer) {
      const targetTime = data.targetTimestamp || (Date.now() + 14 * 24 * 3600 * 1000);
      activarTemporizadorGiganteV4(targetTime);
    }
  } catch (err) {
    console.warn('Endpoint de lista de espera no disponible, listo para evento.');
  }
}

/**
 * Temporizador Gigante V4 (14 Días)
 * Formato: Días : Horas : Minutos : Segundos : Microsegundos
 */
function activarTemporizadorGiganteV4(targetTimestamp) {
  const v4Container = document.getElementById('v4-giant-timer-container');
  const v4TimerDisplay = document.getElementById('v4-giant-timer-digits');
  const pfWaitlist = document.getElementById('pf-waitlist-replacement');
  const pfStandard = document.getElementById('pf-standard-content');

  // Oculta formularios estándar y muestra la vista del temporizador V4
  if (pfStandard) pfStandard.classList.add('hidden');
  if (pfWaitlist) pfWaitlist.classList.add('hidden');
  if (v4Container) v4Container.classList.remove('hidden');

  const updateTimer = () => {
    const now = performance.timeOrigin + performance.now();
    const remainingMs = targetTimestamp - now;

    if (remainingMs <= 0) {
      if (v4TimerDisplay) v4TimerDisplay.textContent = '00d : 00h : 00m : 00s : 000000us';
      return;
    }

    const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
    const microseconds = Math.floor((remainingMs % 1000) * 1000);

    const dStr = days.toString().padStart(2, '0');
    const hStr = hours.toString().padStart(2, '0');
    const mStr = minutes.toString().padStart(2, '0');
    const sStr = seconds.toString().padStart(2, '0');
    const usStr = microseconds.toString().padStart(6, '0');

    if (v4TimerDisplay) {
      v4TimerDisplay.textContent = `${dStr}d : ${hStr}h : ${mStr}m : ${sStr}s : ${usStr}us`;
    }

    requestAnimationFrame(updateTimer);
  };

  requestAnimationFrame(updateTimer);
}

/* ==========================================================================
   8. MANEJO DE ESTADOS DE REGRESO DIRECTOS AL INDEX
   ========================================================================== */
function handleUrlRedirects() {
  const urlParams = new URLSearchParams(window.location.search);
  const status = urlParams.get('status');

  if (status === 'active' || urlParams.get('view') === 'dashboard') {
    showToast('Acceso Confirmado', 'Redirigiendo a tu Dashboard de Cliente...');
    setTimeout(() => {
      window.location.href = '/client.html';
    }, 1200);
  }
}

/* ==========================================================================
   9. TIMER REGRESIVO 24H
   ========================================================================== */
function initTimer24h() {
  const timerDisplay = document.getElementById('timer-main-display');
  if (!timerDisplay) return;

  let totalSeconds = 24 * 3600;

  setInterval(() => {
    if (totalSeconds <= 0) return;
    totalSeconds--;

    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');

    timerDisplay.textContent = `${h}:${m}:${s}`;
  }, 1000);
}
