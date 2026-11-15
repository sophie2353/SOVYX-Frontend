/**
 * SODIE V4 - Motor de Firma Digital y Registro Legal de IP (contrato.js)
 * Sincronizado con app.js y confirmacion.js (Soporta Modo Test / ADMIN)
 */

function getBaseUrl() {
  if (window.SODIE_CONFIG && window.SODIE_CONFIG.API_URL) {
    return window.SODIE_CONFIG.API_URL.replace(/\/$/, '');
  }
  return window.location.origin;
}

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const isAdminOrTest = (
    sessionStorage.getItem('sodie_admin_session') === 'active' ||
    localStorage.getItem('sodie_admin_session') === 'active' ||
    localStorage.getItem('sodie_admin_bypass') === 'true' ||
    urlParams.get('admin') === 'true' ||
    urlParams.get('test') === 'true'
  );

  // 1. Extraer y persistir clientId (Si es Admin/Test y no viene forzado otro en URL, usa ADMIN)
  const clientId = urlParams.get('clientId') || (isAdminOrTest ? 'ADMIN' : (localStorage.getItem('sodie_client_id') || localStorage.getItem('sodie_active_client_id') || 'CLIENT-#01'));
  const fbUser = urlParams.get('fbUser') || localStorage.getItem('sodie_fb_user') || 'Evaluador';
  const sessionId = urlParams.get('sessionId') || '';

  localStorage.setItem('sodie_client_id', clientId);
  localStorage.setItem('sodie_active_client_id', clientId);
  localStorage.setItem('sodie_fb_user', fbUser);

  // Asignar Timestamp ISO
  const timestampInput = document.getElementById('timestamp');
  if (timestampInput) {
    timestampInput.value = new Date().toISOString();
  }

  // Obtener IP pública para el respaldo legal
  const ipInput = document.getElementById('ip_address');
  if (ipInput) {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => {
        ipInput.value = data.ip;
      })
      .catch(() => {
        ipInput.value = '127.0.0.1 (Local/Simulado)';
      });
  }

  // Redirección al siguiente paso del flujo
  function redirectToConfirmation() {
    const adminSuffix = isAdminOrTest ? '&admin=true' : '';
    const nextUrl = `confirmacion.html?step=excel_and_fb&clientId=${encodeURIComponent(clientId)}&fbUser=${encodeURIComponent(fbUser)}&sessionId=${encodeURIComponent(sessionId)}${adminSuffix}`;
    window.location.href = nextUrl;
  }

  // 2. Manejador del Formulario de Firma Digital
  const contractForm = document.getElementById('contract-form');
  if (contractForm) {
    contractForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      const btnSubmit = e.target.querySelector('.btn-submit') || e.target.querySelector('button[type="submit"]');
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Procesando firma legal y registrando IP...';
      }

      const fullNameEl = document.getElementById('user_fullname');
      const emailEl = document.getElementById('user_email');
      const termsEl = document.getElementById('accept_terms');

      const payload = {
        clientId: clientId,
        fbUser: fbUser,
        fullName: fullNameEl ? fullNameEl.value.trim() : 'Admin Test',
        email: emailEl ? emailEl.value.trim() : 'admin@socredi.com',
        ipAddress: ipInput ? ipInput.value : '127.0.0.1',
        timestamp: timestampInput ? timestampInput.value : new Date().toISOString(),
        acceptedTerms: termsEl ? termsEl.checked : true,
        softwareName: 'SODIE',
        softwareVersion: '4.0.0'
      };

      try {
        await fetch(`${getBaseUrl()}/api/webhook/contrato-firmado`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (error) {
        console.warn('Webhook no disponible en este entorno, continuando flujo...', error);
      }

      // Sincroniza ambas llaves de contrato firmado (para contrato.js y para app.js)
      localStorage.setItem('sodie_contract_signed', 'true');
      localStorage.setItem('sodie_contract_completed', 'true');

      redirectToConfirmation();
    });
  }
});
