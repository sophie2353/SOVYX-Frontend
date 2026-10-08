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
  // PASO 0: ASIGNAR ID Y SALTAR A CONTRATO.HTML
  // =========================================================================
  if (step === 'generar_id' || step === 'aceptar_rol' || paymentType === 'hora0') {
    loaderEl.style.display = 'none';
    
    const activeClientId = await resolveClientId();
    const activeFbUser = fbUserParam || 'Evaluador Meta';

    badgeEl.textContent = `Paso 1 de 3 • Cliente ${activeClientId}`;
    titleEl.textContent = '¡Pago Registrado con Éxito!';
    bodyEl.textContent = `Se ha asignado el ID ${activeClientId} para el perfil de Facebook @${activeFbUser}. Acepta la solicitud como evaluador en Meta y firma el contrato digital para continuar.`;

    stepsContainer.innerHTML = `
      <ul class="steps-list">
        <li>
          <span class="step-number">1</span>
          <div>Acepta la invitación de evaluador enviado al usuario <strong>${activeFbUser}</strong> en Meta.</div>
        </li>
        <li>
          <span class="step-number">2</span>
          <div>Firma el contrato legal de prestación de servicios para activar tu cupo.</div>
        </li>
      </ul>
    `;

    actionBtn.style.display = 'inline-flex';
    actionBtn.textContent = '1. Aceptar Evaluador en Meta ↗';
    actionBtn.onclick = () => {
      window.open('https://developers.facebook.com/requests/', '_blank');
    };

    verifyBtn.style.display = 'inline-flex';
    verifyBtn.textContent = '2. Ir a Firma de Contrato Digital ➔';
    verifyBtn.onclick = () => {
      verifyBtn.textContent = 'Redirigiendo a contrato.html...';
      window.location.href = `contrato.html?clientId=${encodeURIComponent(activeClientId)}&fbUser=${encodeURIComponent(activeFbUser)}`;
    };
  }

  // =========================================================================
  // PASO 1: REGRESO DESDE EL EXCEL -> INICIAR CICLO DE META
  // =========================================================================
  else if (step === 'excel_and_fb' || step === 'excel_uploaded') {
    loaderEl.style.display = 'none';
    const activeClientId = await resolveClientId();
    const activeFbUser = fbUserParam || 'Evaluador Meta';

    badgeEl.textContent = `Paso 2 de 3 • Cliente ${activeClientId}`;
    titleEl.textContent = 'Excel Recibido • Inyectando Audiencias';
    bodyEl.textContent = `Hemos vinculado la base de datos de compradores para el usuario @${activeFbUser}. Conecta tu cuenta publicitaria para compilar y generar los borradores.`;

    stepsContainer.innerHTML = `
      <ul class="steps-list">
        <li>
          <span class="step-number">1</span>
          <div>Evaluador asignado: <strong>${activeFbUser}</strong></div>
        </li>
        <li>
          <span class="step-number">2</span>
          <div>Iniciando compilación de audiencias similares en Meta Ads.</div>
        </li>
      </ul>
    `;

    verifyBtn.style.display = 'inline-flex';
    verifyBtn.textContent = 'Iniciar Ciclo en Meta Ads 🚀';
    verifyBtn.onclick = async () => {
      verifyBtn.textContent = 'Conectando con Meta API...';
      try {
        const res = await fetch('/api/facebook/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, clientId: activeClientId, fbUser: activeFbUser })
        });
        const data = await res.json();
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
        } else {
          window.location.href = `index.html?clientId=${encodeURIComponent(activeClientId)}&status=ready_meta#app-dashboard`;
        }
      } catch (err) {
        window.location.href = `index.html?clientId=${encodeURIComponent(activeClientId)}&status=ready_meta#app-dashboard`;
      }
    };
  }

  // =========================================================================
  // PASO 2: CONEXIÓN OAUTH CON META
  // =========================================================================
  else if (step === 'conectar_meta') {
    loaderEl.style.display = 'none';
    badgeEl.textContent = 'Paso 2 de 3 • Vinculación Meta';
    titleEl.textContent = 'Archivos Cargados Exitosamente';
    bodyEl.textContent = 'Tu segmentación en Excel está lista. Conecta tu cuenta corporativa de Facebook para inyectar los conjuntos de anuncios.';

    verifyBtn.style.display = 'inline-flex';
    verifyBtn.textContent = 'Conectar con Facebook Ads';
    verifyBtn.onclick = async () => {
      verifyBtn.textContent = 'Iniciando conexión con Meta...';
      try {
        const res = await fetch('/api/facebook/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });
        const data = await res.json();
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
        } else {
          alert('Error obteniendo la URL de autenticación de Meta.');
        }
      } catch (err) {
        alert('Error de conexión con el servidor.');
      } finally {
        verifyBtn.textContent = 'Conectar con Facebook Ads';
      }
    };
  }

  // =========================================================================
  // PASO 3: ACTIVACIÓN DE CAMPAÑA (CLIENTE VS ADMIN)
  // =========================================================================
  else if (step === 'activar_campana' || paymentType === 'recurring') {
    loaderEl.style.display = 'none';

    if (role === 'admin') {
      badgeEl.textContent = 'Panel Administrador • Verificación';
      titleEl.textContent = 'Gestión Admin: Campaña Generada';
      bodyEl.textContent = 'Se ha inyectado el borrador de la campaña para el cliente. Puedes revisarlo en Meta Ads Manager y confirmar la activación en el panel general.';

      stepsContainer.innerHTML = `
        <ul class="steps-list">
          <li>
            <span class="step-number">1</span>
            <div>Verifica o edita la campaña generada en Meta Ads Manager.</div>
          </li>
          <li>
            <span class="step-number">2</span>
            <div>Confirma la verificación para regresar a la gestión en Admin.</div>
          </li>
        </ul>
      `;

      actionBtn.style.display = 'inline-flex';
      actionBtn.textContent = '1. Revisar en Meta Ads Manager ↗';
      actionBtn.onclick = () => {
        const webUrl = `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${actId}&selected_campaign_ids=${campaignId}`;
        window.open(webUrl, '_blank');
      };

      verifyBtn.style.display = 'inline-flex';
      verifyBtn.textContent = '2. Confirmar y Volver a Admin.html';
      verifyBtn.onclick = async () => {
        verifyBtn.textContent = 'Confirmando cambios...';
        try {
          await fetch('/api/facebook/activar-campana', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, campaignId, role: 'admin' })
          });
        } catch (err) {
          console.warn("Redirigiendo a admin...");
        }
        window.location.href = `/admin.html?sessionId=${sessionId || ''}&status=verified_by_admin`;
      };

    } else {
      // Flujo Normal para Clientes
      const activeClientId = await resolveClientId();

      badgeEl.textContent = `Paso Final • ${activeClientId}`;
      titleEl.textContent = 'Borrador Generado en Meta';
      bodyEl.textContent = 'El borrador de tu campaña ha sido preparado. Abre Meta Ads Manager para publicar presupuesto/creativos y pasa a tu Dashboard.';

      stepsContainer.innerHTML = `
        <ul class="steps-list">
          <li>
            <span class="step-number">1</span>
            <div>Abre Meta Ads Manager para publicar el borrador generado.</div>
          </li>
          <li>
            <span class="step-number">2</span>
            <div>Accede a tu Dashboard. La campaña pasará al estado de verificación.</div>
          </li>
        </ul>
      `;

      actionBtn.style.display = 'inline-flex';
      actionBtn.textContent = '1. Abrir Meta Ads Manager ↗';
      actionBtn.onclick = () => {
        const webUrl = `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${actId}&selected_campaign_ids=${campaignId}`;
        const appUrl = `fb://adsmanager/campaign?act=${actId}&campaign_id=${campaignId}`;

        if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
          const start = Date.now();
          window.location.href = appUrl;
          setTimeout(() => {
            if (Date.now() - start < 3000) window.location.href = webUrl;
          }, 2500);
        } else {
          window.open(webUrl, '_blank');
        }
      };

      verifyBtn.style.display = 'inline-flex';
      verifyBtn.textContent = '2. Ir a mi Dashboard (En Verificación) 📊';
      verifyBtn.onclick = async () => {
        verifyBtn.textContent = 'Confirmando en servidor...';
        try {
          await fetch('/api/facebook/activar-campana', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, campaignId, clientId: activeClientId })
          });
        } catch (err) {
          console.warn("Navegando hacia el dashboard...");
        }

        window.location.href = `/client.html?clientId=${encodeURIComponent(activeClientId)}&sessionId=${sessionId || ''}&campaignId=${campaignId || ''}&status=verifying`;
      };
    }
  }

  // =========================================================================
  // PASO 4: CONFIRMAR PAGO INICIAL / EVENTO CAPI
  // =========================================================================
  else if (step === 'confirmar_pago') {
    loaderEl.style.display = 'none';
    const activeClientId = await resolveClientId();

    localStorage.setItem('sodie_payment_completed', 'true');

    if (typeof fbq === 'function') {
      fbq('track', 'Purchase', { value: 7000.00, currency: 'USD', content_name: 'Reserva Inicial SODIE' });
    }

    badgeEl.textContent = `Pago Exitoso • ${activeClientId}`;
    titleEl.textContent = '¡Pago Registrado!';
    bodyEl.textContent = 'Registrando evento CAPI y redirigiendo a tu panel...';
    
    setTimeout(() => {
      const targetUrl = role === 'admin' 
        ? `/admin.html?sessionId=${sessionId || ''}&status=paid_success` 
        : `/client.html?clientId=${encodeURIComponent(activeClientId)}&sessionId=${sessionId || ''}&status=paid_success`;
      window.location.href = targetUrl;
    }, 2000);
  }

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
