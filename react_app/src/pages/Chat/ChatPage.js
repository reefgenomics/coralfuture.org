import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Alert, Container } from 'react-bootstrap';
import ChatInput from './ChatInput';
import ChatMessages from './ChatMessages';
import { sendChatMessage } from './chatApi';
import './ChatPage.css';

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const TYPEWRITER_CHUNK_SIZE = 4;
const TYPEWRITER_DELAY_MS = 14;

const ChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const typingTimerRef = useRef(null);

  const conversation = useMemo(
    () => messages,
    [messages],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, typing]);

  useEffect(() => () => {
    if (typingTimerRef.current) window.clearInterval(typingTimerRef.current);
  }, []);

  const typeAssistantMessage = (content, links) => {
    const id = makeId();
    let index = 0;
    setTyping(true);
    setMessages((current) => [
      ...current,
      { id, role: 'assistant', content: '', links, streaming: true },
    ]);

    typingTimerRef.current = window.setInterval(() => {
      index = Math.min(index + TYPEWRITER_CHUNK_SIZE, content.length);
      setMessages((current) => current.map((message) => (
        message.id === id
          ? { ...message, content: content.slice(0, index), streaming: index < content.length }
          : message
      )));

      if (index >= content.length) {
        window.clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
        setTyping(false);
      }
    }, TYPEWRITER_DELAY_MS);
  };

  const handleSend = async (text) => {
    const userMessage = { id: makeId(), role: 'user', content: text };
    const nextConversation = [...conversation, userMessage];
    setMessages((current) => [...current, userMessage]);
    setLoading(true);
    setError(null);

    try {
      const data = await sendChatMessage(nextConversation);
      typeAssistantMessage(data.message || 'I could not find an answer.', data.links || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container fluid className="chat-page">
      <section className="chat-shell">
        <main className="chat-main">
          {messages.length === 0 && (
            <div className="chat-empty">
              <h1>Ask a question about CoralFuture data.</h1>
              <p>Projects, colonies, species, countries, ED5, ED50, ED95, and map links.</p>
            </div>
          )}
          {error && <Alert variant="danger">{error}</Alert>}
          <ChatMessages messages={messages} />
          {loading && <div className="chat-thinking">Searching the database...</div>}
          {typing && <div className="chat-thinking">Writing answer...</div>}
          <div ref={bottomRef} />
        </main>
        <footer className="chat-composer">
          <ChatInput disabled={loading || typing} onSend={handleSend} />
        </footer>
      </section>
    </Container>
  );
};

export default ChatPage;
