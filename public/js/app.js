/**
 * SODIE - Core Application Script (app.js)
 * Versión V4: Auto-Slider, Motor Numérico IA3, Dual Video & Bypass Automático ADMIN
 */

function getBaseUrl() {
  if (window.SODIE_CONFIG && window.SODIE_CONFIG.API_URL) {
    return window.SODIE_CONFIG.API_URL.replace(/\/$/, '');
  }
  return window.location.origin;
}

window.CLIENT_STATE = {
  clientId: localStorage.getItem('sodie_active_client_id') || 'CLIENT-#01',
  isAdmin: false,
  excelUploaded: false,
  connected: false,
  status: 'PENDING'
};

let currentPaymentState = {
  hours: 0,
  currentStep: 1,
  blocks: []
};

document.addEventListener('DOMContentLoaded', () => {
  detectAndApplyAdminSession();
  initSplashGauges();
  checkAvailableSlots();
  initSSEMetrics();
  initFacebookMetrics();
  initChatEngine();
  initIA3Engine();
  initTimer30d();
  initPaymentFlowEvents();
  initWaitlistEvents();
  initVideoAndConfirm();
  initNuevosComponentesV4();
  initMetricsAutoSlider();
  initIA3ModalObserver();
});

/* ==========================================================================
   0. DETECCIÓN AUTOMÁTICA DE SESIÓN ADMIN (SALTO DE PAGO DIRECTO A PASOS)
   ========================================================================== */
function isAdminAuthenticated() {
  const urlParams = new URLSearchParams(window.location.search);
  return (
    sessionStorage.getItem('sodie_admin_session') === 'active' ||
    localStorage.getItem('sodie_admin_session') === 'active' ||
    localStorage.getItem('sodie_admin_bypass') === 'true' ||
    urlParams.get('admin') === 'true'
  );
}

function detectAndApplyAdminSession() {
  if (!isAdminAuthenticated()) return;

  window.CLIENT_STATE.clientId = 'ADMIN';
  window.CLIENT_STATE.isAdmin = true;
  window.CLIENT_STATE.connected = true;
  window.CLIENT_STATE.status = 'ACTIVE';
  localStorage.setItem('sodie_active_client_id', 'ADMIN');

  const introCard = document.getElementById('pf-intro-card');
  const iframeBox = document.getElementById('pf-step-iframe');
  const stepExcel = document.getElementById('pf-step-excel');
  const pfActive = document.getElementById('pf-active-payment-flow');
  const pfWaitlist = document.getElementById('pf-waitlist-block');

  // Asegura que el contenedor principal esté activo aunque haya 0 cupos para clientes
  if (pfActive) pfActive.classList.remove('hidden');
  if (pfWaitlist) pfWaitlist.classList.add('hidden');

  // Salta la pasarela de pago y habilita de inmediato el Paso 1 post-pago
  if (introCard) introCard.classList.add('hidden');
  if (iframeBox) iframeBox.classList.add('hidden');
  if (stepExcel) stepExcel.classList.remove('hidden');

  console.log('👑 [SODIE V4] Sesión ADMIN detectada automáticamente. Paso de pago omitido (ID: ADMIN).');
}

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

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

