const QRCode = require('qrcode');
const config = require('../config');

/**
 * Parser & generator QRIS dinamis dari QRIS statis (format EMVCo TLV).
 * Sudah divalidasi terhadap QRIS statis asli KokoKrunch Studios -- CRC checksum cocok.
 */

function parseTLV(str) {
  let i = 0;
  const tags = [];
  while (i < str.length) {
    const id = str.substr(i, 2);
    const len = parseInt(str.substr(i + 2, 2), 10);
    const value = str.substr(i + 4, len);
    tags.push({ id, value });
    i += 4 + len;
  }
  return tags;
}

function serializeTLV(tags) {
  return tags.map((t) => t.id + String(t.value.length).padStart(2, '0') + t.value).join('');
}

function crc16ccitt(str) {
  let crc = 0xffff;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  crc &= 0xffff;
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Ubah QRIS statis menjadi QRIS dinamis dengan nominal tertentu.
 * - Tag 01 (Point of Initiation Method): 11 (statis) -> 12 (dinamis)
 * - Tag 54 (Transaction Amount): disisipkan/diganti dengan nominal
 * - Tag 63 (CRC): dihitung ulang
 */
function buildDynamicQrisPayload(staticPayload, amount) {
  let tags = parseTLV(staticPayload);
  tags = tags.filter((t) => t.id !== '63');

  const poiTag = tags.find((t) => t.id === '01');
  if (poiTag) poiTag.value = '12';

  tags = tags.filter((t) => t.id !== '54');
  const amountTag = { id: '54', value: String(amount) };

  let insertIdx = tags.findIndex((t) => t.id === '53');
  if (insertIdx !== -1) {
    insertIdx += 1;
  } else {
    insertIdx = tags.findIndex((t) => t.id === '58');
    if (insertIdx === -1) insertIdx = tags.length;
  }
  tags.splice(insertIdx, 0, amountTag);

  const serialized = serializeTLV(tags) + '6304';
  const crc = crc16ccitt(serialized);
  return serialized + crc;
}

/**
 * Generate buffer PNG QR code dari payload QRIS dinamis.
 */
async function generateDynamicQrisImage(amount) {
  if (!config.qrisStaticPayload) {
    throw new Error('QRIS_STATIC_PAYLOAD belum dikonfigurasi di .env');
  }
  const payload = buildDynamicQrisPayload(config.qrisStaticPayload, amount);
  const buffer = await QRCode.toBuffer(payload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    scale: 8,
  });
  return buffer;
}

module.exports = {
  buildDynamicQrisPayload,
  generateDynamicQrisImage,
};
