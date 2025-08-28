import { useState, useEffect } from "react";
import { ChatThread, type Message } from "@/components/chat/ChatThread";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { UploadDropzone } from "@/components/upload/UploadDropzone";

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const STORAGE_KEY = "chat.thread.v1";


  return (
    <div className="flex flex-col h-full">
      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8 pb-[120px] sm:pb-28">
          <div className="max-w-2xl w-full">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-text mb-4 text-balance">
                Turn your notes into knowledge
              </h1>
              <p className="text-lg text-muted text-balance">
                Drop a photo of your notes to start learning with AI-powered summaries, quizzes, and mind maps.
              </p>
            </div>
            <UploadDropzone 
              onUpload={(files) => {
                if (files.length === 0) return;

                const fileMessage = `You have uploaded: ${files.map(f => f.name).join(', ')}`;
                setMessages(prev => [...prev, { type: "user", content: fileMessage, timestamp: new Date() }]);
                setIsLoading(true);

                // Simulate AI response after a short delay
                setTimeout(() => {
                  setMessages(prev => [...prev, { 
                    type: "assistant", 
                    content: "Thank you for uploading your notes. I will now analyze them. What would you like me to do? For example, you can ask me to summarize the content, create a quiz, or generate a mind map.",
                    timestamp: new Date(),
                  }]);
                  setIsLoading(false);
                }, 1000);
              }}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 pb-[120px] sm:pb-28">
          <ChatThread messages={messages} isLoading={isLoading} />
        </div>
      )}
      
      <ChatComposer 
        onSend={(message) => {
          setMessages(prev => [...prev, { type: "user", content: message, timestamp: new Date() }]);
          setIsLoading(true);
          // Simulate AI response
          setTimeout(() => {
            setMessages(prev => [...prev, { 
              type: "assistant", 
              content: "I'd be happy to help you with that! Please upload an image of your notes so I can analyze them and provide summaries, explanations, or create quizzes.",
              timestamp: new Date(),
            }]);
            setIsLoading(false);
          }, 1000);
        }}
        onUpload={(files) => {
          if (files.length === 0) return;

          const fileMessage = `You have uploaded: ${files.map(f => f.name).join(', ')}`;
          setMessages(prev => [...prev, { type: "user", content: fileMessage, timestamp: new Date() }]);
          setIsLoading(true);

          // Simulate AI response after a short delay
          setTimeout(() => {
            setMessages(prev => [...prev, { 
              type: "assistant", 
              content: "Thank you for uploading your notes. I will now analyze them. What would you like me to do? For example, you can ask me to summarize the content, create a quiz, or generate a mind map.",
              timestamp: new Date(),
            }]);
            setIsLoading(false);
          }, 1000);
        }}
        disabled={isLoading}
      />
    </div>
  );
}