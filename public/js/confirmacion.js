/**
 * SODIE V4 - Confirmación & Onboarding Post-Pago (confirmacion.js)
 * Soporta flujo real de clientes y Bypass fluido para ADMIN / Modo Test
 */

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
  const role = urlParams.get('role');
  const isAdminOrTest = (
    sessionStorage.getItem('sodie_admin_session') === 'active' ||
    localStorage.getItem('sodie_admin_session') === 'active' ||
    localStorage.getItem('sodie_admin_bypass') === 'true' ||
    urlParams.get('admin') === 'true' ||
    urlParams.get('test') === 'true' ||
    role === 'admin'
  );

  // Si entra sin ?step en modo test/admin, inicia en 'generar_id' para recorrer todo el flujo
  const step = urlParams.get('step') || (isAdminOrTest ? 'generar_id' : null);
  const campaignId = urlParams.get('campaignId') || 'camp_v4_test';
  const actId = urlParams.get('actId');
  const sessionId = urlParams.get('sessionId') || `sess_${Date.now()}`;
  const paymentType = urlParams.get('paymentType');
  let clientIdParam = urlParams.get('clientId');

  const titleEl = document.getElementById('conf-title');
  const bodyEl = document.getElementById('conf-body');
  const badgeEl = document.getElementById('conf-badge');
  const loaderEl = document.getElementById('loader-box');
  const stepsContainer = document.getElementById('steps-container');
  const actionBtn = document.getElementById('conf-action-btn');
  const verifyBtn = document.getElementById('conf-verify-btn');

  function syncClientStorage(id) {
    localStorage.setItem('sodie_client_id', id);
    localStorage.setItem('sodie_active_client_id', id);
  }

  // Helper: Obtiene o asigna el ID del cliente (Si es Admin/Test usa ADMIN salvo que pase otro en URL)
  async function resolveClientId() {
    if (clientIdParam) {
      syncClientStorage(clientIdParam);
      return clientIdParam;
    }

    if (isAdminOrTest) {
      syncClientStorage('ADMIN');
      return 'ADMIN';
    }

    const savedId = localStorage.getItem('sodie_client_id') || localStorage.getItem('sodie_active_client_id');
    if (savedId) {
      syncClientStorage(savedId);
      return savedId;
    }

    try {
      const res = await fetch(`${getBaseUrl()}/api/v1/clients/next-id`);
      if (res.ok) {
        const data = await res.json();
        const newId = data.clientId || 'CLIENT-#01';
        syncClientStorage(newId);
        return newId;
      }
    } catch (err) {
      console.warn('Fallback a ID local por defecto');
    }

    const fallbackId = 'CLIENT-#01';
    syncClientStorage(fallbackId);
    return fallbackId;
  }

  const adminQuerySuffix = isAdminOrTest ? '&admin=true' : '';

  // =========================================================================
  // PASO 0: CONFIRMAR PAGO, ASIGNAR ID Y SALTAR A CONTRATO.HTML
  // =========================================================================
  if (step === 'confirmar_pago' || step === 'generar_id' || step === 'aceptar_rol' || paymentType === 'RESERVA') {
    if (loaderEl) loaderEl.style.display = 'none';

    const activeClientId = await resolveClientId();
    localStorage.setItem('sodie_payment_completed', 'true');

    if (badgeEl) badgeEl.textContent = `Paso 1 de 3 • Cliente ${activeClientId}`;
    if (titleEl) titleEl.textContent = '¡Pago Registrado con Éxito!';
    if (bodyEl) {
      bodyEl.textContent = `Se ha asignado el ID ${activeClientId} a tu perfil corporativo. Firma el contrato digital de prestación de servicios para activar tu cupo en SODIE v4.`;
    }

    if (stepsContainer) {
      stepsContainer.innerHTML = `
        <ul class="steps-list">
          <li>
            <span class="step-number">1</span>
            <div>Identificador corporativo asignado: <strong>${activeClientId}</strong></div>
          </li>
          <li>
            <span class="step-number">2</span>
            <div>Firma del contrato digital y registro de IP de seguridad.</div>
          </li>
        </ul>
      `;
    }

    if (actionBtn) actionBtn.style.display = 'none';
    if (verifyBtn) {
      verifyBtn.style.display = 'inline-flex';
      verifyBtn.textContent = 'Firmar Contrato Digital ➔';
      verifyBtn.onclick = () => {
        verifyBtn.textContent = 'Redirigiendo a contrato.html...';
        const targetUrl = `/contrato.html?clientId=${encodeURIComponent(activeClientId)}&sessionId=${encodeURIComponent(sessionId)}&status=paid_success${adminQuerySuffix}`;
        window.location.href = targetUrl;
      };
    }
  }

  // =========================================================================
  // PASO 1: CONFIGURACIÓN POST-PAGO DE CREDENCIALES (ACT_ID & WEBSITE_URL)
  // =========================================================================
  else if (step === 'excel_and_fb' || step === 'excel_uploaded' || step === 'conectar_meta' || step === 'configurar_meta') {
    if (loaderEl) loaderEl.style.display = 'none';
    const activeClientId = await resolveClientId();

    if (badgeEl) badgeEl.textContent = `Paso 2 de 3 • Cliente ${activeClientId}`;
    if (titleEl) titleEl.textContent = 'Configuración de Cuenta Publicitaria';
    if (bodyEl) {
      bodyEl.textContent = 'Asigna permisos en tu Business Manager y coloca los datos de tu cuenta publicitaria para inyectar la automatización de SODIE v4.';
    }

    if (stepsContainer) {
      stepsContainer.innerHTML = `
        <div id="ltv-warning-banner" style="display: none; background: rgba(234, 179, 8, 0.15); border: 1px solid #eab308; border-radius: 12px; padding: 16px; margin-bottom: 20px; color: #fff;">
          <h4 style="margin: 0 0 8px 0; color: #facc15; font-weight: 600;">Requisito Detectado (Error #100)</h4>
          <p id="ltv-warning-text" style="margin: 0; font-size: 0.88rem; line-height: 1.4; color: #e2e8f0;"></p>
          <div style="margin-top: 14px;">
            <button id="btn-reintentar-ltv" type="button" style="background: #facc15; color: #000; font-weight: 600; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 0.85rem;">
              Reintentar Vinculación
            </button>
          </div>
        </div>

        <div class="credentials-form">
          <h4 style="margin: 0 0 14px 0; font-size: 1rem; color: #fff;">Ingresa los datos de inyección</h4>
          
          <div class="form-group">
            <label for="input-act-id" style="color: #cbd5e1; font-size: 0.9rem;">ID de Cuenta Publicitaria (act_id)</label>
            <input type="text" id="input-act-id" placeholder="Ej: 123456789" value="${actId || ''}" style="width: 100%; padding: 12px; margin-top: 6px; border-radius: 8px; border: 1px solid rgba(0,255,204,0.35); background: rgba(0,0,0,0.35); color: white;">
          </div>
          
          <div class="form-group" style="margin-top: 18px;">
            <label for="input-website-url" style="color: #cbd5e1; font-size: 0.9rem;">URL de tu Sitio Web</label>
            <input type="url" id="input-website-url" placeholder="https://tu-empresa.com" style="width: 100%; padding: 12px; margin-top: 6px; border-radius: 8px; border: 1px solid rgba(0,255,204,0.35); background: rgba(0,0,0,0.35); color: white;">
          </div>
        </div>
      `;
    }

    if (actionBtn) actionBtn.style.display = 'none';
    if (verifyBtn) {
      verifyBtn.style.display = 'inline-flex';
      verifyBtn.textContent = 'Guardar y Vincular Credenciales';
    }

    const ltvBanner = document.getElementById('ltv-warning-banner');
    const btnReintentarLtv = document.getElementById('btn-reintentar-ltv');

    const submitCredentials = async () => {
      let actInput = document.getElementById('input-act-id')?.value.trim() || '';
      let websiteInput = document.getElementById('input-website-url')?.value.trim() || '';

      // En modo Admin/Test permite avanzar incluso si deja valores de prueba rápidos
      if (!actInput && isAdminOrTest) actInput = 'act_999888777';
      if (!websiteInput && isAdminOrTest) websiteInput = 'https://socredi.com';

      if (!actInput) {
        alert('⚠️ Por favor ingresa el ID de tu cuenta publicitaria.');
        return;
      }

      if (!websiteInput.startsWith('http')) {
        websiteInput = `https://${websiteInput}`;
      }

      if (ltvBanner) ltvBanner.style.display = 'none';
      if (verifyBtn) verifyBtn.textContent = 'Guardando credenciales...';

      try {
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

        if (res.ok && data.success) {
          window.location.href = `/confirmacion.html?step=procesar_excel&clientId=${encodeURIComponent(activeClientId)}&actId=${encodeURIComponent(data.act_id || actInput)}&sessionId=${encodeURIComponent(sessionId)}${adminQuerySuffix}`;
          return;
        }

        // Bypass automático si está en flujo de test/admin y la cuenta de prueba no existe en el backend
        if (isAdminOrTest) {
          console.log('👑 [MODO TEST/ADMIN] Saltando validación estricta de /configurar...');
          window.location.href = `/confirmacion.html?step=procesar_excel&clientId=${encodeURIComponent(activeClientId)}&actId=${encodeURIComponent(actInput)}&sessionId=${encodeURIComponent(sessionId)}${adminQuerySuffix}`;
          return;
        }

        alert(`⚠️ Error: ${data.error || 'No se pudieron guardar las credenciales.'}`);
        if (verifyBtn) verifyBtn.textContent = 'Guardar y Vincular Credenciales';
      } catch (err) {
        if (isAdminOrTest) {
          window.location.href = `/confirmacion.html?step=procesar_excel&clientId=${encodeURIComponent(activeClientId)}&actId=${encodeURIComponent(actInput)}&sessionId=${encodeURIComponent(sessionId)}${adminQuerySuffix}`;
          return;
        }
        console.error('💥 Error de conexión:', err);
        alert('💥 Error de conexión con el servidor.');
        if (verifyBtn) verifyBtn.textContent = 'Guardar y Vincular Credenciales';
      }
    };

    if (verifyBtn) verifyBtn.onclick = submitCredentials;
    if (btnReintentarLtv) btnReintentarLtv.onclick = submitCredentials;
  }

  // =========================================================================
  // PASO 1.5: CREACIÓN DE BORRADOR (INYECCIÓN AUTOMÁTICA EN SEGUNDO PLANO)
  // =========================================================================
  else if (step === 'procesar_excel') {
    if (loaderEl) loaderEl.style.display = 'inline-block';
    const activeClientId = await resolveClientId();

    if (badgeEl) badgeEl.textContent = `Paso 2 de 3 • Cliente ${activeClientId}`;
    if (titleEl) titleEl.textContent = 'Inyectando Borrador Automatizado...';
    if (bodyEl) {
      bodyEl.textContent = 'El motor SODIE v4 está generando la audiencia de alto valor y configurando la campaña en estado PAUSADO.';
    }

    if (stepsContainer) {
      stepsContainer.innerHTML = `
        <p style="color: #a1a1aa; text-align: center; font-size: 0.95rem;">
          Esto toma unos segundos mientras el API procesa los registros y la estructura del anuncio...
        </p>
      `;
    }

    if (actionBtn) actionBtn.style.display = 'none';
    if (verifyBtn) verifyBtn.style.display = 'none';

    try {
      const res = await fetch(`${getBaseUrl()}/api/v1/facebook/crear-borrador`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: activeClientId,
          actId: actId || 'act_test',
          sessionId: sessionId
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        window.location.href = `/confirmacion.html?step=esperar_maduracion&clientId=${encodeURIComponent(activeClientId)}&campaignId=${encodeURIComponent(data.campaignId || campaignId)}&actId=${encodeURIComponent(actId || '')}&sessionId=${encodeURIComponent(sessionId)}${adminQuerySuffix}`;
        return;
      }

      // Si es flujo de test/admin, simula 1.8s de inyección y pasa al Paso 3 sin bloquear
      if (isAdminOrTest) {
        setTimeout(() => {
          window.location.href = `/confirmacion.html?step=esperar_maduracion&clientId=${encodeURIComponent(activeClientId)}&campaignId=${encodeURIComponent(campaignId)}&actId=${encodeURIComponent(actId || '')}&sessionId=${encodeURIComponent(sessionId)}${adminQuerySuffix}`;
        }, 1800);
        return;
      }

      if (loaderEl) loaderEl.style.display = 'none';
      if (titleEl) titleEl.textContent = '⚠️ Error en la Inyección';
      if (bodyEl) bodyEl.textContent = data.error || 'No se pudo crear el borrador.';
      if (verifyBtn) {
        verifyBtn.style.display = 'inline-flex';
        verifyBtn.textContent = 'Reintentar Inyección';
        verifyBtn.onclick = () => window.location.reload();
      }
    } catch (err) {
      if (isAdminOrTest) {
        setTimeout(() => {
          window.location.href = `/confirmacion.html?step=esperar_maduracion&clientId=${encodeURIComponent(activeClientId)}&campaignId=${encodeURIComponent(campaignId)}&actId=${encodeURIComponent(actId || '')}&sessionId=${encodeURIComponent(sessionId)}${adminQuerySuffix}`;
        }, 1800);
        return;
      }

      if (loaderEl) loaderEl.style.display = 'none';
      if (titleEl) titleEl.textContent = '💥 Error de Conexión';
      if (bodyEl) bodyEl.textContent = 'Hubo un fallo comunicándose con el motor de inyección.';
      if (verifyBtn) {
        verifyBtn.style.display = 'inline-flex';
        verifyBtn.textContent = 'Reintentar';
        verifyBtn.onclick = () => window.location.reload();
      }
    }
  }

  // =========================================================================
  // PASO 2: ESPERAR MADURACIÓN / RADAR 4H & ACTIVACIÓN
  // =========================================================================
  else if (step === 'esperar_maduracion' || step === 'activar_campana') {
    if (loaderEl) loaderEl.style.display = 'none';
    const activeClientId = await resolveClientId();

    if (badgeEl) badgeEl.textContent = `Paso 3 de 3 • Cliente ${activeClientId}`;
    if (titleEl) titleEl.textContent = 'Borrador Creado y en Maduración';
    if (bodyEl) {
      bodyEl.textContent = 'Tu campaña ha nacido en estado PAUSADO para evitar congelamientos. El Radar SODIE v4 vigila la aprobación de la audiencia y te enviará una notificación push cuando esté lista.';
    }

    if (stepsContainer) {
      stepsContainer.innerHTML = `
        <div style="background: rgba(0, 255, 204, 0.08); border: 1px solid rgba(0, 255, 204, 0.35); border-radius: 12px; padding: 16px; margin-bottom: 20px; color: #fff;">
          <h4 style="margin: 0 0 6px 0; color: #00ffcc; font-size: 0.95rem;">🛡️ Protección Activa contra Congelamientos</h4>
          <p style="margin: 0; font-size: 0.85rem; color: #cbd5e1; line-height: 1.4;">
            El motor mantiene la pauta protegida mientras la audiencia se indexa. Puedes abrir tu administrador de anuncios o dirigirte a tu panel de control.
          </p>
        </div>
        <ul class="steps-list">
          <li>
            <span class="step-number">1</span>
            <div>Recibe la alerta push en tu dispositivo o verifica tu panel.</div>
          </li>
          <li>
            <span class="step-number">2</span>
            <div>Activa el borrador en un clic cuando el radar confirme la aprobación.</div>
          </li>
        </ul>
      `;
    }

    if (actionBtn) {
      actionBtn.style.display = 'inline-flex';
      actionBtn.textContent = 'Abrir Ads Manager ↗';
      actionBtn.onclick = () => {
        const cleanAct = actId ? actId.replace(/^act_/, '') : '';
        const webUrl = cleanAct
          ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${encodeURIComponent(cleanAct)}`
          : 'https://adsmanager.facebook.com/';
        window.open(webUrl, '_blank');
      };
    }

    const cleanClientId = activeClientId.trim().toUpperCase();
    const isAdminUser = isAdminOrTest || cleanClientId === 'ADMIN' || cleanClientId.includes('ADMIN');

    if (verifyBtn) {
      verifyBtn.style.display = 'inline-flex';
      verifyBtn.textContent = 'Ir a mi Dashboard ➔';
      verifyBtn.onclick = () => {
        if (isAdminUser) {
          window.location.href = `/client.html?clientId=ADMIN&admin=true&sessionId=${encodeURIComponent(sessionId)}&status=verifying`;
        } else {
          window.location.href = `/client.html?clientId=${encodeURIComponent(cleanClientId)}&sessionId=${encodeURIComponent(sessionId)}&status=verifying`;
        }
      };
    }
  }

  // =========================================================================
  // FALLBACK POR DEFECTO
  // =========================================================================
  else {
    if (loaderEl) loaderEl.style.display = 'none';
    const activeClientId = await resolveClientId();

    if (badgeEl) badgeEl.textContent = isAdminOrTest ? 'SODIE v4 Admin' : `SODIE v4 • ${activeClientId}`;
    if (titleEl) titleEl.textContent = 'Confirmación SODIE v4';
    if (bodyEl) bodyEl.textContent = 'Selecciona a dónde deseas dirigirte:';

    if (actionBtn) {
      actionBtn.style.display = 'inline-flex';
      actionBtn.textContent = 'Probar Flujo desde Paso 1 ➔';
      actionBtn.onclick = () => {
        window.location.href = `/confirmacion.html?step=generar_id&clientId=${encodeURIComponent(activeClientId)}${adminQuerySuffix}`;
      };
    }

    if (verifyBtn) {
      verifyBtn.style.display = 'inline-flex';
      verifyBtn.textContent = isAdminOrTest ? 'Ir a Vista Cliente (Admin)' : 'Ir al Dashboard';
      verifyBtn.onclick = () => {
        window.location.href = isAdminOrTest
          ? `/client.html?clientId=ADMIN&admin=true&sessionId=${encodeURIComponent(sessionId)}`
          : `/client.html?clientId=${encodeURIComponent(activeClientId)}&sessionId=${encodeURIComponent(sessionId)}`;
      };
    }
  }
});
