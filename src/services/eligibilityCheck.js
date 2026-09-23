const config = require('../config');
const roblox = require('../roblox');
const {
  buildNotJoinedEmbed,
  buildUnverifiedEmbed,
  buildVerifiedEmbed,
  buildUserNotFoundEmbed,
  buildErrorEmbed,
} = require('../embeds');

async function checkEligibilityEmbed(inputUsername) {
  try {
    const resolved = await roblox.resolveUsername(inputUsername);
    if (!resolved) {
      return buildUserNotFoundEmbed(inputUsername);
    }

    const [avatarUrl, membership] = await Promise.all([
      roblox.getAvatarUrl(resolved.userId),
      roblox.checkMembership(resolved.userId),
    ]);

    if (!membership.isMember) {
      return buildNotJoinedEmbed({ robloxUsername: resolved.username, avatarUrl });
    }

    const daysSinceJoin = (Date.now() - membership.joinDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceJoin >= config.eligibleDays) {
      return buildVerifiedEmbed({ robloxUsername: resolved.username, avatarUrl });
    }

    return buildUnverifiedEmbed({
      robloxUsername: resolved.username,
      avatarUrl,
      joinDate: membership.joinDate,
      eligibleDays: config.eligibleDays,
    });
  } catch (err) {
    console.error(`[Eligibility Check] Gagal memproses username "${inputUsername}":`, err);
    return buildErrorEmbed();
  }
}

module.exports = { checkEligibilityEmbed };
