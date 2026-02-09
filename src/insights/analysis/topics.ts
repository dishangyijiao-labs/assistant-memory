import type { InsightMessage } from "../../storage/db.js";
import type { TopicCard } from "../types/index.js";
import { STOP_WORDS, TOPIC_DEFINITIONS } from "./config.js";
import { countKeywordHits, tokenize } from "./helpers.js";

export function takeTopKeywords(messages: InsightMessage[], limit: number): string[] {
  const frequency = new Map<string, number>();
  for (const message of messages) {
    const tokens = tokenize(message.content).filter((token) => !STOP_WORDS.has(token) && token.length >= 4);
    for (const token of tokens) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }
  return [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([token]) => token);
}

export function computeTopicCards(messages: InsightMessage[], sessionIds: number[]): TopicCard[] {
  const sessionTopicHits = new Map<number, Map<string, number>>();
  for (const message of messages) {
    const perSession = sessionTopicHits.get(message.session_id) ?? new Map<string, number>();
    for (const topic of TOPIC_DEFINITIONS) {
      const hitCount = countKeywordHits(message.content, [...topic.keywords]);
      if (hitCount > 0) {
        perSession.set(topic.id, (perSession.get(topic.id) ?? 0) + hitCount);
      }
    }
    sessionTopicHits.set(message.session_id, perSession);
  }

  const topicToSessions = new Map<string, number>();
  for (const sessionId of sessionIds) {
    const perSession = sessionTopicHits.get(sessionId);
    if (!perSession) continue;
    for (const [topicId, hitCount] of perSession.entries()) {
      if (hitCount > 0) topicToSessions.set(topicId, (topicToSessions.get(topicId) ?? 0) + 1);
    }
  }

  const cards: TopicCard[] = [];
  for (const topic of TOPIC_DEFINITIONS) {
    const count = topicToSessions.get(topic.id) ?? 0;
    if (count <= 0) continue;
    cards.push({
      title: topic.title,
      summary: topic.summary,
      sessions: count,
    });
  }
  return cards.sort((a, b) => b.sessions - a.sessions).slice(0, 4);
}
