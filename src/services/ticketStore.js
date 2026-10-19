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

/** Ticket open milik akun Roblox yang sama (cocok via userId, atau username tanpa peduli huruf besar/kecil). */
function getOpenTicketByRobloxUser({ robloxUserId, robloxUsername }) {
  const idStr = robloxUserId != null ? String(robloxUserId) : null;
  const nameLower = robloxUsername ? String(robloxUsername).toLowerCase() : null;
  return (
    readAll().find(
      (t) =>
        t.status === 'open' &&
        ((idStr && t.robloxUserId != null && String(t.robloxUserId) === idStr) ||
          (nameLower && t.robloxUsername && String(t.robloxUsername).toLowerCase() === nameLower))
    ) || null
  );
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

/** Tandai pembeli sudah konfirmasi bayar (menunggu verifikasi staff). Return null kalau ticket tidak open / sudah ditandai. */
function confirmPayment(channelId, { confirmedById }) {
  const tickets = readAll();
  const idx = tickets.findIndex((t) => t.channelId === channelId && t.status === 'open');
  if (idx === -1 || tickets[idx].paymentConfirmed) return null;

  tickets[idx] = {
    ...tickets[idx],
    paymentConfirmed: true,
    paymentConfirmedById: confirmedById,
    paymentConfirmedAt: new Date().toISOString(),
  };
  writeAll(tickets);
  return tickets[idx];
}

function setTicketMessageId(channelId, messageId) {
  const tickets = readAll();
  const idx = tickets.findIndex((t) => t.channelId === channelId);
  if (idx === -1) return null;
  tickets[idx] = { ...tickets[idx], ticketMessageId: messageId };
  writeAll(tickets);
  return tickets[idx];
}

/** Tandai dana sudah masuk (diverifikasi staff). Return null kalau ticket tidak open / sudah ditandai. */
function markFundsReceived(channelId, { receivedById }) {
  const tickets = readAll();
  const idx = tickets.findIndex((t) => t.channelId === channelId && t.status === 'open');
  if (idx === -1 || tickets[idx].fundsReceived) return null;
  tickets[idx] = {
    ...tickets[idx],
    fundsReceived: true,
    fundsReceivedById: receivedById,
    fundsReceivedAt: new Date().toISOString(),
  };
  writeAll(tickets);
  return tickets[idx];
}

/**
 * Tutup paksa ticket yang masih tercatat 'open' tapi channel Discord-nya
 * sudah tidak ada lagi (misal dihapus manual langsung dari Discord, bukan
 * lewat tombol "Tutup Ticket"). Supaya buyer tidak nyangkut dianggap masih
 * punya ticket aktif selamanya.
 */
function forceCloseIfOrphaned(channelId) {
  const tickets = readAll();
  const idx = tickets.findIndex((t) => t.channelId === channelId && t.status === 'open');
  if (idx === -1) return null;

  tickets[idx] = {
    ...tickets[idx],
    status: 'closed',
    closeStatus: 'cancelled',
    closeNote: 'Channel ticket sudah tidak ditemukan (dihapus manual di luar bot), otomatis ditutup oleh sistem.',
    closedById: null,
    closedAt: new Date().toISOString(),
  };
  writeAll(tickets);
  return tickets[idx];
}

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Kunci tanggal WIB: 'YYYY-MM-DD' (hari) dan 'YYYY-MM' (bulan). */
function wibDateKey(iso) {
  return new Date(new Date(iso).getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** Statistik transaksi Store (semua waktu + hari ini + bulan ini, berdasarkan waktu WIB). */
function getStats(now = new Date()) {
  const tickets = readAll();
  const todayKey = wibDateKey(now.toISOString());
  const monthKey = todayKey.slice(0, 7);

  const empty = () => ({ count: 0, revenue: 0 });
  const stats = { completed: empty(), today: empty(), month: empty(), cancelled: 0, refunded: 0, open: 0, total: tickets.length };
  const staffMap = new Map(); // staffId -> { count, revenue, monthCount, monthRevenue }

  for (const t of tickets) {
    if (t.status === 'open') {
      stats.open++;
    } else if (t.closeStatus === 'completed') {
      stats.completed.count++;
      stats.completed.revenue += t.total || 0;
      if (t.closedAt) {
        const key = wibDateKey(t.closedAt);
        if (key === todayKey) { stats.today.count++; stats.today.revenue += t.total || 0; }
        if (key.slice(0, 7) === monthKey) { stats.month.count++; stats.month.revenue += t.total || 0; }
      }
      // Per staff: siapa yang memproses/menutup transaksi berhasil ini.
      const sid = t.closedById || 'unknown';
      const st = staffMap.get(sid) || { staffId: sid, count: 0, revenue: 0, monthCount: 0, monthRevenue: 0 };
      st.count++;
      st.revenue += t.total || 0;
      if (t.closedAt && wibDateKey(t.closedAt).slice(0, 7) === monthKey) {
        st.monthCount++;
        st.monthRevenue += t.total || 0;
      }
      staffMap.set(sid, st);
    } else if (t.closeStatus === 'cancelled') {
      stats.cancelled++;
    } else if (t.closeStatus === 'refunded') {
      stats.refunded++;
    }
  }
  stats.byStaff = [...staffMap.values()].sort((a, b) => b.revenue - a.revenue);
  return stats;
}

module.exports = {
  getStats,
  getOpenTicketByBuyer,
  getOpenTicketByRobloxUser,
  getTicketByChannelId,
  allocateUniqueCode,
  createTicket,
  closeTicket,
  confirmPayment,
  setTicketMessageId,
  markFundsReceived,
  forceCloseIfOrphaned,
};
