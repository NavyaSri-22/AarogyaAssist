
import { useEffect, useRef, useState } from "react";
import {
  Bot, Send, Plus, Sparkles, User, HeartPulse,
  Languages, AlertTriangle, MessageCircle, Trash2,
  History, ChevronRight, LoaderCircle
} from "lucide-react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./ChatAssistant.css";

const API_URL = "http://localhost:8000/api/chat";
const USER_ID = 1;

const suggestions = [
  "What is hemoglobin?",
  "How can I improve my sleep?",
  "Why is drinking water important?",
  "Explain blood pressure in simple words."
];

function ChatAssistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState("English");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const loadHistory = async () => {
    try {
      const response = await fetch(
        `${API_URL}/history/${USER_ID}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to load history.");
      }

      setConversations(data.conversations || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [messages, loading]);

  const startNewChat = () => {
    setMessages([]);
    setInput("");
    setError("");
    setConversationId(null);
    setLanguage("English");
    inputRef.current?.focus();
  };

  const openConversation = async (id) => {
    if (loading) return;

    setError("");

    try {
      const response = await fetch(
        `${API_URL}/conversation/${id}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to open conversation.");
      }

      setConversationId(id);
      setLanguage(data.conversation.language || "English");

      setMessages(
        (data.messages || []).map((item) => ({
          role: item.role,
          content: item.content,
          emergency: item.emergency_detected
        }))
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteConversation = async (id) => {
    if (loading) return;

    try {
      const response = await fetch(
        `${API_URL}/conversation/${id}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to delete conversation.");
      }

      if (conversationId === id) {
        startNewChat();
      }

      await loadHistory();
    } catch (err) {
      setError(err.message);
    }
  };

  const sendMessage = async (event) => {
    event?.preventDefault();

    const userMessage = input.trim();
    if (!userMessage || loading) return;

    setError("");

    const previousMessages = messages;

    setMessages((current) => [
      ...current,
      { role: "user", content: userMessage }
    ]);

    setInput("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: userMessage,
          language,
          conversation_id: conversationId,
          history: previousMessages.slice(-12).map((item) => ({
            role: item.role,
            content: item.content
          }))
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to get AI response.");
      }

      setConversationId(data.conversation_id);

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.reply,
          emergency: data.emergency_detected || false
        }
      ]);

      await loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <section className="chat-page">
      <div className="chat-header">
        <div>
          <div className="chat-eyebrow">
            <Sparkles size={15} />
            YOUR PERSONAL AI HEALTH COMPANION
          </div>

          <h1>AI <span>Assistant.</span></h1>

          <p>
            Ask questions and understand health topics
            through simple, educational conversations.
          </p>
        </div>

        <button className="new-chat-button" onClick={startNewChat}>
          <Plus size={17} />
          New Chat
        </button>
      </div>

      <div className="chat-workspace">
        <div className="chat-toolbar">
          <div className="chat-bot-profile">
            <div className="chat-bot-avatar">
              <HeartPulse size={22} />
            </div>

            <div>
              <strong>Aarogya AI</strong>
              <span>
                <i className="chat-online-dot" />
                Ready to assist
              </span>
            </div>
          </div>

          <div className="chat-language">
            <Languages size={17} />
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              disabled={loading}
            >
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
              <option value="Telugu">Telugu</option>
            </select>
          </div>
        </div>

        <div className="chat-history-layout">
          <aside className="chat-history-panel">
            <div className="history-title">
              <History size={17} />
              <strong>Recent Chats</strong>
            </div>

            {historyLoading ? (
              <p className="history-empty">Loading conversations...</p>
            ) : conversations.length === 0 ? (
              <p className="history-empty">
                Your conversations will appear here.
              </p>
            ) : (
              <div className="history-list">
                {conversations.map((item) => (
                  <div
                    key={item.conversation_id}
                    className={`history-item ${
                      conversationId === item.conversation_id
                        ? "active-history"
                        : ""
                    }`}
                  >
                    <button
                      className="history-open"
                      onClick={() =>
                        openConversation(item.conversation_id)
                      }
                      disabled={loading}
                      title={item.title}
                    >
                      <MessageCircle size={15} />
                      <span>{item.title}</span>
                    </button>

                    <button
                      className="history-delete"
                      onClick={() =>
                        deleteConversation(item.conversation_id)
                      }
                      disabled={loading}
                      title="Delete conversation"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </aside>

          <div className="chat-main">
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="chat-welcome">
                  <div className="chat-welcome-icon">
                    <Bot size={35} />
                    <Sparkles size={17} />
                  </div>

                  <h2>Hello! How can I help you today?</h2>

                  <p>
                    I'm Aarogya Assist, your AI health education
                    companion. Ask me about general health,
                    medical terminology, nutrition or wellness.
                  </p>

                  <div className="suggestion-heading">
                    <MessageCircle size={16} />
                    TRY ASKING
                  </div>

                  <div className="chat-suggestions">
                    {suggestions.map((item) => (
                      <button
                        key={item}
                        onClick={() => setInput(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={`chat-message ${
                      message.role === "user"
                        ? "user-message"
                        : "assistant-message"
                    }`}
                  >
                    <div className="message-avatar">
                      {message.role === "user"
                        ? <User size={18} />
                        : <Bot size={19} />}
                    </div>

                    <div className="message-content">
                      <span className="message-author">
                        {message.role === "user" ? "You" : "Aarogya AI"}
                      </span>

                      {message.emergency && (
                        <div className="emergency-warning">
                          <AlertTriangle size={18} />
                          Emergency warning
                        </div>
                      )}

                      <div className="message-bubble">
                        {message.role === "assistant" ? (
                          <div className="markdown-content">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        ) : message.content}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {loading && (
                <div className="chat-loading">
                  <LoaderCircle size={18} />
                  Aarogya AI is preparing your response...
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {error && <div className="chat-error">{error}</div>}

            <form className="chat-input-area" onSubmit={sendMessage}>
              <div className="chat-input-wrapper">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask your health question..."
                  disabled={loading}
                  maxLength={4000}
                />

                <button
                  type="submit"
                  className="chat-send-button"
                  disabled={!input.trim() || loading}
                  aria-label="Send message"
                >
                  <Send size={19} />
                </button>
              </div>

              <div className="chat-input-footer">
                <span>English · हिंदी · తెలుగు</span>
                <span>{input.length}/4000</span>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="chat-disclaimer">
        <AlertTriangle size={17} />
        <p>
          Aarogya Assist provides educational information only.
          It does not diagnose conditions or prescribe medicines.
          For emergencies, seek immediate professional medical help.
        </p>
      </div>
    </section>
  );
}

export default ChatAssistant;