/* ==========================================================================
   2. SPLASH SCREEN & GAUGES HUD
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

    if (pctNum) pctNum.textContent = `${progress}%`;
    if (welcomeFill) {
      welcomeFill.style.width = `${progress}%`;
      welcomeFill.style.height = `${progress}%`;
    }

    if (gauge1Val) gauge1Val.textContent = `${progress}%`;
    if (gauge1Circle) gauge1Circle.setAttribute('stroke-dasharray', `${progress}, 100`);

    if (gauge2Val) gauge2Val.textContent = `${progress}%`;
    if (gauge2Circle) gauge2Circle.setAttribute('stroke-dasharray', `${progress}, 100`);

    const capIndex = Math.floor((progress / 100) * totalCaps);
    for (let i = 0; i < capIndex && i < totalCaps; i++) {
      if (capsules[i] && !capsules[i].classList.contains('cap-lit')) {
        capsules[i].classList.remove('cap-dark');
        capsules[i].classList.add('cap-lit');

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
  let slots = 4;
  try {
    const res = await fetch(`${getBaseUrl()}/api/clientes/disponibles`);
    if (res.ok) {
      const data = await res.json();
      const parsed = parseInt(data.disponibles, 10);
      if (!isNaN(parsed)) slots = parsed;
    }
  } catch (error) {
    slots = 4;
  }
  actualizarInterfazCupos(slots);
}

function actualizarInterfazCupos(slots) {
  const cuposVal = document.getElementById('metric-cupos-val');
  const cuposSub = document.getElementById('metric-cupos-sub');
  const cuposBadge = document.getElementById('cupos-count-badge');
  const pfActive = document.getElementById('pf-active-payment-flow');
  const pfWaitlist = document.getElementById('pf-waitlist-block');

  if (cuposVal) {
    cuposVal.textContent = slots;
    animateValue(cuposVal, slots, { duration: 1200, decimals: 0 });
  }

  // Si es ADMIN, nunca se le bloquea el flujo aunque haya 0 cupos
  if (window.CLIENT_STATE && window.CLIENT_STATE.isAdmin) {
    if (cuposBadge) cuposBadge.textContent = `MODO ADMIN (${slots} cupos públicos)`;
    if (pfActive) pfActive.classList.remove('hidden');
    if (pfWaitlist) pfWaitlist.classList.add('hidden');
    return;
  }

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
    animateDashboardMetrics();
  };

  try {
    let visitasAcumuladas = parseInt(localStorage.getItem('sodie_visitas_counter') || '0', 10);
    visitasAcumuladas++;
    localStorage.setItem('sodie_visitas_counter', visitasAcumuladas);

    const cacheMetricas = sessionStorage.getItem('sodie_cached_metrics');
    const ultimaConsultaVisita = parseInt(localStorage.getItem('sodie_ultima_consulta_en') || '0', 10);

    if (cacheMetricas && (visitasAcumuladas - ultimaConsultaVisita < 50)) {
      const data = JSON.parse(cacheMetricas);
      renderizarDatosEnPantalla(data, { elSpend, elSpendStatus, elReach, elReachStatus, elVisitors, elActivos, elPayClicks });
      return;
    }

    const res = await fetch(`${getBaseUrl()}/api/facebook/metrics?clientId=ADMIN`);
    if (!res.ok) throw new Error('Campaña no activa');
    const data = await res.json();

    if (data && data.hasActiveCampaign) {
      sessionStorage.setItem('sodie_cached_metrics', JSON.stringify(data));
      localStorage.setItem('sodie_ultima_consulta_en', visitasAcumuladas);

      renderizarDatosEnPantalla(data, { elSpend, elSpendStatus, elReach, elReachStatus, elVisitors, elActivos, elPayClicks });
    } else {
      setZeroMetrics();
    }
  } catch (error) {
    const cacheFallback = sessionStorage.getItem('sodie_cached_metrics');
    if (cacheFallback) {
      const data = JSON.parse(cacheFallback);
      renderizarDatosEnPantalla(data, { elSpend, elSpendStatus, elReach, elReachStatus, elVisitors, elActivos, elPayClicks });
    } else {
      setZeroMetrics();
    }
  }
}

function renderizarDatosEnPantalla(data, els) {
  if (els.elSpend) els.elSpend.textContent = `$${data.spend || 0}`;
  if (els.elSpendStatus) els.elSpendStatus.textContent = 'Conectado Meta Ads';
  if (els.elReach) els.elReach.textContent = (data.reach || 0).toLocaleString('en-US');
  if (els.elReachStatus) els.elReachStatus.textContent = (data.impressions || 0).toLocaleString('en-US');
  if (els.elVisitors) els.elVisitors.textContent = data.visitors || 0;
  if (els.elActivos) els.elActivos.textContent = data.activos || 0;
  if (els.elPayClicks) els.elPayClicks.textContent = data.payClicks || 0;

  animateDashboardMetrics();
}

/* ==========================================================================
   5. CHAT & ASISTENTE IA2
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

    const rawMessages = data.messages || [data.reply || data.respuesta || 'Mensaje procesado correctamente.'];

    let totalDelay = 0;
    rawMessages.forEach((msgBlock) => {
      const messageChunks = splitTextIntoChunks(msgBlock);

      messageChunks.forEach((chunk) => {
        const currentDelay = totalDelay;
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
        }, currentDelay);

        totalDelay += 800;
      });
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
   6. IA3 ANALYZER ENGINE + VISTA PREVIA EN TIEMPO REAL
   ========================================================================== */
