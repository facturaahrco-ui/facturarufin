const textarea = document.getElementById('notebook');
const folioInput = document.getElementById('folio-number');
const dateInput = document.getElementById('invoice-date');
const clientNameInput = document.getElementById('client-name');
const phoneInput = document.getElementById('client-phone');
const totalInput = document.getElementById('invoice-total');
const addressInput = document.getElementById('client-address');
const addressInput2 = document.getElementById('client-address-2');
const sigCanvas = document.getElementById('signature-pad');

// --- 1. AUTO-FORMATO PARA TELÉFONOS DE ESTADOS UNIDOS: (XXX) XXX-XXXX ---
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
    guardarBorradorActual();
  });
}

// --- 2. AUTO-FORMATO MONETARIO CON COMAS AUTOMÁTICAS ---
if (totalInput) {
  totalInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/[^0-9.]/g, '');
    
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }
    
    const splitParts = value.split('.');
    if (splitParts.length > 2) {
      splitParts.length = 2;
    }

    if (splitParts[0]) {
      splitParts[0] = parseInt(splitParts[0].replace(/,/g, ''), 10).toLocaleString('en-US');
    }

    e.target.value = splitParts.join('.');
    guardarBorradorActual();
  });
}

// --- 3. FOLIO: siempre se ve el folio real; solo avanza cuando el cliente confirma "Sí" ---
const K_ULT = 'ahrco_ultimo_folio_emitido';
const fmtFolio = (n) => 'A' + String(n).padStart(10, '0');
const numFolio = (s) => parseInt((String(s).match(/\d+/) || [0])[0], 10) || 0;

function inicializarFolioCarga() {
  if (!folioInput) return;
  const ultimo = parseInt(localStorage.getItem(K_ULT), 10) || 0;
  folioInput.value = fmtFolio(ultimo + 1);
}

function consolidarFolioEmitido() {
  const ultimo = parseInt(localStorage.getItem(K_ULT), 10) || 0;
  localStorage.setItem(K_ULT, Math.max(ultimo, numFolio(folioInput.value)));
  return folioInput.value;
}

// --- 4. FECHA USA (MM/DD/YYYY) CORREGIDA ---
function setTodayDateUSA() {
  if (dateInput) {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const yyyy = today.getFullYear();
    dateInput.value = `${mm}/${dd}/${yyyy}`;
  }
}

// --- 5. CUADERNO: 12 renglones, crece hasta 20, y se puede tocar cualquier renglón ---
const LINE_H = 28, MIN_LINES = 13, MAX_LINES = 20;
let ultimoValido = '';

// Renglón visual donde termina el texto (cuenta también las líneas largas que se parten)
function lineasUsadas(texto) {
  const cs = getComputedStyle(textarea);
  const m = document.createElement('div');
  m.style.cssText = `position:absolute;visibility:hidden;white-space:pre-wrap;overflow-wrap:break-word;box-sizing:border-box;width:${textarea.clientWidth}px;padding:${cs.padding};font-family:${cs.fontFamily};font-size:${cs.fontSize};letter-spacing:${cs.letterSpacing};line-height:${LINE_H}px;`;
  m.textContent = texto;
  const marca = document.createElement('span');
  marca.textContent = '\u200b';
  m.appendChild(marca);
  document.body.appendChild(m);
  const n = Math.floor(marca.offsetTop / LINE_H) + 1;
  m.remove();
  return n;
}

// Base de 13 renglones; al llegar al 13 se suma uno extra, al 14 otro, etc. hasta 20
function visiblesPara(texto) {
  const usadas = lineasUsadas(texto);
  return Math.min(MAX_LINES, Math.max(MIN_LINES, usadas + 1));
}

function adjustHeight() {
  if (!textarea) return;
  textarea.style.height = (visiblesPara(textarea.value) * LINE_H) + 'px';
  ultimoValido = textarea.value;
}

