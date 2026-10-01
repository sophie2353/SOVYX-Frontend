document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  
  // Extraer credenciales pasadas por URL o recuperar del localStorage
  const email = urlParams.get('email') || localStorage.getItem('sodie_v4_email');
  const userId = urlParams.get('userId') || localStorage.getItem('sodie_v4_user_id');

  const titleEl = document.getElementById('conf-title');
  const bodyEl = document.getElementById('conf-body');
  const badgeEl = document.getElementById('conf-badge');
  const loaderEl = document.getElementById('loader-box');
  const resultBox = document.getElementById('result-box');
  const generatedIdElem = document.getElementById('generated-client-id');
  const cuposRestantesElem = document.getElementById('cupos-restantes-text');
  const actionBtn = document.getElementById('conf-action-btn');

  // Registrar evento CAPI / Meta Pixel por la reserva
  if (typeof fbq === 'function') {
    fbq('track', 'Purchase', { value: 2000.00, currency: 'USD', content_name: 'Reserva Lista de Espera V4' });
  }

  try {
    // Llamada directa al endpoint POST /confirm-waitlist
    const response = await fetch('/api/waitlist/confirm-waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, userId })
    });

    const data = await response.json();

    if (data.success) {
      const assignedClientId = data.clientId;
      const waitlistStatus = data.waitlistStatus;

      // Guardar identificador y datos en localStorage
      localStorage.setItem('sodie_v4_client_id', assignedClientId);
      if (email) localStorage.setItem('sodie_v4_email', email);

      // Actualizar interfaz con respuesta del Backend
      loaderEl.classList.add('d-none');
      
      badgeEl.textContent = `Lista de Espera V4 • ${assignedClientId}`;
      titleEl.textContent = '¡Pago Confirmado con Éxito!';
      bodyEl.textContent = 'Tu cupo ha sido reservado formalmente en el sistema. Procede a la firma del contrato legal para finalizar tu registro prioritario.';

      generatedIdElem.textContent = assignedClientId;
      cuposRestantesElem.innerHTML = `Cupos prioritarios restantes: <strong>${waitlistStatus.cuposRestantes} / ${waitlistStatus.cuposTotales}</strong> (Confirmados: ${waitlistStatus.confirmados})`;

      resultBox.classList.remove('d-none');
      actionBtn.classList.remove('d-none');

      // Botón hacia el contrato de lista de espera
      actionBtn.onclick = () => {
        actionBtn.textContent = 'Redirigiendo a contrato...';
        window.location.href = `contract-waitlist.html?clientId=${encodeURIComponent(assignedClientId)}${email ? `&email=${encodeURIComponent(email)}` : ''}`;
      };

    } else {
      throw new Error(data.error || 'No se pudo procesar la confirmación.');
    }

  } catch (error) {
    console.error('Error procesando confirm-waitlist:', error);
    loaderEl.classList.add('d-none');
    titleEl.textContent = 'Error de Confirmación';
    bodyEl.textContent = error.message || 'Ocurrió un inconveniente al validar la transacción. Por favor contacta a soporte.';
  }
});
