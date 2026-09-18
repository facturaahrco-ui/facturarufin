const textarea = document.getElementById('notebook');
const folioInput = document.getElementById('folio-number');
const dateInput = document.getElementById('invoice-date');
const clientNameInput = document.getElementById('client-name');
const phoneInput = document.getElementById('client-phone');
const totalInput = document.getElementById('invoice-total');

let archivoActual = null;
let urlActual = null;
let dataURLActual = null;
let imagenEmitidaConfirmada = false;

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
    e.target.value = formatted.toUpperCase();
  });
}

// AUTO-FORMATO MONETARIO CON COMAS AUTOMÁTICAS
if (totalInput) {
  totalInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/[^0-9.]/g, '');
    
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }
    
    const splitParts = value.split('.');
    if (splitParts.length > 2) {
      splitParts = splitParts.slice(1).join('').substring(0, 2);
      splitParts.length = 2;
    }

    if (splitParts[0]) {
      splitParts[0] = parseInt(splitParts[0].replace(/,/g, ''), 10).toLocaleString('en-US');
    }

    e.target.value = splitParts.join('.');
  });
}

// FORZAR MAYÚSCULAS VÍA JAVASCRIPT EN TODOS LOS CAMPOS
document.querySelectorAll('input, textarea').forEach(element => {
  element.addEventListener('input', (e) => {
    if (e.target.id !== 'invoice-total') {
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const upperVal = e.target.value.toUpperCase();
      if (e.target.value !== upperVal) {
        e.target.value = upperVal;
        if (start !== null && end !== null) {
          e.target.setSelectionRange(start, end);
        }
      }
    }
  });
});

// CONTROL DE FOLIOS: MUESTRA EL SIGUIENTE SIN QUEMARLO AL CARGAR O NUEVA FACTURA
function inicializarFolioCarga() {
  if (folioInput && !folioInput.value) {
    let ultimoEmitido = parseInt(localStorage.getItem('ahrco_ultimo_folio_emitido'), 10) || 0;
    let numAjustado = ultimoEmitido === 0 ? 1 : ultimoEmitido + 1;
    folioInput.value = 'A' + String(numAjustado).padStart(10, '0');
  }
}

