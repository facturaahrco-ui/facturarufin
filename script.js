const textarea = document.getElementById('notebook');
const folioInput = document.getElementById('folio-number');
const dateInput = document.getElementById('invoice-date');
const clientNameInput = document.getElementById('client-name');
const phoneInput = document.getElementById('client-phone');
const totalInput = document.getElementById('invoice-total');

let archivoActual = null;
let urlActual = null;
let dataURLActual = null;

// AUTO-FORMATO PARA TELÉFONOS DE ESTADOS UNIDOS: (XXX) XXX-XXXX
if (phoneInput) {
  phoneInput.addEventListener('input', (e) => {
    let input = e.target.value.replace(/\D/g, '');
    if (input.length > 10) input = input.substring(0, 10);
    
    let formatted = '';
    if (input.length > 0) {
      formatted = '(' + input.substring(0, 3);
    }
    if (input.length >= 4) {
      formatted += ') ' + input.substring(3, 6);
    }
    if (input.length >= 7) {
      formatted += '-' + input.substring(6, 10);
    }
    e.target.value = formatted;
  });
}

// AUTO-FORMATO MONETARIO CON COMAS AUTOMÁTICAS PARA MILES Y MILLONES
if (totalInput) {
  totalInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/[^0-9.]/g, '');
    
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }
    
    if (parts[1] && parts[1].length > 2) {
      parts[1] = parts[1].substring(0, 2);
    }

    if (parts[0]) {
      parts[0] = parseInt(parts[0], 10).toLocaleString('en-US');
    }

    e.target.value = parts.join('.');
  });
}

