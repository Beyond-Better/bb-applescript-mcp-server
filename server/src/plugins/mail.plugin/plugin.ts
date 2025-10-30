/**
 * Apple Mail Plugin
 * Provides tools for reading, organizing, and managing emails via Mail.app
 * 
 * TODO: Future tools to implement:
 * - send_mail: Compose and send emails with attachments
 * - move_mail: Move messages between mailboxes
 * - delete_mail: Delete or move messages to trash
 * - create_mailbox: Create new mailboxes/folders
 * - reply_to_mail: Create reply messages
 * - forward_mail: Forward messages
 * - get_mail_attachments: List or save attachments from messages
 */

// INJECT_STATIC_IMPORT: ./scripts/index.ts
import { AppPlugin, ToolRegistration, ToolRegistry, WorkflowBase, WorkflowRegistry } from '@beyondbetter/bb-mcp-server';
import { z } from 'zod';
import { findAndExecuteScript } from '../../utils/scriptLoader.ts';
import { getPluginDir } from '../../utils/pluginUtils.ts';

// Input schemas
const readMailInputSchema = {
  messageIds: z
    .array(z.string())
    .optional()
    .describe('Retrieve specific messages by ID (ignores other filters if provided)'),
  sender: z
    .string()
    .optional()
    .describe('Filter by sender email address or name (partial match supported)'),
  subject: z
    .string()
    .optional()
    .describe('Filter by subject text (partial match supported)'),
  flags: z
    .object({
      read: z.boolean().optional().describe('Filter by read status'),
      flagged: z.boolean().optional().describe('Filter by flagged status'),
      replied: z.boolean().optional().describe('Filter by replied status'),
      forwarded: z.boolean().optional().describe('Filter by forwarded status'),
      deleted: z.boolean().optional().describe('Filter by deleted/junk status'),
    })
    .optional()
    .describe('Filter by message flags/status'),
  mailboxes: z
    .array(z.string())
    .optional()
    .describe('Filter by specific mailbox names (searches all mailboxes if not specified)'),
  sortBy: z
    .enum(['date-newest', 'date-oldest', 'sender', 'subject'])
    .optional()
    .default('date-newest')
    .describe('Sort messages (default: date-newest for most recent first)'),
  includeBody: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include full message bodies (false = metadata only, true = full bodies)'),
  maxResults: z
    .number()
    .optional()
    .default(50)
    .describe('Maximum number of messages to return (hard limit: 100)'),
  timeout: z.number().optional().describe('Timeout in milliseconds'),
} as const;

const getMailboxesInputSchema = {
  accountName: z
    .string()
    .optional()
    .describe('Filter mailboxes by specific account name (returns all accounts if not specified)'),
  timeout: z.number().optional().describe('Timeout in milliseconds'),
} as const;

const markMailInputSchema = {
  messageIds: z
    .array(z.string())
    .describe('Array of message IDs to mark (obtained from read_mail results)'),
  flagType: z
    .enum(['read', 'flagged', 'deleted', 'junk'])
    .describe('Type of flag to modify'),
  flagValue: z
    .boolean()
    .describe('Value to set the flag to (true or false)'),
  // TODO: Add dryRun parameter when implementing dry run mode
  // dryRun: z.boolean().optional().default(false).describe('Preview changes without applying them'),
  timeout: z.number().optional().describe('Timeout in milliseconds'),
} as const;

// Type definitions
type ReadMailArgs = {
  messageIds?: string[];
  sender?: string;
  subject?: string;
  flags?: {
    read?: boolean;
    flagged?: boolean;
    replied?: boolean;
    forwarded?: boolean;
    deleted?: boolean;
  };
  mailboxes?: string[];
  sortBy?: 'date-newest' | 'date-oldest' | 'sender' | 'subject';
  includeBody?: boolean;
  maxResults?: number;
  timeout?: number;
};

type GetMailboxesArgs = {
  accountName?: string;
  timeout?: number;
};

type MarkMailArgs = {
  messageIds: string[];
  flagType: 'read' | 'flagged' | 'deleted' | 'junk';
  flagValue: boolean;
  timeout?: number;
};

