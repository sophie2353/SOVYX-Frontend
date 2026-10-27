function getBaseUrl() {
  if (window.SODIE_CONFIG && window.SODIE_CONFIG.API_URL) {
    return window.SODIE_CONFIG.API_URL.replace(/\/$/, '');
  }
  return window.location.origin;
}

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
  // PASO 0: CONFIRMAR PAGO, ASIGNAR ID Y SALTAR A CONTRATO.HTML
  // =========================================================================
  if (step === 'confirmar_pago' || step === 'generar_id' || step === 'aceptar_rol' || paymentType === 'hora0') {
    loaderEl.style.display = 'none';
    
    const activeClientId = await resolveClientId();

    localStorage.setItem('sodie_payment_completed', 'true');
    if (typeof fbq === 'function') {
      fbq('track', 'Purchase', { value: 25000.00, currency: 'USD', content_name: 'Reserva Inicial SODIE' });
    }

    badgeEl.textContent = `Paso 1 de 3 • Cliente ${activeClientId}`;
    titleEl.textContent = '¡Pago Registrado con Éxito!';
    bodyEl.textContent = `Se ha asignado el ID ${activeClientId} a tu perfil. Firma el contrato legal de prestación de servicios para activar formalmente tu cupo.`;

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

    actionBtn.style.display = 'none';
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
  // PASO 1: CONFIGURACIÓN POST-PAGO DE CREDENCIALES (ACT_ID & PIXEL_ID)
  // =========================================================================
  // confirmacion.html (Sección JS de configuración y procesamiento)
else if (step === 'excel_and_fb' || step === 'excel_uploaded' || step === 'conectar_meta' || step === 'configurar_meta') {
    loaderEl.style.display = 'none';
    const activeClientId = await resolveClientId();

    badgeEl.textContent = `Paso 2 de 3 • Cliente ${activeClientId}`;
    titleEl.textContent = 'Configuración de Cuenta Publicitaria';
    bodyEl.textContent = `Ingresa los datos de tu cuenta publicitaria de Meta para vincular la automatización de IA1 con el cliente ${activeClientId}. Solo se requiere una vez.`;

    // Inyectar el formulario de configuración + Contenedor de Alerta para Error #100
    stepsContainer.innerHTML = `
      <div id="ltv-warning-banner" style="display: none; background: rgba(234, 179, 8, 0.15); border: 1px solid #eab308; border-radius: 12px; padding: 16px; margin-bottom: 20px; color: #fff;">
        <h4 style="margin: 0 0 8px 0; color: #facc15; font-weight: 600;">Requisito de Meta Detectado (Error #100)</h4>
        <p id="ltv-warning-text" style="margin: 0; font-size: 0.88rem; line-height: 1.4; color: #e2e8f0;"></p>
        <div style="margin-top: 14px;">
          <button id="btn-reintentar-ltv" type="button" style="background: #facc15; color: #000; font-weight: 600; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 0.85rem;">
            Reintentar Vinculación
          </button>
        </div>
      </div>

      <div class="credentials-form">
        <div class="form-group">
          <label for="input-act-id">ID de Cuenta Publicitaria (act_id)</label>
          <input type="text" id="input-act-id" placeholder="Ej: act_123456789 o 123456789" value="${actId || ''}">
        </div>
        <div class="form-group" style="margin-top: 14px;">
          <label for="input-pixel-id">ID del Píxel de Meta (pixel_id - Opcional)</label>
          <input type="text" id="input-pixel-id" placeholder="Ej: 987654321012345">
        </div>
      </div>
    `;

    const ltvBanner = document.getElementById('ltv-warning-banner');
    const ltvText = document.getElementById('ltv-warning-text');
    const btnReintentarLtv = document.getElementById('btn-reintentar-ltv');

    const submitCredentials = async () => {
      const actInput = document.getElementById('input-act-id').value.trim();
      const pixelInput = document.getElementById('input-pixel-id').value.trim();

      if (!actInput) {
        alert('⚠️ Por favor ingresa el ID de tu cuenta publicitaria.');
        return;
      }

      // Ocultar banner previo si existía
      if (ltvBanner) ltvBanner.style.display = 'none';

      verifyBtn.textContent = 'Guardando y Validando en Meta...';
      try {
        const res = await fetch('/api/v1/facebook/configurar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: activeClientId,
            actId: actInput,
            pixelId: pixelInput || null
          })
        });

        const data = await res.json();

        // 1. Interceptar si devuelve el error de Value / LTV Terms Required
        if (!data.success && (data.errorCode === 'VALUE_TERMS_REQUIRED' || data.error?.includes('Términos de Valor'))) {
          ltvText.textContent = data.instructions || 'Debes activar la segmentación por Value subiendo un archivo CSV de prueba en tu panel de Meta y aceptar los términos.';
          ltvBanner.style.display = 'block';
          verifyBtn.textContent = 'Guardar y Vincular Credenciales';
          return;
        }

        // 2. Éxito: Continuar al siguiente paso
        if (data.success) {
          window.location.href = `/confirmacion.html?step=procesar_excel&clientId=${encodeURIComponent(activeClientId)}&actId=${encodeURIComponent(data.act_id)}&sessionId=${sessionId || ''}`;
        } else {
          alert(`⚠️ Error: ${data.error || 'No se pudieron guardar las credenciales.'}`);
          verifyBtn.textContent = 'Guardar y Vincular Credenciales';
        }
      } catch (err) {
        console.error('💥 Error de conexión:', err);
        alert('💥 Error de conexión con el servidor.');
        verifyBtn.textContent = 'Guardar y Vincular Credenciales';
      }
    };

  // =========================================================================
  // PASO 2: ACTIVACIÓN Y PUBLICACIÓN DE CAMPAÑA (POST-CONFIGURACIÓN)
  // =========================================================================
  else if (step === 'procesar_excel' || step === 'activar_campana') {
    loaderEl.style.display = 'none';
    const activeClientId = await resolveClientId();

    badgeEl.textContent = `Paso 3 de 3 • Cliente ${activeClientId}`;
    titleEl.textContent = '¡Borrador Generado en Meta Ads!';
    bodyEl.textContent = 'Tu campaña y segmentación de 24 horas han sido inyectadas exitosamente en tu cuenta. Abre Ads Manager para confirmar presupuesto y publicar tus visuales.';

    stepsContainer.innerHTML = `
      <ul class="steps-list">
        <li>
          <span class="step-number">1</span>
          <div>Ingresa a Meta Ads Manager para asignar presupuesto/imagen y activar.</div>
        </li>
        <li>
          <span class="step-number">2</span>
          <div>Pasa a tu Dashboard mientras el sistema verifica las métricas.</div>
        </li>
      </ul>
    `;

    actionBtn.style.display = 'inline-flex';
    actionBtn.textContent = '1. Abrir Meta Ads Manager ↗';
    actionBtn.onclick = () => {
      const cleanAct = actId ? actId.replace(/^act_/, '') : '';
      const webUrl = cleanAct 
        ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${cleanAct}${campaignId ? `&selected_campaign_ids=${campaignId}` : ''}`
        : 'https://adsmanager.facebook.com/adsmanager/manage/campaigns';
      window.open(webUrl, '_blank');
    };

    verifyBtn.style.display = 'inline-flex';
    verifyBtn.textContent = '2. Ir a mi Dashboard';
    verifyBtn.onclick = () => {
      window.location.href = `/client.html?clientId=${encodeURIComponent(activeClientId)}&sessionId=${sessionId || ''}&status=verifying`;
    };
  }

  // =========================================================================
  // PASO 3: REDIRECCIÓN POST-PAGO SEMANAL -> CLIENT.HTML
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
