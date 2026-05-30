import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const markdownComponents = {
  a: ({ href, children }) => (
    <a href={href} target={href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
      {children}
    </a>
  ),
};

const ChatMessages = ({ messages }) => (
  <div className="chat-messages" aria-live="polite">
    {messages.map((message) => (
      <article key={message.id} className={`chat-message chat-message-${message.role}`}>
        <div className="chat-message-role">
          {message.role === 'user' ? 'You' : 'CoralFuture AI'}
        </div>
        <div className="chat-message-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {message.content || ''}
          </ReactMarkdown>
          {Array.isArray(message.links) && message.links.length > 0 && !message.streaming && (
            <div className="chat-links">
              {message.links.map((link) => (
                <a key={link.href} href={link.href} className={`chat-link chat-link-${link.type || 'link'}`}>
                  {link.label || link.href}
                </a>
              ))}
            </div>
          )}
        </div>
      </article>
    ))}
  </div>
);

export default ChatMessages;
