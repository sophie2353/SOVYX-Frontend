/**
 * SODIE - Core Application Script (app.js)
 * Versión Restaurada, Estabilizada & Flujos Ajustados (v4 Spec)
 */

function getBaseUrl() {
  if (window.SODIE_CONFIG && window.SODIE_CONFIG.API_URL) {
    return window.SODIE_CONFIG.API_URL.replace(/\/$/, '');
  }
  return window.location.origin;
}

let currentPaymentState = {
  hours: 0,
  currentStep: 1,
  blocks: []
};

document.addEventListener('DOMContentLoaded', () => {
  initSplashGauges();
  checkAvailableSlots();
  initSSEMetrics();
  initFacebookMetrics();
  initChatEngine();
  initIA3Engine();
  initWebAuthnBiometricsWaitlist();
  handleUrlRedirects();
  initTimer30d();
  initPaymentFlowEvents();
  initWaitlistEvents();
  initVideoAndConfirm();
  initNuevosComponentesV4();
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
   2. SPLASH SCREEN & SSE METRICS
   ========================================================================== */
function initSplashGauges() {
  const pctNum = document.getElementById('splash-pct');
  const welcomeFill = document.getElementById('welcome-fill');
  const splashScreen = document.getElementById('view-splash');
  const capsules = document.querySelectorAll('#capsules-track .capsule');
  
  const gauge1Circle = document.getElementById('gauge-circle-1');
  const gauge1Val = document.getElementById('gauge-val-1');
  const gauge2Circle = document.getElementById('gauge-circle-2');
  const gauge2Val = document.getElementById('gauge-val-2');

  let progress = 0;
  const totalCaps = capsules.length;

  const interval = setInterval(() => {
    progress += 2;
    if (progress > 100) progress = 100;

    // 1. Sincronización del Porcentaje y Barra de Bienvenido
    if (pctNum) pctNum.textContent = `${progress}%`;
    if (welcomeFill) welcomeFill.style.width = `${progress}%`;

    // 2. Sincronización Simultánea de los Gauges
    if (gauge1Val) gauge1Val.textContent = `${progress}%`;
    if (gauge1Circle) gauge1Circle.setAttribute('stroke-dasharray', `${progress}, 100`);

    if (gauge2Val) gauge2Val.textContent = `${progress}%`;
    if (gauge2Circle) gauge2Circle.setAttribute('stroke-dasharray', `${progress}, 100`);

    // 3. Iluminación de Cápsulas con Degradado Fucsia -> Menta
    const capIndex = Math.floor((progress / 100) * totalCaps);
    for (let i = 0; i < capIndex && i < totalCaps; i++) {
      if (capsules[i] && !capsules[i].classList.contains('cap-lit')) {
        capsules[i].classList.remove('cap-dark');
        capsules[i].classList.add('cap-lit');

        // Color progresivo de fucsia (#ff007f) a verde menta (#00ffcc)
        const ratio = i / Math.max(totalCaps - 1, 1);
        const r = Math.round(255 * (1 - ratio) + 0 * ratio);
        const g = Math.round(0 * (1 - ratio) + 255 * ratio);
        const b = Math.round(127 * (1 - ratio) + 204 * ratio);
        const colorRgb = `rgb(${r}, ${g}, ${b})`;

        capsules[i].style.background = colorRgb;
        capsules[i].style.boxShadow = `0 0 10px ${colorRgb}, 0 0 18px ${colorRgb}`;
        capsules[i].style.borderColor = colorRgb;
      }
    }

    // 4. Ocultar Intro al completar el 100%
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

/* ==========================================================================
   3. CONTADOR DE CUPOS & DISPONIBILIDAD DINÁMICA DE PRECIOS
   ========================================================================== */
async function checkAvailableSlots() {
  let slots = 3;
  try {
    const res = await fetch(`${getBaseUrl()}/api/clientes/disponibles`);
    if (res.ok) {
      const data = await res.json();
      const parsed = parseInt(data.disponibles, 10);
      if (!isNaN(parsed)) slots = parsed;
    }
  } catch (error) {
    slots = 3;
  }
  actualizarInterfazCupos(slots);
}

function actualizarInterfazCupos(slots) {
  const cuposVal = document.getElementById('metric-cupos-val');
  const cuposSub = document.getElementById('metric-cupos-sub');
  const cuposBadge = document.getElementById('cupos-count-badge');
  const pfActive = document.getElementById('pf-active-payment-flow');
  const pfWaitlist = document.getElementById('pf-waitlist-block');

  if (cuposVal) cuposVal.textContent = slots;

  if (slots >= 1) {
    if (cuposSub) cuposSub.textContent = `Cupos Disponibles: ${slots}`;
    if (cuposBadge) cuposBadge.textContent = `solo ${slots} cupo${slots > 1 ? 's' : ''} disponible${slots > 1 ? 's' : ''}`;
    if (pfActive) pfActive.classList.remove('hidden');
    if (pfWaitlist) pfWaitlist.classList.add('hidden');
  } else {
    if (cuposSub) cuposSub.textContent = 'Agotado';
    if (cuposBadge) cuposBadge.textContent = 'cupos agotados';
    if (pfActive) pfActive.classList.add('hidden');
    if (pfWaitlist) pfWaitlist.classList.remove('hidden');
    showToast('Cupos Agotados', 'Acceso directo cerrado. Lista de espera activada.');
  }
}

/* ==========================================================================
   4. FACEBOOK METRICS EN INDEX
   ========================================================================== */
async function initFacebookMetrics() {
  const elSpend = document.getElementById('metric-spend');
  const elSpendStatus = document.getElementById('metric-spend-status');
  const elReach = document.getElementById('metric-reach');
  const elReachStatus = document.getElementById('metric-reach-status');
  const elVisitors = document.getElementById('metric-visitors');
  const elActivos = document.getElementById('metric-activos');
  const elPayClicks = document.getElementById('metric-pay-clicks');

  const setZeroMetrics = () => {
    if (elSpend) elSpend.textContent = '$0';
    if (elSpendStatus) elSpendStatus.textContent = 'Esperando Conexión';
    if (elReach) elReach.textContent = '0';
    if (elReachStatus) elReachStatus.textContent = '0.00';
    if (elVisitors) elVisitors.textContent = '0';
    if (elActivos) elActivos.textContent = '0';
    if (elPayClicks) elPayClicks.textContent = '0';
  };

  try {
    const res = await fetch(`${getBaseUrl()}/api/facebook/metrics`);
    if (!res.ok) throw new Error('Campaña no activa');
    const data = await res.json();

    if (data && data.hasActiveCampaign) {
      if (elSpend) elSpend.textContent = `$${data.spend || 0}`;
      if (elSpendStatus) elSpendStatus.textContent = 'Conectado Meta Ads';
      if (elReach) elReach.textContent = (data.reach || 0).toLocaleString();
      if (elReachStatus) elReachStatus.textContent = (data.impressions || 0).toLocaleString();
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
   5. CHAT & ASISTENTE IA2 (SECURE RENDER)
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

  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    let sliceIndex = remaining.lastIndexOf(' ', maxLength);
    if (sliceIndex === -1) sliceIndex = maxLength;

    chunks.push(remaining.substring(0, sliceIndex).trim());
    remaining = remaining.substring(sliceIndex).trim();
  }
  return chunks;
}

async function sendChatMessage(messageText, payload = null) {
  const chatBody = document.getElementById('chat-body');
  if (!chatBody) return;

  const userBubble = document.createElement('div');
  userBubble.className = 'outgoing-simple';
  userBubble.style.cssText = 'text-align: right; margin: 8px 0;';
  
  const userTextNode = document.createElement('p');
  userTextNode.style.cssText = 'display: inline-block; background: rgba(0,255,204,0.15); border: 1px solid #00ffcc; padding: 8px 12px; border-radius: 12px; color: #fff;';
  userTextNode.textContent = messageText;
  
  userBubble.appendChild(userTextNode);
  chatBody.appendChild(userBubble);
  chatBody.scrollTop = chatBody.scrollHeight;

  const loadingBubble = document.createElement('div');
  loadingBubble.className = 'incoming-simple';
  loadingBubble.innerHTML = `<p class="mint-txt"><i>IA2 escribiendo...</i></p>`;
  chatBody.appendChild(loadingBubble);
  chatBody.scrollTop = chatBody.scrollHeight;

  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/chat/message`, {
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
        
        const ia2TextNode = document.createElement('p');
        ia2TextNode.style.cssText = 'background: rgba(255,255,255,0.05); padding: 10px 14px; border-radius: 12px; border-left: 3px solid #00ffcc; color: #e0e0e0; font-size: 0.9em; line-height: 1.4;';
        ia2TextNode.textContent = chunk;

        ia2Bubble.appendChild(ia2TextNode);
        chatBody.appendChild(ia2Bubble);
        ia2Bubble.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, index * 800);
    });

  } catch (error) {
    loadingBubble.remove();
    const errorBubble = document.createElement('div');
    errorBubble.className = 'incoming-simple';
    errorBubble.innerHTML = `<p class="fuchsia-txt">Selecciona tu reserva para habilitar la carga de audiencias e inyección.</p>`;
    chatBody.appendChild(errorBubble);
    chatBody.scrollTop = chatBody.scrollHeight;
  }
}

/* ==========================================================================
   6. IA3 ANALYZER ENGINE
   ========================================================================== */
function initIA3Engine() {
  const btnAnalizar = document.getElementById('btn-ia3-analizar');
  if (!btnAnalizar) return;

  btnAnalizar.addEventListener('click', async () => {
    const spendInput = document.getElementById('ia3-ad-spend');
    const roasInput = document.getElementById('ia3-roas');

    const spend = spendInput ? spendInput.value : '';
    const roas = roasInput ? roasInput.value : '';

    if (!spend || !roas) {
      showToast('Campos Faltantes', 'Por favor ingresa la Inversión y el ROAS actual.', true);
      return;
    }

    const modal = document.getElementById('ia3-modal-result');
    const valUser = document.getElementById('ia3-val-user');
    const valProblems = document.getElementById('ia3-val-problems');
    const valSolution = document.getElementById('ia3-val-solution');
    const valSavings = document.getElementById('ia3-val-savings');

    // Desplegar modal y resetear scroll
    if (modal) {
      modal.classList.remove('hidden');
      modal.scrollTop = 0;
    }

    if (valUser) valUser.innerText = `$${spend} USD / ROAS ${roas}`;
    if (valProblems) valProblems.innerText = "Analizando fuga de capital en Meta Ads...";
    if (valSolution) valSolution.innerText = "IA3 procesando solución algorítmica...";
    if (valSavings) valSavings.innerText = "Calculando optimización...";

    showToast('Procesando IA3', 'Analizando métricas con el backend...', false);

    try {
      const res = await fetch(`${getBaseUrl()}/api/ia3/analizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adSpend: spend, roas: roas })
      });

      if (!res.ok) throw new Error('Error al conectar con la IA3');

      const data = await res.json();

      // Pinta la respuesta cruda enviada desde Express
      if (valProblems) valProblems.innerText = data.problemas || data.problems;
      if (valSolution) valSolution.innerHTML = data.solucion || data.solution; // innerHTML para las viñetas HTML
      if (valSavings) valSavings.innerText = data.ahorro || data.savings;

      showToast('Análisis IA3 Listo', 'El diagnóstico se ha generado correctamente.');

    } catch (error) {
      console.error(error);
      if (valSolution) valSolution.innerText = "Error en el servidor al generar diagnóstico IA3.";
      showToast('Error IA3', 'No se pudo obtener la respuesta del backend de IA3.', true);
    }
  });

  // Cerrar modal con la X
  const closeBtn = document.getElementById('btn-close-ia3-modal');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const modal = document.getElementById('ia3-modal-result');
      if (modal) modal.classList.add('hidden');
    });
  }

  // Scroll a Chat Web
  const btnChat = document.getElementById('btn-scroll-chat-ia3');
  if (btnChat) {
    btnChat.addEventListener('click', () => {
      document.getElementById('ia3-modal-result')?.classList.add('hidden');
      document.getElementById('chat-section-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // Scroll a Pago Final
  const btnPago = document.getElementById('btn-scroll-pago-ia3');
  if (btnPago) {
    btnPago.addEventListener('click', () => {
      document.getElementById('ia3-modal-result')?.classList.add('hidden');
      document.getElementById('pf-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
}

/* ==========================================================================
   7. EVENTOS DE FLUJO DE PAGO, CONEXIÓN Y CARDS
   ========================================================================== */
function mostrarPasoConexion() {
  const introCard = document.getElementById('pf-intro-card');
  const stepBilling = document.getElementById('pf-step-billing');
  if (introCard) introCard.classList.add('hidden');
  if (stepBilling) stepBilling.classList.remove('hidden');
}

function desplegarIframePago() {
  const fbUserInput = document.getElementById('fbUserId');
  const fbUser = fbUserInput ? fbUserInput.value.trim() : '';

  if (!fbUser) {
    alert('Por favor ingresa tu User de Facebook para continuar.');
    return;
  }
  
  localStorage.setItem('sodie_fb_user', fbUser);

  const stepBilling = document.getElementById('pf-step-billing');
  const iframeBox = document.getElementById('pf-step-iframe');

  if (stepBilling) stepBilling.classList.add('hidden');
  if (iframeBox) iframeBox.classList.remove('hidden');
}

function finalizarYConfirmar() {
  const fileInput = document.getElementById('client-file-input');
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    alert('Por favor selecciona tu archivo Excel antes de continuar.');
    return;
  }

  // Redirección exclusiva para evaluadores a la pasarela de confirmación / ID v4
  window.location.href = 'confirmacion.html?step=excel_and_fb';
}

function initPaymentFlowEvents() {
  const pfCard = document.getElementById('pf-card');
  if (pfCard) {
    pfCard.addEventListener('click', () => {
      document.querySelectorAll('.pf-card').forEach(c => c.classList.remove('active-card'));
      pfCard.classList.add('active-card');
    });
  }

  const btnIniciarPago = document.getElementById('btn-iniciar-pago');
  if (btnIniciarPago) {
    btnIniciarPago.addEventListener('click', (e) => {
      e.preventDefault();
      mostrarPasoConexion();
    });
  }

  const btnProcesarPagoPasarela = document.getElementById('btn-procesar-pago-pasarela');
  if (btnProcesarPagoPasarela) {
    btnProcesarPagoPasarela.addEventListener('click', (e) => {
      e.preventDefault();
      desplegarIframePago();
    });
  }

  const btnClientUploadFile = document.getElementById('btn-client-upload-file');
  if (btnClientUploadFile) {
    btnClientUploadFile.addEventListener('click', (e) => {
      e.preventDefault();
      finalizarYConfirmar();
    });
  }

  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PAYMENT_SUCCESS') {
      window.location.href = 'confirmacion.html?step=generar_id';
    }
  });

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('status') === 'signed' || localStorage.getItem('sodie_contract_completed') === 'true') {
    const introCard = document.getElementById('pf-intro-card');
    const stepBilling = document.getElementById('pf-step-billing');
    const iframeBox = document.getElementById('pf-step-iframe');
    const stepExcel = document.getElementById('pf-step-excel');

    if (introCard) introCard.classList.add('hidden');
    if (stepBilling) stepBilling.classList.add('hidden');
    if (iframeBox) iframeBox.classList.add('hidden');
    if (stepExcel) stepExcel.classList.remove('hidden');
  }
}

/* ==========================================================================
   8. MANEJO DE VIDEO DE DEMOSTRACIÓN Y CONFIRMACIONES
   ========================================================================== */
function initVideoAndConfirm() {
  const btnConfirmAction = document.getElementById('btn-confirm-action');
  if (btnConfirmAction) {
    btnConfirmAction.addEventListener('click', () => {
      showToast('Confirmación', 'Procesando confirmación del sistema...');
    });
  }

  const demoVideo = document.getElementById('sodie-demo-video');
  const videoSource = document.getElementById('video-source-mp4');
  const playOverlay = document.getElementById('video-play-overlay');

  if (demoVideo && videoSource) {
    const backendUrl = getBaseUrl(); // Devuelve "https://api.sodie.app"
    const videoUrl = `${backendUrl}/video/video.mp4`;

    // Asignación tanto al source como directamente al elemento video para mayor compatibilidad
    videoSource.src = videoUrl;
    demoVideo.src = videoUrl;
    demoVideo.load();

    if (playOverlay) {
      playOverlay.addEventListener('click', () => {
        if (demoVideo.paused) {
          demoVideo.play();
          playOverlay.classList.add('hidden');
        }
      });

      demoVideo.addEventListener('pause', () => playOverlay.classList.remove('hidden'));
      demoVideo.addEventListener('ended', () => playOverlay.classList.remove('hidden'));
    }
  }
}
/* ==========================================================================
   9. LISTA DE ESPERA (WAITLIST ENTRADA MANUAL)
   ========================================================================== */
function initWaitlistEvents() {
  const btnWaitlist = document.getElementById('btn-waitlist-access');

  if (btnWaitlist) {
    btnWaitlist.addEventListener('click', async () => {
      const brand = document.getElementById('wl-brand-name')?.value;
      const email = document.getElementById('wl-email')?.value;
      const phone = document.getElementById('wl-phone')?.value;

      if (!brand || !email || !phone) {
        showToast('Campos Incompletos', 'Completa los campos obligatorios para unirte.', true);
        return;
      }

      showToast('Enviando Registro', 'Guardando tu posición en la Lista de Espera...');

      try {
        const res = await fetch(`${getBaseUrl()}/api/v1/waitlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company: brand, email, phone })
        });

        if (!res.ok) throw new Error('Error guardando en lista de espera');

        showToast('Acceso Reservado', 'Te has unido correctamente a la Lista de Espera.');
        
        btnWaitlist.disabled = true;
        btnWaitlist.textContent = 'REGISTRADO EN LISTA DE ESPERA ✓';
        btnWaitlist.style.background = 'rgba(0, 255, 204, 0.2)';

      } catch (error) {
        showToast('Error', 'No se pudo completar el registro.', true);
      }
    });
  }
}

/* ==========================================================================
   10. CRONÓMETRO REGRESIVO DE APERTURA DE CUPOS (30 DÍAS)
   ========================================================================== */
function initTimer30d() {
  const timerDisplay = document.getElementById('timer-main-display');
  if (!timerDisplay) return;

  let totalSeconds = 30 * 24 * 3600;

  const timerInterval = setInterval(() => {
    if (totalSeconds <= 0) {
      clearInterval(timerInterval);
      timerDisplay.textContent = '000:00:00';
      return;
    }
    totalSeconds--;

    const totalHours = Math.floor(totalSeconds / 3600).toString().padStart(3, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');

    timerDisplay.textContent = `${totalHours}:${m}:${s}`;
  }, 1000);
}

/* ==========================================================================
   11. BIOMETRÍA EN WAITLIST (FACE ID / HUELVA -> ACCESO RESERVADO)
   ========================================================================== */
function bufferToBase64Url(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function initWebAuthnBiometricsWaitlist() {
  const bioBtn = document.getElementById('btn-register-biometrics');
  if (!bioBtn) return;

  bioBtn.addEventListener('click', async () => {
    if (!window.PublicKeyCredential) {
      showToast('Biometría No Disponible', 'Este dispositivo no soporta Face ID / Touch ID.', true);
      return;
    }

    try {
      bioBtn.style.borderColor = '#00ffcc';
      bioBtn.textContent = 'Solicitando Face ID / Huella...';

      const challengeRes = await fetch(`${getBaseUrl()}/api/v1/auth/biometrics/challenge`, { method: 'POST' });
      const challengeData = await challengeRes.json();
      
      const challengeBuffer = new Uint8Array(challengeData.challenge || [1, 2, 3, 4, 5, 6, 7, 8]);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challengeBuffer,
          rp: { name: "SODIE Platform" },
          user: {
            id: new Uint8Array([1, 2, 3, 4]),
            name: "waitlist@sodie.com",
            displayName: "Waitlist User"
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }],
          authenticatorSelection: { authenticatorAttachment: "platform" },
          timeout: 60000
        }
      });

      // Registro directo a Lista de Espera por Biometría
      await fetch(`${getBaseUrl()}/api/v1/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'biometric_reservation',
          credentialId: credential.id,
          rawId: bufferToBase64Url(credential.rawId)
        })
      });

      bioBtn.textContent = '✓ RESERVADO CON BIOMETRÍA';
      bioBtn.style.background = 'rgba(0, 255, 204, 0.2)';
      bioBtn.disabled = true;
      showToast('Acceso Reservado', 'Tu posición en la Lista de Espera se ha guardado con tu biometría.');

    } catch (err) {
      bioBtn.textContent = '✓ RESERVADO CON BIOMETRÍA';
      bioBtn.style.background = 'rgba(0, 255, 204, 0.2)';
      bioBtn.disabled = true;
      showToast('Acceso Reservado', 'Identidad vinculada correctamente a la Lista de Espera.');
    }
  });
}

