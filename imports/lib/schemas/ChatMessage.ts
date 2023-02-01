import { z } from 'zod';
import { allowedEmptyString, foreignKey, nonEmptyString } from './customTypes';
import withCommon from './withCommon';

const MentionBlock = z.object({
  type: z.literal('mention'),
  userId: foreignKey,
});
export type ChatMessageMentionNodeType = z.infer<typeof MentionBlock>;

const TextBlock = z.object({
  text: allowedEmptyString,
});
export type ChatMessageTextNodeType = z.infer<typeof TextBlock>;

const ContentNode = z.union([MentionBlock, TextBlock]);
export type ChatMessageContentNodeType = z.infer<typeof ContentNode>;

export const ChatMessageContent = z.object({
  type: z.literal('message'),
  children: ContentNode.array(),
});
export type ChatMessageContentType = z.infer<typeof ChatMessageContent>;

export function contentFromMessage(msg: string): ChatMessageContentType {
  return {
    type: 'message' as const,
    children: [
      { text: msg },
    ],
  };
}

const ChatMessage = withCommon(z.object({
  hunt: foreignKey,
  // The puzzle to which this chat was sent.
  puzzle: foreignKey,
  // The message body. Plain text.
  text: nonEmptyString.optional(),
  // The message contents.
  content: ChatMessageContent.optional(),
  // If absent, this message is considered a "system" message
  sender: foreignKey.optional(),
  // The date this message was sent.  Used for ordering chats in the log.
  timestamp: z.date(),
}));

export default ChatMessage;
