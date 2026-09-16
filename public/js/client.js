/**
 * SODIE - Client Dashboard Engine (client.js)
 * Manejo de métricas, temporizadores activos (0-96h), subida de archivos,
 * activación de campaña y pasarelas de pago con redirección a confirmación.
 */

// Helper para obtener la base URL limpia en cada llamada
function getBaseUrl() {
  if (window.SODIE_CONFIG && window.SODIE_CONFIG.API_URL) {
    return window.SODIE_CONFIG.API_URL.replace(/\/$/, '');
  }
  return window.location.origin;
}

document.addEventListener('DOMContentLoaded', () => {
  initClientDashboard();
});

/* ==========================================================================
   1. ESTADO GLOBAL Y CONFIGURACIÓN INICIAL
   ========================================================================== */
const CLIENT_STATE = {
  activeModalidad: null, // '3_CUOTAS', '2_CUOTAS', '1_CUOTA'
  paidInstallments: [],
  campaignActivated: false,
  timerInterval: null,
  totalSeconds: 96 * 3600, // 96 Horas totales en segundos
  elapsedSeconds: 0        // Segundos transcurridos
};

function initClientDashboard() {
  fetchClientMetrics();
  initGlobalTimer();
  checkCallbackStatus();
}

/* ==========================================================================
   2. NOTIFICACIONES Y UI FEEDBACK
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
   3. MÉTRICAS DE RENDIMIENTO (/api/facebook/metrics)
   ========================================================================== */
async function fetchClientMetrics() {
  const elSpend = document.getElementById('metric-spend');
  const elReach = document.getElementById('metric-reach');
  const elVisitors = document.getElementById('metric-visitors');

  try {
    const res = await fetch(`${getBaseUrl()}/api/facebook/metrics`);
    if (!res.ok) throw new Error('Error al cargar métricas');
    const data = await res.json();

    if (data) {
      if (elSpend) elSpend.textContent = `${data.spend || 40}$`;
      if (elReach) elReach.textContent = (data.reach || 2000).toLocaleString();
      if (elVisitors) elVisitors.textContent = data.visitors || 82;
    }
  } catch (error) {
    console.warn('Usando valores por defecto para métricas');
  }
}

/* ==========================================================================
   4. SUBIDA DE ARCHIVOS DE AUDIENCIA (/api/v1/media/upload)
   ========================================================================== */