// CONSOLIDA Y QUEMA EL FOLIO ÚNICAMENTE AL EMITIR / GUARDAR DEFINITIVO
function consolidarFolioEmitido() {
  if (!folioInput) return 'A0000000001';
  const folioActualStr = folioInput.value;
  const match = folioActualStr.match(/\d+/);
  const numActual = match ? parseInt(match[0], 10) : 1;
  
  const ultimoGuardado = parseInt(localStorage.getItem('ahrco_ultimo_folio_emitido'), 10) || 0;
  const nuevoUltimo = Math.max(numActual, ultimoGuardado + 1);
  localStorage.setItem('ahrco_ultimo_folio_emitido', nuevoUltimo);
  
  const folioFinal = 'A' + String(nuevoUltimo).padStart(10, '0');
  folioInput.value = folioFinal;
  return folioFinal;
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

// CONTROL DINÁMICO DE RENGLONES (MAX 20 RENGLONES)
function adjustHeight() {
  if (!textarea) return;
  
  const lineHeight = 28;
  const minLines = 12;
  const maxLines = 20;
  
  const lineas = textarea.value.split('\n');
  const numLineas = Math.max(minLines, lineas.length);

  let targetLines = numLineas;
  if (targetLines > maxLines) {
    targetLines = maxLines;
  }

  textarea.style.height = (targetLines * lineHeight) + 'px';
}

if (textarea) {
  textarea.addEventListener('input', () => {
    let lineas = textarea.value.split('\n');
    if (lineas.length > 20) {
      textarea.value = lineas.slice(0, 20).join('\n');
    }
    adjustHeight();
  });
}

// GENERADOR DE CAPTURA LIMPIA SIN RUPTURA DE LAYOUT
function obtenerCapturaCanvas() {
  const elemento = document.getElementById('factura-card');
  const clearBtn = document.getElementById('clear-signature');
  if (!elemento) return Promise.resolve(null);

  if (clearBtn) clearBtn.style.display = 'none';

  const inputs = elemento.querySelectorAll('input, textarea');
  const reemplazos = [];

  inputs.forEach(input => {
    const div = document.createElement('div');
    const computedStyle = window.getComputedStyle(input);

    div.style.width = input.offsetWidth + 'px';
    div.style.minHeight = input.offsetHeight + 'px';
    div.style.fontFamily = computedStyle.fontFamily;
    div.style.fontSize = computedStyle.fontSize;
    div.style.fontWeight = computedStyle.fontWeight;
    div.style.color = computedStyle.color;
    div.style.textAlign = computedStyle.textAlign;
    div.style.textTransform = 'uppercase';
    div.style.padding = computedStyle.padding;
    div.style.boxSizing = 'border-box';

    if (input.tagName.toLowerCase() === 'textarea') {
      div.className = input.className;
      div.style.whiteSpace = 'pre-wrap';
      div.style.wordBreak = 'break-word';
      div.style.lineHeight = '28px';
      div.style.paddingTop = '1px';
      div.textContent = (input.value || '').toUpperCase();
    } else {
      div.className = input.className;
      div.style.display = 'inline-block';
      div.style.borderBottom = computedStyle.borderBottom;
      div.textContent = (input.value || '').toUpperCase() || '\u00A0';
    }

    input.style.display = 'none';
    input.parentNode.insertBefore(div, input);
    reemplazos.push({ input, div });
  });

  return html2canvas(elemento, { 
    scale: 2, 
    useCORS: true,
    logging: false,
    width: 800,
    windowWidth: 800,
    scrollY: -window.scrollY
  }).then(canvas => {
    reemplazos.forEach(item => {
      item.div.remove();
      item.input.style.display = '';
    });

    if (clearBtn) clearBtn.style.display = '';

    return canvas;
  });
}

// REGISTRAR EN HISTORIAL CON FOLIO CONSOLIDADO
function registrarEmisionFactura(folioConsolidado, imagenDataURL = '') {
  const cliente = (clientNameInput && clientNameInput.value.trim()) ? clientNameInput.value.trim().toUpperCase() : 'SIN NOMBRE';
  const fecha = dateInput ? dateInput.value : '';

  let historial = JSON.parse(localStorage.getItem('ahrco_historial')) || [];
  const indexExistente = historial.findIndex(item => item.folio === folioConsolidado);

  if (indexExistente !== -1) {
    historial[indexExistente] = { folio: folioConsolidado, cliente, fecha, imagen: imagenDataURL };
  } else {
    historial = historial.filter(item => item.folio !== folioConsolidado);
    historial.unshift({ folio: folioConsolidado, cliente, fecha, imagen: imagenDataURL });
  }

  localStorage.setItem('ahrco_historial', JSON.stringify(historial));
  renderHistorial();
}

// PDF OFICIAL (DIRECTO AL TOCAR EL BOTÓN, SIN VENTANAS RARAS, AJUSTADO A CARTA)
async function imprimirFactura() {
  const canvas = await obtenerCapturaCanvas();
  if (!canvas) return;

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const folioStr = consolidarFolioEmitido();
  registrarEmisionFactura(folioStr, imgData);

  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    window.print();
    return;
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: 'letter'
  });

  const pageWidth = 8.5;
  const pageHeight = 11.0;
  const margin = 0.35;
  const availWidth = pageWidth - (margin * 2);
  const availHeight = pageHeight - (margin * 2);

  const imgProps = pdf.getImageProperties(imgData);
  const ratio = Math.min(availWidth / imgProps.width, availHeight / imgProps.height);

  const pdfWidth = imgProps.width * ratio;
  const pdfHeight = imgProps.height * ratio;

  const xOffset = margin + (availWidth - pdfWidth) / 2;
  const yOffset = margin;

  pdf.addImage(imgData, 'JPEG', xOffset, yOffset, pdfWidth, pdfHeight);
  pdf.save(`Factura_${folioStr}.pdf`);
}

// PREVIEW DE IMAGEN (SOLO MUESTRA VISTA PREVIA, NO QUEMA FOLIO TODAVÍA)
async function generarImagenFactura() {
  const canvas = await obtenerCapturaCanvas();
  if (!canvas) return;

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;

  dataURLActual = canvas.toDataURL('image/png');
  imagenEmitidaConfirmada = false;

  const folioActualVisual = folioInput ? folioInput.value : 'A0000000001';
  const nombre = `Factura_${folioActualVisual}.png`;

  archivoActual = new File([blob], nombre, { type: 'image/png' });

  if (urlActual) URL.revokeObjectURL(urlActual);
  urlActual = URL.createObjectURL(blob);

  const previewImg = document.getElementById('preview-img');
  const overlay = document.getElementById('preview-overlay');

  if (previewImg && overlay) {
    previewImg.src = urlActual;
    overlay.classList.remove('hidden');
  }
}