if (textarea) {
  textarea.addEventListener('input', () => {
    if (lineasUsadas(textarea.value) > MAX_LINES) {
      const pos = Math.max(0, textarea.selectionStart - (textarea.value.length - ultimoValido.length));
      textarea.value = ultimoValido;
      textarea.setSelectionRange(pos, pos);
    }
    adjustHeight();
    guardarBorradorActual();
  });

  // Tocar cualquier renglón vacío (debajo de lo escrito) pone el cursor ahí; sobre texto lo coloca el iPad
  textarea.addEventListener('click', (e) => {
    if (textarea.selectionStart !== textarea.selectionEnd) return;
    const rect = textarea.getBoundingClientRect();
    const tocada = Math.min(MAX_LINES - 1, Math.floor((e.clientY - rect.top + textarea.scrollTop) / LINE_H));
    const ultima = lineasUsadas(textarea.value) - 1;
    if (tocada > ultima) {
      textarea.value += '\n'.repeat(tocada - ultima);
      const fin = textarea.value.length;
      textarea.setSelectionRange(fin, fin);
      adjustHeight();
      guardarBorradorActual();
    }
  });
}

// --- 6. AUTOSAVE BORRADOR (incluye folio y firma) ---
function limpiarFirma() {
  if (!sigCanvas) return;
  const c = sigCanvas.getContext('2d');
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
  c.restore();
}

function dibujarFirma(url) {
  return new Promise((resolve) => {
    limpiarFirma();
    if (!url || !sigCanvas) return resolve();
    const img = new Image();
    img.onload = () => { sigCanvas.getContext('2d').drawImage(img, 0, 0, sigCanvas.clientWidth, sigCanvas.clientHeight); resolve(); };
    img.onerror = resolve;
    img.src = url;
  });
}

function guardarBorradorActual() {
  const borrador = {
    cliente: clientNameInput ? clientNameInput.value : '',
    dir1: addressInput ? addressInput.value : '',
    dir2: addressInput2 ? addressInput2.value : '',
    tel: phoneInput ? phoneInput.value : '',
    total: totalInput ? totalInput.value : '',
    notas: textarea ? textarea.value : '',
    fecha: dateInput ? dateInput.value : '',
    folio: folioInput ? folioInput.value : '',
    firma: sigCanvas ? sigCanvas.toDataURL('image/png') : ''
  };
  try { localStorage.setItem('ahrco_borrador_actual', JSON.stringify(borrador)); } catch (e) {}
}

async function cargarBorradorSiExiste() {
  const guardado = localStorage.getItem('ahrco_borrador_actual');
  if (guardado) {
    try {
      const b = JSON.parse(guardado);
      if (clientNameInput) clientNameInput.value = b.cliente || '';
      if (addressInput) addressInput.value = b.dir1 || '';
      if (addressInput2) addressInput2.value = b.dir2 || '';
      if (phoneInput) phoneInput.value = b.tel || '';
      if (totalInput) totalInput.value = b.total || '';
      if (folioInput && b.folio) folioInput.value = b.folio;
      if (textarea) { 
        textarea.value = b.notas || ''; 
        adjustHeight(); 
      }
      if (dateInput && b.fecha) dateInput.value = b.fecha;
      await dibujarFirma(b.firma);
      return;
    } catch(e) {}
  }
  if (textarea && !textarea.value) {
    textarea.value = '';
    adjustHeight();
  }
}

