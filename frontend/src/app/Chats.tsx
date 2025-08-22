import ChatList from "../components/chat/ChatList";
import ChatWindow from "../components/chat/ChatWindow";
import { useState } from "react";

export default function Chats() {
  const [active, setActive] = useState<string | null>(null);
  return (
    <div className="grid md:grid-cols-3 h-screen">
      <div className="border-r overflow-y-auto">
        <ChatList onOpen={(id)=>setActive(id)} activeId={active}/>
      </div>
      <div className="md:col-span-2">
        {active ? <ChatWindow chatId={active}/> : <div className="p-6">Select or start a chat.</div>}
      </div>
    </div>
  );
}