// CONFIRMA Y QUEMA FOLIO SOLO CUANDO EL USUARIO DA GUARDAR/COMPARTIR EN EL PREVIEW
function confirmarEmisionImagenSiNoConfirmada() {
  if (!imagenEmitidaConfirmada) {
    const folioStr = consolidarFolioEmitido();
    registrarEmisionFactura(folioStr, dataURLActual);
    if (archivoActual) {
      archivoActual = new File([archivoActual], `Factura_${folioStr}.png`, { type: 'image/png' });
    }
    imagenEmitidaConfirmada = true;
    return folioStr;
  }
  return folioInput ? folioInput.value : 'A0000000001';
}

// NUEVA FACTURA
function nuevaFactura() {
  if (confirm("¿Deseas limpiar los datos y comenzar una nueva factura?")) {
    let ultimoEmitido = parseInt(localStorage.getItem('ahrco_ultimo_folio_emitido'), 10) || 0;
    let siguienteSugerido = ultimoEmitido + 1;
    
    if (folioInput) {
      folioInput.value = 'A' + String(siguienteSugerido).padStart(10, '0');
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

    imagenEmitidaConfirmada = false;
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
      const folioConsolidado = confirmarEmisionImagenSiNoConfirmada();

      if (navigator.canShare && navigator.canShare({ files: [archivoActual] })) {
        navigator.share({ title: `Factura AHRCO ${folioConsolidado}`, files: [archivoActual] })
          .then(() => cerrarModal())
          .catch(() => {});
      } else {
        alert("Tu navegador no permite compartir archivos directamente.");
        cerrarModal();
      }
    });
  }

  // FLUJO ORIGINAL TAL CUAL DE GUARDAR EN FOTO / DISPOSITIVO
  if (btnGuardar) {
    btnGuardar.addEventListener('click', () => {
      if (!archivoActual || !dataURLActual) return;
      const folioConsolidado = confirmarEmisionImagenSiNoConfirmada();

      if (navigator.canShare && navigator.canShare({ files: [archivoActual] })) {
        navigator.share({
          title: `Guardar Factura ${folioConsolidado}`,
          files: [archivoActual]
        })
        .then(() => cerrarModal())
        .catch(() => {});
      } else {
        const enlace = document.createElement('a');
        enlace.href = dataURLActual;
        enlace.download = archivoActual ? archivoActual.name : `Factura_${folioConsolidado}.png`;
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
      <td class="py-3 px-4 text-center flex justify-center gap-1">
        <button onclick="verCapturaFactura(${index})" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-2 py-1 rounded text-xs transition-colors" title="Ver / Descargar Imagen">
          👁️ Imagen
        </button>
        <button onclick="reimprimirPDFHistorial(${index})" class="bg-gray-700 hover:bg-gray-800 text-white font-semibold px-2 py-1 rounded text-xs transition-colors" title="Imprimir Copia en PDF">
          📄 PDF
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

async function reimprimirPDFHistorial(index) {
  let historial = JSON.parse(localStorage.getItem('ahrco_historial')) || [];
  const item = historial[index];
  if (!item || !item.imagen) {
    alert("No se encontró imagen base para generar el PDF de este folio.");
    return;
  }

  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    alert("jsPDF no disponible");
    return;
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: 'letter'
  });

  const pageWidth = 8.5;
  const pageHeight = 11.0;
  const margin = 0.35;
  const availWidth = pageWidth - (margin * 2);
  const availHeight = pageHeight - (margin * 2);

  const imgProps = pdf.getImageProperties(item.imagen);
  const ratio = Math.min(availWidth / imgProps.width, availHeight / imgProps.height);

  const pdfWidth = imgProps.width * ratio;
  const pdfHeight = imgProps.height * ratio;

  const xOffset = margin + (availWidth - pdfWidth) / 2;
  const yOffset = margin;

  pdf.addImage(item.imagen, 'JPEG', xOffset, yOffset, pdfWidth, pdfHeight);
  pdf.save(`Factura_${item.folio}_CopiaPDF.pdf`);
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
  inicializarFolioCarga();
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
    ctx.setTransform(1, 0, 0, 1, 0, 0);
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
    const touch = (e.touches && e.touches.length > 0) ? e.touches[0] : (e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches[0] : e);
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