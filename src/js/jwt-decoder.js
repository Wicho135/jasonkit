'use strict';

/**
 * Decodificador local de JSON Web Tokens.
 * No verifica firmas ni envía el token a ningún servidor.
 */
(() => {
  const els = {
    input: document.getElementById('jwt-input'),
    inputMeta: document.getElementById('jwt-input-meta'),
    status: document.getElementById('status'),
    statusText: document.getElementById('status-text'),
    error: document.getElementById('jwt-error'),
    errorText: document.getElementById('jwt-error-text'),
    empty: document.getElementById('jwt-empty'),
    results: document.getElementById('jwt-results'),
    header: document.getElementById('jwt-header'),
    payload: document.getElementById('jwt-payload'),
    signature: document.getElementById('jwt-signature'),
    alg: document.getElementById('jwt-alg'),
    iat: document.getElementById('jwt-iat'),
    nbf: document.getElementById('jwt-nbf'),
    exp: document.getElementById('jwt-exp'),
    expBadge: document.getElementById('jwt-exp-badge'),
    expText: document.getElementById('jwt-exp-text'),
    btnCopyHeader: document.getElementById('btn-copy-header'),
    btnCopyPayload: document.getElementById('btn-copy-payload'),
    btnCopySignature: document.getElementById('btn-copy-signature'),
    btnSample: document.getElementById('btn-sample'),
    btnClear: document.getElementById('btn-clear'),
  };

  if (!els.input || !els.results) {
    return;
  }

  const { copyText, debounce, formatNumber, highlightJson, showToast } =
    window.JSONKit;

  const state = {
    header: null,
    payload: null,
    signature: '',
  };

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
    const value = els.input.value.trim();

    els.inputMeta.textContent = `${formatNumber(value.length)} ${
      value.length === 1 ? 'carácter' : 'caracteres'
    }`;
  };

  const decodeSegment = (segment) => {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  };

  const parseJsonSegment = (segment, name) => {
    let decoded;

    try {
      decoded = decodeSegment(segment);
    } catch {
      throw new Error(`El ${name} no contiene un Base64URL válido.`);
    }

    let parsed;

    try {
      parsed = JSON.parse(decoded);
    } catch {
      throw new Error(`El ${name} no contiene JSON válido.`);
    }

    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      throw new Error(`El ${name} debe ser un objeto JSON.`);
    }

    return parsed;
  };

  const parseToken = (raw) => {
    const cleaned = raw
      .trim()
      .replace(/^Bearer\s+/i, '')
      .replace(/^["']|["']$/g, '');
    const parts = cleaned.split('.');

    if (parts.length !== 3) {
      throw new Error(
        'Un JWT debe tener tres partes separadas por puntos (header.payload.signature).',
      );
    }

    if (!parts[0] || !parts[1]) {
      throw new Error('El header y el payload no pueden estar vacíos.');
    }

    const header = parseJsonSegment(parts[0], 'header');
    const payload = parseJsonSegment(parts[1], 'payload');

    return {
      header,
      payload,
      signature: parts[2],
    };
  };

  const formatDate = (seconds) => {
    const date = new Date(Number(seconds) * 1000);

    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return date.toLocaleString('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const formatDuration = (seconds) => {
    const absolute = Math.abs(seconds);

    if (absolute < 60) {
      return `${Math.round(absolute)} s`;
    }

    if (absolute < 3600) {
      return `${Math.round(absolute / 60)} min`;
    }

    if (absolute < 86400) {
      return `${Math.round(absolute / 3600)} h`;
    }

    if (absolute < 2592000) {
      return `${Math.round(absolute / 86400)} días`;
    }

    if (absolute < 31536000) {
      return `${Math.round(absolute / 2592000)} meses`;
    }

    return `${Math.round(absolute / 31536000)} años`;
  };

  const getNumericClaim = (payload, claim) => {
    const value = payload[claim];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (
      typeof value === 'string' &&
      value.trim() !== '' &&
      Number.isFinite(Number(value))
    ) {
      return Number(value);
    }

    return null;
  };

  const updateExpiration = () => {
    const now = Math.floor(Date.now() / 1000);
    const exp = getNumericClaim(state.payload, 'exp');
    const nbf = getNumericClaim(state.payload, 'nbf');
    const iat = getNumericClaim(state.payload, 'iat');

    els.expBadge.className = 'badge badge--neutral';
    els.iat.textContent = iat !== null ? formatDate(iat) : '—';
    els.nbf.textContent = nbf !== null ? formatDate(nbf) : '—';
    els.exp.textContent = exp !== null ? formatDate(exp) : '—';

    if (exp === null) {
      els.expBadge.classList.add('badge--neutral');
      els.expBadge.textContent = 'Sin expiración';
      els.expText.textContent =
        'El payload no incluye el claim exp. El token no caduca por sí mismo.';
      return;
    }

    const difference = exp - now;

    if (difference <= 0) {
      els.expBadge.className = 'badge badge--danger';
      els.expBadge.textContent = 'Caducado';
      els.expText.textContent = `Caducó el ${formatDate(
        exp,
      )} · hace ${formatDuration(difference)}.`;
    } else {
      els.expBadge.className = 'badge badge--success';
      els.expBadge.textContent = 'Vigente';
      els.expText.textContent = `Vigente hasta ${formatDate(
        exp,
      )} · expira en ${formatDuration(difference)}.`;
    }

    if (nbf !== null && nbf > now) {
      els.expBadge.className = 'badge badge--warning';
      els.expBadge.textContent = 'Aún no vigente';
      els.expText.textContent = `El token no será válido hasta ${formatDate(
        nbf,
      )}.`;
    }
  };

  const showEmpty = () => {
    state.header = null;
    state.payload = null;
    state.signature = '';
    els.empty.hidden = false;
    els.results.hidden = true;
    els.error.hidden = true;
  };

  const showError = (message) => {
    state.header = null;
    state.payload = null;
    state.signature = '';
    els.empty.hidden = true;
    els.results.hidden = true;
    els.error.hidden = false;
    els.errorText.textContent = message;
  };

  const showToken = (token) => {
    state.header = token.header;
    state.payload = token.payload;
    state.signature = token.signature;

    els.empty.hidden = true;
    els.error.hidden = true;
    els.results.hidden = false;

    highlightJson(els.header, JSON.stringify(token.header, null, 2));
    highlightJson(els.payload, JSON.stringify(token.payload, null, 2));
    els.signature.textContent = token.signature || '(vacía)';
    els.alg.textContent =
      typeof token.header.alg === 'string' ? token.header.alg : '—';
    updateExpiration();
  };

  const render = () => {
    updateInputMeta();

    const raw = els.input.value.trim();

    if (!raw) {
      showEmpty();
      setStatus('empty', 'Esperando token JWT…');
      return;
    }

    try {
      const token = parseToken(raw);
      showToken(token);
      setStatus('valid', 'JWT decodificado');
    } catch (error) {
      showError(error.message);
      setStatus('invalid', 'JWT no válido');
    }
  };

  const scheduleRender = () => {
    updateInputMeta();

    if (!els.input.value.trim()) {
      setStatus('empty', 'Esperando token JWT…');
      showEmpty();
      return;
    }

    setStatus('working', 'Decodificando…');
    debounceRender();
  };

  const debounceRender = debounce(render, 160);

  const createSampleToken = () => {
    const encodeSegment = (object) => {
      const bytes = new TextEncoder().encode(JSON.stringify(object));
      let binary = '';

      bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
      });

      return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    };

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      sub: '1234567890',
      name: 'Ada Lovelace',
      roles: ['admin', 'editor'],
      iat: now,
      exp: now + 3600,
    };
    const signature = btoa('firma-demo')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return `${encodeSegment(header)}.${encodeSegment(payload)}.${signature}`;
  };

  const copyPart = async (value, label) => {
    const copied = await copyText(value);

    if (copied) {
      showToast(`${label} copiado al portapapeles.`);
      return;
    }

    showToast(`No se pudo copiar el ${label.toLowerCase()}.`, 'error');
  };

  els.input.addEventListener('input', scheduleRender);

  els.btnCopyHeader.addEventListener('click', () => {
    if (state.header) {
      copyPart(JSON.stringify(state.header, null, 2), 'Header');
    }
  });

  els.btnCopyPayload.addEventListener('click', () => {
    if (state.payload) {
      copyPart(JSON.stringify(state.payload, null, 2), 'Payload');
    }
  });

  els.btnCopySignature.addEventListener('click', () => {
    if (state.signature) {
      copyPart(state.signature, 'Firma');
    }
  });

  els.btnSample.addEventListener('click', () => {
    els.input.value = createSampleToken();
    render();
    els.input.focus();
    els.input.setSelectionRange(0, 0);
    els.input.scrollTop = 0;
    showToast('Token de ejemplo cargado.');
  });

  els.btnClear.addEventListener('click', () => {
    els.input.value = '';
    render();
    els.input.focus();
  });

  updateInputMeta();
  showEmpty();
  setStatus('empty', 'Esperando token JWT…');
})();
