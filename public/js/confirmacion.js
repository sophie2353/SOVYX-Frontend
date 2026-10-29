function getBaseUrl() {
  if (window.SODIE_CONFIG && window.SODIE_CONFIG.API_URL) {
    return window.SODIE_CONFIG.API_URL.replace(/\/$/, '');
  }
  return window.location.origin;
}

document.addEventListener('DOMContentLoaded', async () => {
  if (window.SODIE_CONFIG_READY) {
    await window.SODIE_CONFIG_READY;
  }

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
      const res = await fetch(`${getBaseUrl()}/api/v1/clients/next-id`);
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
  else if (step === 'excel_and_fb' || step === 'excel_uploaded' || step === 'conectar_meta' || step === 'configurar_meta') {
    loaderEl.style.display = 'none';
    const activeClientId = await resolveClientId();
    
    // 🔥 TU ID DE BUSINESS MANAGER (Para que el cliente lo asigne como Socio)
    const SODIE_BM_ID = "123456789012345"; // <-- REEMPLAZA ESTO CON TU ID REAL 👺

    badgeEl.textContent = `Paso 2 de 3 • Cliente ${activeClientId}`;
    titleEl.textContent = 'Configuración de Campaña en Meta';
    bodyEl.textContent = `Asigna permisos a SODIE en tu Business Manager y coloca los datos de tu cuenta publicitaria para inyectar la automatización.`;

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

      <!-- Tarjeta de Instrucción: Business Manager -->
      <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <h4 style="margin: 0 0 10px 0; font-size: 1rem; color: #fff;">1. Asígnanos como Socio en Meta</h4>
        <p style="margin: 0 0 12px 0; font-size: 0.85rem; color: #a1a1aa; line-height: 1.5;">
          Ve a "Configuración del Negocio > Socios" en Meta y agrega a SODIE dándole permisos sobre tu Cuenta Publicitaria, Página y Píxel usando nuestro ID.
        </p>
        <div style="display: flex; gap: 10px; align-items: center;">
          <code id="sodie-bm-id" style="background: rgba(0,0,0,0.5); padding: 8px 12px; border-radius: 6px; color: #34d399; font-weight: 600; font-size: 0.95rem; letter-spacing: 1px; flex: 1;">${SODIE_BM_ID}</code>
          <button type="button" onclick="navigator.clipboard.writeText('${SODIE_BM_ID}'); alert('ID de SODIE copiado.');" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; transition: all 0.2s;">
            Copiar ID
          </button>
        </div>
      </div>

      <!-- Formulario de Credenciales -->
      <div class="credentials-form">
        <h4 style="margin: 0 0 14px 0; font-size: 1rem; color: #fff;">2. Ingresa tus datos</h4>
        
        <div class="form-group">
          <label for="input-act-id" style="color: #cbd5e1; font-size: 0.9rem;">ID de Cuenta Publicitaria (act_id)</label>
          <input type="text" id="input-act-id" placeholder="Ej: 123456789" value="${actId || ''}" style="width: 100%; padding: 12px; margin-top: 6px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: white;">
        </div>
        
        <div class="form-group" style="margin-top: 18px;">
          <label for="input-website-url" style="color: #cbd5e1; font-size: 0.9rem;">URL de tu Sitio Web</label>
          <input type="url" id="input-website-url" placeholder="https://tu-sitio.com" style="width: 100%; padding: 12px; margin-top: 6px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: white;">
        </div>
      </div>
    `;

    verifyBtn.style.display = 'inline-flex';
    verifyBtn.textContent = 'Guardar y Vincular Credenciales';

    const ltvBanner = document.getElementById('ltv-warning-banner');
    const ltvText = document.getElementById('ltv-warning-text');
    const btnReintentarLtv = document.getElementById('btn-reintentar-ltv');

    const submitCredentials = async () => {
      const actInput = document.getElementById('input-act-id').value.trim();
      const websiteInput = document.getElementById('input-website-url').value.trim();

      if (!actInput) {
        alert('⚠️ Por favor ingresa el ID de tu cuenta publicitaria.');
        return;
      }
      
      if (!websiteInput || !websiteInput.startsWith('http')) {
        alert('⚠️ Por favor ingresa una URL válida (ej. https://tusitio.com).');
        return;
      }

      if (ltvBanner) ltvBanner.style.display = 'none';

      verifyBtn.textContent = 'Guardando y Validando en Meta...';
      try {
        // Hacemos la llamada al backend pasando ACT_ID y WEBSITE_URL
        const res = await fetch(`${getBaseUrl()}/api/v1/facebook/configurar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: activeClientId,
            actId: actInput,
            websiteUrl: websiteInput
          })
        });

        const data = await res.json();

        if (!data.success && (data.errorCode === 'VALUE_TERMS_REQUIRED' || data.error?.includes('Términos de Valor'))) {
          ltvText.textContent = data.instructions || 'Debes activar la segmentación por Value subiendo un archivo CSV de prueba en tu panel de Meta y aceptar los términos.';
          ltvBanner.style.display = 'block';
          verifyBtn.textContent = 'Guardar y Vincular Credenciales';
          return;
        }

        if (data.success) {
          // Si todo va bien, pasamos al siguiente paso en el flujo (crear el borrador en la nube/meta)
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

    verifyBtn.onclick = submitCredentials;
    if (btnReintentarLtv) {
      btnReintentarLtv.onclick = submitCredentials;
    }
  }

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
