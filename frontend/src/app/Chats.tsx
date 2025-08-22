import { useState } from "react";
import ChatList from "../components/chat/ChatList";
import ChatWindow from "../components/chat/ChatWindow";

export default function Chats() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-black dark:text-neutral-100">
      {/* Desktop layout */}
      <div className="hidden md:grid min-h-dvh w-screen md:grid-cols-[360px_1fr]">
        <aside className="border-r border-neutral-200/70 dark:border-neutral-800/70 bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl">
          <ChatList onOpen={(id) => setActive(id)} activeId={active} />
        </aside>
        <main className="relative">
          {active ? (
            <ChatWindow chatId={active} onBack={() => setActive(null)} />
          ) : (
            <div className="h-full flex items-center justify-center p-8">
              <div className="text-center">
                <h2 className="text-2xl font-semibold tracking-tight">
                  Messages
                </h2>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  Select a conversation or start a new one.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Mobile “separate pages” layout */}
      <div className="md:hidden min-h-dvh w-screen">
        {/* Page: ChatList */}
        <div className={active ? "hidden" : "block h-full"}>
          <ChatList onOpen={(id) => setActive(id)} activeId={active} />
        </div>
        {/* Page: ChatWindow */}
        <div className={active ? "block h-full" : "hidden"}>
          {active && (
            <ChatWindow chatId={active} onBack={() => setActive(null)} />
          )}
        </div>
      </div>
    </div>
  );
}
