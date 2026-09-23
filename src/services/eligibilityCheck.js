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
      return { embed: buildUserNotFoundEmbed(inputUsername, { botAvatarUrl }), result: null };
    }

    const [avatarUrl, membership] = await Promise.all([
      roblox.getAvatarUrl(resolved.userId),
      roblox.checkMembership(resolved.userId),
    ]);

    if (!membership.isMember) {
      const embed = buildNotJoinedEmbed({
        robloxUsername: resolved.username,
        displayName: resolved.displayName,
        userId: resolved.userId,
        avatarUrl,
        guildIconUrl,
        botAvatarUrl,
      });
      return {
        embed,
        result: { status: 'not_joined', robloxUserId: resolved.userId, robloxUsername: resolved.username },
      };
    }

    const daysSinceJoin = (Date.now() - membership.joinDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceJoin >= config.eligibleDays) {
      const embed = buildVerifiedEmbed({
        robloxUsername: resolved.username,
        displayName: resolved.displayName,
        userId: resolved.userId,
        avatarUrl,
        joinDate: membership.joinDate,
        guildIconUrl,
        botAvatarUrl,
      });
      return {
        embed,
        result: { status: 'verified', robloxUserId: resolved.userId, robloxUsername: resolved.username },
      };
    }

    const embed = buildUnverifiedEmbed({
      robloxUsername: resolved.username,
      displayName: resolved.displayName,
      userId: resolved.userId,
      avatarUrl,
      joinDate: membership.joinDate,
      eligibleDays: config.eligibleDays,
      guildIconUrl,
      botAvatarUrl,
    });
    return {
      embed,
      result: {
        status: 'unverified',
        robloxUserId: resolved.userId,
        robloxUsername: resolved.username,
        displayName: resolved.displayName,
        joinDate: membership.joinDate,
        eligibleDays: config.eligibleDays,
      },
    };
  } catch (err) {
    console.error(`[Eligibility Check] Gagal memproses username "${inputUsername}":`, err);
    return { embed: buildErrorEmbed({ botAvatarUrl }), result: null };
  }
}

module.exports = { checkEligibilityEmbed };