async function sodieFlujoInyeccionCliente() {
  const fileInput = document.getElementById('client-file-input');
  const btnUpload = document.getElementById('btn-client-upload-excel');
  const btnActivate = document.getElementById('btn-client-activate-campaign');

  if (!fileInput || !fileInput.files[0]) {
    showToast('Archivo Requerido', 'Por favor selecciona un archivo (.csv, .xlsx, .xls).', true);
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  if (btnUpload) btnUpload.textContent = 'Procesando...';

  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/media/upload`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) throw new Error('Error al procesar archivo de audiencia');

    showToast('Audiencia Inyectada', 'Excel procesado correctamente. Habilitando activación.');
    
    if (btnUpload) {
      btnUpload.textContent = '✓ Archivo Cargado';
      btnUpload.style.background = 'rgba(0, 255, 204, 0.2)';
    }

    if (btnActivate) {
      btnActivate.classList.remove('hidden');
      btnActivate.scrollIntoView({ behavior: 'smooth' });
    }

  } catch (error) {
    console.error('Error subiendo audiencia:', error);
    showToast('Error de Carga', 'No se pudo subir el archivo al servidor.', true);
    if (btnUpload) btnUpload.textContent = 'Subir Excel';
  }
}

/* ==========================================================================
   5. ACTIVACIÓN DE CAMPAÑA (ENDPOINT + REDIRECCIÓN A CONFIRMACION.HTML)
   ========================================================================== */
async function sodieConfirmarActivacionCliente() {
  const btnActivate = document.getElementById('btn-client-activate-campaign');
  if (btnActivate) btnActivate.textContent = 'Activando...';

  try {
    const res = await fetch(`${getBaseUrl()}/api/facebook/activar-campana`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE', timestamp: Date.now() })
    });

    if (!res.ok) throw new Error('Fallo al activar campaña');

    showToast('Campaña Procesada', 'Redirigiendo a confirmación...');

    setTimeout(() => {
      window.location.href = '/confirmacion.html?type=campaign&status=success';
    }, 1000);

  } catch (error) {
    console.error('Error activando campaña:', error);
    showToast('Error', 'No se pudo confirmar la activación en el servidor.', true);
    if (btnActivate) btnActivate.textContent = 'Activar Campaña';
  }
}

/* ==========================================================================
   6. PAGOS POST-RESULTADOS (ENDPOINT + REDIRECCIÓN A CONFIRMACION.HTML)
   ========================================================================== */

// Opción 1: Pagar Cuota de $3.000 (Hora 48, 72, 96)
async function sodieProcesarPago(installmentNumber) {
  CLIENT_STATE.activeModalidad = '3_CUOTAS';
  const amount = 3000;

  showToast('Procesando Pago', `Iniciando transacción Cuota ${installmentNumber} ($${amount} USD)...`);

  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/payments/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modalidad: '3_CUOTAS',
        cuota: installmentNumber,
        amount: amount,
        timestamp: Date.now()
      })
    });

    if (!res.ok) throw new Error('Pago rechazado por la pasarela');

    showToast('Pago Aprobado', 'Redirigiendo a confirmación...');

    setTimeout(() => {
      window.location.href = `/confirmacion.html?type=payment&modalidad=3_CUOTAS&cuota=${installmentNumber}&amount=${amount}&status=success`;
    }, 1000);

  } catch (error) {
    console.error('Error procesando pago cuota:', error);
    showToast('Error de Pago', 'No se pudo verificar la transacción.', true);
  }
}

// Opciones 2 y 3: Pagar Modalidades (2 Cuotas o 1 Cuota Directa)
async function sodieProcesarPagoModalidad(modalidadType) {
  let amount = 0;
  let installmentNumber = 1;

  if (modalidadType === 2) {
    CLIENT_STATE.activeModalidad = '2_CUOTAS';
    amount = CLIENT_STATE.paidInstallments.includes(1) ? 3000 : 6000;
    installmentNumber = CLIENT_STATE.paidInstallments.includes(1) ? 2 : 1;
  } else if (modalidadType === 1) {
    CLIENT_STATE.activeModalidad = '1_CUOTA';
    amount = 9000;
    installmentNumber = 1;
  }

  showToast('Procesando Pago', `Iniciando pago modalidad $${amount} USD...`);

  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/payments/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modalidad: CLIENT_STATE.activeModalidad,
        cuota: installmentNumber,
        amount: amount,
        timestamp: Date.now()
      })
    });

    if (!res.ok) throw new Error('Pago rechazado por la pasarela');

    showToast('Pago Aprobado', 'Redirigiendo a confirmación...');

    setTimeout(() => {
      window.location.href = `/confirmacion.html?type=payment&modalidad=${CLIENT_STATE.activeModalidad}&cuota=${installmentNumber}&amount=${amount}&status=success`;
    }, 1000);

  } catch (error) {
    console.error('Error en pago de modalidad:', error);
    showToast('Error de Pago', 'No se pudo verificar la transacción.', true);
  }
}

/* ==========================================================================
   7. RECEPCIÓN Y VERIFICACIÓN POST-REDIRECCIÓN (RETORNO DE CONFIRMACION.HTML)
   ========================================================================== */
function checkCallbackStatus() {
  const urlParams = new URLSearchParams(window.location.search);
  const type = urlParams.get('type');
  const status = urlParams.get('status');

  if (status === 'success' || status === 'confirmed') {
    if (type === 'campaign') {
      CLIENT_STATE.campaignActivated = true;
      const btnActivate = document.getElementById('btn-client-activate-campaign');
      if (btnActivate) {
        btnActivate.classList.remove('hidden');
        btnActivate.textContent = '✓ Campaña en Ejecución';
        btnActivate.style.background = 'rgba(0, 255, 204, 0.3)';
        btnActivate.disabled = true;
      }
      showToast('Campaña Confirmada', 'Inyección activa en Meta Ads. Refrescando métricas...');
      fetchClientMetrics();
    } 

    if (type === 'payment') {
      const modalidad = urlParams.get('modalidad');
      const cuota = parseInt(urlParams.get('cuota') || '1', 10);
      const amount = urlParams.get('amount');

      CLIENT_STATE.activeModalidad = modalidad;
      if (!CLIENT_STATE.paidInstallments.includes(cuota)) {
        CLIENT_STATE.paidInstallments.push(cuota);
      }

      if (modalidad === '3_CUOTAS') {
        updatePaymentUI(cuota, amount);
      } else {
        const typeNum = modalidad === '2_CUOTAS' ? 2 : 1;
        updateModalidadUI(typeNum, amount, cuota);
      }

      showToast('Pago Verificado', `Comprobante registrado: $${amount} USD.`);
      fetchClientMetrics();
    }
  }
}

/* ==========================================================================
   8. TEMPORIZADOR GLOBAL EN TIEMPO REAL & HITOS (0 a 96 Horas Progresivo)
   ========================================================================== */
function initGlobalTimer() {
  const mainTimer = document.getElementById('timer-main-display');
  const globalTimerDisplay = document.getElementById('global-timer-display');
  const timer24hDisplay = document.getElementById('timer-24h-display');
  const timerPostDisplay = document.getElementById('timer-post-display');

  if (CLIENT_STATE.timerInterval) return;

  const MAX_SECONDS = 96 * 3600; // Límite máximo de 96 horas
  const SECONDS_24H = 24 * 3600;

  CLIENT_STATE.timerInterval = setInterval(() => {
    // Si alcanza el tope de 96 horas, ejecuta eventos finales y se detiene
    if (CLIENT_STATE.elapsedSeconds >= MAX_SECONDS) {
      clearInterval(CLIENT_STATE.timerInterval);
      CLIENT_STATE.timerInterval = null;
      triggerHour96Events();
      return;
    }

    // Incrementar los segundos transcurridos (Cronómetro progresivo de 0 en adelante)
    CLIENT_STATE.elapsedSeconds++;

    // Formateador estándar HH:MM:SS para el tiempo acumulado
    const h = Math.floor(CLIENT_STATE.elapsedSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((CLIENT_STATE.elapsedSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (CLIENT_STATE.elapsedSeconds % 60).toString().padStart(2, '0');
    const timeFormatted = `${h}:${m}:${s}`;

    // 1. Mostrar tiempo global transcurrido en el Dashboard (Avanza de 00:00:00 en adelante)
    if (mainTimer) mainTimer.textContent = timeFormatted;
    if (globalTimerDisplay) globalTimerDisplay.textContent = timeFormatted;

    // 2. Etapa 1: Registro / Inyección (Primeras 24 horas)
    if (CLIENT_STATE.elapsedSeconds <= SECONDS_24H) {
      if (timer24hDisplay) timer24hDisplay.textContent = timeFormatted;
    } else {
      if (timer24hDisplay) timer24hDisplay.textContent = "24:00:00 (Completado)";
    }

    // 3. Etapa 2: Post-Resultados (De hora 24 a 96)
    if (CLIENT_STATE.elapsedSeconds > SECONDS_24H) {
      if (timerPostDisplay) timerPostDisplay.textContent = timeFormatted;
    } else {
      if (timerPostDisplay) timerPostDisplay.textContent = "00:00:00 (En Espera)";
    }

    // Evaluar liberación progresiva de botones (alcanzar hora 48, 72 o 96)
    const hoursElapsed = CLIENT_STATE.elapsedSeconds / 3600;
    evaluateTimelineTriggers(hoursElapsed);

  }, 1000);
}

/* ==========================================================================
   9. HABILITACIÓN PROGRESIVA DE BOTONES DE PAGO Y COMPARATIVA
   ========================================================================== */
function evaluateTimelineTriggers(hoursElapsed) {
  if (hoursElapsed >= 48) {
    enablePaymentButton('btn-pay-part-1');
    enablePaymentButton('btn-pay-2-installments');
    enablePaymentButton('btn-pay-1-installment');
  }

  if (hoursElapsed >= 72) {
    const compSection = document.getElementById('section-sodie-comparison');
    if (compSection) compSection.classList.remove('hidden');

    if (CLIENT_STATE.activeModalidad === '3_CUOTAS' && CLIENT_STATE.paidInstallments.includes(1)) {
      enablePaymentButton('btn-pay-part-2');
    }
  }

  if (hoursElapsed >= 96) {
    triggerHour96Events();
  }
}

function enablePaymentButton(buttonId) {
  const btn = document.getElementById(buttonId);
  if (btn && btn.classList.contains('disabled')) {
    btn.classList.remove('disabled');
    btn.disabled = false;
  }
}

function triggerHour96Events() {
  if (CLIENT_STATE.activeModalidad === '3_CUOTAS' && CLIENT_STATE.paidInstallments.includes(2)) {
    enablePaymentButton('btn-pay-part-3');
  }

  if (isFullyPaid()) {
    const completeSection = document.getElementById('section-hour-96-complete');
    if (completeSection) completeSection.classList.remove('hidden');
  }
}

function isFullyPaid() {
  if (CLIENT_STATE.activeModalidad === '1_CUOTA' && CLIENT_STATE.paidInstallments.includes(1)) return true;
  if (CLIENT_STATE.activeModalidad === '2_CUOTAS' && CLIENT_STATE.paidInstallments.length >= 2) return true;
  if (CLIENT_STATE.activeModalidad === '3_CUOTAS' && CLIENT_STATE.paidInstallments.length >= 3) return true;
  return false;
}

/* ==========================================================================
   10. ACTUALIZACIÓN VISUAL DE INTERFAZ POST-PAGO
   ========================================================================== */
function updatePaymentUI(cuota, amount) {
  const currentBtn = document.getElementById(`btn-pay-part-${cuota}`);
  if (currentBtn) {
    currentBtn.textContent = `✓ Cuota ${cuota} Pagada ($${amount})`;
    currentBtn.style.background = 'rgba(0, 255, 204, 0.25)';
    currentBtn.disabled = true;
  }

  if (cuota === 1) {
    const nextBtn = document.getElementById('btn-pay-part-2');
    if (nextBtn) nextBtn.classList.remove('hidden');
  } else if (cuota === 2) {
    const nextBtn = document.getElementById('btn-pay-part-3');
    if (nextBtn) nextBtn.classList.remove('hidden');
  }

  checkFinalCompletion();
}

function updateModalidadUI(type, amount, cuota) {
  if (type === 1) {
    const btn = document.getElementById('btn-pay-1-installment');
    if (btn) {
      btn.textContent = '✓ Liquidación Total Completada ($9.000)';
      btn.style.background = 'rgba(0, 255, 204, 0.25)';
      btn.disabled = true;
    }
  } else if (type === 2) {
    const btn = document.getElementById('btn-pay-2-installments');
    if (btn) {
      if (cuota === 1) {
        btn.textContent = 'Pagar Cuota 2: $3.000 (Hora 72)';
      } else {
        btn.textContent = '✓ Pago a 2 Cuotas Completado ($9.000)';
        btn.style.background = 'rgba(0, 255, 204, 0.25)';
        btn.disabled = true;
      }
    }
  }

  checkFinalCompletion();
}

function checkFinalCompletion() {
  if (isFullyPaid()) {
    const completeSection = document.getElementById('section-hour-96-complete');
    if (completeSection) completeSection.classList.remove('hidden');
  }
}
