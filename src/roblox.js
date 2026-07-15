const { requestWithRetry } = require('./httpClient');
const config = require('./config');

const ROBLOX_API_KEY_HEADER = { 'x-api-key': config.robloxApiKey };

/**
 * STRATEGI PENGECEKAN JOIN DATE:
 *
 * 1) PRIMARY: Open Cloud "List Group Memberships" (/cloud/v2/groups/{groupId}/memberships)
 *    -> Endpoint resmi (bukan legacy), pakai autentikasi API Key, dan mengembalikan
 *       field `createTime` yang merepresentasikan kapan user tsb menjadi member.
 *       Endpoint ini jauh lebih stabil dibanding audit-log lama.
 *
 * 2) FALLBACK: Legacy Audit Log (/legacy-groups/v1/groups/{groupId}/audit-log?actionType=JoinGroup)
 *    -> Dipakai HANYA kalau primary gagal total (misal Roblox sedang gangguan di endpoint v2).
 *       Roblox sendiri menandai endpoint ini "legacy" dan developer lain melaporkan endpoint
 *       ini kadang timeout dari server/VPS. Karena itu bukan andalan utama, hanya cadangan.
 */

// ---------------------------------------------------------------------------
// 1. Resolve username -> userId (API publik, tidak butuh API key)
// ---------------------------------------------------------------------------
async function resolveUsername(username) {
  const res = await requestWithRetry(
    {
      method: 'POST',
      url: 'https://users.roblox.com/v1/usernames/users',
      data: {
        usernames: [username],
        excludeBannedUsers: false,
      },
      headers: { 'Content-Type': 'application/json' },
    },
    { context: 'users.roblox.com (resolve username)' }
  );

  const found = res.data?.data?.[0];
  if (!found) return null;

  return {
    userId: found.id,
    username: found.name,
    displayName: found.displayName,
  };
}

// ---------------------------------------------------------------------------
// 2. Avatar (full-body render) untuk ditampilkan di embed
// ---------------------------------------------------------------------------
async function getAvatarUrl(userId) {
  try {
    const res = await requestWithRetry(
      {
        method: 'GET',
        url: 'https://thumbnails.roblox.com/v1/users/avatar',
        params: {
          userIds: userId,
          size: '250x250',
          format: 'Png',
          isCircular: false,
        },
      },
      { context: 'thumbnails.roblox.com (avatar)' }
    );
    return res.data?.data?.[0]?.imageUrl ?? null;
  } catch (err) {
    console.warn('[Roblox] Gagal ambil avatar, embed akan tampil tanpa gambar.', err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 3a. PRIMARY: cek membership + createTime via Open Cloud v2
// ---------------------------------------------------------------------------
async function getMembershipViaOpenCloud(userId) {
  // Coba pakai filter server-side dulu (lebih cepat & hemat request)
  try {
    const res = await requestWithRetry(
      {
        method: 'GET',
        url: `https://apis.roblox.com/cloud/v2/groups/${config.robloxGroupId}/memberships`,
        headers: ROBLOX_API_KEY_HEADER,
        params: {
          maxPageSize: 1,
          filter: `user == 'users/${userId}'`,
        },
      },
      { context: 'apis.roblox.com (list memberships, filtered)' }
    );

    const membership = res.data?.groupMemberships?.[0];
    if (membership?.createTime) {
      return { isMember: true, joinDate: new Date(membership.createTime) };
    }
    return { isMember: false, joinDate: null };
  } catch (err) {
    const status = err.response?.status;
    // Kalau server menolak parameter filter (400), fallback ke pagination manual di bawah.
    // Kalau error lain (network/5xx), lempar supaya ditangani caller (bisa lanjut ke audit-log fallback).
    if (status !== 400) throw err;
    console.warn('[Roblox] Filter query tidak didukung, fallback ke pagination manual...');
    return getMembershipViaPagination(userId);
  }
}

// Fallback kalau parameter `filter` di atas suatu saat tidak didukung/berubah oleh Roblox
async function getMembershipViaPagination(userId) {
  let pageToken = undefined;
  const targetPath = `users/${userId}`;
  const MAX_PAGES = 50; // safety guard, komunitas dg ratusan ribu member tetap dibatasi

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await requestWithRetry(
      {
        method: 'GET',
        url: `https://apis.roblox.com/cloud/v2/groups/${config.robloxGroupId}/memberships`,
        headers: ROBLOX_API_KEY_HEADER,
        params: { maxPageSize: 100, pageToken },
      },
      { context: `apis.roblox.com (list memberships, page ${page + 1})` }
    );

    const memberships = res.data?.groupMemberships ?? [];
    const found = memberships.find((m) => m.user === targetPath);
    if (found) {
      return { isMember: true, joinDate: new Date(found.createTime) };
    }

    pageToken = res.data?.nextPageToken;
    if (!pageToken) break;
  }

  return { isMember: false, joinDate: null };
}

// ---------------------------------------------------------------------------
// 3b. FALLBACK: cek join date via legacy audit log (actionType=JoinGroup)
// ---------------------------------------------------------------------------
async function getJoinDateViaAuditLog(userId) {
  const res = await requestWithRetry(
    {
      method: 'GET',
      url: `https://apis.roblox.com/legacy-groups/v1/groups/${config.robloxGroupId}/audit-log`,
      headers: ROBLOX_API_KEY_HEADER,
      params: {
        actionType: 'JoinGroup',
        userId,
        limit: 10,
        sortOrder: 'Desc',
      },
    },
    { context: 'apis.roblox.com (legacy audit-log fallback)', retries: 2 }
  );

  const entries = res.data?.data ?? [];
  const entry = entries.find((e) => String(e.actor?.user?.userId) === String(userId));
  if (!entry) return { isMember: false, joinDate: null };

  return { isMember: true, joinDate: new Date(entry.created) };
}

// ---------------------------------------------------------------------------
// Fungsi utama yang dipanggil command /eligible
// ---------------------------------------------------------------------------
async function checkMembership(userId) {
  try {
    return await getMembershipViaOpenCloud(userId);
  } catch (primaryErr) {
    console.warn(
      '[Roblox] Endpoint Membership (primary) gagal total, mencoba fallback audit-log...',
      primaryErr.message
    );
    try {
      return await getJoinDateViaAuditLog(userId);
    } catch (fallbackErr) {
      console.error('[Roblox] Fallback audit-log juga gagal.', fallbackErr.message);
      // Lempar error asli (primary) supaya pesan error ke user lebih relevan
      throw primaryErr;
    }
  }
}

module.exports = {
  resolveUsername,
  getAvatarUrl,
  checkMembership,
};
