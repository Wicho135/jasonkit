'use strict';

/**
 * Utilidades compartidas por todas las herramientas de JSONKit.
 * No realizan peticiones de red: todo se ejecuta en el navegador.
 */
(() => {
  const numberFormatter = new Intl.NumberFormat('es-ES');

  const formatNumber = (value) => numberFormatter.format(Number(value) || 0);

  const formatBytes = (bytes) => {
    const size = Number(bytes);

    if (!Number.isFinite(size) || size < 0) {
      return '—';
    }

    if (size < 1024) {
      return `${formatNumber(size)} B`;
    }

    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = size / 1024;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }

    return `${new Intl.NumberFormat('es-ES', {
      maximumFractionDigits: 1,
    }).format(value)} ${units[unitIndex]}`;
  };

  /**
   * Pinta JSON con resaltado básico usando nodos de texto y <span>.
   * No utiliza innerHTML, por lo que el contenido siempre es seguro.
   */
  const highlightJson = (element, code) => {
    element.replaceChildren();

    if (!code) {
      return;
    }

    const fragment = document.createDocumentFragment();
    const tokenPattern =
      /"(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b/g;
    let lastIndex = 0;
    let match = tokenPattern.exec(code);

    while (match) {
      if (match.index > lastIndex) {
        fragment.append(
          document.createTextNode(code.slice(lastIndex, match.index)),
        );
      }

      const token = match[0];
      const span = document.createElement('span');

      if (token.charAt(0) === '"') {
        span.className = /^\s*:/.test(code.slice(tokenPattern.lastIndex))
          ? 'tok-key'
          : 'tok-string';
      } else if (token === 'true' || token === 'false') {
        span.className = 'tok-literal';
      } else if (token === 'null') {
        span.className = 'tok-null';
      } else {
        span.className = 'tok-number';
      }

      span.textContent = token;
      fragment.append(span);
      lastIndex = tokenPattern.lastIndex;
      match = tokenPattern.exec(code);
    }

    if (lastIndex < code.length) {
      fragment.append(document.createTextNode(code.slice(lastIndex)));
    }

    element.append(fragment);
  };

  const copyText = async (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Se intenta el método clásico si el portapapeles moderno falla.
      }
    }

    const helper = document.createElement('textarea');
    const previousFocus = document.activeElement;
    helper.value = text;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.top = '-9999px';
    helper.style.left = '-9999px';
    document.body.appendChild(helper);
    helper.focus();
    helper.select();
    helper.setSelectionRange(0, text.length);

    let copied = false;

    try {
      copied = document.execCommand('copy');
    } catch {
      // El método clásico tampoco está disponible.
    }

    helper.remove();

    if (previousFocus && typeof previousFocus.focus === 'function') {
      previousFocus.focus();
    }

    return copied;
  };

  let toastTimer = 0;

  const showToast = (message, kind = 'success') => {
    const toast = document.getElementById('toast');

    if (!toast) {
      return;
    }

    toast.textContent = message;
    toast.classList.toggle('is-error', kind === 'error');
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 2800);
  };

  const downloadBlob = (filename, blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Se mantiene la URL viva el tiempo suficiente para que el navegador
    // termine de escribir archivos grandes antes de liberar la memoria.
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const downloadText = (filename, text, mime = 'text/plain;charset=utf-8') => {
    downloadBlob(filename, new Blob([text], { type: mime }));
  };

  const downloadBytes = (
    filename,
    bytes,
    mime = 'application/octet-stream',
  ) => {
    downloadBlob(filename, new Blob([bytes], { type: mime }));
  };

  const debounce = (callback, delay) => {
    let timer = 0;

    const debounced = (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => callback(...args), delay);
    };

    debounced.cancel = () => window.clearTimeout(timer);

    return debounced;
  };

  window.JSONKit = Object.freeze({
    copyText,
    debounce,
    downloadBytes,
    downloadText,
    formatBytes,
    formatNumber,
    highlightJson,
    showToast,
  });
})();