// --- 7. HISTORIAL & REGISTRO (la copia guarda todo, firma incluida) ---
function registrarEmisionFactura(folioConsolidado) {
  const cliente = (clientNameInput && clientNameInput.value.trim()) ? clientNameInput.value.trim() : 'SIN NOMBRE';
  const nombre = clientNameInput ? clientNameInput.value : '';
  const fecha = dateInput ? dateInput.value : '';
  const dir1 = addressInput ? addressInput.value : '';
  const dir2 = addressInput2 ? addressInput2.value : '';
  const tel = phoneInput ? phoneInput.value : '';
  const total = totalInput ? totalInput.value : '';
  const notas = textarea ? textarea.value : '';
  const firma = sigCanvas ? sigCanvas.toDataURL('image/png') : '';

  let historial = JSON.parse(localStorage.getItem('ahrco_historial')) || [];
  historial = historial.filter(item => item.folio !== folioConsolidado);
  historial.unshift({ folio: folioConsolidado, cliente, nombre, fecha, dir1, dir2, tel, total, notas, firma });
  if (historial.length > 50) historial.pop();

  try { localStorage.setItem('ahrco_historial', JSON.stringify(historial)); }
  catch (e) { alert('No se pudo guardar la copia en el historial (almacenamiento lleno).'); }
  renderHistorial();
}

// --- 8. IMPRIMIR: revisar -> descargar/compartir -> confirmar. Nada cambia hasta el "Sí" ---
const leerActual = () => ({
  folio: folioInput.value, nombre: clientNameInput.value, dir1: addressInput.value, dir2: addressInput2.value,
  tel: phoneInput.value, total: totalInput.value, notas: textarea.value, fecha: dateInput.value
});

const cargarImagen = (url) => new Promise((res) => {
  const im = new Image();
  im.onload = () => res(im);
  im.onerror = () => res(null);
  im.src = url;
});

// Parte el texto en renglones visuales, igual que lo hace el cuaderno en pantalla
function renglonesVisuales(texto) {
  const cs = getComputedStyle(textarea);
  const m = document.createElement('div');
  m.style.cssText = `position:absolute;visibility:hidden;white-space:pre-wrap;overflow-wrap:break-word;box-sizing:border-box;width:${textarea.clientWidth}px;padding:${cs.padding};font-family:${cs.fontFamily};font-size:${cs.fontSize};letter-spacing:${cs.letterSpacing};line-height:${LINE_H}px;`;
  const chars = [...texto];
  const spans = chars.map((ch) => { const sp = document.createElement('span'); sp.textContent = ch; m.appendChild(sp); return sp; });
  document.body.appendChild(m);
  const lineas = [];
  spans.forEach((sp, i) => {
    const k = Math.floor(sp.offsetTop / LINE_H);
    while (lineas.length <= k) lineas.push('');
    if (chars[i] !== '\n') lineas[k] += chars[i];
  });
  m.remove();
  return lineas;
}

// Solo trabaja sobre el clon del PDF: la pantalla real no se toca
function armarClon(doc, snap, firma) {
  const campos = { 'folio-number': 'folio', 'client-name': 'nombre', 'client-address': 'dir1', 'client-address-2': 'dir2', 'client-phone': 'tel', 'invoice-total': 'total', 'invoice-date': 'fecha' };
  const props = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'color', 'textAlign', 'width', 'height', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderBottomWidth', 'borderBottomStyle', 'borderBottomColor'];

  Object.keys(campos).forEach((id) => {
    const real = document.getElementById(id), inp = doc.getElementById(id);
    if (!real || !inp) return;
    const cs = getComputedStyle(real);
    const d = doc.createElement('div');
    d.className = inp.className;
    props.forEach((pr) => { d.style[pr] = cs[pr]; });
    d.style.boxSizing = 'border-box';
    d.style.display = 'block';
    d.style.whiteSpace = 'nowrap';
    d.style.overflow = 'hidden';
    d.textContent = snap[campos[id]] || '';
    inp.replaceWith(d);
  });

  const nb = doc.getElementById('notebook');
  if (nb) {
    const cs = getComputedStyle(textarea);
    const renglones = renglonesVisuales(snap.notas || '');
    const total = visiblesPara(snap.notas || '');
    const cont = doc.createElement('div');
    cont.style.cssText = `width:100%;height:${total * LINE_H}px;overflow:hidden;`;
    for (let i = 0; i < total; i++) {
      const r = doc.createElement('div');
      r.style.cssText = `height:${LINE_H}px;box-sizing:border-box;padding-top:1px;line-height:${LINE_H}px;white-space:pre;overflow:hidden;border-bottom:1px solid #94a3b8;font-family:${cs.fontFamily};font-size:${cs.fontSize};color:${cs.color};letter-spacing:${cs.letterSpacing};`;
      r.textContent = renglones[i] || '';
      cont.appendChild(r);
    }
    nb.replaceWith(cont);
  }

  const cv = doc.getElementById('signature-pad');
  if (cv && firma !== undefined) {           // undefined = factura actual (su firma ya viene en el clon)
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    if (firma) c.drawImage(firma, 0, 0, cv.width, cv.height);
  }

  const clearBtn = doc.getElementById('clear-signature');
  if (clearBtn) clearBtn.style.display = 'none';
}