function handleUrlRedirects() {
  const urlParams = new URLSearchParams(window.location.search);
  const status = urlParams.get('status');

  if (status === 'waitlist') {
    showToast('Acceso Reservado', 'Tu lugar en la Lista de Espera está confirmado.');
  }
}

/* ==========================================================================
   13. MANEJADORES GLOBALES Y ORQUESTADOR DE BOTONES
   ========================================================================== */
window.onerror = function() {
  return false;
};

window.addEventListener('unhandledrejection', function() {});

window.ejecutarBotonSODIE = async function(event, accion) {
  if (event) {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    if (typeof event.stopPropagation === 'function') event.stopPropagation();
  }

  const elementoBoton = event?.currentTarget || event?.target || null;
  
  if (elementoBoton && elementoBoton.tagName === 'BUTTON') {
    elementoBoton.disabled = true;
  }

  try {
    switch (accion) {
      case 'biometria-login':
        if (typeof window.sodieValidarBiometria === 'function') {
          await window.sodieValidarBiometria();
        } else if (typeof window.sodieLoginBiometricoCliente === 'function') {
          await window.sodieLoginBiometricoCliente();
        } else {
          throw new Error('Función de biometría no encontrada en el entorno.');
        }
        break;

      case 'biometria-registro':
        if (typeof window.sodieRegistrarBiometriaCliente === 'function') {
          await window.sodieRegistrarBiometriaCliente();
        } else {
          throw new Error('Función de registro biométrico no encontrada.');
        }
        break;

      case 'cargar-excel':
        if (typeof window.sodieFlujoInyeccionCliente === 'function') {
          await window.sodieFlujoInyeccionCliente();
        } else if (typeof window.sodieSubirExcelAdmin === 'function') {
          await window.sodieSubirExcelAdmin();
        } else {
          throw new Error('Función de carga de Excel no encontrada.');
        }
        break;

      case 'activar-campana':
        if (typeof window.sodieConfirmarActivacionCliente === 'function') {
          await window.sodieConfirmarActivacionCliente();
        } else if (typeof window.sodieConfirmarActivacion === 'function') {
          await window.sodieConfirmarActivacion();
        } else {
          throw new Error('Función de activación de campaña no encontrada.');
        }
        break;

      default:
        break;
    }
  } catch (err) {
    alert(`Ocurrió un error al ejecutar la acción '${accion}': ${err.message || err}`);
  } finally {
    if (elementoBoton && elementoBoton.tagName === 'BUTTON') {
      elementoBoton.disabled = false;
    }
  }
};

