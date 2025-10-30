/**
 * Example User Plugin for AppleScript MCP Server
 * 
 * This demonstrates how users can create custom plugins that work
 * with the AppleScript MCP Server, even when running from JSR.
 * 
 * IMPORTANT: This example shows TWO approaches:
 * 1. Inline scripts (simple, but no auto-injected JSON utilities)
 * 2. Script files (recommended, with automatic JSON utilities)
 * 
 * For production plugins, use approach #2 with script files.
 * See docs/JSON-STANDARDIZATION.md for complete guidance.
 * 
 * To use this plugin:
 * 1. Save this file to a local directory (e.g., ~/my-applescript-plugins/mail.plugin.ts)
 * 2. Set PLUGINS_DISCOVERY_PATHS environment variable to that directory
 * 3. Restart the MCP server
 * 
 * The plugin will be discovered and loaded alongside the built-in plugins.
 */

import type {
	AppPlugin,
	ToolRegistry,
	WorkflowRegistry,
} from 'jsr:@beyondbetter/bb-mcp-server';
import { z } from 'npm:zod@^3.22.4';
import { runAppleScript } from '../../server/src/utils/scriptRunner.ts';
import type { AppleScriptResult } from '../../server/src/utils/errorHandler.ts';

/**
 * Example: Mail.app plugin
 * Provides tools for sending emails via Mail.app
 */
export default {
	name: 'mail-tools',
	version: '1.0.0',
	description: 'Tools for sending emails via Mail.app',
	author: 'Your Name',

	workflows: [],
	tools: [],

	async initialize(
		dependencies: any,
		toolRegistry: ToolRegistry,
		workflowRegistry: WorkflowRegistry,
	): Promise<void> {
		const logger = dependencies.logger;

		logger.info('Initializing Mail Tools plugin');

		// Register send_email tool (APPROACH 1: Inline script - simple but limited)
		// WARNING: Inline scripts don't get auto-injected JSON utilities
		// For production, use APPROACH 2 with script files instead
		toolRegistry.registerTool(
			'send_email_simple',
			{
				title: 'Send Email (Simple)',
				description: 'Create and send an email via Mail.app using inline script',
				category: 'Mail',
				inputSchema: {
					to: z.string().email().describe('Recipient email address'),
					subject: z.string().describe('Email subject'),
					body: z.string().describe('Email body text'),
				},
			},
			async (args) => {
				try {
					logger.info('Sending email (simple)', { to: args.to, subject: args.subject });

					// WARNING: Manual string interpolation is vulnerable to injection
					// This is only safe for trusted input
					// For production, use script files with proper JSON parsing
					const script = `
						tell application "Mail"
							set newMessage to make new outgoing message with properties {subject:"${args.subject.replace(/"/g, '\\"')}", content:"${args.body.replace(/"/g, '\\"')}"}
							tell newMessage
								make new to recipient at end of to recipients with properties {address:"${args.to}"}
								send
							end tell
						end tell
						return "Email sent successfully"
					`;

					const result: AppleScriptResult = await runAppleScript({
						script,
						inline: true,
						logger,
					});

					if (result.success) {
						return {
							content: [
								{
									type: 'text',
									text: JSON.stringify(
										{
											success: true,
											message: 'Email sent successfully',
											to: args.to,
											subject: args.subject,
										},
										null,
										2,
									),
								},
							],
						};
					} else {
						const errorMsg = result.error?.message || 'Unknown error';
						return {
							content: [
								{
									type: 'text',
									text: JSON.stringify(
										{
											success: false,
											error: errorMsg,
										},
										null,
										2,
									),
								},
							],
							isError: true,
						};
					}
				} catch (error) {
					return {
						content: [
							{
								type: 'text',
								text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
							},
						],
						isError: true,
					};
				}
			},
		);

		// NOTE: For APPROACH 2 with script files and automatic JSON utilities:
		// 1. Create scripts/send_email.applescript with parseValue() calls
		// 2. Use findAndExecuteScript() which auto-injects JSON utilities
		// 3. Pass raw values (not JSON.stringify) - templateRenderer handles it
		// Example:
		// const result = await findAndExecuteScript(
		//   pluginDir,
		//   'send_email',
		//   { to: args.to, subject: args.subject, body: args.body },
		//   undefined,
		//   timeout,
		//   logger
		// );
		// See docs/JSON-STANDARDIZATION.md for complete examples

		// Register check_mail tool
		toolRegistry.registerTool(
			'check_unread_mail',
			{
				title: 'Check Unread Mail',
				description: 'Get count of unread emails in Mail.app',
				category: 'Mail',
				inputSchema: {
					mailbox: z.string().optional().describe('Mailbox name (default: INBOX)'),
				},
			},
			async (args) => {
				try {
					const mailbox = args.mailbox || 'INBOX';
					const script = `
						tell application "Mail"
							set unreadCount to count of (messages of inbox whose read status is false)
							return unreadCount
						end tell
					`;

					const result: AppleScriptResult = await runAppleScript({
						script,
						inline: true,
						logger,
					});

					if (result.success) {
						const count = parseInt(result.output || '0');
						return {
							content: [
								{
									type: 'text',
									text: JSON.stringify(
										{
											success: true,
											mailbox,
											unreadCount: count,
											message: `You have ${count} unread email${count !== 1 ? 's' : ''}`,
										},
										null,
										2,
									),
								},
							],
						};
					} else {
						const errorMsg = result.error?.message || 'Failed to check mail';
						return {
							content: [
								{
									type: 'text',
									text: JSON.stringify(
										{
											success: false,
											error: errorMsg,
											details: result.error?.details,
										},
										null,
										2,
									),
								},
							],
							isError: true,
						};
					}
				} catch (error) {
					return {
						content: [
							{
								type: 'text',
								text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
							},
						],
						isError: true,
					};
				}
			},
		);

		logger.info('Mail Tools plugin initialized', {
			tools: ['send_email', 'check_unread_mail'],
		});
	},
} as AppPlugin;
