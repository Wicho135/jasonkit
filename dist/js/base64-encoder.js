'use strict';

/**
 * Codificador y decodificador de texto y archivos a Base64.
 */
(() => {
  const els = {
    status: document.getElementById('status'),
    statusText: document.getElementById('status-text'),
    contentMode: document.getElementById('content-mode'),
    direction: document.getElementById('direction'),
    input: document.getElementById('base64-input'),
    inputLabel: document.getElementById('input-label'),
    inputMeta: document.getElementById('input-meta'),
    fileZone: document.getElementById('file-zone'),
    fileInput: document.getElementById('file-input'),
    fileZoneTitle: document.getElementById('file-zone-title'),
    fileZoneHint: document.getElementById('file-zone-hint'),
    outputLabel: document.getElementById('output-label'),
    outputMeta: document.getElementById('output-meta'),
    output: document.getElementById('base64-output'),
    outputEmpty: document.getElementById('base64-output-empty'),
    outputEmptyText: document.getElementById('base64-output-empty-text'),
    outputCode: document.getElementById('base64-output-code'),
    outputError: document.getElementById('base64-output-error'),
    outputErrorText: document.getElementById('base64-error-message'),
    fileResult: document.getElementById('file-result'),
    fileResultName: document.getElementById('file-result-name'),
    fileResultMeta: document.getElementById('file-result-meta'),
    urlSafe: document.getElementById('url-safe'),
    urlSafeField: document.getElementById('url-safe-field'),
    btnCopy: document.getElementById('btn-copy'),
    btnCopyLabel: document.getElementById('btn-copy-label'),
    btnDownload: document.getElementById('btn-download'),
    btnDownloadLabel: document.getElementById('btn-download-label'),
    btnSwap: document.getElementById('btn-swap'),
    btnClear: document.getElementById('btn-clear'),
    btnSample: document.getElementById('btn-sample'),
  };

  if (!els.input || !els.output) {
    return;
  }

  const {
    copyText,
    downloadBytes,
    downloadText,
    formatBytes,
    formatNumber,
    showToast,
  } = window.JSONKit;

  const SAMPLE_TEXT =
    'Hola, JSONKit 👋\nEste texto se codifica y decodifica 100% en tu navegador.';

  const MIME_EXTENSIONS = {
    'application/json': 'json',
    'application/pdf': 'pdf',
    'application/zip': 'zip',
    'audio/mpeg': 'mp3',
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
    'text/csv': 'csv',
    'text/html': 'html',
    'text/plain': 'txt',
  };

  const state = {
    mode: 'text',
    direction: 'encode',
    resultText: '',
    resultBytes: null,
    resultMime: 'application/octet-stream',
    resultFilename: 'archivo.bin',
    selectedFile: null,
    selectedBytes: null,
  };

  let copyTimer = 0;

  const setStatus = (stateName, message) => {
    els.status.classList.remove('is-valid', 'is-invalid', 'is-working');

    if (
      stateName === 'valid' ||
      stateName === 'invalid' ||
      stateName === 'working'
    ) {
      els.status.classList.add(`is-${stateName}`);
    }

    els.statusText.textContent = message;
  };

  const updateInputMeta = () => {
    if (state.mode === 'file' && state.direction === 'encode') {
      els.inputMeta.textContent = state.selectedFile
        ? `${state.selectedFile.name} · ${formatBytes(state.selectedFile.size)}`
        : 'Ningún archivo';
      return;
    }

    const value = els.input.value;
    els.inputMeta.textContent = `${formatNumber(value.length)} ${
      value.length === 1 ? 'carácter' : 'caracteres'
    }`;
  };

  const resetCopyButton = () => {
    window.clearTimeout(copyTimer);
    els.btnCopy.classList.remove('is-copied');
    els.btnCopyLabel.textContent = 'Copiar';
  };

  const showEmpty = () => {
    state.resultText = '';
    state.resultBytes = null;
    els.outputEmpty.hidden = false;
    els.outputCode.hidden = true;
    els.outputError.hidden = true;
    els.fileResult.hidden = true;
    els.outputMeta.textContent = 'Sin resultado';
    els.btnCopy.disabled = true;
    els.btnDownload.disabled = true;
    els.btnSwap.disabled = true;
    resetCopyButton();
  };

  const showError = (message) => {
    state.resultText = '';
    state.resultBytes = null;
    els.outputEmpty.hidden = true;
    els.outputCode.hidden = true;
    els.fileResult.hidden = true;
    els.outputError.hidden = false;
    els.outputErrorText.textContent = message;
    els.outputMeta.textContent = 'Error';
    els.btnCopy.disabled = true;
    els.btnDownload.disabled = true;
    els.btnSwap.disabled = true;
    resetCopyButton();
  };

  const showTextResult = (text, bytesLength, meta) => {
    state.resultText = text;
    state.resultBytes = null;
    els.outputEmpty.hidden = true;
    els.outputError.hidden = true;
    els.fileResult.hidden = true;
    els.outputCode.hidden = false;
    els.outputCode.textContent = text;
    els.outputMeta.textContent = meta;
    els.btnCopy.disabled = false;
    els.btnDownload.disabled = false;
    els.btnSwap.disabled = state.mode !== 'text';

    if (state.direction === 'decode') {
      state.resultFilename = 'texto-decodificado.txt';
      state.resultMime = 'text/plain;charset=utf-8';
    } else {
      state.resultFilename = 'texto.base64.txt';
      state.resultMime = 'text/plain;charset=utf-8';
    }

    els.btnDownloadLabel.textContent =
      state.direction === 'decode' ? 'Descargar texto' : 'Descargar Base64';
  };

  const showFileResult = (bytes, mime, filename) => {
    state.resultText = '';
    state.resultBytes = bytes;
    state.resultMime = mime;
    state.resultFilename = filename;
    els.outputEmpty.hidden = true;
    els.outputCode.hidden = true;
    els.outputError.hidden = true;
    els.fileResult.hidden = false;
    els.fileResultName.textContent = filename;
    els.fileResultMeta.textContent = `${formatBytes(bytes.length)} · ${mime}`;
    els.outputMeta.textContent = `Archivo · ${formatBytes(bytes.length)}`;
    els.btnCopy.disabled = true;
    els.btnDownload.disabled = false;
    els.btnSwap.disabled = true;
    els.btnDownloadLabel.textContent = 'Descargar archivo';
    resetCopyButton();
  };

  const bytesToBase64 = (bytes) => {
    let binary = '';
    const chunkSize = 0x8000;

    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(
        ...bytes.subarray(index, index + chunkSize),
      );
    }

    return btoa(binary);
  };

  const base64ToBytes = (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  };

  const normalizeBase64 = (raw) => {
    let data = raw.trim();
    let mime = 'application/octet-stream';

    const dataUrlMatch = data.match(
      /^data:([^;,]*)(?:;[^,]*)?;base64,([\s\S]*)$/i,
    );

    if (dataUrlMatch) {
      mime = dataUrlMatch[1] || mime;
      data = dataUrlMatch[2];
    }

    data = data.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');

    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(data)) {
      throw new Error(
        'El texto contiene caracteres que no son Base64 válidos.',
      );
    }

    const padding = (4 - (data.length % 4)) % 4;
    data += '='.repeat(padding);

    if (data.length % 4 !== 0 || data.length === 0) {
      throw new Error('La longitud del Base64 no es válida.');
    }

    return { data, mime };
  };

  const encodeText = () => {
    const text = els.input.value;

    if (!text) {
      showEmpty();
      setStatus('empty', 'Escribe un texto para codificar');
      return;
    }

    const bytes = new TextEncoder().encode(text);
    let output = bytesToBase64(bytes);

    if (els.urlSafe.checked) {
      output = output
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }

    showTextResult(
      output,
      bytes.length,
      `${formatNumber(output.length)} caracteres Base64 · ${formatBytes(bytes.length)}`,
    );
    setStatus('valid', 'Texto codificado');
  };

  const decodeText = () => {
    const raw = els.input.value;

    if (!raw.trim()) {
      showEmpty();
      setStatus('empty', 'Pega un Base64 para decodificar');
      return;
    }

    try {
      const { data } = normalizeBase64(raw);
      const bytes = base64ToBytes(data);
      let text;

      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        throw new Error(
          'El Base64 es válido, pero no contiene texto UTF-8. Usa el modo Archivo para descargar los bytes.',
        );
      }

      showTextResult(
        text,
        bytes.length,
        `${formatNumber(text.length)} caracteres · ${formatBytes(bytes.length)}`,
      );
      setStatus('valid', 'Base64 decodificado');
    } catch (error) {
      showError(error.message);
      setStatus('invalid', 'Base64 no válido');
    }
  };

  const encodeFile = () => {
    if (!state.selectedFile || !state.selectedBytes) {
      showEmpty();
      setStatus('empty', 'Selecciona un archivo para codificar');
      return;
    }

    let output = bytesToBase64(state.selectedBytes);

    if (els.urlSafe.checked) {
      output = output
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }

    state.resultText = output;
    state.resultBytes = null;
    state.resultFilename = `${state.selectedFile.name}.base64.txt`;
    state.resultMime = 'text/plain;charset=utf-8';
    els.outputEmpty.hidden = true;
    els.outputError.hidden = true;
    els.fileResult.hidden = true;
    els.outputCode.hidden = false;
    els.outputCode.textContent = output;
    els.outputMeta.textContent = `${formatNumber(output.length)} caracteres Base64`;
    els.btnCopy.disabled = false;
    els.btnDownload.disabled = false;
    els.btnDownloadLabel.textContent = 'Descargar Base64';
    resetCopyButton();
    setStatus('valid', 'Archivo codificado');
  };

  const decodeFile = () => {
    const raw = els.input.value;

    if (!raw.trim()) {
      showEmpty();
      setStatus('empty', 'Pega el Base64 de un archivo');
      return;
    }

    try {
      const { data, mime } = normalizeBase64(raw);
      const bytes = base64ToBytes(data);
      const extension = MIME_EXTENSIONS[mime] || 'bin';
      const filename = `archivo-decodificado.${extension}`;

      showFileResult(bytes, mime, filename);
      setStatus('valid', 'Archivo listo para descargar');
    } catch (error) {
      showError(error.message);
      setStatus('invalid', 'Base64 no válido');
    }
  };

  const run = () => {
    updateInputMeta();

    if (state.mode === 'file' && state.direction === 'encode') {
      encodeFile();
      return;
    }

    if (state.mode === 'file' && state.direction === 'decode') {
      decodeFile();
      return;
    }

    if (state.direction === 'encode') {
      encodeText();
    } else {
      decodeText();
    }
  };

  const updateUI = () => {
    const isText = state.mode === 'text';
    const isEncode = state.direction === 'encode';
    const showFileZone = !isText && isEncode;

    els.contentMode.querySelectorAll('[data-mode]').forEach((button) => {
      const active = button.dataset.mode === state.mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    els.direction.querySelectorAll('[data-direction]').forEach((button) => {
      const active = button.dataset.direction === state.direction;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    els.input.hidden = showFileZone;
    els.fileZone.hidden = !showFileZone;
    els.urlSafeField.hidden = !isEncode;

    if (isText) {
      els.inputLabel.textContent = isEncode ? 'Texto plano' : 'Base64';
      els.input.placeholder = isEncode
        ? 'Escribe o pega aquí el texto que quieres codificar...'
        : 'Pega aquí el Base64 que quieres decodificar...';
      els.outputLabel.textContent = isEncode ? 'Base64' : 'Texto decodificado';
      els.outputEmptyText.textContent = isEncode
        ? 'El Base64 aparecerá aquí mientras escribes.'
        : 'El texto decodificado aparecerá aquí.';
      els.btnDownloadLabel.textContent = isEncode
        ? 'Descargar Base64'
        : 'Descargar texto';
    } else {
      els.inputLabel.textContent = isEncode ? 'Archivo' : 'Base64 del archivo';
      els.input.placeholder =
        'Pega el Base64 del archivo que quieres descargar...';
      els.outputLabel.textContent = isEncode ? 'Base64 del archivo' : 'Archivo';
      els.outputEmptyText.textContent = isEncode
        ? 'El Base64 del archivo aparecerá aquí.'
        : 'El archivo decodificado estará listo para descargar.';
      els.btnDownloadLabel.textContent = isEncode
        ? 'Descargar Base64'
        : 'Descargar archivo';
    }

    if (showFileZone && state.selectedFile) {
      els.fileZoneTitle.textContent = state.selectedFile.name;
      els.fileZoneHint.textContent = `${formatBytes(
        state.selectedFile.size,
      )} · Haz clic para cambiar de archivo`;
    } else if (showFileZone) {
      els.fileZoneTitle.textContent = 'Selecciona un archivo';
      els.fileZoneHint.textContent = 'o arrástralo y suéltalo aquí';
    }

    els.btnSwap.disabled = isText ? !state.resultText : true;
  };

  const switchMode = (mode) => {
    if (mode === state.mode) {
      return;
    }

    state.mode = mode;
    els.input.value = '';
    state.selectedFile = null;
    state.selectedBytes = null;
    els.fileInput.value = '';
    showEmpty();
    updateUI();
    updateInputMeta();
    run();
  };

  const switchDirection = (direction) => {
    if (direction === state.direction) {
      return;
    }

    const previousResult = state.resultText;
    const wasText = state.mode === 'text';

    state.direction = direction;

    if (wasText && previousResult) {
      els.input.value = previousResult;
    } else if (state.mode === 'file') {
      els.input.value = '';
      state.selectedFile = null;
      state.selectedBytes = null;
      els.fileInput.value = '';
    }

    showEmpty();
    updateUI();
    run();
  };

  const readFile = (file) => {
    if (!file) {
      return;
    }

    state.selectedFile = file;
    updateUI();
    updateInputMeta();

    file
      .arrayBuffer()
      .then((buffer) => {
        state.selectedBytes = new Uint8Array(buffer);
        updateUI();
        updateInputMeta();
        run();
      })
      .catch(() => {
        state.selectedFile = null;
        state.selectedBytes = null;
        showError('No se pudo leer el archivo seleccionado.');
        setStatus('invalid', 'Error al leer el archivo');
      });
  };

  els.contentMode.addEventListener('click', (event) => {
    const button = event.target.closest('[data-mode]');

    if (button) {
      switchMode(button.dataset.mode);
    }
  });

  els.direction.addEventListener('click', (event) => {
    const button = event.target.closest('[data-direction]');

    if (button) {
      switchDirection(button.dataset.direction);
    }
  });

  els.input.addEventListener('input', () => {
    updateInputMeta();
    setStatus('working', 'Procesando…');
    run();
  });

  els.urlSafe.addEventListener('change', run);

  els.fileInput.addEventListener('change', () => {
    readFile(els.fileInput.files[0]);
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    els.fileZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.fileZone.classList.add('is-dragover');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    els.fileZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.fileZone.classList.remove('is-dragover');
    });
  });

  els.fileZone.addEventListener('drop', (event) => {
    const file = event.dataTransfer.files[0];

    if (file) {
      readFile(file);
    }
  });

  els.btnCopy.addEventListener('click', async () => {
    if (!state.resultText) {
      return;
    }

    const copied = await copyText(state.resultText);

    if (copied) {
      window.clearTimeout(copyTimer);
      els.btnCopy.classList.add('is-copied');
      els.btnCopyLabel.textContent = 'Copiado';
      showToast('Resultado copiado al portapapeles.');
      copyTimer = window.setTimeout(resetCopyButton, 1800);
      return;
    }

    showToast('No se pudo copiar el resultado.', 'error');
  });

  els.btnDownload.addEventListener('click', () => {
    if (state.resultBytes) {
      downloadBytes(state.resultFilename, state.resultBytes, state.resultMime);
      showToast(`Descargando ${state.resultFilename}.`);
      return;
    }

    if (state.resultText) {
      downloadText(state.resultFilename, state.resultText, state.resultMime);
      showToast(`Descargando ${state.resultFilename}.`);
    }
  });

  els.btnSwap.addEventListener('click', () => {
    if (!state.resultText) {
      return;
    }

    els.input.value = state.resultText;
    state.direction = state.direction === 'encode' ? 'decode' : 'encode';
    showEmpty();
    updateUI();
    run();
  });

  els.btnClear.addEventListener('click', () => {
    els.input.value = '';
    state.selectedFile = null;
    state.selectedBytes = null;
    els.fileInput.value = '';
    showEmpty();
    updateUI();
    updateInputMeta();
    setStatus('empty', 'Esperando datos');
    els.input.focus();
  });

  els.btnSample.addEventListener('click', () => {
    state.mode = 'text';
    state.direction = 'encode';
    els.urlSafe.checked = false;
    els.input.value = SAMPLE_TEXT;
    showEmpty();
    updateUI();
    run();
    els.input.focus();
    els.input.setSelectionRange(0, 0);
    els.input.scrollTop = 0;
    showToast('Ejemplo cargado.');
  });

  updateUI();
  updateInputMeta();
  showEmpty();
  setStatus('empty', 'Esperando datos');
})();
