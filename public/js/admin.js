// ==========================================
// SODIE - ADMIN ENGINE (admin.js)
// ==========================================

// 1. TEMPORIZADOR DE 120 HORAS EN ADMIN
let totalSeconds120H = 120 * 3600; // 120 horas en segundos
let adminTimerInterval = null;

function updateAdmin120HTimer() {
  const display = document.getElementById('admin-120h-timer');
  if (!display) return;

  if (totalSeconds120H <= 0) {
    display.innerText = "000:00:00";
    clearInterval(adminTimerInterval);
    return;
  }

  const hours = Math.floor(totalSeconds120H / 3600);
  const minutes = Math.floor((totalSeconds120H % 3600) / 60);
  const seconds = totalSeconds120H % 60;

  const hStr = String(hours).padStart(3, '0');
  const mStr = String(minutes).padStart(2, '0');
  const sStr = String(seconds).padStart(2, '0');

  display.innerText = `${hStr}:${mStr}:${sStr}`;
  totalSeconds120H--;
}

function startAdminTimer() {
  if (!adminTimerInterval) {
    updateAdmin120HTimer();
    adminTimerInterval = setInterval(updateAdmin120HTimer, 1000);
  }
}

// 2. ACCIONES DE CONTROL

function sodieConfirmarActivacion() {
  if (confirm("¿Seguro que deseas activar la campaña directa?")) {
    alert("Campaña activa correctamente.");
  }
}

function sodieToggleWaitlistMode(activar) {
  if (activar) {
    alert("Dashboard Principal cerrado. Lista de espera $5K activada.");
  } else {
    alert("Lista de espera desactivada. Flow de pago $1K restablecido.");
  }
}

function sodieCerrarListaEspera() {
  if (confirm("¿Cerrar lista de espera y activar la cuenta regresiva oficial de 14 días para la V4 en el Dashboard Principal?")) {
    // Aquí puedes disparar la llamada al backend o localstorage para activar los 14 días
    localStorage.setItem('v4_timer_active', 'true');
    alert("⏳ ¡Lista de espera cerrada! Notificaciones push enviadas y Temporizador de 14 días activado en el Dashboard Principal.");
  }
}

// 3. CARGA DE ARCHIVOS Y EVENTOS
document.addEventListener("DOMContentLoaded", () => {
  // Arranca el reloj de 120 horas de la sección Admin
  startAdminTimer();

  document.getElementById('btn-upload-video')?.addEventListener('click', () => {
    const file = document.getElementById('admin-video-file')?.files[0];
    if (file) alert(`Video "${file.name}" cargado exitosamente.`);
    else alert("Selecciona un archivo de video primero.");
  });

  document.getElementById('btn-upload-contract')?.addEventListener('click', () => {
    const file = document.getElementById('admin-contract-file')?.files[0];
    if (file) alert(`Contrato "${file.name}" cargado exitosamente.`);
    else alert("Selecciona un archivo PDF primero.");
  });

  document.getElementById('btn-upload-excel')?.addEventListener('click', () => {
    const file = document.getElementById('admin-excel-file')?.files[0];
    if (file) alert(`Excel "${file.name}" cargado exitosamente.`);
    else alert("Selecciona un archivo Excel/CSV primero.");
  });
});
