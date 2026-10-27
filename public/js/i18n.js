// js/i18n.js
const dictionary = {
    en: {
        btn_active: "Activate Campaign",
        admin_title: "Admin Dashboard",
        client_welcome: "Welcome back"
    },
    pt: {
        btn_active: "Ativar Campanha",
        admin_title: "Painel do Admin",
        client_welcome: "Bem-vindo de volta"
    }
};

// Función global que traduce toda la página automáticamente
window.setLanguage = function(lang) {
    localStorage.setItem('sodie_lang', lang);
    
    // Traduce los elementos estáticos del HTML
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dictionary[lang] && dictionary[lang][key]) {
            el.innerText = dictionary[lang][key];
        }
    });
};

// Se ejecuta solo al cargar la página detectando el idioma guardado
document.addEventListener("DOMContentLoaded", () => {
    const savedLang = localStorage.getItem('sodie_lang') || 'en';
    window.setLanguage(savedLang);
});
