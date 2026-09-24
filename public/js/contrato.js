function getBaseUrl() {
  if (window.SODIE_CONFIG && window.SODIE_CONFIG.API_URL) {
    return window.SODIE_CONFIG.API_URL.replace(/\/$/, '');
  }
  return window.location.origin;
}
// 1. Extraer Parámetros URL (clientId y fbUser)
    const urlParams = new URLSearchParams(window.location.search);
    const clientId = urlParams.get('clientId') || localStorage.getItem('sodie_client_id') || 'CLIENT-#01';
    const fbUser = urlParams.get('fbUser') || localStorage.getItem('sodie_fb_user') || 'Evaluador';

    // Asignar Timestamp
    document.getElementById('timestamp').value = new Date().toISOString();

    // Obtener la IP pública mediante API
    fetch('https://api.ipify.org?format=json')
        .then(res => res.json())
        .then(data => {
            document.getElementById('ip_address').value = data.ip;
        })
        .catch(() => {
            document.getElementById('ip_address').value = "127.0.0.1 (Local/Simulado)";
        });

    // Redirección centralizada a confirmacion.html
    function redirectToConfirmation() {
        const nextUrl = `confirmacion.html?step=excel_and_fb&clientId=${encodeURIComponent(clientId)}&fbUser=${encodeURIComponent(fbUser)}`;
        window.location.href = nextUrl;
    }

    // 2. Manejador del Formulario de Firma Digital
    document.getElementById('contract-form').addEventListener('submit', async function(e) {
        e.preventDefault();

        const btnSubmit = e.target.querySelector('.btn-submit');
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Procesando firma y vinculando evaluador...';

        const payload = {
            clientId: clientId,
            fbUser: fbUser,
            fullName: document.getElementById('user_fullname').value,
            email: document.getElementById('user_email').value,
            ipAddress: document.getElementById('ip_address').value,
            timestamp: document.getElementById('timestamp').value,
            acceptedTerms: document.getElementById('accept_terms').checked,
            softwareName: 'SODIE',
            softwareVersion: '3.5.0'
        };

        try {
            await fetch('/api/webhook/contrato-firmado', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (error) {
            console.warn('Webhook no disponible, continuando flujo local...', error);
        }

        // Marcar contrato firmado localmente
        localStorage.setItem('sodie_contract_signed', 'true');

        // Redirigir a confirmacion.html?step=excel_and_fb
        redirectToConfirmation();
    });

    // Acción para el botón opcional de pago finalizado
    document.getElementById('btn-finish-payment').addEventListener('click', () => {
        redirectToConfirmation();
    });
