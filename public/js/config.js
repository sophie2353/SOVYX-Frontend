// config.js
(function () {
  // Detectar un origin válido o construir un fallback seguro
  var getSafeOrigin = function () {
    if (window.location && window.location.origin && window.location.origin !== 'null') {
      return window.location.origin;
    }
    // Fallback en caso de file:// o entono restringido
    return window.location.protocol + '//' + window.location.host;
  };

  window.SODIE_CONFIG = Object.assign({}, window.SODIE_CONFIG, {
    // URL de la API del entorno SODIE
    API_URL: getSafeOrigin()
  });
})();
