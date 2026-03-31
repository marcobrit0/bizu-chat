const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const {
  logAgentMigrationWarning,
  logPromptMigrationWarning,
  checkAgentPermissionsMigration,
  checkPromptPermissionsMigration,
} = require('@librechat/api');
const { getProjectByName } = require('~/models/Project');
const { Agent, PromptGroup } = require('~/db/models');
const { findRoleByIdentifier } = require('~/models');

/**
 * Check if permissions migrations are needed for shared resources
 * This runs at the end to ensure all systems are initialized
 */
async function checkMigrations() {
  let agentMigrationResult = {
    totalToMigrate: 0,
    globalEditAccess: 0,
    globalViewAccess: 0,
    privateAgents: 0,
  };
  let promptMigrationResult = {
    totalToMigrate: 0,
    globalViewAccess: 0,
    privateGroups: 0,
  };

  try {
    agentMigrationResult = await checkAgentPermissionsMigration({
      mongoose,
      methods: {
        findRoleByIdentifier,
        getProjectByName,
      },
      AgentModel: Agent,
    });
    logAgentMigrationWarning(agentMigrationResult);
  } catch (error) {
    logger.error('Failed to check agent permissions migration:', error);
  }
  try {
    promptMigrationResult = await checkPromptPermissionsMigration({
      mongoose,
      methods: {
        findRoleByIdentifier,
        getProjectByName,
      },
      PromptGroupModel: PromptGroup,
    });
    logPromptMigrationWarning(promptMigrationResult);
  } catch (error) {
    logger.error('Failed to check prompt permissions migration:', error);
  }

  const requirePermissionMigrations = process.env.REQUIRE_PERMISSION_MIGRATIONS === 'true';
  const totalPendingMigrations =
    agentMigrationResult.totalToMigrate + promptMigrationResult.totalToMigrate;

  if (requirePermissionMigrations && totalPendingMigrations > 0) {
    throw new Error(
      'Permission migrations are required before startup. Run npm run migrate:agent-permissions and npm run migrate:prompt-permissions.',
    );
  }

  return {
    agentMigrationResult,
    promptMigrationResult,
    totalPendingMigrations,
  };
}

module.exports = {
  checkMigrations,
};
