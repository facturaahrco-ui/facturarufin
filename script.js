const textarea = document.getElementById('notebook');
const folioInput = document.getElementById('folio-number');

// 1. Manejo del Folio Persistente
function getNextFolio() {
  let currentFolioNum = parseInt(localStorage.getItem('ahrco_folio_num')) || 1;
  const formattedFolio = 'A' + String(currentFolioNum).padStart(10, '0');
  if (folioInput) {
    folioInput.value = formattedFolio;
  }
}

function incrementFolio() {
  let currentFolioNum = parseInt(localStorage.getItem('ahrco_folio_num')) || 1;
  localStorage.setItem('ahrco_folio_num', currentFolioNum + 1);
}

// Escuchar evento de impresión (AirPrint o Impresión Web)
window.addEventListener('beforeprint', () => {
  incrementFolio();
});

window.addEventListener('afterprint', () => {
  getNextFolio();
});

// 2. Ajuste de Altura Dinámico
function adjustHeight() {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

textarea.addEventListener('input', adjustHeight);

window.addEventListener('load', () => {
  getNextFolio();

  if (!textarea.value) {
    textarea.value = '\n'.repeat(15);
  }
  adjustHeight();
  initSignaturePad();
});

// 3. Firma Táctil Compatible con iOS Safari (Soportando Retina Display)
function initSignaturePad() {
  const canvas = document.getElementById('signature-pad');
  const clearBtn = document.getElementById('clear-signature');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let isDrawing = false;

  function resizeCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    
    // Ajuste de resolución para pantallas Retina de iPhone
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.scale(ratio, ratio);

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000000';
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
  }

  function startDrawing(e) {
    isDrawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function draw(e) {
    if (!isDrawing) return;
    if (e.cancelable) e.preventDefault(); // Previene scroll en iOS Safari
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function stopDrawing() {
    isDrawing = false;
  }

  // Eventos de Mouse
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseleave', stopDrawing);

  // Eventos Táctiles iOS / Android
  canvas.addEventListener('touchstart', (e) => {
    if (e.cancelable) e.preventDefault();
    startDrawing(e);
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    if (e.cancelable) e.preventDefault();
    draw(e);
  }, { passive: false });

  canvas.addEventListener('touchend', stopDrawing);

  clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });
}