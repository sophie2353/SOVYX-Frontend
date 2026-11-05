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
  if (step === 'confirmar_pago' || step === 'generar_id' || step === 'aceptar_rol' || paymentType === 'RESERVA') {
    loaderEl.style.display = 'none';
    
    const activeClientId = await resolveClientId();

    localStorage.setItem('sodie_payment_completed', 'true');
    if (typeof fbq === 'function') {
      fbq('track', 'Purchase', { value: 25000.00, currency: 'USD', content_name: 'Reserva SODIE' });
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
      const targetUrl = `/contrato.html?clientId=${encodeURIComponent(activeClientId)}&sessionId=${sessionId || ''}&status=paid_success`;
      window.location.href = targetUrl;
    };
  }

  // =========================================================================
  // PASO 1: CONFIGURACIÓN POST-PAGO DE CREDENCIALES (ACT_ID & WEBSITE_URL)
  // =========================================================================
  else if (step === 'excel_and_fb' || step === 'excel_uploaded' || step === 'conectar_meta' || step === 'configurar_meta') {
    loaderEl.style.display = 'none';
    const activeClientId = await resolveClientId();
    
    const SODIE_BM_ID = "2918454448354968";

    badgeEl.textContent = `Paso 2 de 3 • Cliente ${activeClientId}`;
    titleEl.textContent = 'Configuración de Cuenta en Meta';
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

      <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <h4 style="margin: 0 0 10px 0; font-size: 1rem; color: #fff;">1. Asígnanos como Socio en Meta</h4>
        <p style="margin: 0 0 12px 0; font-size: 0.85rem; color: #a1a1aa; line-height: 1.5;">
          Ve a "Configuración del Negocio > Socios" en Meta y agrega a SODIE dándole permisos sobre tu Cuenta Publicitaria y Píxel.
        </p>
        <div style="display: flex; gap: 10px; align-items: center;">
          <code id="sodie-bm-id" style="background: rgba(0,0,0,0.5); padding: 8px 12px; border-radius: 6px; color: #34d399; font-weight: 600; font-size: 0.95rem; letter-spacing: 1px; flex: 1;">${SODIE_BM_ID}</code>
          <button type="button" onclick="navigator.clipboard.writeText('${SODIE_BM_ID}'); alert('ID de SODIE copiado.');" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
            Copiar ID
          </button>
        </div>
      </div>

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

      verifyBtn.textContent = 'Guardando credenciales...';
      try {
        // Llamada a /configurar del nuevo flujo
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

        if (data.success) {
          // Una vez guardadas las credenciales, saltamos automáticamente a crear el borrador en Meta
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
  // PASO 1.5: CREACIÓN DE BORRADOR (INYECCIÓN AUTOMÁTICA EN SEGUNDO PLANO)
  // =========================================================================
  else if (step === 'procesar_excel') {
    loaderEl.style.display = 'inline-block';
    const activeClientId = await resolveClientId();

    badgeEl.textContent = `Paso 2 de 3 • Cliente ${activeClientId}`;
    titleEl.textContent = 'Inyectando Borrador en Meta...';
    bodyEl.textContent = 'El motor SODIE está generando los Lookalikes Value-Based de forma segura y configurando la campaña en pausa.';

    stepsContainer.innerHTML = `
      <p style="color: #a1a1aa; text-align: center; font-size: 0.95rem;">
        Esto puede tomar unos segundos mientras la API procesa los hashes y el presupuesto de $33/día...
      </p>
    `;

    actionBtn.style.display = 'none';
    verifyBtn.style.display = 'none';

    try {
      // Invocamos el endpoint de creación de borrador adaptado al nuevo flujo
      const res = await fetch(`${getBaseUrl()}/api/v1/facebook/crear-borrador`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: activeClientId,
          actId: actId,
          sessionId: sessionId || ''
        })
      });

      const data = await res.json();

      if (data.success) {
        // Redirigimos al paso de espera de maduración (Radar 4h)
        window.location.href = `/confirmacion.html?step=esperar_maduracion&clientId=${encodeURIComponent(activeClientId)}&campaignId=${encodeURIComponent(data.campaignId)}&actId=${encodeURIComponent(actId)}&sessionId=${sessionId || ''}`;
      } else {
        loaderEl.style.display = 'none';
        titleEl.textContent = '⚠️ Error en la Inyección';
        bodyEl.textContent = data.error || 'No se pudo crear el borrador en Meta.';
        verifyBtn.style.display = 'inline-flex';
        verifyBtn.textContent = 'Reintentar Inyección';
        verifyBtn.onclick = () => window.location.reload();
      }
    } catch (err) {
      console.error('💥 Error crítico creando borrador:', err);
      loaderEl.style.display = 'none';
      titleEl.textContent = '💥 Error de Conexión';
      bodyEl.textContent = 'Hubo un fallo comunicándose con el motor de Meta.';
      verifyBtn.style.display = 'inline-flex';
      verifyBtn.textContent = 'Reintentar';
      verifyBtn.onclick = () => window.location.reload();
    }
  }

  // =========================================================================
  // PASO 2: ESPERAR MADURACIÓN / RADAR 4H & ACTIVACIÓN
  // =========================================================================
  else if (step === 'esperar_maduracion' || step === 'activar_campana') {
    loaderEl.style.display = 'none';
    const activeClientId = await resolveClientId();

    badgeEl.textContent = `Paso 3 de 3 • Cliente ${activeClientId}`;
    titleEl.textContent = 'Borrador Creado y en Maduración';
    bodyEl.textContent = 'Tu campaña ha nacido en estado PAUSADO para evitar congelamientos. El Radar SODIE vigila la indexación en Meta y te avisará por notificación push cuando esté lista.';

    stepsContainer.innerHTML = `
      <div style="background: rgba(52, 211, 153, 0.1); border: 1px solid rgba(52, 211, 153, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 20px; color: #fff;">
        <h4 style="margin: 0 0 6px 0; color: #34d399; font-size: 0.95rem;">🛡️ Protección Activa contra Congelamientos</h4>
        <p style="margin: 0; font-size: 0.85rem; color: #cbd5e1; line-height: 1.4;">
          El motor mantiene la pauta protegida mientras la audiencia se procesa. Puedes abrir tu Ads Manager o dirigirte directamente a tu Dashboard de control.
        </p>
      </div>
      <ul class="steps-list">
        <li>
          <span class="step-number">1</span>
          <div>Espera la alerta push o revisa tu panel de control.</div>
        </li>
        <li>
          <span class="step-number">2</span>
          <div>Activa el anuncio una vez el radar confirme la indexación óptima.</div>
        </li>
      </ul>
    `;

    actionBtn.style.display = 'inline-flex';
    actionBtn.textContent = 'Abrir Meta Ads Manager ↗';
    actionBtn.onclick = () => {
      const cleanAct = actId ? actId.replace(/^act_/, '') : '';
      const webUrl = cleanAct 
        ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${cleanAct}${campaignId ? `&selected_campaign_ids=${campaignId}` : ''}`
        : 'https://adsmanager.facebook.com/adsmanager/manage/campaigns';
      window.open(webUrl, '_blank');
    };

    const cleanClientId = activeClientId.trim().toUpperCase();
    const isAdminUser = cleanClientId === 'ADMIN' || cleanClientId.includes('ADMIN');

    verifyBtn.style.display = 'inline-flex';
    verifyBtn.textContent = 'Ir a mi Dashboard ➔';
    verifyBtn.onclick = () => {
      if (isAdminUser) {
        window.location.href = `/admin.html?clientId=ADMIN&sessionId=${encodeURIComponent(sessionId || '')}&status=verifying`;
      } else {
        window.location.href = `/client.html?clientId=${encodeURIComponent(cleanClientId)}&sessionId=${encodeURIComponent(sessionId || '')}&status=verifying`;
      }
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