export default {
  name: 'mail',
  version: '1.0.0',
  description: 'Tools for reading, organizing, and managing emails via Apple Mail',

  workflows: [] as WorkflowBase[],
  tools: [] as ToolRegistration[],

  async initialize(
    dependencies: any,
    toolRegistry: ToolRegistry,
    workflowRegistry: WorkflowRegistry,
  ): Promise<void> {
    const logger = dependencies.logger;
    const pluginDir = getPluginDir(import.meta.url);

    // Register read_mail tool
    toolRegistry.registerTool(
      'read_mail',
      {
        title: 'Read Mail',
        description:
          'Search and retrieve email messages based on sender, subject, and status flags. Can return metadata only or full message bodies.',
        category: 'Mail',
        inputSchema: readMailInputSchema,
      },
      async (args: ReadMailArgs) => {
        try {
          logger.info('Reading mail with filters:', {
            messageIds: args.messageIds,
            sender: args.sender,
            subject: args.subject,
            flags: args.flags,
            mailboxes: args.mailboxes,
            sortBy: args.sortBy,
            includeBody: args.includeBody,
            maxResults: args.maxResults,
          });

          // Enforce hard limit on results
          const maxResults = Math.min(args.maxResults || 50, 100);

          // Prepare template variables (templateRenderer JSON.stringifies them)
          const variables: Record<string, any> = {
            messageIds: args.messageIds ?? null,
            sender: args.sender ?? null,
            subject: args.subject ?? null,
            flags: args.flags ?? null,
            mailboxes: args.mailboxes ?? null,
            sortBy: args.sortBy || 'date-newest',
            includeBody: args.includeBody || false,
            maxResults: maxResults,
          };

          const result = await findAndExecuteScript(
            pluginDir,
            'read_mail',
            variables,
            undefined,
            args.timeout,
            logger,
          );

          if (result.success) {
            let scriptResult;
            try {
              scriptResult = typeof result.result === 'string' ? JSON.parse(result.result) : result.result;
            } catch {
              scriptResult = { output: result.result };
            }

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      success: true,
                      ...(typeof scriptResult === 'object' && scriptResult !== null
                        ? scriptResult
                        : { output: scriptResult }),
                      metadata: result.metadata,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          } else {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
              isError: true,
            };
          }
        } catch (error) {
          logger.error('Failed to read mail:', error);
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

    // Register get_mailboxes tool
    toolRegistry.registerTool(
      'get_mailboxes',
      {
        title: 'Get Mailboxes',
        description:
          'List all available mailboxes/folders across all accounts or for a specific account.',
        category: 'Mail',
        inputSchema: getMailboxesInputSchema,
      },
      async (args: GetMailboxesArgs) => {
        try {
          logger.info('Getting mailboxes:', { accountName: args.accountName });

          // Prepare template variables (templateRenderer JSON.stringifies them)
          const variables: Record<string, any> = {
            accountName: args.accountName ?? null,
          };

          const result = await findAndExecuteScript(
            pluginDir,
            'get_mailboxes',
            variables,
            undefined,
            args.timeout,
            logger,
          );

          if (result.success) {
            let scriptResult;
            try {
              scriptResult = typeof result.result === 'string' ? JSON.parse(result.result) : result.result;
            } catch {
              scriptResult = { output: result.result };
            }

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      success: true,
                      ...(typeof scriptResult === 'object' && scriptResult !== null
                        ? scriptResult
                        : { output: scriptResult }),
                      metadata: result.metadata,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          } else {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
              isError: true,
            };
          }
        } catch (error) {
          logger.error('Failed to get mailboxes:', error);
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

    // Register mark_mail tool
    toolRegistry.registerTool(
      'mark_mail',
      {
        title: 'Mark Mail',
        description:
          'Mark email messages with specific flags (read/unread, flagged, deleted, junk).',
        category: 'Mail',
        inputSchema: markMailInputSchema,
      },
      async (args: MarkMailArgs) => {
        try {
          logger.info('Marking mail:', {
            messageIds: args.messageIds,
            flagType: args.flagType,
            flagValue: args.flagValue,
          });

          // TODO: Implement approval elicitation here
          // Use bb-mcp-server's elicitation support to request user approval
          // before modifying messages. Example:
          // const approval = await elicitApproval({
          //   message: `Mark ${args.messageIds.length} message(s) as ${args.flagType}=${args.flagValue}?`,
          //   messageIds: args.messageIds,
          //   action: { type: 'mark_mail', flagType: args.flagType, flagValue: args.flagValue }
          // });
          // if (!approval.approved) {
          //   return { content: [{ type: 'text', text: 'Action cancelled by user' }] };
          // }

          // Prepare template variables (templateRenderer JSON.stringifies them)
          const variables: Record<string, any> = {
            messageIds: args.messageIds,
            flagType: args.flagType,
            flagValue: args.flagValue,
          };

          const result = await findAndExecuteScript(
            pluginDir,
            'mark_mail',
            variables,
            undefined,
            args.timeout,
            logger,
          );

          if (result.success) {
            let scriptResult;
            try {
              scriptResult = typeof result.result === 'string' ? JSON.parse(result.result) : result.result;
            } catch {
              scriptResult = { output: result.result };
            }

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      success: true,
                      ...(typeof scriptResult === 'object' && scriptResult !== null
                        ? scriptResult
                        : { output: scriptResult }),
                      metadata: result.metadata,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          } else {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
              isError: true,
            };
          }
        } catch (error) {
          logger.error('Failed to mark mail:', error);
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

    logger.info('Mail plugin initialized with tools: read_mail, get_mailboxes, mark_mail');
  },
} as AppPlugin;
