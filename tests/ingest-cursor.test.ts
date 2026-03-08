import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCursorChatData, normalizeCursorRole, extractContent } from "../src/ingest/cursor.js";

describe("normalizeCursorRole", () => {
  it("returns user for 'user'", () => {
    assert.equal(normalizeCursorRole("user"), "user");
  });

  it("returns user for 'human'", () => {
    assert.equal(normalizeCursorRole("human"), "user");
  });

  it("returns user for role containing 'prompt'", () => {
    assert.equal(normalizeCursorRole("userPrompt"), "user");
  });

  it("returns user for role containing 'request'", () => {
    assert.equal(normalizeCursorRole("httpRequest"), "user");
  });

  it("returns user for 'inbound'", () => {
    assert.equal(normalizeCursorRole("inbound"), "user");
  });

  it("returns assistant for 'assistant'", () => {
    assert.equal(normalizeCursorRole("assistant"), "assistant");
  });

  it("returns assistant for role containing 'model'", () => {
    assert.equal(normalizeCursorRole("languageModel"), "assistant");
  });

  it("returns assistant for role containing 'ai'", () => {
    assert.equal(normalizeCursorRole("aiResponse"), "assistant");
  });

  it("returns assistant for role containing 'bot'", () => {
    assert.equal(normalizeCursorRole("chatbot"), "assistant");
  });

  it("returns assistant for role containing 'copilot'", () => {
    assert.equal(normalizeCursorRole("copilotReply"), "assistant");
  });

  it("returns assistant for role containing 'response'", () => {
    assert.equal(normalizeCursorRole("serverResponse"), "assistant");
  });

  it("returns assistant for role containing 'completion'", () => {
    assert.equal(normalizeCursorRole("textCompletion"), "assistant");
  });

  it("returns assistant for 'outbound'", () => {
    assert.equal(normalizeCursorRole("outbound"), "assistant");
  });

  it("returns null for unknown role", () => {
    assert.equal(normalizeCursorRole("unknown"), null);
    assert.equal(normalizeCursorRole(""), null);
  });

  it("returns null for undefined", () => {
    assert.equal(normalizeCursorRole(undefined), null);
  });

  it("isUser=true overrides role", () => {
    assert.equal(normalizeCursorRole("assistant", true), "user");
  });

  it("isUser=false overrides role", () => {
    assert.equal(normalizeCursorRole("user", false), "assistant");
  });
});

describe("extractContent", () => {
  it("returns content field when string", () => {
    assert.equal(extractContent({ content: "hello" }), "hello");
  });

  it("returns text field when string", () => {
    assert.equal(extractContent({ text: "hello" }), "hello");
  });

  it("joins parts array", () => {
    const obj = { parts: [{ text: "a" }, { text: "b" }] };
    assert.equal(extractContent(obj), "a\nb");
  });

  it("extracts from message.content", () => {
    const obj = { message: { content: "from message" } };
    assert.equal(extractContent(obj), "from message");
  });

  it("uses message as string", () => {
    const obj = { message: "string message" };
    assert.equal(extractContent(obj), "string message");
  });

  it("returns empty for no matching fields", () => {
    assert.equal(extractContent({}), "");
    assert.equal(extractContent({ foo: "bar" }), "");
  });

  it("prefers content over text", () => {
    assert.equal(extractContent({ content: "c", text: "t" }), "c");
  });
});

describe("parseCursorChatData", () => {
  it("parses array of conversations", () => {
    const json = JSON.stringify([
      {
        id: "conv-1",
        bubbles: [
          { prompt: "What is TypeScript?", response: "A typed language" },
        ],
      },
    ]);
    const sessions = parseCursorChatData(json);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].external_id, "conv-1");
    assert.equal(sessions[0].messages.length, 2);
    assert.equal(sessions[0].messages[0].role, "user");
    assert.equal(sessions[0].messages[1].role, "assistant");
  });

  it("parses allComposers format", () => {
    const json = JSON.stringify({
      allComposers: [
        {
          composer: {
            id: "comp-1",
            messages: [
              { role: "user", content: "Hello" },
              { role: "assistant", content: "Hi!" },
            ],
          },
        },
      ],
    });
    const sessions = parseCursorChatData(json);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].external_id, "comp-1");
    assert.equal(sessions[0].messages.length, 2);
  });

  it("parses single conversation object", () => {
    const json = JSON.stringify({
      id: "single",
      messages: [
        { role: "user", content: "Question" },
        { role: "assistant", content: "Answer" },
      ],
    });
    const sessions = parseCursorChatData(json);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].external_id, "single");
  });

  it("returns empty for invalid JSON", () => {
    assert.deepEqual(parseCursorChatData("{invalid"), []);
  });

  it("returns empty for conversation with no messages", () => {
    const json = JSON.stringify([{ id: "empty", messages: [] }]);
    assert.deepEqual(parseCursorChatData(json), []);
  });

  it("handles bubbles with object prompts/responses", () => {
    const json = JSON.stringify([
      {
        id: "obj-bubbles",
        bubbles: [
          { prompt: { text: "Q" }, response: { content: "A" } },
        ],
      },
    ]);
    const sessions = parseCursorChatData(json);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].messages[0].content, "Q");
    assert.equal(sessions[0].messages[1].content, "A");
  });

  it("handles turns alias", () => {
    const json = JSON.stringify([
      {
        id: "turns-test",
        turns: [
          { prompt: "Turn Q", response: "Turn A" },
        ],
      },
    ]);
    const sessions = parseCursorChatData(json);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].messages.length, 2);
  });

  it("handles messages with isUser flag", () => {
    const json = JSON.stringify({
      id: "isUser-test",
      messages: [
        { isUser: true, content: "User msg" },
        { isUser: false, content: "Bot msg" },
      ],
    });
    const sessions = parseCursorChatData(json);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].messages[0].role, "user");
    assert.equal(sessions[0].messages[1].role, "assistant");
  });

  it("alternates roles for unknown role values", () => {
    const json = JSON.stringify({
      id: "alt-roles",
      messages: [
        { content: "First" },
        { content: "Second" },
        { content: "Third" },
      ],
    });
    const sessions = parseCursorChatData(json);
    assert.equal(sessions.length, 1);
    // Since lastRole starts as "assistant", first unknown → "user"
    assert.equal(sessions[0].messages[0].role, "user");
    assert.equal(sessions[0].messages[1].role, "assistant");
    assert.equal(sessions[0].messages[2].role, "user");
  });

  it("uses sessionId as fallback id", () => {
    const json = JSON.stringify({
      sessionId: "fallback-session",
      messages: [{ role: "user", content: "test" }],
    });
    const sessions = parseCursorChatData(json);
    assert.equal(sessions[0].external_id, "fallback-session");
  });

  it("uses conversationId as fallback id", () => {
    const json = JSON.stringify({
      conversationId: "conv-id",
      messages: [{ role: "user", content: "test" }],
    });
    const sessions = parseCursorChatData(json);
    assert.equal(sessions[0].external_id, "conv-id");
  });

  it("allComposers without composer key uses item directly", () => {
    const json = JSON.stringify({
      allComposers: [
        {
          id: "direct",
          messages: [{ role: "user", content: "test" }],
        },
      ],
    });
    const sessions = parseCursorChatData(json);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].external_id, "direct");
  });
});
