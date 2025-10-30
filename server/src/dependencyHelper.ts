/**
 * Dependency Helper for AppleScript MCP Server
 *
 * Provides static plugin loading for JSR deployments and dynamic loading for local development.
 * When running from JSR, plugins must be statically imported since filesystem discovery doesn't work.
 */

import { dirname, relative, resolve } from 'jsr:@std/path@^1.1.2';

import type {
  AppPlugin,
  AppServerDependencies,
  CreateCustomAppServerDependencies,
  Logger,
  PluginManagerConfig,
} from '@beyondbetter/bb-mcp-server';

// Static imports for JSR deployment
import standardPlugin from './plugins/standard.plugin/plugin.ts';
import bbeditPlugin from './plugins/bbedit.plugin/plugin.ts';
import mailPlugin from './plugins/mail.plugin/plugin.ts';

/**
 * Detect if the server is running from JSR or locally
 *
 * @returns true if running from JSR (https://jsr.io/...), false if running locally (file://...)
 */
export function isRunningFromJsr(): boolean {
  const importUrl = import.meta.url;

  // JSR modules are loaded via HTTPS URLs
  if (
    importUrl.startsWith('https://jsr.io/') ||
    importUrl.startsWith('https://esm.sh/jsr/')
  ) {
    return true;
  }

  // Local development uses file:// URLs
  if (importUrl.startsWith('file://')) {
    return false;
  }

  // Fallback: assume JSR if not a file URL
  // This handles other CDN formats that might be used
  return !importUrl.startsWith('file://');
}

/**
 * Get static plugins for registration
 *
 * When running from JSR, all plugins must be statically imported and registered
 * because filesystem discovery doesn't work with JSR packages.
 *
 * @returns Array of statically imported plugins
 */
export function getStaticPlugins(): AppPlugin[] {
  return [
    standardPlugin,
    bbeditPlugin,
    mailPlugin,
  ];
}

/**
 * Create dependencies for the AppleScript MCP Server
 *
 * This function detects the runtime environment and provides appropriate
 * plugin configuration:
 * - JSR: Static plugins for built-in tools + user can provide custom plugins via PLUGINS_DISCOVERY_PATHS
 * - Local: dynamic discovery
 *
 * In both modes, users can add their own plugins by:
 * 1. Setting PLUGINS_DISCOVERY_PATHS environment variable (e.g., "./my-plugins")
 * 2. Setting PLUGINS_AUTOLOAD=true (default)
 *
 * The built-in plugins (standard-tools, bbedit) are always available,
 * and user plugins are discovered from the filesystem.
 *
 * @returns Partial dependencies with plugin configuration
 */
export async function createAppleScriptDependencies(
  appDependencies: CreateCustomAppServerDependencies,
): Promise<Partial<AppServerDependencies>> {
  const { configManager, logger } = appDependencies;

  const runningFromJsr = isRunningFromJsr();

  // Log runtime information
  logRuntimeInfo(logger, runningFromJsr);

  const dependencies: Partial<AppServerDependencies> = {
    // 🎯 Library dependencies (from bb-mcp-server)
    configManager,
    logger,

    serverConfig: {
      name: 'applescript-mcp-server',
      version: '0.1.0',
      title: 'AppleScript MCP Server',
      description: 'MCP server for executing AppleScript scripts to interact with macOS applications',
    },
  };

  if (runningFromJsr) {
    // JSR mode: Static plugins for built-in tools
    // User plugins can still be loaded from PLUGINS_DISCOVERY_PATHS
    logger.info('🌐 Running from JSR - built-in plugins loaded statically');
    logger.info('   User plugins can be added via PLUGINS_DISCOVERY_PATHS environment variable');

    // Note: PluginManager will still discover user plugins from PLUGINS_DISCOVERY_PATHS
    // if PLUGINS_AUTOLOAD=true (default). This allows users to extend the server
    // with custom plugins even when running from JSR.
    dependencies.staticPlugins = getStaticPlugins();
  } else {
    // Local mode: Static plugins as fallback + dynamic discovery
    logger.info(
      '💻 Running locally - built-in plugins loaded dynamically',
    );

    // Get current module's directory and resolve core plugin path relative to CWD
    const moduleDir = dirname(new URL(import.meta.url).pathname);
    const corePluginPath = relative(Deno.cwd(), resolve(moduleDir, './plugins'));

    const pluginManagerConfig = configManager.get<PluginManagerConfig>('pluginManager');
    const existingPaths = pluginManagerConfig.paths || [];

    // Normalize paths and check for duplicates
    const normalizedCorePath = corePluginPath.replace(/\\/g, '/'); // normalize path separators
    const normalizedExistingPaths = existingPaths.map((p: string) => p.replace(/\\/g, '/'));

    // Add core path only if not already present
    if (!normalizedExistingPaths.includes(normalizedCorePath)) {
      configManager.set('pluginManager.paths', [normalizedCorePath, ...existingPaths]);
    }
  }

  return dependencies;
}

/**
 * Log runtime information for debugging
 */
export function logRuntimeInfo(logger: Logger, runningFromJsr: boolean): void {
  const importUrl = import.meta.url;

  const loadedUsing = runningFromJsr ? 'Static + Dynamic discovery' : 'Dynamic discovery only';
  logger.info('📦 AppleScript MCP Server Runtime Info:');
  logger.info(`   Import URL: ${importUrl}`);
  logger.info(`   Running from JSR: ${runningFromJsr ? 'Yes' : 'No'}`);
  logger.info(`   Plugin loading: ${loadedUsing}`);
}
