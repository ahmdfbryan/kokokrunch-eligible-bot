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