function triggerIA3ArrowProgress() {
  const arrowFill = document.getElementById('ia3-arrow-fill');
  if (arrowFill) {
    arrowFill.style.width = '0%';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        arrowFill.style.width = '100%';
      });
    });
  }
}

function initIA3Engine() {
  const spendInput = document.getElementById('ia3-ad-spend');
  const roasInput = document.getElementById('ia3-roas');
  const inlinePreview = document.getElementById('ia3-inline-savings-preview');
  const btnAnalizar = document.getElementById('btn-ia3-analizar');

  // Actualiza la vista previa de ahorro en vivo mientras el usuario escribe
  const updateInlinePreview = () => {
    if (!inlinePreview) return;
    const spendVal = parseFloat(spendInput?.value || '0');
    const roasVal = parseFloat(roasInput?.value || '1.5');
    if (spendVal > 0) {
      const monthlySpend = spendVal * 30;
      const estimatedRetained = Math.round(monthlySpend * Math.max(0.45, Math.min(1.25, (3.0 - Math.min(roasVal, 2.5)))));
      inlinePreview.innerHTML = `$${estimatedRetained.toLocaleString('en-US')} <small style="font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; color: #c0b4d8;">USD/mes retenidos</small>`;
    }
  };

  if (spendInput) spendInput.addEventListener('input', updateInlinePreview);
  if (roasInput) roasInput.addEventListener('input', updateInlinePreview);

  if (!btnAnalizar) return;

  btnAnalizar.addEventListener('click', async () => {
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

    if (modal) {
      modal.classList.remove('hidden');
      modal.scrollTop = 0;
    }

    triggerIA3ArrowProgress();

    if (valUser) valUser.innerText = `$${spend} USD / ROAS ${roas}`;
    if (valProblems) valProblems.innerText = 'Analizando fuga de capital publicitario...';
    if (valSolution) valSolution.innerText = 'IA3 procesando solución algorítmica...';
    if (valSavings) valSavings.innerText = 'Calculando optimización...';

    showToast('Procesando IA3', 'Analizando métricas con el backend...', false);

    try {
      const res = await fetch(`${getBaseUrl()}/api/ia3/analizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adSpend: spend, roas: roas })
      });

      if (!res.ok) throw new Error('Error al conectar con la IA3');

      const data = await res.json();

      if (valProblems) valProblems.innerText = data.problemas || data.problems;
      if (valSolution) valSolution.innerHTML = data.solucion || data.solution;
      if (valSavings) valSavings.innerText = data.ahorro || data.savings;

      if (modal) {
        animateIA3DiagnosticNumbers(modal);
      }

      showToast('Análisis IA3 Listo', 'El diagnóstico se ha generado correctamente.');

    } catch (error) {
      console.error(error);
      if (valSolution) valSolution.innerText = 'Error en el servidor al generar diagnóstico IA3.';
      showToast('Error IA3', 'No se pudo obtener la respuesta del backend de IA3.', true);
    }
  });

  const closeBtn = document.getElementById('btn-close-ia3-modal');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const modal = document.getElementById('ia3-modal-result');
      if (modal) modal.classList.add('hidden');
    });
  }

  const btnChat = document.getElementById('btn-scroll-chat-ia3');
  if (btnChat) {
    btnChat.addEventListener('click', () => {
      document.getElementById('ia3-modal-result')?.classList.add('hidden');
      document.getElementById('chat-section-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

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
function desplegarIframePago() {
  // Si es ADMIN, salta el iframe directo al Paso 1 de segmentación
  if (window.CLIENT_STATE && window.CLIENT_STATE.isAdmin) {
    detectAndApplyAdminSession();
    return;
  }

  const introCard = document.getElementById('pf-intro-card');
  const iframeBox = document.getElementById('pf-step-iframe');

  if (introCard) introCard.classList.add('hidden');
  if (iframeBox) iframeBox.classList.remove('hidden');
}

function finalizarYConfirmar(event) {
  const fileInput = document.getElementById('client-file-input');
  if (fileInput) {
    if (!fileInput.files || fileInput.files.length === 0) {
      alert('Por favor selecciona tu archivo Excel antes de continuar.');
      return;
    }
    window.location.href = 'confirmacion.html?step=excel_and_fb';
    return;
  }

  // En el flujo de inputs de segmentación (V4), delega a ejecutarBotonSODIE
  if (typeof window.ejecutarBotonSODIE === 'function') {
    window.ejecutarBotonSODIE(event, 'cargar-excel');
  }
}

function initPaymentFlowEvents() {
  const pfCard = document.getElementById('pf-card');
  if (pfCard) {
    pfCard.addEventListener('click', () => {
      document.querySelectorAll('.pf-card').forEach(c => c.classList.remove('active-card'));
      pfCard.classList.add('active-card');
    });
  }

  // 1. Botón principal de pago
  const btnProcesarPago = document.getElementById('btn-procesar-pago-pasarela');
  if (btnProcesarPago) {
    btnProcesarPago.addEventListener('click', (e) => {
      e.preventDefault();
      desplegarIframePago();
    });
  }
  
  // 2. Botón de guardar / cargar segmentación (si no tiene onclick inline)
  const btnClientUploadFile = document.getElementById('btn-client-upload-file');
  if (btnClientUploadFile && !btnClientUploadFile.getAttribute('onclick')) {
    btnClientUploadFile.addEventListener('click', (e) => {
      e.preventDefault();
      finalizarYConfirmar(e);
    });
  }

  // 3. Escuchar el pago y notificar a admin.js
  window.addEventListener('message', (event) => {
    if (event.origin && event.origin.includes('nowpayments.io')) {
      if (event.data && (event.data.status === 'finished' || event.data.paymentStatus === 'confirmed' || event.data.type === 'PAYMENT_SUCCESS')) {
        const paymentNotif = {
          id: `PAY-${Date.now()}`,
          clientId: window.CLIENT_STATE?.clientId || localStorage.getItem('sodie_active_client_id') || 'NUEVO-CLIENTE',
          amount: event.data.price_amount ? `$${event.data.price_amount} USDC` : '$50,000 USDC',
          network: event.data.pay_currency ? event.data.pay_currency.toUpperCase() : 'NOWPayments',
          status: 'CONFIRMADO',
          timestamp: new Date().toLocaleString('es-VE')
        };

        // Guarda en localStorage para que admin.html lo cargue al instante (y dispare el evento 'storage' en vivo)
        const existing = JSON.parse(localStorage.getItem('sodie_admin_payment_notifications') || '[]');
        existing.unshift(paymentNotif);
        localStorage.setItem('sodie_admin_payment_notifications', JSON.stringify(existing.slice(0, 30)));

        // Notificación opcional al backend (no bloquea la redirección si aún no existe la ruta)
        fetch(`${getBaseUrl()}/api/admin/payment-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(paymentNotif)
        }).catch(() => {});

        console.log('🎉 ¡Pago exitoso detectado y notificado al Panel Admin!');
        window.location.href = 'confirmacion.html?step=generar_id';
      }
    }
  });

  // 4. Validar estado de contrato/firma o sesión ADMIN
  const urlParams = new URLSearchParams(window.location.search);
  if (
    isAdminAuthenticated() ||
    urlParams.get('status') === 'signed' ||
    localStorage.getItem('sodie_contract_completed') === 'true'
  ) {
    const introCard = document.getElementById('pf-intro-card');
    const iframeBox = document.getElementById('pf-step-iframe');
    const stepExcel = document.getElementById('pf-step-excel');

    if (introCard) introCard.classList.add('hidden');
    if (iframeBox) iframeBox.classList.add('hidden');
    if (stepExcel) stepExcel.classList.remove('hidden');
  }
}

