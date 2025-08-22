import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebaseClient";
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { qrng } from "../../lib/api";

export default function ChatList({ onOpen, activeId }:{ onOpen:(id:string)=>void, activeId:string|null }) {
  const [uid,setUid]=useState<string>(""); const [chats,setChats]=useState<any[]>([]);
  const [friendUname,setFriendUname]=useState("");

  useEffect(()=> onAuthStateChanged(auth, (u)=> setUid(u?.uid||"")), []);
  useEffect(()=>{
    if(!uid) return;
    const q = query(collection(db,"chats"), where("members","array-contains", uid), orderBy("createdAt","desc"));
    return onSnapshot(q, snap=>{
      setChats(snap.docs.map(d=>({id:d.id, ...d.data()})));
    });
  }, [uid]);

  const startChat = async () => {
    const uname = friendUname.trim().toLowerCase();
    if (!uname || !uid) return;
    const uref = doc(db, "usernames", uname);
    const umap = await getDoc(uref);
    if (!umap.exists()) { alert("User not found"); return; }
    const other = umap.data().uid;
    const members = [uid, other].sort();

    const qSeed = await qrng(32);
    const q_seed_b64 = btoa(String.fromCharCode(...qSeed));
    const chat = await addDoc(collection(db,"chats"), { members, q_seed_b64, createdAt: serverTimestamp() });
    onOpen(chat.id);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2">
        <input className="border px-3 py-2 rounded flex-1" placeholder="friend username" value={friendUname} onChange={e=>setFriendUname(e.target.value)} />
        <button className="border px-3 py-2 rounded" onClick={startChat}>Start</button>
      </div>
      <div>
        {chats.map(c=>(
          <div key={c.id} className={`p-3 border-b cursor-pointer ${activeId===c.id?"bg-neutral-800/20":""}`} onClick={()=>onOpen(c.id)}>
            <div className="text-sm opacity-70">Chat</div>
            <div className="text-xs break-all">q_seed: {c.q_seed_b64?.slice(0,16)}…</div>
          </div>
        ))}
      </div>
    </div>
  );
}
