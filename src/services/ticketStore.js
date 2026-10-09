const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'tickets.json');

function readAll() {
  if (!fs.existsSync(STORE_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function writeAll(tickets) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(tickets, null, 2));
}

function getOpenTicketByBuyer(buyerId) {
  return readAll().find((t) => t.buyerId === buyerId && t.status === 'open') || null;
}

function getTicketByChannelId(channelId) {
  return readAll().find((t) => t.channelId === channelId) || null;
}

/** Ambil kode unik 1-999 yang belum dipakai ticket manapun yang masih open. */
function allocateUniqueCode() {
  const tickets = readAll();
  const usedCodes = new Set(tickets.filter((t) => t.status === 'open').map((t) => t.uniqueCode));

  if (usedCodes.size >= 999) return null; // semua kode unik sedang terpakai

  // Coba acak dulu (cepat untuk kasus umum), fallback scan berurutan kalau sial.
  for (let i = 0; i < 50; i++) {
    const candidate = 1 + Math.floor(Math.random() * 999);
    if (!usedCodes.has(candidate)) return candidate;
  }
  for (let candidate = 1; candidate <= 999; candidate++) {
    if (!usedCodes.has(candidate)) return candidate;
  }
  return null;
}

function generateTicketId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa karakter ambigu (0/O, 1/I)
  let suffix = '';
  for (let i = 0; i < 5; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `KKS-${suffix}`;
}

function createTicket({
  channelId,
  buyerId,
  productId,
  productLabel,
  robloxUsername,
  robloxUserId,
  price,
  uniqueCode,
}) {
  const tickets = readAll();
  const ticket = {
    ticketId: generateTicketId(),
    channelId,
    buyerId,
    productId,
    productLabel,
    robloxUsername,
    robloxUserId,
    price,
    uniqueCode,
    total: price + uniqueCode,
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  tickets.push(ticket);
  writeAll(tickets);
  return ticket;
}

function closeTicket(channelId, { status, note, closedById }) {
  const tickets = readAll();
  const idx = tickets.findIndex((t) => t.channelId === channelId);
  if (idx === -1) return null;

  tickets[idx] = {
    ...tickets[idx],
    status: 'closed',
    closeStatus: status, // 'completed' | 'cancelled' | 'refunded'
    closeNote: note,
    closedById,
    closedAt: new Date().toISOString(),
  };
  writeAll(tickets);
  return tickets[idx];
}

module.exports = {
  getOpenTicketByBuyer,
  getTicketByChannelId,
  allocateUniqueCode,
  createTicket,
  closeTicket,
};