/* ==========================================================================
   8. MANEJO DE LOS 2 VIDEOS DE DEMOSTRACIÓN (video.mp4 y video2.mp4)
   ========================================================================== */
function initVideoAndConfirm() {
  const btnConfirmAction = document.getElementById('btn-confirm-action');
  if (btnConfirmAction) {
    btnConfirmAction.addEventListener('click', () => {
      showToast('Confirmación', 'Procesando confirmación del sistema...');
    });
  }

  const backendUrl = getBaseUrl();

  // Video 1: Demostración en Vivo (video.mp4)
  const demoVideo = document.getElementById('sodie-demo-video');
  const videoSource = document.getElementById('video-source-mp4');
  const playOverlay = document.getElementById('video-play-overlay');

  if (demoVideo && videoSource) {
    const videoUrl1 = `${backendUrl}/video/video.mp4`;
    videoSource.src = videoUrl1;
    demoVideo.src = videoUrl1;
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

  // Video 2: Flujo Post-Pago NOWPayments (video2.mp4)
  const postpayVideo = document.getElementById('sodie-postpay-video');
  const postpaySource = document.getElementById('video-source-postpay-mp4');

  if (postpayVideo && postpaySource) {
    const videoUrl2 = `${backendUrl}/video/video2.mp4`;
    postpaySource.src = videoUrl2;
    postpayVideo.src = videoUrl2;
    postpayVideo.load();
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
        const res = await fetch(`${getBaseUrl()}/api/v1/registro`, {
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
   11. MANEJADORES GLOBALES Y ORQUESTADOR DE BOTONES
   ========================================================================== */
window.onerror = function() { return false; };
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
      case 'cargar-excel': {
        const paises = document.getElementById('sodie-paises')?.value || 'MX, CO';
        const nicho = document.getElementById('sodie-nicho')?.value || 'infoproductos';
        const value = document.getElementById('sodie-value')?.value || '1000';
        const edadMin = document.getElementById('sodie-edad-min')?.value || '22';
        const edadMax = document.getElementById('sodie-edad-max')?.value || '55';

        // Si es ADMIN detectado automáticamente, envía 'ADMIN'; si es cliente, su ID asignado
        const clientId = isAdminAuthenticated()
          ? 'ADMIN'
          : (window.CLIENT_STATE?.clientId || localStorage.getItem('sodie_active_client_id') || 'CLIENT-#01');

        const btn = document.getElementById('btn-client-upload-file') || document.getElementById('btn-client-upload-excel');

        if (btn) btn.textContent = 'Generando Segmentación (72h)...';

        const baseUrl = typeof getBaseUrl === 'function' ? getBaseUrl() : '';
        const response = await fetch(`${baseUrl}/api/v1/segmentacion/procesar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId,
            paises,
            nicho,
            value: parseFloat(value),
            edadMin: parseInt(edadMin),
            edadMax: parseInt(edadMax)
          })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Error al procesar la segmentación.');
        }

        if (window.CLIENT_STATE) {
          window.CLIENT_STATE.excelUploaded = true;
        }

        if (btn) {
          btn.textContent = '✓ Segmentación Activa (72h)';
          btn.style.background = 'rgba(0, 255, 204, 0.2)';
        }

        if (typeof showToast === 'function') {
          showToast('Segmentación Procesada', `Dataset de 200 filas enviado para ${clientId}.`);
        }

        localStorage.setItem(`sodie_last_excel_time_${clientId}`, Date.now().toString());
        console.log('✅ [APP] Segmentación procesada correctamente:', data);

        // Avanza a confirmacion.html conservando el rol (ADMIN o Cliente)
        setTimeout(() => {
          const targetRole = clientId === 'ADMIN' ? '&admin=true&clientId=ADMIN' : `&clientId=${encodeURIComponent(clientId)}`;
          window.location.href = `confirmacion.html?step=excel_and_fb${targetRole}`;
        }, 900);
        break;
      }

      case 'activar-campana': {
        const clientId = isAdminAuthenticated()
          ? 'ADMIN'
          : (window.CLIENT_STATE?.clientId || localStorage.getItem('sodie_active_client_id') || 'CLIENT-#01');

        const payload = {
          clientId: clientId,
          sessionId: `sess_${clientId.toLowerCase()}_${Date.now()}`,
          action: 'activate_campaign',
          timestamp: Date.now()
        };

        const btnActivar = document.getElementById('btn-activar-campana') || document.getElementById('btn-activate');
        if (btnActivar) {
          btnActivar.disabled = true;
          btnActivar.textContent = 'Conectando con Meta Ads...';
        }

        const baseUrl = typeof getBaseUrl === 'function' ? getBaseUrl() : '';

        let response = await fetch(`${baseUrl}/api/v1/connect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('sodie_token') || ''}`
          },
          body: JSON.stringify(payload)
        });

        if (response.status === 401 || response.status === 404) {
          console.warn('⚠️ [APP] Ruta /api/v1/connect no disponible, intentando /api/v1/auth/login...');
          response = await fetch(`${baseUrl}/api/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }

        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(data.error || data.message || 'No se pudo verificar la conexión.');
        }

        if (data.token) {
          localStorage.setItem('sodie_token', data.token);
        }

        if (window.CLIENT_STATE) {
          window.CLIENT_STATE.connected = true;
          window.CLIENT_STATE.status = 'ACTIVE';
        }

        if (btnActivar) {
          btnActivar.disabled = false;
          btnActivar.textContent = '✓ Campaña Activada';
          btnActivar.style.background = 'rgba(0, 255, 204, 0.2)';
        }

        if (typeof showToast === 'function') {
          showToast('Campaña Conectada', `Conexión verificada exitosamente para ${clientId}.`);
        }

        console.log('✅ [APP] Activación/Conexión exitosa:', data);
        break;
      }

      default:
        console.warn(`Acción no reconocida: ${accion}`);
        break;
    }
  } catch (err) {
    console.error(`❌ Error en acción '${accion}':`, err);
    alert(`Ocurrió un error al ejecutar la acción '${accion}': ${err.message || err}`);
  } finally {
    if (elementoBoton && elementoBoton.tagName === 'BUTTON') {
      elementoBoton.disabled = false;
    }
  }
};