// Sin "item" = factura de la pantalla. Con "item" = copia del historial (con su folio, datos y firma)
async function generarPDF(elemento, item) {
  const snap = item || leerActual();
  const firma = item ? (item.firma ? await cargarImagen(item.firma) : null) : undefined;
  const canvas = await html2canvas(elemento, { 
    scale: 2, useCORS: true, logging: false, width: 800, windowWidth: 800,
    onclone: (clonedDoc) => armarClon(clonedDoc, snap, firma)
  });
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.98), 'JPEG', 0, 0, 8.5, 11.0);
  return pdf;
}

async function imprimirFactura() {
  if (!window.jspdf) { alert('jsPDF no disponible (revisa tu conexión a internet).'); return; }
  if (document.getElementById('modal-imprimir')) return;

  guardarBorradorActual();
  const folioStr = folioInput.value;
  const nombreArchivo = `Factura_${folioStr}.pdf`;
  let pdf = null, archivo = null;

  const modal = document.createElement('div');
  modal.id = 'modal-imprimir';
  modal.className = 'no-print fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white w-full max-w-md rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
      <div class="flex justify-between items-center bg-gray-900 text-white p-4">
        <h2 class="text-lg font-bold">🖨️ Imprimir factura</h2>
        <button id="mi-x" class="text-gray-400 hover:text-white text-2xl font-bold leading-none">&times;</button>
      </div>
      <div class="p-6">
        <p id="mi-texto" class="text-gray-800 font-semibold mb-1"></p>
        <p id="mi-sub" class="text-sm text-gray-500 mb-4"></p>
        <div id="mi-botones" class="flex flex-col gap-2"></div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const cerrar = () => modal.remove();
  modal.querySelector('#mi-x').onclick = cerrar;

  const vista = (texto, sub, botones) => {
    modal.querySelector('#mi-texto').textContent = texto;
    modal.querySelector('#mi-sub').textContent = sub;
    const caja = modal.querySelector('#mi-botones');
    caja.innerHTML = '';
    botones.forEach(b => {
      const el = document.createElement('button');
      el.className = b.c + ' font-semibold py-2.5 px-4 rounded shadow text-sm transition-colors' + (b.off ? ' opacity-50 cursor-not-allowed' : '');
      el.textContent = b.t;
      el.disabled = !!b.off;
      el.onclick = b.f;
      caja.appendChild(el);
    });
  };

  const vistaRevisar = (listo) => vista(
    'Revisa que todo esté correcto con la factura',
    listo ? `Folio ${folioStr}` : 'Preparando el PDF…',
    [
      { t: '⬇ Descargar PDF', c: 'bg-red-700 hover:bg-red-800 text-white', off: !listo, f: descargar },
      { t: '📤 Compartir / Imprimir', c: 'bg-gray-800 hover:bg-black text-white', off: !listo, f: compartir },
      { t: 'Volver a editar', c: 'bg-gray-200 hover:bg-gray-300 text-gray-800', f: cerrar }
    ]
  );

  const vistaConfirmar = () => vista(
    '¿Ya quedó guardado, enviado o impreso el PDF?',
    'Si contestas Sí: se crea el siguiente folio, se guarda la copia en el Historial y la pantalla queda limpia.',
    [
      { t: 'Sí, terminar factura', c: 'bg-green-700 hover:bg-green-800 text-white', f: terminar },
      { t: 'No, intentar otra vez', c: 'bg-gray-200 hover:bg-gray-300 text-gray-800', f: () => vistaRevisar(true) }
    ]
  );

  function descargar() { pdf.save(nombreArchivo); vistaConfirmar(); }

  async function compartir() {
    if (archivo && navigator.canShare && navigator.canShare({ files: [archivo] })) {
      try { await navigator.share({ title: `Factura ${folioStr}`, files: [archivo] }); vistaConfirmar(); }
      catch (e) { if (e.name !== 'AbortError') { pdf.save(nombreArchivo); vistaConfirmar(); } }
    } else {
      pdf.save(nombreArchivo);
      vistaConfirmar();
    }
  }

  function terminar() {
    const folio = consolidarFolioEmitido();
    registrarEmisionFactura(folio);
    cerrar();
    limpiarFormularioPantallaLimpia();
  }

  vistaRevisar(false);
  try {
    pdf = await generarPDF(document.getElementById('factura-card'));
    try { archivo = new File([pdf.output('blob')], nombreArchivo, { type: 'application/pdf' }); } catch (e) { archivo = null; }
    if (document.body.contains(modal)) vistaRevisar(true);
  } catch (err) {
    if (document.body.contains(modal)) {
      vista('No se pudo preparar el PDF', String(err && err.message || err), [
        { t: 'Cerrar', c: 'bg-gray-200 hover:bg-gray-300 text-gray-800', f: cerrar }
      ]);
    }
  }
}

