'use strict';

/**
 * Generador masivo de UUID v4 y v1 con opciones de formato.
 */
(() => {
  const els = {
    status: document.getElementById('status'),
    statusText: document.getElementById('status-text'),
    version: document.getElementById('uuid-version'),
    count: document.getElementById('uuid-count'),
    uppercase: document.getElementById('uppercase'),
    noHyphens: document.getElementById('no-hyphens'),
    braces: document.getElementById('braces'),
    output: document.getElementById('uuid-output'),
    outputEmpty: document.getElementById('uuid-output-empty'),
    outputCode: document.getElementById('uuid-output-code'),
    meta: document.getElementById('uuid-meta'),
    btnGenerate: document.getElementById('btn-generate'),
    btnCopy: document.getElementById('btn-copy'),
    btnCopyLabel: document.getElementById('btn-copy-label'),
    btnDownload: document.getElementById('btn-download'),
    btnClear: document.getElementById('btn-clear'),
  };

  if (!els.output || !els.count) {
    return;
  }

  const { copyText, downloadText, formatNumber, showToast } = window.JSONKit;

  const GREGORIAN_OFFSET = 122192928000000000n;
  const MAX_COUNT = 1000;

  let version = '4';
  let generated = [];
  let lastTimestamp = 0n;
  let copyTimer = 0;

  const clockSequence = crypto.getRandomValues(new Uint16Array(1))[0] & 0x3fff;
  const nodeBytes = crypto.getRandomValues(new Uint8Array(6));
  nodeBytes[0] |= 0x01;
  const node = Array.from(nodeBytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');

  const setStatus = (state, message) => {
    els.status.classList.remove('is-valid', 'is-invalid', 'is-working');

    if (state === 'valid' || state === 'invalid' || state === 'working') {
      els.status.classList.add(`is-${state}`);
    }

    els.statusText.textContent = message;
  };

  const randomHex = (byte) => byte.toString(16).padStart(2, '0');

  const uuidV4 = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, randomHex).join('');

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
      12,
      16,
    )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };

  const uuidV1 = () => {
    let timestamp = (BigInt(Date.now()) + GREGORIAN_OFFSET) * 10000n;

    if (timestamp <= lastTimestamp) {
      timestamp = lastTimestamp + 1n;
    }

    lastTimestamp = timestamp;

    const timeLow = (timestamp & 0xffffffffn).toString(16).padStart(8, '0');
    const timeMid = ((timestamp >> 32n) & 0xffffn)
      .toString(16)
      .padStart(4, '0');
    const timeHi = (((timestamp >> 48n) & 0x0fffn) | 0x1000n)
      .toString(16)
      .padStart(4, '0');
    const clock = (0x8000 | clockSequence).toString(16).padStart(4, '0');

    return `${timeLow}-${timeMid}-${timeHi}-${clock}-${node}`;
  };

  const getCount = () => {
    const parsed = Number.parseInt(els.count.value, 10);
    const count = Number.isFinite(parsed)
      ? Math.min(MAX_COUNT, Math.max(1, parsed))
      : 10;

    els.count.value = String(count);
    return count;
  };

  const formatUuid = (uuid) => {
    let formatted = els.uppercase.checked ? uuid.toUpperCase() : uuid;

    if (els.noHyphens.checked) {
      formatted = formatted.replace(/-/g, '');
    }

    if (els.braces.checked) {
      formatted = `{${formatted}}`;
    }

    return formatted;
  };

  const getFormattedUuids = () => generated.map(formatUuid);

  const render = () => {
    const formatted = getFormattedUuids();

    if (!formatted.length) {
      els.outputEmpty.hidden = false;
      els.outputCode.hidden = true;
      els.meta.textContent = 'Sin UUIDs';
      els.btnCopy.disabled = true;
      els.btnDownload.disabled = true;
      return;
    }

    els.outputEmpty.hidden = true;
    els.outputCode.hidden = false;
    els.outputCode.textContent = formatted.join('\n');
    els.meta.textContent = `${formatNumber(formatted.length)} UUIDs · v${version}`;
    els.btnCopy.disabled = false;
    els.btnDownload.disabled = false;
  };

  const generate = () => {
    const count = getCount();
    generated = Array.from({ length: count }, () =>
      version === '4' ? uuidV4() : uuidV1(),
    );

    render();
    setStatus(
      'valid',
      `${formatNumber(count)} UUID v${version} generados localmente`,
    );
  };

  const updateVersionUI = () => {
    els.version.querySelectorAll('[data-version]').forEach((button) => {
      const active = button.dataset.version === version;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };

  els.version.addEventListener('click', (event) => {
    const button = event.target.closest('[data-version]');

    if (!button || button.dataset.version === version) {
      return;
    }

    version = button.dataset.version;
    updateVersionUI();
    generate();
  });

  els.count.addEventListener('change', generate);
  els.uppercase.addEventListener('change', render);
  els.noHyphens.addEventListener('change', render);
  els.braces.addEventListener('change', render);

  els.btnGenerate.addEventListener('click', generate);

  els.btnCopy.addEventListener('click', async () => {
    const formatted = getFormattedUuids();

    if (!formatted.length) {
      return;
    }

    const copied = await copyText(formatted.join('\n'));

    if (copied) {
      window.clearTimeout(copyTimer);
      els.btnCopy.classList.add('is-copied');
      els.btnCopyLabel.textContent = 'Copiado';
      showToast(`${formatNumber(formatted.length)} UUIDs copiados.`);
      copyTimer = window.setTimeout(() => {
        els.btnCopy.classList.remove('is-copied');
        els.btnCopyLabel.textContent = 'Copiar todos';
      }, 1800);
      return;
    }

    showToast('No se pudieron copiar los UUIDs.', 'error');
  });

  els.btnDownload.addEventListener('click', () => {
    const formatted = getFormattedUuids();

    if (!formatted.length) {
      return;
    }

    downloadText(`uuids-v${version}.txt`, formatted.join('\n'));
    showToast(`Descargando uuids-v${version}.txt.`);
  });

  els.btnClear.addEventListener('click', () => {
    generated = [];
    render();
    setStatus('empty', 'Sin UUIDs generados');
  });

  updateVersionUI();
  generate();
})();