/* ==========================================================================
   12. COMPONENTES V4: MODAL AVISO & COOKIES
   ========================================================================== */
function initNuevosComponentesV4() {
  // 1. Modal de Aviso (Oculto por defecto en V4 porque ya soporta Laptop y Móvil)
  const mobileNoticeModal = document.getElementById('mobile-notice-modal');
  const btnCloseMobileNotice = document.getElementById('btn-close-mobile-notice');

  if (mobileNoticeModal) {
    mobileNoticeModal.classList.add('hidden');
    mobileNoticeModal.style.display = 'none';

    if (btnCloseMobileNotice && !btnCloseMobileNotice.dataset.bound) {
      btnCloseMobileNotice.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        mobileNoticeModal.classList.add('hidden');
        mobileNoticeModal.style.display = 'none';
      });
      btnCloseMobileNotice.dataset.bound = 'true';
    }
  }

  // 2. Banner de Cookies
  const cookieBanner = document.getElementById('cookie-consent-banner');
  const btnAcceptCookies = document.getElementById('btn-accept-cookies');

  if (cookieBanner) {
    const cookiesAccepted = localStorage.getItem('cookiesAccepted');
    if (!cookiesAccepted) {
      cookieBanner.classList.remove('hidden');
      cookieBanner.style.display = 'flex';
    } else {
      cookieBanner.classList.add('hidden');
      cookieBanner.style.display = 'none';
    }

    if (btnAcceptCookies && !btnAcceptCookies.dataset.bound) {
      btnAcceptCookies.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        localStorage.setItem('cookiesAccepted', 'true');
        cookieBanner.classList.add('hidden');
        cookieBanner.style.display = 'none';
      });
      btnAcceptCookies.dataset.bound = 'true';
    }
  }
}

