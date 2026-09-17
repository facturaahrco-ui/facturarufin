const textarea = document.getElementById('notebook');
const folioInput = document.getElementById('folio-number');
const dateInput = document.getElementById('invoice-date');
const clientNameInput = document.getElementById('client-name');

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

function setTodayDate() {
  if (dateInput) {
    const today = new Date();
    const formattedDate = today.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    dateInput.value = formattedDate;
  }
}

// Procesa la captura limpia del elemento html2canvas y retorna la imagen base64
function obtenerCapturaDataURL() {
  const elemento = document.getElementById('factura-card');
  const clearBtn = document.getElementById('clear-signature');
  if (!elemento) return Promise.resolve('');

  if (clearBtn) clearBtn.style.display = 'none';

  const paddingOriginal = elemento.style.paddingBottom;
  elemento.style.paddingBottom = '24px';

  const inputs = elemento.querySelectorAll('input, textarea');
  const reemplazos = [];

  inputs.forEach(input => {
    const span = document.createElement('div');
    if (input.tagName.toLowerCase() === 'textarea') {
      span.className = input.className;
      span.style.whiteSpace = 'pre-wrap';
      span.style.minHeight = input.offsetHeight + 'px';
      span.style.lineHeight = '28px';
      span.style.paddingTop = '1px';
      span.textContent = input.value;
    } else {
      span.className = input.className;
      span.style.display = 'inline-block';
      span.style.paddingBottom = '3px';
      span.textContent = input.value || '\u00A0';
    }

    input.style.display = 'none';
    input.parentNode.insertBefore(span, input);
    reemplazos.push({ input, span });
  });

  return html2canvas(elemento, { 
    scale: 2, 
    useCORS: true,
    scrollY: -window.scrollY,
    windowWidth: document.documentElement.offsetWidth
  }).then(canvas => {
    reemplazos.forEach(item => {
      item.span.remove();
      item.input.style.display = '';
    });

    if (clearBtn) clearBtn.style.display = '';
    elemento.style.paddingBottom = paddingOriginal;

    return canvas.toDataURL('image/png');
  });
}

function registrarEmisionFactura(imagenDataURL = '') {
  const folio = folioInput ? folioInput.value : 'A0000000001';
  const cliente = (clientNameInput && clientNameInput.value.trim()) ? clientNameInput.value.trim() : 'Sin Nombre';
  const fecha = dateInput ? dateInput.value : '';

  let historial = JSON.parse(localStorage.getItem('ahrco_historial')) || [];
  historial.unshift({ folio, cliente, fecha, imagen: imagenDataURL });
  localStorage.setItem('ahrco_historial', JSON.stringify(historial));

  incrementFolio();
  getNextFolio();
  renderHistorial();
}

function imprimirFactura() {
  window.print();
}

window.addEventListener('afterprint', () => {
  const seImprimio = confirm("¿Se completó la impresión / PDF de la factura correctamente?");
  if (seImprimio) {
    obtenerCapturaDataURL().then(imgData => {
      registrarEmisionFactura(imgData);
    });
  }
});

function generarImagenFactura() {
  obtenerCapturaDataURL().then(dataURL => {
    if (!dataURL) return;

    const enlace = document.createElement('a');
    const folioStr = folioInput ? folioInput.value : 'factura';
    enlace.download = `Factura_${folioStr}.png`;
    enlace.href = dataURL;
    enlace.click();

    setTimeout(() => {
      const seGuardo = confirm("¿Se descargó correctamente la imagen de la factura?");
      if (seGuardo) {
        registrarEmisionFactura(dataURL);
      }
    }, 400);
  });
}

function abrirHistorial() {
  const modal = document.getElementById('modal-historial');
  if (modal) {
    renderHistorial();
    modal.classList.remove('hidden');
  }
}

function cerrarHistorial() {
  const modal = document.getElementById('modal-historial');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function renderHistorial() {
  const tablaBody = document.getElementById('historial-tabla');
  if (!tablaBody) return;

  let historial = JSON.parse(localStorage.getItem('ahrco_historial')) || [];
  tablaBody.innerHTML = '';

  if (historial.length === 0) {
    tablaBody.innerHTML = `<tr><td colspan="4" class="py-6 px-4 text-center text-gray-400">No hay facturas registradas.</td></tr>`;
    return;
  }

  historial.forEach((item, index) => {
    const fila = document.createElement('tr');
    fila.className = 'border-b hover:bg-gray-50';
    fila.innerHTML = `
      <td class="py-3 px-4 font-bold text-red-700">${item.folio}</td>
      <td class="py-3 px-4 font-medium">${item.cliente}</td>
      <td class="py-3 px-4 text-gray-500">${item.fecha}</td>
      <td class="py-3 px-4 text-center">
        <button onclick="verCapturaFactura(${index})" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1 rounded text-xs transition-colors">
          👁️ Ver
        </button>
      </td>
    `;
    tablaBody.appendChild(fila);
  });
}

function verCapturaFactura(index) {
  let historial = JSON.parse(localStorage.getItem('ahrco_historial')) || [];
  const item = historial[index];
  if (!item || !item.imagen) {
    alert("No se encontró una captura asociada a esta factura.");
    return;
  }

  const visorModal = document.getElementById('modal-visor-factura');
  const visorImg = document.getElementById('visor-imagen');
  const visorTitulo = document.getElementById('visor-titulo');
  const visorDescargar = document.getElementById('visor-descargar');

  if (visorImg && visorModal) {
    visorImg.src = item.imagen;
    if (visorTitulo) visorTitulo.textContent = `Factura ${item.folio} - ${item.cliente}`;
    if (visorDescargar) {
      visorDescargar.href = item.imagen;
      visorDescargar.download = `Factura_${item.folio}.png`;
    }
    visorModal.classList.remove('hidden');
  }
}

function cerrarVisorFactura() {
  const visorModal = document.getElementById('modal-visor-factura');
  if (visorModal) visorModal.classList.add('hidden');
}

function limpiarHistorial() {
  if (confirm("¿Seguro que deseas borrar el historial de facturas?")) {
    localStorage.removeItem('ahrco_historial');
    renderHistorial();
  }
}

function adjustHeight() {
  if (!textarea) return;
  textarea.style.height = 'auto';
  const baseHeight = 420;
  textarea.style.height = Math.max(baseHeight, textarea.scrollHeight) + 'px';
}

if (textarea) {
  textarea.addEventListener('input', adjustHeight);
}

window.addEventListener('load', () => {
  getNextFolio();
  setTodayDate();

  if (textarea) {
    if (!textarea.value) {
      textarea.value = '\n'.repeat(15);
    }
    adjustHeight();
  }
  initSignaturePad();
});

function initSignaturePad() {
  const canvas = document.getElementById('signature-pad');
  const clearBtn = document.getElementById('clear-signature');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let isDrawing = false;

  function resizeCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    
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
    if (e.cancelable) e.preventDefault();
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function stopDrawing() {
    isDrawing = false;
  }

  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseleave', stopDrawing);

  canvas.addEventListener('touchstart', (e) => {
    if (e.cancelable) e.preventDefault();
    startDrawing(e);
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    if (e.cancelable) e.preventDefault();
    draw(e);
  }, { passive: false });

  canvas.addEventListener('touchend', stopDrawing);

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
  }
}