function getNextFolio() {
  let currentFolioNum = parseInt(localStorage.getItem('ahrco_folio_num'), 10) || 1;
  const formattedFolio = 'A' + String(currentFolioNum).padStart(10, '0');
  if (folioInput && !folioInput.value) {
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

// CONTROL DINÁMICO DE RENGLONES (INICIA EN 12, CRECE AUTOMÁTICAMENTE Y SE DETIENE EN EL LÍMITE DE 20 RENGLONES)
function adjustHeight() {
  if (!textarea) return;
  
  const lineHeight = 28;
  const minLines = 12;
  const maxLines = 20; // Límite infranqueable de 20 renglones
  
  const lineas = textarea.value.split('\n');
  const numLineas = Math.max(minLines, lineas.length);

  let targetLines = numLineas;
  if (targetLines > maxLines) {
    targetLines = maxLines;
  }

  textarea.style.height = (targetLines * lineHeight) + 'px';
}

if (textarea) {
  textarea.addEventListener('input', (e) => {
    let lineas = textarea.value.split('\n');
    
    if (lineas.length > 20) {
      textarea.value = lineas.slice(0, 20).join('\n');
    }
    
    adjustHeight();
  });
}

function obtenerCapturaCanvas() {
  const elemento = document.getElementById('factura-card');
  const clearBtn = document.getElementById('clear-signature');
  if (!elemento) return Promise.resolve(null);

  if (clearBtn) clearBtn.style.display = 'none';

  const inputs = elemento.querySelectorAll('input, textarea');
  const reemplazos = [];

  inputs.forEach(input => {
    const span = document.createElement('div');
    if (input.tagName.toLowerCase() === 'textarea') {
      span.className = input.className;
      span.style.whiteSpace = 'pre-wrap';
      span.style.height = input.offsetHeight + 'px';
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
    width: 800,
    windowWidth: 800,
    scrollY: -window.scrollY
  }).then(canvas => {
    reemplazos.forEach(item => {
      item.span.remove();
      item.input.style.display = '';
    });

    if (clearBtn) clearBtn.style.display = '';

    return canvas;
  });
}

function registrarEmisionFactura(imagenDataURL = '') {
  const folio = folioInput ? folioInput.value : 'A0000000001';
  const cliente = (clientNameInput && clientNameInput.value.trim()) ? clientNameInput.value.trim() : 'Sin Nombre';
  const fecha = dateInput ? dateInput.value : '';

  let historial = JSON.parse(localStorage.getItem('ahrco_historial')) || [];
  const indexExistente = historial.findIndex(item => item.folio === folio);

  if (indexExistente !== -1) {
    historial[indexExistente] = { folio, cliente, fecha, imagen: imagenDataURL };
  } else {
    historial.unshift({ folio, cliente, fecha, imagen: imagenDataURL });
    incrementFolio();
  }

  localStorage.setItem('ahrco_historial', JSON.stringify(historial));
  renderHistorial();
}

// GENERACIÓN DIRECTA DE PDF REAL (SIN ERROR DE 0 KB NI REDIRECCIONES DAÑADAS EN SAFARI/IPAD)
async function imprimirFactura() {
  const elemento = document.getElementById('factura-card');
  const clearBtn = document.getElementById('clear-signature');
  const folioStr = folioInput ? folioInput.value : 'A0000000001';

  // Guardar captura para historial
  const canvas = await obtenerCapturaCanvas();
  if (canvas) {
    registrarEmisionFactura(canvas.toDataURL('image/png'));
  }

  // Ocultar botón "Limpiar" antes del PDF
  if (clearBtn) clearBtn.style.display = 'none';

  // Opciones de html2pdf para 1 página Letter en iPad
  const opt = {
    margin:       0.2,
    filename:     `Factura_${folioStr}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, windowWidth: 800 },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  // Generar y descargar/compartir el PDF
  html2pdf().set(opt).from(elemento).save().then(() => {
    if (clearBtn) clearBtn.style.display = '';
  }).catch(() => {
    if (clearBtn) clearBtn.style.display = '';
  });
}

async function generarImagenFactura() {
  const canvas = await obtenerCapturaCanvas();
  if (!canvas) return;

  const folioStr = folioInput ? folioInput.value : 'A0000000001';
  const nombre = `Factura_${folioStr}.png`;

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;

  archivoActual = new File([blob], nombre, { type: 'image/png' });
  dataURLActual = canvas.toDataURL('image/png');

  if (urlActual) URL.revokeObjectURL(urlActual);
  urlActual = URL.createObjectURL(blob);

  const previewImg = document.getElementById('preview-img');
  const overlay = document.getElementById('preview-overlay');

  if (previewImg && overlay) {
    previewImg.src = urlActual;
    overlay.classList.remove('hidden');
  }

  registrarEmisionFactura(dataURLActual);
}

function nuevaFactura() {
  if (confirm("¿Deseas limpiar los datos y comenzar una nueva factura?")) {
    let currentFolioNum = parseInt(localStorage.getItem('ahrco_folio_num'), 10) || 1;
    if (folioInput) {
      folioInput.value = 'A' + String(currentFolioNum).padStart(10, '0');
    }
    
    if (clientNameInput) clientNameInput.value = '';
    const addressInput = document.getElementById('client-address');
    if (addressInput) addressInput.value = '';
    const addressInput2 = document.getElementById('client-address-2');
    if (addressInput2) addressInput2.value = '';
    if (phoneInput) phoneInput.value = '';
    if (totalInput) totalInput.value = '';

    if (textarea) {
      textarea.value = '\n'.repeat(11);
      adjustHeight();
    }

    const canvas = document.getElementById('signature-pad');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    setTodayDate();
  }
}

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

  if (btnCompartir) {
    btnCompartir.addEventListener('click', () => {
      if (!archivoActual) return;

      if (navigator.canShare && navigator.canShare({ files: [archivoActual] })) {
        navigator.share({ title: 'Factura AHRCO', files: [archivoActual] })
          .then(() => cerrarModal())
          .catch(() => {});
      } else {
        alert("Tu navegador no permite compartir archivos directamente.");
        cerrarModal();
      }
    });
  }

  if (btnGuardar) {
    btnGuardar.addEventListener('click', () => {
      if (!archivoActual || !dataURLActual) return;

      if (navigator.canShare && navigator.canShare({ files: [archivoActual] })) {
        navigator.share({
          title: 'Guardar Factura',
          files: [archivoActual]
        })
        .then(() => cerrarModal())
        .catch(() => {});
      } else {
        const enlace = document.createElement('a');
        enlace.href = dataURLActual;
        enlace.download = archivoActual ? archivoActual.name : 'Factura.png';
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        cerrarModal();
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

window.addEventListener('load', () => {
  getNextFolio();
  setTodayDate();

  if (textarea) {
    if (!textarea.value) {
      textarea.value = '\n'.repeat(11);
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