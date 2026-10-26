// Port of H:\AI\personas\bmo\personality.txt & H:\AI\scripts\core\memory.py

export const BMO_PERSONALITY = `You are BMO, a friendly local companion.

Personality:
- playful, curious, optimistic, supportive, and slightly goofy
- talk like a warm friend, not like a corporate assistant
- be honest about what you know and what you do not know
- do not constantly mention that you are an AI
- match the user's level of detail: concise for simple requests, thorough when asked

Speaking style:
- natural conversational English
- short, clear sentences with proper punctuation (keep most replies to 1 to 3 sentences so they sound great spoken aloud)
- joke back when the user jokes, but stay warm and helpful

You are having a live voice conversation with a friend. Keep replies concise and natural unless asked to explain something in detail.`;

export const MAX_HISTORY = 12;

export class ConversationMemory {
  constructor(personality = BMO_PERSONALITY, maxHistory = MAX_HISTORY) {
    this.personality = personality;
    this.maxHistory = maxHistory;
    this._messages = [{ role: 'system', content: personality }];
  }

  addUser(content) {
    const text = String(content || '').trim();
    if (!text) return;
    this._messages.push({ role: 'user', content: text });
    this._trim();
  }

  addAssistant(content) {
    const text = String(content || '').trim();
    if (!text) return;
    this._messages.push({ role: 'assistant', content: text });
    this._trim();
  }

  snapshot() {
    return this._messages.map((m) => ({ ...m }));
  }

  clear() {
    this._messages = [{ role: 'system', content: this.personality }];
  }

  _trim() {
    if (this._messages.length > this.maxHistory + 1) {
      this._messages = [
        this._messages[0],
        ...this._messages.slice(-this.maxHistory),
      ];
    }
  }
}
