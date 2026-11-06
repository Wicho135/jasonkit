'use strict';

/**
 * Formateador, validador y minificador de JSON.
 */
(() => {
  const els = {
    input: document.getElementById('json-input'),
    inputMeta: document.getElementById('input-meta'),
    output: document.getElementById('output'),
    outputEmpty: document.getElementById('output-empty'),
    outputCode: document.getElementById('output-code'),
    outputError: document.getElementById('output-error'),
    outputMeta: document.getElementById('output-meta'),
    errorLocation: document.getElementById('error-location'),
    errorMessage: document.getElementById('error-message'),
    errorSnippet: document.getElementById('error-snippet'),
    status: document.getElementById('status'),
    statusText: document.getElementById('status-text'),
    indent: document.getElementById('indent'),
    btnFormat: document.getElementById('btn-format'),
    btnMinify: document.getElementById('btn-minify'),
    btnClear: document.getElementById('btn-clear'),
    btnCopy: document.getElementById('btn-copy'),
    btnCopyLabel: document.getElementById('btn-copy-label'),
    btnSample: document.getElementById('btn-sample'),
  };

  if (!els.input || !els.output) {
    return;
  }

  const SAMPLE = {
    site: 'JSONKit',
    version: '1.0.0',
    private: true,
    tools: ['formatear', 'validar', 'minificar'],
    theme: {
      mode: 'dark',
      accent: '#6366f1',
    },
    features: {
      offline: true,
      telemetry: false,
    },
    stats: {
      tools: 5,
      rating: 4.9,
    },
    lastRelease: '2026-11-06',
  };

  const DEFAULT_MODE = 'format';
  const DEBOUNCE_MS = 180;

  let mode = DEFAULT_MODE;
  let lastValidOutput = '';
  let renderTimer = 0;
  let copyTimer = 0;

  const formatNumber = window.JSONKit.formatNumber;

  const setStatus = (state, message) => {
    els.status.classList.remove('is-valid', 'is-invalid', 'is-working');

    if (state === 'valid' || state === 'invalid' || state === 'working') {
      els.status.classList.add(`is-${state}`);
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

  const showEmptyOutput = () => {
    els.outputEmpty.hidden = false;
    els.outputCode.hidden = true;
    els.outputError.hidden = true;
    els.outputMeta.textContent = 'Sin resultado';
  };

  const showCodeOutput = (code) => {
    els.outputEmpty.hidden = true;
    els.outputError.hidden = true;
    els.outputCode.hidden = false;
    els.outputCode.classList.remove('output-code--plain');
    window.JSONKit.highlightJson(els.outputCode, code);
    els.outputMeta.textContent = `${
      mode === 'minify' ? 'Minificado' : 'Formateado'
    } · ${formatNumber(code.length)} caracteres`;
  };

  const getErrorDetails = (error, source) => {
    const rawMessage =
      error && error.message ? error.message : 'Error de sintaxis desconocido.';

    let line = null;
    let column = null;

    const lineColumnMatch = rawMessage.match(
      /\bline\s+(\d+)\s+column\s+(\d+)\b/i,
    );

    if (lineColumnMatch) {
      line = Number(lineColumnMatch[1]);
      column = Number(lineColumnMatch[2]);
    } else {
      const positionMatch = rawMessage.match(/\bposition\s+(\d+)\b/i);

      if (positionMatch) {
        const position = Math.min(Number(positionMatch[1]), source.length);
        const before = source.slice(0, position);
        const lastBreak = before.lastIndexOf('\n');

        line = before.split('\n').length;
        column = position - lastBreak;
      }
    }

    const cleanedMessage = rawMessage
      .replace(/^JSON\.parse:\s*/i, '')
      .replace(
        /\s+in JSON at position \d+(?:\s*\(line \d+ column \d+\))?\s*$/i,
        '',
      )
      .replace(/\s+at line \d+ column \d+(?:\s+of the JSON data)?\s*$/i, '')
      .trim();

    return {
      line,
      column,
      message: cleanedMessage || rawMessage,
    };
  };

  const buildSnippet = (source, line, column) => {
    if (!line) {
      return '';
    }

    const rawLine = source.split('\n')[line - 1];

    if (typeof rawLine !== 'string') {
      return '';
    }

    const plainLine = rawLine.replace(/\t/g, '  ');
    const caretPosition = Math.max(0, (column || 1) - 1);
    const prefix = rawLine.slice(0, caretPosition).replace(/\t/g, '  ');

    return `${plainLine}\n${' '.repeat(prefix.length)}^`;
  };

  const showErrorOutput = (details, source) => {
    els.outputEmpty.hidden = true;
    els.outputCode.hidden = true;
    els.outputMeta.textContent = 'Error de sintaxis';

    if (details.line && details.column) {
      els.errorLocation.hidden = false;
      els.errorLocation.textContent = `Línea ${formatNumber(
        details.line,
      )}, columna ${formatNumber(details.column)}`;
    } else {
      els.errorLocation.hidden = true;
      els.errorLocation.textContent = '';
    }

    els.errorMessage.textContent = details.message;

    const snippet = buildSnippet(source, details.line, details.column);

    els.errorSnippet.hidden = !snippet;
    els.errorSnippet.textContent = snippet;
    els.outputError.hidden = false;
  };

  const resetCopyButton = () => {
    window.clearTimeout(copyTimer);
    els.btnCopy.classList.remove('is-copied');
    els.btnCopyLabel.textContent = 'Copiar';
  };

  const setCopyEnabled = (enabled) => {
    if (!enabled) {
      resetCopyButton();
    }

    els.btnCopy.disabled = !enabled;
  };

  const getIndent = () => {
    if (els.indent.value === 'tab') {
      return '\t';
    }

    return Number(els.indent.value);
  };

  const render = () => {
    updateInputMeta();

    const raw = els.input.value;

    if (!raw.trim()) {
      lastValidOutput = '';
      setCopyEnabled(false);
      showEmptyOutput();
      setStatus('empty', 'Esperando JSON…');
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const result = JSON.stringify(
        parsed,
        null,
        mode === 'format' ? getIndent() : undefined,
      );

      lastValidOutput = result;
      showCodeOutput(result);
      setCopyEnabled(true);
      setStatus('valid', 'JSON válido');
    } catch (error) {
      lastValidOutput = '';
      setCopyEnabled(false);
      showErrorOutput(getErrorDetails(error, raw), raw);
      setStatus('invalid', 'JSON no válido');
    }
  };

  const scheduleRender = () => {
    updateInputMeta();

    if (!els.input.value.trim()) {
      window.clearTimeout(renderTimer);
      render();
      return;
    }

    setStatus('working', 'Comprobando…');
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(render, DEBOUNCE_MS);
  };

  const setMode = (nextMode) => {
    mode = nextMode;
    render();

    if (!els.input.value.trim()) {
      els.input.focus();
    }
  };

  els.input.addEventListener('input', scheduleRender);

  els.input.addEventListener('keydown', (event) => {
    const isModifierPressed = event.ctrlKey || event.metaKey;

    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      const start = els.input.selectionStart;
      const end = els.input.selectionEnd;
      els.input.setRangeText('  ', start, end, 'end');
      els.input.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }

    if (isModifierPressed && event.key === 'Enter') {
      event.preventDefault();
      setMode('format');
      window.JSONKit.showToast('JSON formateado.');
      return;
    }

    if (
      isModifierPressed &&
      event.shiftKey &&
      event.key.toLowerCase() === 'm'
    ) {
      event.preventDefault();
      setMode('minify');
      window.JSONKit.showToast('JSON minificado.');
    }
  });

  els.btnFormat.addEventListener('click', () => {
    setMode('format');
  });

  els.btnMinify.addEventListener('click', () => {
    setMode('minify');
  });

  els.btnClear.addEventListener('click', () => {
    els.input.value = '';
    mode = DEFAULT_MODE;
    window.clearTimeout(renderTimer);
    render();
    els.input.focus();
  });

  els.btnCopy.addEventListener('click', async () => {
    if (!lastValidOutput) {
      return;
    }

    const copied = await window.JSONKit.copyText(lastValidOutput);

    if (copied) {
      window.clearTimeout(copyTimer);
      els.btnCopy.classList.add('is-copied');
      els.btnCopyLabel.textContent = 'Copiado';
      window.JSONKit.showToast('JSON copiado al portapapeles.');
      copyTimer = window.setTimeout(resetCopyButton, 1800);
      return;
    }

    window.JSONKit.showToast(
      'No se pudo copiar. Selecciona el resultado manualmente.',
      'error',
    );
  });

  els.btnSample.addEventListener('click', () => {
    els.input.value = JSON.stringify(SAMPLE, null, 2);
    mode = DEFAULT_MODE;
    window.clearTimeout(renderTimer);
    render();
    els.input.focus();
    els.input.setSelectionRange(0, 0);
    els.input.scrollTop = 0;
    window.JSONKit.showToast(
      'Ejemplo cargado. Prueba a formatear o minificar.',
    );
  });

  els.indent.addEventListener('change', () => {
    if (mode === 'format') {
      render();
    }
  });

  updateInputMeta();
  render();
})();
