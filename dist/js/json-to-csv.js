'use strict';

/**
 * Convertidor bidireccional JSON ↔ CSV.
 */
(() => {
  const els = {
    status: document.getElementById('status'),
    statusText: document.getElementById('status-text'),
    direction: document.getElementById('direction'),
    input: document.getElementById('converter-input'),
    inputLabel: document.getElementById('input-label'),
    inputMeta: document.getElementById('input-meta'),
    output: document.getElementById('converter-output'),
    outputLabel: document.getElementById('output-label'),
    outputEmpty: document.getElementById('converter-output-empty'),
    outputEmptyText: document.getElementById('converter-output-empty-text'),
    outputCode: document.getElementById('converter-output-code'),
    outputError: document.getElementById('converter-output-error'),
    outputErrorText: document.getElementById('converter-error-message'),
    outputMeta: document.getElementById('output-meta'),
    flatten: document.getElementById('flatten'),
    flattenField: document.getElementById('flatten-field'),
    delimiter: document.getElementById('delimiter'),
    headers: document.getElementById('headers'),
    headersField: document.getElementById('headers-field'),
    inferTypes: document.getElementById('infer-types'),
    inferField: document.getElementById('infer-field'),
    btnConvert: document.getElementById('btn-convert'),
    btnDownload: document.getElementById('btn-download'),
    btnDownloadLabel: document.getElementById('btn-download-label'),
    btnCopy: document.getElementById('btn-copy'),
    btnCopyLabel: document.getElementById('btn-copy-label'),
    btnClear: document.getElementById('btn-clear'),
    btnSample: document.getElementById('btn-sample'),
  };

  if (!els.input || !els.output) {
    return;
  }

  const { copyText, formatNumber, highlightJson, showToast } = window.JSONKit;

  const SAMPLE_JSON = [
    {
      id: 1,
      nombre: 'Ada Lovelace',
      email: 'ada@example.com',
      activo: true,
      direccion: { ciudad: 'Londres', pais: 'Reino Unido' },
    },
    {
      id: 2,
      nombre: 'Linus Torvalds',
      email: 'linus@example.com',
      activo: false,
      direccion: { ciudad: 'Portland', pais: 'Estados Unidos' },
    },
    {
      id: 3,
      nombre: 'Margaret Hamilton',
      email: 'margaret@example.com',
      activo: true,
      direccion: { ciudad: 'Boston', pais: 'Estados Unidos' },
    },
  ];

  const SAMPLE_CSV = `nombre,edad,activo,ciudad
Ada Lovelace,36,true,Londres
Linus Torvalds,54,false,Portland
Margaret Hamilton,87,true,Boston`;

  const state = {
    direction: 'json-csv',
    result: '',
    isJson: false,
    filename: 'datos.csv',
    mime: 'text/csv;charset=utf-8',
  };

  let copyTimer = 0;
  let convertTimer = 0;

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
    const value = els.input.value;
    const chars = value.length;
    const lines = value ? value.split('\n').length : 0;

    els.inputMeta.textContent = `${formatNumber(chars)} ${
      chars === 1 ? 'carácter' : 'caracteres'
    } · ${formatNumber(lines)} ${lines === 1 ? 'línea' : 'líneas'}`;
  };

  const getDelimiter = () => els.delimiter.value;

  const escapeCsvCell = (value, delimiter) => {
    const text =
      value === null || value === undefined
        ? ''
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);

    if (
      text.includes('"') ||
      text.includes('\n') ||
      text.includes('\r') ||
      text.includes(delimiter)
    ) {
      return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
  };

  const flattenObject = (object, prefix = '', target = {}) => {
    Object.keys(object).forEach((key) => {
      const value = object[key];
      const path = prefix ? `${prefix}.${key}` : key;

      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        flattenObject(value, path, target);
      } else {
        target[path] = value;
      }
    });

    return target;
  };

  const normalizeJsonRows = (data, shouldFlatten) => {
    if (Array.isArray(data)) {
      return data.map((item) => {
        if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
          return shouldFlatten ? flattenObject(item) : { ...item };
        }

        return { value: item };
      });
    }

    if (data !== null && typeof data === 'object') {
      return [shouldFlatten ? flattenObject(data) : { ...data }];
    }

    return [{ value: data }];
  };

  const collectHeaders = (rows) => {
    const headers = [];

    rows.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (!headers.includes(key)) {
          headers.push(key);
        }
      });
    });

    return headers;
  };

  const jsonToCsv = (raw) => {
    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`JSON no válido: ${error.message}`, { cause: error });
    }

    const rows = normalizeJsonRows(parsed, els.flatten.checked);

    if (!rows.length) {
      throw new Error('El JSON no contiene filas para convertir.');
    }

    const headers = collectHeaders(rows);

    if (!headers.length) {
      throw new Error('No se han encontrado columnas en el JSON.');
    }

    const delimiter = getDelimiter();
    const lines = [headers.map((header) => escapeCsvCell(header, delimiter))];

    rows.forEach((row) => {
      lines.push(
        headers.map((header) => escapeCsvCell(row[header], delimiter)),
      );
    });

    return {
      output: lines.join('\r\n'),
      rows: rows.length,
      columns: headers.length,
      filename: 'datos.csv',
      mime: 'text/csv;charset=utf-8',
      isJson: false,
      message: `${formatNumber(rows.length)} filas × ${formatNumber(
        headers.length,
      )} columnas`,
    };
  };

  const parseCsv = (text, delimiter) => {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];

      if (inQuotes) {
        if (char === '"') {
          if (text[index + 1] === '"') {
            field += '"';
            index += 1;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        row.push(field);
        field = '';
      } else if (char === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (char === '\r') {
        if (text[index + 1] === '\n') {
          index += 1;
        }
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }

    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }

    if (inQuotes) {
      throw new Error('El CSV contiene comillas sin cerrar.');
    }

    while (
      rows.length &&
      rows[rows.length - 1].length === 1 &&
      rows[rows.length - 1][0] === ''
    ) {
      rows.pop();
    }

    return rows;
  };

  const makeUniqueHeaders = (rawHeaders) => {
    const used = new Set();

    return rawHeaders.map((header, index) => {
      const base = String(header).trim() || `columna_${index + 1}`;
      let candidate = base;
      let suffix = 2;

      while (used.has(candidate)) {
        candidate = `${base}_${suffix}`;
        suffix += 1;
      }

      used.add(candidate);
      return candidate;
    });
  };

  const inferCsvValue = (value) => {
    const trimmed = value.trim();

    if (trimmed === '') {
      return '';
    }

    if (/^true$/i.test(trimmed)) {
      return true;
    }

    if (/^false$/i.test(trimmed)) {
      return false;
    }

    if (/^null$/i.test(trimmed)) {
      return null;
    }

    if (
      /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(trimmed) &&
      Number.isFinite(Number(trimmed)) &&
      Math.abs(Number(trimmed)) <= Number.MAX_SAFE_INTEGER
    ) {
      return Number(trimmed);
    }

    return value;
  };

  const csvToJson = (raw) => {
    const delimiter = getDelimiter();
    const rows = parseCsv(raw.replace(/^\uFEFF/, ''), delimiter);

    if (!rows.length) {
      throw new Error('No se han encontrado filas en el CSV.');
    }

    let headers;

    if (els.headers.checked) {
      headers = makeUniqueHeaders(rows.shift());
    } else {
      const width = Math.max(...rows.map((row) => row.length));
      headers = Array.from(
        { length: width },
        (_, index) => `columna_${index + 1}`,
      );
    }

    if (!headers.length) {
      throw new Error('El CSV no contiene cabeceras.');
    }

    const data = rows.map((row) => {
      const item = {};

      headers.forEach((header, index) => {
        const value = row[index] === undefined ? '' : row[index];
        item[header] = els.inferTypes.checked ? inferCsvValue(value) : value;
      });

      return item;
    });

    return {
      output: JSON.stringify(data, null, 2),
      rows: data.length,
      columns: headers.length,
      filename: 'datos.json',
      mime: 'application/json;charset=utf-8',
      isJson: true,
      message: `${formatNumber(data.length)} ${
        data.length === 1 ? 'registro' : 'registros'
      } · ${formatNumber(headers.length)} columnas`,
    };
  };

  const showEmpty = () => {
    state.result = '';
    els.outputEmpty.hidden = false;
    els.outputCode.hidden = true;
    els.outputError.hidden = true;
    els.outputMeta.textContent = 'Sin resultado';
    els.btnDownload.disabled = true;
    els.btnCopy.disabled = true;
    els.btnCopyLabel.textContent = 'Copiar';
    els.btnCopy.classList.remove('is-copied');
  };

  const showError = (message) => {
    state.result = '';
    els.outputEmpty.hidden = true;
    els.outputCode.hidden = true;
    els.outputError.hidden = false;
    els.outputErrorText.textContent = message;
    els.outputMeta.textContent = 'Error de conversión';
    els.btnDownload.disabled = true;
    els.btnCopy.disabled = true;
    els.btnCopyLabel.textContent = 'Copiar';
    els.btnCopy.classList.remove('is-copied');
  };

  const showResult = (conversion) => {
    state.result = conversion.output;
    state.isJson = conversion.isJson;
    state.filename = conversion.filename;
    state.mime = conversion.mime;

    els.outputEmpty.hidden = true;
    els.outputError.hidden = true;
    els.outputCode.hidden = false;
    els.outputCode.classList.toggle('output-code--plain', !conversion.isJson);

    if (conversion.isJson) {
      highlightJson(els.outputCode, conversion.output);
    } else {
      els.outputCode.textContent = conversion.output;
    }

    els.outputMeta.textContent = `${conversion.message} · ${formatNumber(
      conversion.output.length,
    )} caracteres`;
    els.btnDownload.disabled = false;
    els.btnCopy.disabled = false;
    els.btnDownloadLabel.textContent = conversion.isJson
      ? 'Descargar .json'
      : 'Descargar .csv';
  };

  const convert = () => {
    updateInputMeta();

    const raw = els.input.value.trim();

    if (!raw) {
      showEmpty();
      setStatus('empty', 'Esperando datos…');
      return;
    }

    try {
      const conversion =
        state.direction === 'json-csv' ? jsonToCsv(raw) : csvToJson(raw);

      showResult(conversion);
      setStatus('valid', 'Conversión válida');
    } catch (error) {
      showError(error.message);
      setStatus('invalid', 'No se pudo convertir');
    }
  };

  const scheduleConvert = () => {
    updateInputMeta();

    if (!els.input.value.trim()) {
      window.clearTimeout(convertTimer);
      convert();
      return;
    }

    setStatus('working', 'Convirtiendo…');
    window.clearTimeout(convertTimer);
    convertTimer = window.setTimeout(convert, 220);
  };

  const updateDirectionUI = () => {
    const isJsonToCsv = state.direction === 'json-csv';

    els.direction.querySelectorAll('[data-direction]').forEach((button) => {
      const active = button.dataset.direction === state.direction;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    els.inputLabel.textContent = isJsonToCsv
      ? 'JSON de entrada'
      : 'CSV de entrada';
    els.outputLabel.textContent = isJsonToCsv
      ? 'CSV de salida'
      : 'JSON de salida';
    els.input.placeholder = isJsonToCsv
      ? '[\n  { "nombre": "Ada", "edad": 36 },\n  { "nombre": "Linus", "edad": 54 }\n]'
      : 'nombre,edad,activo\nAda,36,true\nLinus,54,false';
    els.outputEmptyText.textContent = isJsonToCsv
      ? 'El CSV convertido aparecerá aquí.'
      : 'El JSON convertido aparecerá aquí.';
    els.btnDownloadLabel.textContent = isJsonToCsv
      ? 'Descargar .csv'
      : 'Descargar .json';
    els.flattenField.hidden = !isJsonToCsv;
    els.headersField.hidden = isJsonToCsv;
    els.inferField.hidden = isJsonToCsv;
  };

  const setDirection = (nextDirection) => {
    if (nextDirection === state.direction) {
      return;
    }

    const previousResult = state.result;

    state.direction = nextDirection;
    window.clearTimeout(convertTimer);

    if (previousResult) {
      els.input.value = previousResult;
    }

    showEmpty();
    updateDirectionUI();
    convert();
  };

  els.direction.addEventListener('click', (event) => {
    const button = event.target.closest('[data-direction]');

    if (button) {
      setDirection(button.dataset.direction);
    }
  });

  els.input.addEventListener('input', scheduleConvert);

  els.flatten.addEventListener('change', convert);
  els.headers.addEventListener('change', convert);
  els.inferTypes.addEventListener('change', convert);
  els.delimiter.addEventListener('change', convert);

  els.btnConvert.addEventListener('click', () => {
    window.clearTimeout(convertTimer);
    convert();
  });

  els.btnClear.addEventListener('click', () => {
    els.input.value = '';
    window.clearTimeout(convertTimer);
    showEmpty();
    setStatus('empty', 'Esperando datos…');
    updateInputMeta();
    els.input.focus();
  });

  els.btnSample.addEventListener('click', () => {
    els.input.value =
      state.direction === 'json-csv'
        ? JSON.stringify(SAMPLE_JSON, null, 2)
        : SAMPLE_CSV;
    window.clearTimeout(convertTimer);
    convert();
    els.input.focus();
    els.input.setSelectionRange(0, 0);
    els.input.scrollTop = 0;
    showToast('Ejemplo cargado.');
  });

  els.btnCopy.addEventListener('click', async () => {
    if (!state.result) {
      return;
    }

    const copied = await copyText(state.result);

    if (copied) {
      window.clearTimeout(copyTimer);
      els.btnCopy.classList.add('is-copied');
      els.btnCopyLabel.textContent = 'Copiado';
      showToast('Resultado copiado al portapapeles.');
      copyTimer = window.setTimeout(() => {
        els.btnCopy.classList.remove('is-copied');
        els.btnCopyLabel.textContent = 'Copiar';
      }, 1800);
      return;
    }

    showToast('No se pudo copiar el resultado.', 'error');
  });

  els.btnDownload.addEventListener('click', () => {
    if (!state.result) {
      return;
    }

    const content = state.isJson ? state.result : `\uFEFF${state.result}`;

    window.JSONKit.downloadText(state.filename, content, state.mime);
    showToast(`Descargando ${state.filename}.`);
  });

  updateDirectionUI();
  updateInputMeta();
  showEmpty();
  setStatus('empty', 'Esperando datos…');
})();