/* ==========================================================================
   13. SISTEMA DE MÉTRICAS EN TIEMPO REAL (SSE)
   ========================================================================== */
function initSSEMetrics() {
  if (!window.EventSource) return;

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
      eventSource.close();
    };
  } catch (error) {
    console.warn('No se pudo inicializar la conexión SSE:', error);
  }
}

/* ==========================================================================
   14. AUTO-SLIDER INTELIGENTE PARA MÉTRICAS EN TIEMPO REAL
   ========================================================================== */
function initMetricsAutoSlider() {
  const slider = document.querySelector('.metrics-slider');
  const cards = document.querySelectorAll('.metrics-slider .metric-square');
  const dots = document.querySelectorAll('.slider-dots-indicator .dot');

  if (!slider || cards.length === 0) return;

  let currentIndex = 0;
  let autoSlideInterval = null;
  const SLIDE_DELAY = 2800;

  function updateDots(index) {
    if (!dots.length) return;
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === index % dots.length);
    });
  }

  function slideToNextCard() {
    const firstCard = cards[0];
    const gap = parseFloat(window.getComputedStyle(slider).gap) || 14;
    const stepWidth = firstCard.offsetWidth + gap;
    const maxScrollLeft = slider.scrollWidth - slider.clientWidth;

    if (slider.scrollLeft >= maxScrollLeft - 10) {
      currentIndex = 0;
      slider.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      currentIndex++;
      slider.scrollBy({ left: stepWidth, behavior: 'smooth' });
    }

    updateDots(currentIndex);
  }

  function startAutoSlide() {
    stopAutoSlide();
    autoSlideInterval = setInterval(slideToNextCard, SLIDE_DELAY);
  }

  function stopAutoSlide() {
    if (autoSlideInterval) {
      clearInterval(autoSlideInterval);
      autoSlideInterval = null;
    }
  }

  slider.addEventListener('scroll', () => {
    const firstCard = cards[0];
    const gap = parseFloat(window.getComputedStyle(slider).gap) || 14;
    const stepWidth = firstCard.offsetWidth + gap;
    const approxIndex = Math.round(slider.scrollLeft / stepWidth);
    updateDots(approxIndex);
  }, { passive: true });

  slider.addEventListener('mouseenter', stopAutoSlide);
  slider.addEventListener('mouseleave', startAutoSlide);
  slider.addEventListener('touchstart', stopAutoSlide, { passive: true });
  slider.addEventListener('touchend', startAutoSlide, { passive: true });

  dots.forEach((dot, idx) => {
    dot.addEventListener('click', () => {
      stopAutoSlide();
      const firstCard = cards[0];
      const gap = parseFloat(window.getComputedStyle(slider).gap) || 14;
      currentIndex = idx;
      slider.scrollTo({ left: idx * (firstCard.offsetWidth + gap), behavior: 'smooth' });
      updateDots(currentIndex);
      startAutoSlide();
    });
  });

  startAutoSlide();
}

