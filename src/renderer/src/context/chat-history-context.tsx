import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export interface Message {
  id: string;
  content: string;
  role: "ai" | "human";
  timestamp: string;
  name?: string;
  avatar?: string;
}

interface ChatHistoryContextType {
  messages: Message[];
  appendHumanMessage: (content: string) => void;
  appendAiMessage: (content: string, name?: string, avatar?: string) => void;
  clearMessages: () => void;
  clearResponse: () => void;
  setForceNewMessage: (force: boolean) => void;
  forceNewMessage: boolean;
}

const ChatHistoryContext = createContext<ChatHistoryContextType | null>(null);

export function ChatHistoryProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [forceNewMessage, setForceNewMessage] = useState(false);

  const appendHumanMessage = useCallback((content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'human',
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, newMessage]);
  }, []);

  const appendAiMessage = useCallback((content: string, name?: string, avatar?: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'ai',
      timestamp: new Date().toISOString(),
      name,
      avatar,
    };
    setMessages(prev => [...prev, newMessage]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const clearResponse = useCallback(() => {
    // Clear the last AI response if it exists
    setMessages(prev => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage && lastMessage.role === 'ai') {
        return prev.slice(0, -1);
      }
      return prev;
    });
  }, []);

  const contextValue = useMemo(() => ({
    messages,
    appendHumanMessage,
    appendAiMessage,
    clearMessages,
    clearResponse,
    setForceNewMessage,
    forceNewMessage,
  }), [
    messages,
    appendHumanMessage,
    appendAiMessage,
    clearMessages,
    clearResponse,
    forceNewMessage,
  ]);

  return (
    <ChatHistoryContext.Provider value={contextValue}>
      {children}
    </ChatHistoryContext.Provider>
  );
}

export function useChatHistory() {
  const context = useContext(ChatHistoryContext);
  if (!context) {
    throw new Error('useChatHistory must be used within a ChatHistoryProvider');
  }
  return context;
}