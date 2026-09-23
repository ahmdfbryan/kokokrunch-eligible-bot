const config = require('../config');
const roblox = require('../roblox');
const {
  buildNotJoinedEmbed,
  buildUnverifiedEmbed,
  buildVerifiedEmbed,
  buildUserNotFoundEmbed,
  buildErrorEmbed,
} = require('../embeds');

async function checkEligibilityEmbed(inputUsername, context = {}) {
  const { guildIconUrl, botAvatarUrl } = context;

  try {
    const resolved = await roblox.resolveUsername(inputUsername);
    if (!resolved) {
      return buildUserNotFoundEmbed(inputUsername, { botAvatarUrl });
    }

    const [avatarUrl, membership] = await Promise.all([
      roblox.getAvatarUrl(resolved.userId),
      roblox.checkMembership(resolved.userId),
    ]);

    if (!membership.isMember) {
      return buildNotJoinedEmbed({
        robloxUsername: resolved.username,
        displayName: resolved.displayName,
        userId: resolved.userId,
        avatarUrl,
        guildIconUrl,
        botAvatarUrl,
      });
    }

    const daysSinceJoin = (Date.now() - membership.joinDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceJoin >= config.eligibleDays) {
      return buildVerifiedEmbed({
        robloxUsername: resolved.username,
        displayName: resolved.displayName,
        userId: resolved.userId,
        avatarUrl,
        joinDate: membership.joinDate,
        guildIconUrl,
        botAvatarUrl,
      });
    }

    return buildUnverifiedEmbed({
      robloxUsername: resolved.username,
      displayName: resolved.displayName,
      userId: resolved.userId,
      avatarUrl,
      joinDate: membership.joinDate,
      eligibleDays: config.eligibleDays,
      guildIconUrl,
      botAvatarUrl,
    });
  } catch (err) {
    console.error(`[Eligibility Check] Gagal memproses username "${inputUsername}":`, err);
    return buildErrorEmbed({ botAvatarUrl });
  }
}

module.exports = { checkEligibilityEmbed };
