// js/i18n.js
const dictionary = {
    en: {
        btn_activate: "Activate Campaign",
        btn_confirm: "Confirm",
        btn_save: "Save Changes",
        title_admin: "Control Panel",
        alert_success: "Operation successful!"
    },
    pt: {
        btn_activate: "Ativar Campanha",
        btn_confirm: "Confirmar",
        btn_save: "Salvar Alterações",
        title_admin: "Painel de Controle",
        alert_success: "Operação realizada com sucesso!"
    }
};

// 1. Función global para cambiar y aplicar el idioma en cualquier momento
window.setLanguage = function(lang) {
    // Seguridad por si pasan un idioma que no existe
    if (!dictionary[lang]) lang = 'en';
    
    localStorage.setItem('sodie_lang', lang);
    
    // Traduce todos los elementos estáticos del HTML que tengan la etiqueta
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dictionary[lang][key]) {
            el.innerText = dictionary[lang][key];
        }
    });
};

// 2. Función inteligente que detecta el navegador o el guardado previo
function detectAndApplyLanguage() {
    let lang = localStorage.getItem('sodie_lang');

    // Si es la primera vez que entra, revisa el idioma del navegador
    if (!lang) {
        const browserLang = navigator.language || navigator.userLanguage || '';
        
        // Si el navegador es de Brasil/portugués, pone 'pt', de lo contrario 'en'
        if (browserLang.toLowerCase().startsWith('pt')) {
            lang = 'pt';
        } else {
            lang = 'en'; 
        }
        
        localStorage.setItem('sodie_lang', lang);
    }

    // Aplica el idioma encontrado
    window.setLanguage(lang);
}

// 3. ÚNICO disparador al cargar la página (limpio, sin duplicados)
document.addEventListener("DOMContentLoaded", detectAndApplyLanguage);