/* ==========================================================================
   15. MOTOR DE ANIMACIÓN NUMÉRICA (MÉTRICAS + MODAL IA3)
   ========================================================================== */
function easeOutExpo(x) {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

function animateValue(element, targetNumber, options = {}) {
  const {
    duration = 1400,
    prefix = '',
    suffix = '',
    decimals = 0,
    useCommas = true
  } = options;

  const startTime = performance.now();

  function updateFrame(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutExpo(progress);
    const currentVal = targetNumber * eased;

    let formatted = currentVal.toFixed(decimals);
    if (useCommas) {
      const parts = formatted.split('.');
      parts[0] = Number(parts[0]).toLocaleString('en-US');
      formatted = parts.join('.');
    }

    element.textContent = `${prefix}${formatted}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(updateFrame);
    }
  }

  requestAnimationFrame(updateFrame);
}

function animateDashboardMetrics() {
  const metricCards = document.querySelectorAll('.metrics-slider .metric-square');

  metricCards.forEach((card) => {
    const textNodes = card.querySelectorAll('.card-value, span, p, strong, h3, h4, div');
    textNodes.forEach((el) => {
      if (el.children.length > 0) return;
      const rawText = el.textContent.trim();

      const match = rawText.match(/^(\$?)(\d+(?:[.,]\d+)?)$/);
      if (match) {
        const hasDollar = match[1] === '$';
        const cleanNumber = parseFloat(match[2].replace(/,/g, ''));
        const decimals = match[2].includes('.') ? match[2].split('.')[1].length : 0;

        animateValue(el, cleanNumber, {
          duration: 1500,
          prefix: hasDollar ? '$' : '',
          decimals
        });
      }
    });
  });
}

function animateIA3DiagnosticNumbers(modalElement) {
  if (!modalElement) return;

  const textBlocks = modalElement.querySelectorAll('.ia3-val-text, p, span, strong');

  textBlocks.forEach((block) => {
    if (block.querySelector('.ia3-anim-num')) return;
    if (block.children.length > 0 && !block.classList.contains('ia3-val-text')) return;

    const originalHTML = block.innerHTML;

    const parsedHTML = originalHTML
      .replace(/\$([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+(?:\.[0-9]+)?)/g, (full, numStr) => {
        const cleanVal = numStr.replace(/,/g, '');
        const dec = numStr.includes('.') ? numStr.split('.')[1].length : 0;
        return `<span class="ia3-anim-num mint-txt font-bold" data-target="${cleanVal}" data-prefix="$" data-decimals="${dec}">$0</span>`;
      })
      .replace(/(ROAS\s+)([0-9]+(?:\.[0-9]+)?)/gi, (full, label, numStr) => {
        const dec = numStr.includes('.') ? numStr.split('.')[1].length : 1;
        return `${label}<span class="ia3-anim-num fuchsia-txt font-bold" data-target="${numStr}" data-prefix="" data-decimals="${dec}">0.0</span>`;
      });

    if (parsedHTML !== originalHTML) {
      block.innerHTML = parsedHTML;
    }
  });

  const animatedSpans = modalElement.querySelectorAll('.ia3-anim-num');
  animatedSpans.forEach((span) => {
    const target = parseFloat(span.getAttribute('data-target')) || 0;
    const prefix = span.getAttribute('data-prefix') || '';
    const decimals = parseInt(span.getAttribute('data-decimals') || '0', 10);

    animateValue(span, target, {
      duration: 1600,
      prefix,
      decimals,
      useCommas: true
    });
  });
}

function initIA3ModalObserver() {
  const ia3Modal = document.querySelector('.ia3-float-card');
  if (!ia3Modal) return;

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class' && !ia3Modal.classList.contains('hidden')) {
        triggerIA3ArrowProgress();
        animateIA3DiagnosticNumbers(ia3Modal);
      }
    });
  });

  observer.observe(ia3Modal, { attributes: true });
}