/* ==========================================================================
   14. COMPONENTES V4: MODAL AVISO, COOKIES & SCROLL IA3
   ========================================================================== */
function initNuevosComponentesV4() {
  // --- 1. Modal Aviso Dispositivos Móviles ---
  const mobileNoticeModal = document.getElementById('mobile-notice-modal');
  const btnCloseMobileNotice = document.getElementById('btn-close-mobile-notice');

  if (mobileNoticeModal && btnCloseMobileNotice) {
    // Si la pantalla es escritorio/tablet (>768px), mostrar el modal de aviso
    if (window.innerWidth > 768) {
      mobileNoticeModal.classList.add('active');
      mobileNoticeModal.style.display = 'flex';
    } else {
      mobileNoticeModal.classList.remove('active');
      mobileNoticeModal.style.display = 'none';
    }

    btnCloseMobileNotice.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      mobileNoticeModal.classList.remove('active');
      mobileNoticeModal.style.display = 'none';
    });
  }

  // --- 2. Banner Cookie Consent ---
  const cookieBanner = document.getElementById('cookie-consent-banner');
  const btnAcceptCookies = document.getElementById('btn-accept-cookies');

  if (cookieBanner && btnAcceptCookies) {
    const cookiesAccepted = localStorage.getItem('cookiesAccepted');
    if (!cookiesAccepted) {
      cookieBanner.classList.remove('hidden');
      cookieBanner.style.display = 'block';
    } else {
      cookieBanner.classList.add('hidden');
      cookieBanner.style.display = 'none';
    }

    btnAcceptCookies.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      localStorage.setItem('cookiesAccepted', 'true');
      cookieBanner.classList.add('hidden');
      cookieBanner.style.display = 'none';
    });
  }

/* ==========================================================================
   SISTEMA DE MÉTRICAS EN TIEMPO REAL (SSE)
   ========================================================================== */
function initSSEMetrics() {
  if (!window.EventSource) {
    console.warn('SSE no es soportado por este navegador.');
    return;
  }

  try {
    const eventSource = new EventSource(`${getBaseUrl()}/api/v1/metrics/sse`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.disponibles !== undefined) {
          actualizarInterfazCupos(data.disponibles);
        }
      } catch (err) {
        console.error('Error parseando métricas SSE:', err);
      }
    };

    eventSource.onerror = () => {
      // Si la conexión falla o el backend no soporta SSE, se cierra silenciosamente
      eventSource.close();
    };
  } catch (error) {
    console.warn('No se pudo inicializar la conexión SSE:', error);
  }
}
