const textarea = document.getElementById('notebook');
const folioInput = document.getElementById('folio-number');
const dateInput = document.getElementById('invoice-date');
const clientNameInput = document.getElementById('client-name');

let archivoActual = null;
let urlActual = null;

function getNextFolio() {
  let currentFolioNum = parseInt(localStorage.getItem('ahrco_folio_num'), 10) || 1;
  const formattedFolio = 'A' + String(currentFolioNum).padStart(10, '0');
  if (folioInput) {
    folioInput.value = formattedFolio;
  }
}

function incrementFolio() {
  let currentFolioNum = parseInt(localStorage.getItem('ahrco_folio_num'), 10) || 1;
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

// Procesa la captura limpia del elemento html2canvas
function obtenerCapturaCanvas() {
  const elemento = document.getElementById('factura-card');
  const clearBtn = document.getElementById('clear-signature');
  if (!elemento) return Promise.resolve(null);

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

    return canvas;
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
    obtenerCapturaCanvas().then(canvas => {
      if (canvas) registrarEmisionFactura(canvas.toDataURL('image/png'));
    });
  }
});

// GENERACIÓN DE IMAGEN CON VISTA PREVIA FLOTANTE (COMPATIBLE CON IPHONE Y ANDROID)
async function generarImagenFactura() {
  const canvas = await obtenerCapturaCanvas();
  if (!canvas) return;

  const folioStr = folioInput ? folioInput.value : 'factura';
  const nombre = `Factura_${folioStr}.png`;

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;

  archivoActual = new File([blob], nombre, { type: 'image/png' });

  if (urlActual) URL.revokeObjectURL(urlActual);
  urlActual = URL.createObjectURL(blob);

  const previewImg = document.getElementById('preview-img');
  const overlay = document.getElementById('preview-overlay');

  if (previewImg && overlay) {
    previewImg.src = urlActual;
    overlay.classList.remove('hidden');
  }

  // Registrar emisión en historial al generar
  registrarEmisionFactura(canvas.toDataURL('image/png'));
}

// BOTONES DEL MODAL DE VISTA PREVIA
document.addEventListener('DOMContentLoaded', () => {
  const btnGuardar = document.getElementById('btn-guardar-fotos');
  const btnCompartir = document.getElementById('btn-compartir-wa');
  const btnCerrar1 = document.getElementById('btn-cerrar-preview');
  const btnCerrar2 = document.getElementById('btn-cerrar-preview-2');
  const overlay = document.getElementById('preview-overlay');

  const cerrarModal = () => {
    if (overlay) overlay.classList.add('hidden');
  };

  if (btnCerrar1) btnCerrar1.addEventListener('click', cerrarModal);
  if (btnCerrar2) btnCerrar2.addEventListener('click', cerrarModal);

  // BOTÓN COMPARTIR
  if (btnCompartir) {
    btnCompartir.addEventListener('click', () => {
      if (!archivoActual) return;

      if (navigator.canShare && navigator.canShare({ files: [archivoActual] })) {
        navigator.share({ title: 'Factura AHRCO', files: [archivoActual] }).catch(() => {});
      } else {
        alert("Tu navegador no permite compartir archivos directamente. Usa 'Guardar en Fotos' y luego adjúntala en WhatsApp.");
      }
    });
  }

  // BOTÓN GUARDAR EN FOTOS
  if (btnGuardar) {
    btnGuardar.addEventListener('click', () => {
      if (!urlActual) return;

      const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      if (esIOS) {
        alert("Mantén presionada la imagen de arriba y elige 'Agregar a Fotos' o 'Guardar Imagen'.");
      } else {
        const enlace = document.createElement('a');
        enlace.href = urlActual;
        enlace.download = archivoActual ? archivoActual.name : 'Factura.png';
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
      }
    });
  }
});

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
      <td class="py-3 px-4 text-center flex justify-center gap-2">
        <button onclick="verCapturaFactura(${index})" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1 rounded text-xs transition-colors">
          👁️ Ver
        </button>
        <button onclick="eliminarFactura(${index})" class="bg-red-600 hover:bg-red-700 text-white font-semibold px-2 py-1 rounded text-xs transition-colors" title="Eliminar de historial">
          🗑️
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

function eliminarFactura(index) {
  let historial = JSON.parse(localStorage.getItem('ahrco_historial')) || [];
  if (confirm(`¿Deseas borrar del historial la factura ${historial[index]?.folio}?`)) {
    historial.splice(index, 1);
    localStorage.setItem('ahrco_historial', JSON.stringify(historial));
    renderHistorial();
  }
}

function cerrarVisorFactura() {
  const visorModal = document.getElementById('modal-visor-factura');
  if (visorModal) visorModal.classList.add('hidden');
}

function limpiarHistorial() {
  if (confirm("¿Seguro que deseas borrar TODO el historial de facturas?")) {
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

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let isDrawing = false;

  function resizeCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);

    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.scale(ratio, ratio);

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000000';

    if (tempCanvas.width > 0 && tempCanvas.height > 0) {
      ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width / ratio, tempCanvas.height / ratio);
    }
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', resizeCanvas);

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const touch = (e.touches && e.touches.length > 0) ? e.touches[0] : (e.changedTouches ? e.changedTouches[0] : e);
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
    startDrawing(e);
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    draw(e);
  }, { passive: false });

  canvas.addEventListener('touchend', stopDrawing, { passive: false });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });
  }
}