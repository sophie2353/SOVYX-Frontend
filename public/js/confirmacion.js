document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const step = urlParams.get('step');
  const campaignId = urlParams.get('campaignId');
  const actId = urlParams.get('actId');
  const sessionId = urlParams.get('sessionId');
  const paymentType = urlParams.get('paymentType'); // 'hora0' | 'recurring'
  const role = urlParams.get('role'); // 'admin' | null (cliente)
  const weekNumber = urlParams.get('week') || '1';
  let clientIdParam = urlParams.get('clientId');
  let fbUserParam = urlParams.get('fbUser') || localStorage.getItem('sodie_fb_user');

  // Guardar el fbUser en almacenamiento local para persistencia
  if (fbUserParam) {
    localStorage.setItem('sodie_fb_user', fbUserParam);
  }

  const titleEl = document.getElementById('conf-title');
  const bodyEl = document.getElementById('conf-body');
  const badgeEl = document.getElementById('conf-badge');
  const loaderEl = document.getElementById('loader-box');
  const stepsContainer = document.getElementById('steps-container');
  const actionBtn = document.getElementById('conf-action-btn');
  const verifyBtn = document.getElementById('conf-verify-btn');

  // Helper: Obtiene o asigna el ID del cliente secuencial desde el servidor
  async function resolveClientId() {
    if (clientIdParam) {
      localStorage.setItem('sodie_client_id', clientIdParam);
      return clientIdParam;
    }

    const savedId = localStorage.getItem('sodie_client_id');
    if (savedId) return savedId;

    try {
      const res = await fetch('/api/v1/clients/next-id');
      if (res.ok) {
        const data = await res.json();
        const newId = data.clientId || 'CLIENT-#01';
        localStorage.setItem('sodie_client_id', newId);
        return newId;
      }
    } catch (err) {
      console.warn('Fallback a ID local por defecto');
    }

    const fallbackId = 'CLIENT-#01';
    localStorage.setItem('sodie_client_id', fallbackId);
    return fallbackId;
  }

    // =========================================================================
  // PASO 0: CONFIRMAR PAGO, ASIGNAR ID Y SALTAR A CONTRATO.HTML (SIN EVALUADOR)
  // =========================================================================
  if (step === 'confirmar_pago' || step === 'generar_id' || step === 'aceptar_rol' || paymentType === 'hora0') {
    loaderEl.style.display = 'none';
    
    const activeClientId = await resolveClientId();

    // Registrar evento de compra en Pixel/CAPI si aplica
    localStorage.setItem('sodie_payment_completed', 'true');
    if (typeof fbq === 'function') {
      fbq('track', 'Purchase', { value: 7000.00, currency: 'USD', content_name: 'Reserva Inicial SODIE' });
    }

    badgeEl.textContent = `Paso 1 de 3 • Cliente ${activeClientId}`;
    titleEl.textContent = '¡Pago Registrado con Éxito!';
    bodyEl.textContent = `Se ha asignado el ID ${activeClientId} a tu perfil. Firma el contrato legal de prestación de servicios para activar formalmente tu cupo en el sistema.`;

    stepsContainer.innerHTML = `
      <ul class="steps-list">
        <li>
          <span class="step-number">1</span>
          <div>Identificador de cliente asignado: <strong>${activeClientId}</strong></div>
        </li>
        <li>
          <span class="step-number">2</span>
          <div>Firma del contrato digital de prestación de servicios.</div>
        </li>
      </ul>
    `;

    // Ocultar botón secundario innecesario
    actionBtn.style.display = 'none';

    // Botón directo a la firma de contrato
    verifyBtn.style.display = 'inline-flex';
    verifyBtn.textContent = 'Firmar Contrato Digital ➔';
    verifyBtn.onclick = () => {
      verifyBtn.textContent = 'Redirigiendo a contrato.html...';
      const targetUrl = role === 'admin'
        ? `/admin.html?sessionId=${sessionId || ''}&status=paid_success`
        : `/contrato.html?clientId=${encodeURIComponent(activeClientId)}&sessionId=${sessionId || ''}&status=paid_success`;
      window.location.href = targetUrl;
    };
  }
  // =========================================================================
  // PASO 1: REGRESO DESDE EL EXCEL -> INICIAR CICLO DE META
  // =========================================================================
  // =========================================================================
  // PASO 1: CONEXIÓN OAUTH CON META (ÚNICA ENTRADA POST-EXCEL)
  // =========================================================================
  else if (step === 'excel_and_fb' || step === 'excel_uploaded' || step === 'conectar_meta') {
    loaderEl.style.display = 'none';
    const activeClientId = await resolveClientId();

    badgeEl.textContent = `Paso 2 de 3 • Cliente ${activeClientId}`;
    titleEl.textContent = 'Excel Recibido • Vinculación Meta Ads';
    bodyEl.textContent = `Hemos vinculado tu base de datos procesada por IA1 para el cliente ${activeClientId}. Inicia sesión con Facebook para sincronizar la cuenta publicitaria.`;

    stepsContainer.innerHTML = `
      <ul class="steps-list">
        <li>
          <span class="step-number">1</span>
          <div>Cliente activo: <strong>${activeClientId}</strong></div>
        </li>
        <li>
          <span class="step-number">2</span>
          <div>Autoriza el acceso para generar el token de 90 días e inyectar borradores.</div>
        </li>
      </ul>
    `;

    verifyBtn.style.display = 'inline-flex';
    verifyBtn.textContent = 'Iniciar Sesión con Meta Ads 🚀';
    verifyBtn.onclick = async () => {
      verifyBtn.textContent = 'Conectando con Meta...';
      try {
        const res = await fetch('/api/v1/facebook/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, clientId: activeClientId })
        });
        const data = await res.json();
        
        if (data.redirectUrl) {
          // Va a Meta OAuth -> El callback en backend procesa y redirige a step=procesar_excel o step=activar_campana
          window.location.href = data.redirectUrl;
        } else {
          alert('⚠️ Error obteniendo la URL de autenticación de Meta.');
        }
      } catch (err) {
        alert('💥 Error de conexión con el servidor.');
      } finally {
        verifyBtn.textContent = 'Iniciar Sesión con Meta Ads 🚀';
      }
    };
  }

  // =========================================================================
  // PASO 2: ACTIVACIÓN Y PUBLICACIÓN DE CAMPAÑA (REGRESO DEL CALLBACK)
  // =========================================================================
  else if (step === 'procesar_excel' || step === 'activar_campana') {
    loaderEl.style.display = 'none';
    const activeClientId = await resolveClientId();

    badgeEl.textContent = `Paso 3 de 3 • Cliente ${activeClientId}`;
    titleEl.textContent = '¡Borrador Generado en Meta Ads!';
    bodyEl.textContent = 'Tu campaña y segmentación de 24 horas han sido inyectadas exitosamente. Abre Ads Manager para confirmar presupuesto y publicar los visuales.';

    stepsContainer.innerHTML = `
      <ul class="steps-list">
        <li>
          <span class="step-number">1</span>
          <div>Ingresa a Meta Ads Manager para asignar presupuesto/imagen y activar.</div>
        </li>
        <li>
          <span class="step-number">2</span>
          <div>Pasa a tu Dashboard mientras Meta aprueba la verificación.</div>
        </li>
      </ul>
    `;

    actionBtn.style.display = 'inline-flex';
    actionBtn.textContent = '1. Abrir Meta Ads Manager ↗';
    actionBtn.onclick = () => {
      const webUrl = `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${actId || ''}`;
      window.open(webUrl, '_blank');
    };

    verifyBtn.style.display = 'inline-flex';
    verifyBtn.textContent = '2. Ir a mi Dashboard';
    verifyBtn.onclick = () => {
      window.location.href = `/client.html?clientId=${encodeURIComponent(activeClientId)}&sessionId=${sessionId || ''}&status=verifying`;
    };
  }

  // =========================================================================
  // PASO 4: CONFIRMAR PAGO INICIAL / EVENTO CAPI
  // =========================================================================

  // =========================================================================
  // PASO 5: NUEVA REDIRECCIÓN POST-PAGO SEMANAL -> CLIENT.HTML
  // =========================================================================
  else if (step === 'pago_semanal') {
    loaderEl.style.display = 'none';
    const activeClientId = await resolveClientId();

    localStorage.setItem('sodie_weekly_payment_completed', 'true');
    localStorage.setItem(`sodie_paid_week_${weekNumber}_${activeClientId}`, 'true');

    if (typeof fbq === 'function') {
      fbq('track', 'Purchase', { value: 6000.00, currency: 'USD', content_name: `Cuota Semanal ${weekNumber} SODIE` });
    }

    badgeEl.textContent = `Cuota Semanal ${weekNumber} • ${activeClientId}`;
    titleEl.textContent = '¡Pago Semanal Confirmado!';
    bodyEl.textContent = `Hemos validado tu pago de $6,000 USDT para la Semana ${weekNumber}. Redirigiendo a tu Panel de Cliente...`;

    setTimeout(() => {
      const targetUrl = `/client.html?clientId=${encodeURIComponent(activeClientId)}&status=weekly_paid_success&week=${weekNumber}&paid=true`;
      window.location.href = targetUrl;
    }, 2000);
  }

  // =========================================================================
  // FALLBACK POR DEFECTO
  // =========================================================================
  else {
    loaderEl.style.display = 'none';
    const activeClientId = await resolveClientId();

    badgeEl.textContent = role === 'admin' ? 'SODIE Admin' : `SODIE Panel • ${activeClientId}`;
    titleEl.textContent = 'Confirmación SODIE';
    bodyEl.textContent = 'Redirigiendo a tu panel principal...';
    verifyBtn.style.display = 'inline-flex';
    verifyBtn.textContent = role === 'admin' ? 'Ir a Admin Panel' : 'Ir al Dashboard';
    verifyBtn.onclick = () => {
      window.location.href = role === 'admin' 
        ? `/admin.html?sessionId=${sessionId || ''}` 
        : `/client.html?clientId=${encodeURIComponent(activeClientId)}&sessionId=${sessionId || ''}`;
    };
  }
});
