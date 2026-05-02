import React, { useState } from 'react';
import { Button, Form } from 'react-bootstrap';

const ChatInput = ({ disabled, onSend }) => {
  const [value, setValue] = useState('');

  const submit = (event) => {
    event.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    setValue('');
    onSend(text);
  };

  return (
    <Form className="chat-input" onSubmit={submit}>
      <Form.Control
        as="textarea"
        rows={2}
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) submit(event);
        }}
        placeholder="Ask about projects, colonies, species, countries, ED50, ED5, ED95..."
      />
      <Button type="submit" disabled={disabled || !value.trim()}>
        Ask
      </Button>
    </Form>
  );
};

export default ChatInput;
