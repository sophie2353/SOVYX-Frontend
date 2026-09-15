// config.js
window.SODIE_CONFIG = {
  API_URL: ''
};

// Cargar la configuración dinámicamente desde el Backend
async function sodieCargarConfiguracion() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    window.SODIE_CONFIG.API_URL = data.API_URL;
  } catch (err) {
    // Si falla o no responde, usa la misma URL de origen de la página
    window.SODIE_CONFIG.API_URL = window.location.origin;
  }
}

// Ejecutar de inmediato
sodieCargarConfiguracion();
