const config = require('../config');

/**
 * Katalog produk Store. Untuk nambah produk baru di masa depan, tinggal
 * tambah entry baru di array ini (tidak perlu ubah logic lain selama
 * requiresRobloxUsername & enabled diisi dengan benar).
 */
const PRODUCTS = [
  {
    id: 'golden_pet',
    label: 'Golden Pet',
    emoji: '🐾',
    description: 'Golden Pet eksklusif Mount Lonely.',
    ticketPrefix: 'gold',
    categoryName: 'Golden Pet', // kategori ticket (otomatis "Golden Pet 2", "Golden Pet 3", ... kalau penuh)
    useLegacyCategory: true, // kategori lama dari TICKET_CATEGORY_ID (kalau diisi) tetap dipakai dulu sebelum bikin baru
    get price() {
      return config.goldenPetPrice;
    },
    requiresRobloxUsername: true,
    enabled: true,
  },
  {
    id: 'coming_soon',
    label: 'Coming Soon',
    emoji: '🔒',
    description: 'Produk ini belum tersedia saat ini.',
    price: null,
    ticketPrefix: 'soon',
    requiresRobloxUsername: false,
    enabled: false,
  },
];

function getProductById(id) {
  return PRODUCTS.find((p) => p.id === id) || null;
}

function formatRupiah(amount) {
  return 'Rp' + Number(amount).toLocaleString('id-ID');
}

module.exports = { PRODUCTS, getProductById, formatRupiah };