function limpiarFormularioPantallaLimpia() {
  if (clientNameInput) clientNameInput.value = '';
  if (addressInput) addressInput.value = '';
  if (addressInput2) addressInput2.value = '';
  if (phoneInput) phoneInput.value = '';
  if (totalInput) totalInput.value = '';
  if (textarea) { textarea.value = ''; adjustHeight(); }

  const canvas = document.getElementById('signature-pad');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  setTodayDateUSA();
  inicializarFolioCarga();
  localStorage.removeItem('ahrco_borrador_actual');
}

// --- 9. HISTORIAL CON VISOR Y PDF ---
function abrirHistorial() {
  const modal = document.getElementById('modal-historial');
  if (modal) { renderHistorial(); modal.classList.remove('hidden'); }
}

function cerrarHistorial() {
  const modal = document.getElementById('modal-historial');
  if (modal) modal.classList.add('hidden');
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
        <button onclick="verFacturaHistorial(${index})" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-2 py-1 rounded text-xs transition-colors" title="Ver Factura">
          👁️ Ver
        </button>
        <button onclick="reimprimirPDFCopiaHistorial(${index})" class="bg-gray-700 hover:bg-gray-800 text-white font-semibold px-2 py-1 rounded text-xs transition-colors" title="Descargar PDF Copia">
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

function verFacturaHistorial(index) {
  let historial = JSON.parse(localStorage.getItem('ahrco_historial')) || [];
  const item = historial[index];
  if (!item) return;

  const visorFolio = document.getElementById('visor-folio-number');
  const visorDate = document.getElementById('visor-invoice-date');
  const visorClientName = document.getElementById('visor-client-name');
  const visorPhone = document.getElementById('visor-client-phone');
  const visorAddress = document.getElementById('visor-client-address');
  const visorAddress2 = document.getElementById('visor-client-address-2');
  const visorTotal = document.getElementById('visor-invoice-total');
  const visorNotebook = document.getElementById('visor-notebook');

  if (visorFolio) visorFolio.textContent = item.folio;
  if (visorDate) visorDate.textContent = item.fecha;
  if (visorClientName) visorClientName.textContent = item.cliente;
  if (visorPhone) visorPhone.textContent = item.tel;
  if (visorAddress) visorAddress.textContent = item.dir1;
  if (visorAddress2) visorAddress2.textContent = item.dir2;
  if (visorTotal) visorTotal.textContent = item.total;
  if (visorNotebook) visorNotebook.textContent = item.notas || '';

  if (visorNotebook) {
    visorNotebook.style.height = 'auto';
    visorNotebook.style.maxHeight = 'none';
    visorNotebook.style.overflow = 'visible';
    visorNotebook.style.minHeight = (MIN_LINES * LINE_H + 18) + 'px';
  }

  let firmaImg = document.getElementById('visor-firma');
  if (!firmaImg && visorDate && visorDate.closest('footer')) {
    const bloque = document.createElement('div');
    bloque.className = 'flex items-end w-7/12';
    bloque.innerHTML = '<strong class="mr-2 mb-1 whitespace-nowrap">SIGNED BY:</strong><div class="w-full border-b border-black"><img id="visor-firma" alt="" class="h-14 block"></div>';
    const pie = visorDate.closest('footer');
    pie.insertBefore(bloque, pie.firstChild);
    firmaImg = document.getElementById('visor-firma');
  }
  if (firmaImg) {
    if (item.firma) { firmaImg.src = item.firma; firmaImg.style.visibility = 'visible'; }
    else { firmaImg.removeAttribute('src'); firmaImg.style.visibility = 'hidden'; }
  }

  const modalVisor = document.getElementById('modal-visor-factura');
  if (modalVisor) modalVisor.classList.remove('hidden');
}

function cerrarVisorFactura() {
  const modalVisor = document.getElementById('modal-visor-factura');
  if (modalVisor) modalVisor.classList.add('hidden');
}

// La copia se arma SOLO dentro del clon que usa html2canvas: la factura en pantalla y su folio no se tocan
async function reimprimirPDFCopiaHistorial(index) {
  let historial = JSON.parse(localStorage.getItem('ahrco_historial')) || [];
  const item = historial[index];
  if (!item) return;
  if (!window.jspdf) { alert("jsPDF no disponible"); return; }

  const snap = { ...item, nombre: item.nombre !== undefined ? item.nombre : (item.cliente === 'SIN NOMBRE' ? '' : item.cliente) };
  try {
    const pdf = await generarPDF(document.getElementById('factura-card'), snap);
    pdf.save(`Factura_${item.folio}_Copia.pdf`);
  } catch (e) {
    alert('No se pudo generar la copia: ' + (e.message || e));
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

function limpiarHistorial() {
  if (confirm("¿Seguro que deseas borrar TODO el historial de facturas?")) {
    localStorage.removeItem('ahrco_historial');
    renderHistorial();
  }
}

// --- 10. INICIALIZACIÓN ---
window.addEventListener('load', async () => {
  inicializarFolioCarga();
  setTodayDateUSA();
  initSignaturePad();
  await cargarBorradorSiExiste();
  adjustHeight();

  [folioInput, clientNameInput, addressInput, addressInput2].forEach(inp => {
    if (inp) inp.addEventListener('input', guardarBorradorActual);
  });
});

// --- FIRMA DIGITAL ---
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
    tempCanvas.width = canvas.width; tempCanvas.height = canvas.height;
    tempCanvas.getContext('2d').drawImage(canvas, 0, 0);

    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#000000';

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
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }

  function startDrawing(e) { isDrawing = true; const pos = getPos(e); ctx.beginPath(); ctx.moveTo(pos.x, pos.y); }
  function draw(e) { if (!isDrawing) return; if (e.cancelable) e.preventDefault(); const pos = getPos(e); ctx.lineTo(pos.x, pos.y); ctx.stroke(); }
  function stopDrawing() { if (isDrawing) { isDrawing = false; guardarBorradorActual(); } }

  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseleave', stopDrawing);
  canvas.addEventListener('touchstart', startDrawing, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  canvas.addEventListener('touchend', stopDrawing, { passive: false });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => { ctx.clearRect(0, 0, canvas.width, canvas.height); guardarBorradorActual(); });
  }
}