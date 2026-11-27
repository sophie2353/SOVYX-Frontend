/**
 * SODIE v4 - Motor del Panel Supervisor (js/supervisor.js)
 * Incluye Bypass automático para ADMIN y vista interna de clientes sin redirecciones.
 */
(() => {
  const MOCK_METRICS = {
    'CLIENT-#01': { spend: 4250, reach: 68400, visitors: 1420, activos: 38 },
    'CLIENT-#02': { spend: 1890, reach: 31500, visitors: 780,  activos: 19 },
    'CLIENT-#03': { spend: 7600, reach: 124000, visitors: 3110, activos: 74 },
    'CLIENT-#04': { spend: 950,  reach: 15200, visitors: 410,  activos: 11 }
  };

  function getBaseUrl() {
    if (window.SODIE_CONFIG && window.SODIE_CONFIG.API_URL) {
      return window.SODIE_CONFIG.API_URL.replace(/\/$/, '');
    }
    return window.location.origin;
  }

  function esAdminBypass() {
    const params = new URLSearchParams(window.location.search);
    const bioSession = typeof SodieBiometria !== 'undefined' ? SodieBiometria.obtenerSesion() : null;
    return (
      params.get('admin') === 'true' ||
      sessionStorage.getItem('sodie_admin_session') === 'active' ||
      localStorage.getItem('sodie_admin_session') === 'active' ||
      localStorage.getItem('sodie_admin_bypass') === 'true' ||
      (bioSession && bioSession.role === 'ADMIN')
    );
  }

  function showSupToast(title, body) {
    const toast = document.getElementById('sup-toast');
    const tTitle = document.getElementById('sup-toast-title');
    const tBody = document.getElementById('sup-toast-body');
    if (!toast || !tTitle || !tBody) return;
    tTitle.textContent = title;
    tBody.textContent = body;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3500);
  }

  function abrirDashboardSupervisor(isAdmin = false) {
    document.getElementById('sup-auth-card')?.classList.add('hidden');
    document.getElementById('sup-dashboard')?.classList.remove('hidden');

    if (isAdmin) {
      document.getElementById('admin-test-bar')?.classList.remove('hidden');
      const roleBadge = document.getElementById('sup-role-badge');
      if (roleBadge) roleBadge.textContent = 'ADMIN (VISTA SUP)';
    }

    cargarPagosSoloLectura();
  }

  async function cargarPagosSoloLectura() {
    const feed = document.getElementById('sup-payments-feed');
    const count = document.getElementById('sup-pay-count');
    if (!feed) return;

    let backendList = [];
    try {
      const res = await fetch(`${getBaseUrl()}/api/v1/webhook-payment/admin/payments`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.payments)) backendList = data.payments;
      }
    } catch {
      // Silencioso si no hay conexión
    }

    const localMocks = JSON.parse(localStorage.getItem('sodie_sup_test_payments') || '[]');
    const list = [...backendList, ...localMocks];

    if (count) count.textContent = list.length;

    if (list.length === 0) {
      feed.innerHTML = '<div class="sup-sub" style="text-align:center; padding:16px; border:1px dashed #2a2a35; border-radius:12px;">Sin activaciones registradas aún.</div>';
      return;
    }

    feed.innerHTML = list.map((p) => `
      <div class="client-row" style="padding:12px 14px;">
        <div class="client-meta">
          <strong>${p.clientId} • ${p.amount}</strong>
          <small>${p.network} • ${p.timestamp}</small>
        </div>
        <span class="sup-badge sup-badge-mint">${p.status}</span>
      </div>
    `).join('');
  }

  // NAVEGACIÓN INTERNA: ABRE EL CLIENTE COMO SECCIÓN SIN SALIR DE SUPERVISOR
  async function abrirSeccionCliente(clientId) {
    document.getElementById('sup-main-view')?.classList.add('hidden');
    document.getElementById('sup-client-inspector')?.classList.remove('hidden');
    document.getElementById('insp-client-id').textContent = clientId;

    let metrics = MOCK_METRICS[clientId] || { spend: 0, reach: 0, visitors: 0, activos: 0 };

    try {
      const res = await fetch(`${getBaseUrl()}/api/facebook/metrics?clientId=${encodeURIComponent(clientId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.hasActiveCampaign) metrics = { ...metrics, ...data };
      }
    } catch {
      // Usa fallback si el backend no responde
    }

    document.getElementById('insp-spend').textContent = `$${Number(metrics.spend || 0).toLocaleString('en-US')}`;
    document.getElementById('insp-reach').textContent = Number(metrics.reach || 0).toLocaleString('en-US');
    document.getElementById('insp-visits').textContent = Number(metrics.visitors || 0).toLocaleString('en-US');
    document.getElementById('insp-active').textContent = Number(metrics.activos || 0).toLocaleString('en-US');
  }

  function volverAListaPrincipal() {
    document.getElementById('sup-client-inspector')?.classList.add('hidden');
    document.getElementById('sup-main-view')?.classList.remove('hidden');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const statusEl = document.getElementById('sup-auth-status');

    // 1. Verificar Bypass Admin o sesión biométrica existente
    if (esAdminBypass()) {
      abrirDashboardSupervisor(true);
    } else {
      const bio = typeof SodieBiometria !== 'undefined' ? SodieBiometria.obtenerSesion() : null;
      if (bio && bio.role === 'SUPERVISOR') {
        abrirDashboardSupervisor(false);
      }
    }

    // 2. Botones de Biometría Supervisor
    document.getElementById('btn-sup-bio-register')?.addEventListener('click', async () => {
      statusEl.textContent = 'Esperando sensor biométrico...';
      const res = await SodieBiometria.registrar('SUPERVISOR');
      statusEl.textContent = res.ok ? '✅ Biometría registrada. Ya puedes entrar.' : `❌ ${res.error}`;
    });

    document.getElementById('btn-sup-bio-login')?.addEventListener('click', async () => {
      statusEl.textContent = 'Validando biometría...';
      const res = await SodieBiometria.validar('SUPERVISOR');
      if (res.ok) abrirDashboardSupervisor(false);
      else statusEl.textContent = `❌ ${res.error}`;
    });

    // 3. Abrir cliente como sección interna (sin link web)
    document.querySelectorAll('.btn-inspect-client').forEach((btn) => {
      btn.addEventListener('click', () => abrirSeccionCliente(btn.dataset.id));
    });

    document.getElementById('btn-back-to-list')?.addEventListener('click', volverAListaPrincipal);

    // 4. Controles de prueba exclusivos de Admin
    document.getElementById('btn-admin-sim-pay')?.addEventListener('click', () => {
      const mock = {
        clientId: 'CLIENT-#01',
        amount: '$50,000 USDC',
        network: 'Polygon (Test Admin)',
        status: 'CONFIRMADO',
        timestamp: new Date().toLocaleTimeString()
      };
      const list = JSON.parse(localStorage.getItem('sodie_sup_test_payments') || '[]');
      list.unshift(mock);
      localStorage.setItem('sodie_sup_test_payments', JSON.stringify(list.slice(0, 15)));
      cargarPagosSoloLectura();
      showSupToast('Pago Simulado', 'CLIENT-#01 • $50,000 USDC cargado en vista Supervisor.');
    });

    document.getElementById('btn-admin-sim-notif')?.addEventListener('click', () => {
      showSupToast('Alerta de Prueba', 'Notificación en tiempo real verificada correctamente.');
    });

    document.getElementById('btn-admin-back')?.addEventListener('click', () => {
      window.location.href = '/admin';
    });

    // 5. Cerrar Sesión
    document.getElementById('btn-sup-logout')?.addEventListener('click', () => {
      if (typeof SodieBiometria !== 'undefined') SodieBiometria.cerrarSesion();
      window.location.reload();
    });
  });
})();
