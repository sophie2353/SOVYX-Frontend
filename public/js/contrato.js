document.getElementById('contract-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const btnSubmit = e.target.querySelector('.btn-submit');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Procesando firma...';

    // 1. Extraer todos los metadatos del formulario
    const payload = {
        fullName: document.getElementById('user_fullname').value,
        email: document.getElementById('user_email').value,
        ipAddress: document.getElementById('ip_address').value,
        timestamp: document.getElementById('timestamp').value,
        acceptedTerms: document.getElementById('accept_terms').checked,
        softwareName: 'SODIE',
        softwareVersion: '3.5.0'
    };

    try {
        // 2. Enviar Webhook a tu Backend o Servicio de Automatización (ej. n8n / Make / Node.js)
        const response = await fetch('/api/webhook/contrato-firmado', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const result = await response.json();
            
            // 3. Ocultar el formulario de contrato y mostrar la pasarela
            document.querySelector('.audit-box').style.display = 'none';
            
            const paymentDiv = document.getElementById('payment-section');
            paymentDiv.style.display = 'block';
            
            // Pasar el ID temporal/email al iframe o widget de NOWPayments
            iniciarPasarelaNowPayments(payload, result.contratoId);
        } else {
            alert('Error al registrar la firma. Intenta nuevamente.');
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Aceptar y Firmar Digitalmente';
        }
    } catch (error) {
        console.error('Error enviando webhook:', error);
        alert('Error de conexión con el servidor.');
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Aceptar y Firmar Digitalmente';
    }
});

function iniciarPasarelaNowPayments(clienteData, contratoId) {
    // Ejemplo de integración con el Widget / Invoice API de NOWPayments
    console.log(`Iniciando pago para ${clienteData.email} con Contrato ID: ${contratoId}`);
}
