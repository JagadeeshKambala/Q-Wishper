import { useEffect, useState } from "react";
import { auth, db } from "../../lib/firebaseClient";
import { collection, addDoc, serverTimestamp, onSnapshot, orderBy, query, doc, getDoc } from "firebase/firestore";
import { simulateBB84, base64ToBytes } from "../../lib/api";
import { hkdfKey, aesGcmEncrypt, aesGcmDecrypt } from "../../lib/crypto";
import { onAuthStateChanged } from "firebase/auth";

export default function ChatWindow({ chatId }: { chatId: string }) {
  const [uid,setUid]=useState<string>(""); const [seedB64,setSeedB64]=useState<string>(""); 
  const [msgs,setMsgs]=useState<any[]>([]); const [text,setText]=useState("");
  const [derived,setDerived]=useState<CryptoKey|null>(null); const [qber,setQber]=useState<number| null>(null);

  useEffect(()=> onAuthStateChanged(auth, (u)=> setUid(u?.uid||"")), []);
  useEffect(()=>{
    const run = async () => {
      const data = (await getDoc(doc(db,"chats",chatId))).data();
      const s = data?.q_seed_b64 as string; setSeedB64(s);
      const bb = await simulateBB84(s, 2048);
      setQber(bb.qber);
      const sifted = base64ToBytes(bb.base64_key);
      const salt = base64ToBytes(s);
      const k = await hkdfKey(sifted, salt);
      setDerived(k);
    };
    run();
  }, [chatId]);

  useEffect(()=>{
    const q = query(collection(db,"chats",chatId,"messages"), orderBy("createdAt","asc"));
    return onSnapshot(q, snap=> setMsgs(snap.docs.map(d=>({id:d.id, ...d.data()}))));
  }, [chatId]);

  const send = async () => {
    if (!derived || !text.trim()) return;
    const { iv_b64, ct_b64 } = await aesGcmEncrypt(derived, text.trim());
    await addDoc(collection(db,"chats",chatId,"messages"), {
      senderUid: uid, iv_b64, ct_b64, createdAt: serverTimestamp()
    });
    setText("");
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b text-sm">Chat #{chatId.slice(0,6)} — QBER {qber?.toFixed(3)}</div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {msgs.map(m=> <MessageBubble key={m.id} me={m.senderUid===uid} msg={m} keyObj={derived} /> )}
      </div>
      <div className="p-3 border-t flex gap-2">
        <input className="border px-3 py-2 rounded flex-1" value={text} onChange={e=>setText(e.target.value)} placeholder="Type…" />
        <button className="border px-3 py-2 rounded" onClick={send}>Send</button>
      </div>
    </div>
  );
}

function MessageBubble({ me, msg, keyObj }:{ me:boolean, msg:any, keyObj:CryptoKey|null }) {
  const [pt,setPt]=useState<string>("…");
  useEffect(()=>{
    (async ()=>{
      if (!keyObj) { setPt("…"); return;}
      try { setPt(await aesGcmDecrypt(keyObj, msg.iv_b64, msg.ct_b64)); }
      catch { setPt("[decrypt error]"); }
    })();
  }, [keyObj, msg.iv_b64, msg.ct_b64]);
  return (
    <div className={`max-w-[70%] px-3 py-2 rounded ${me?"ml-auto bg-blue-600/80":"bg-neutral-700/60"}`}>
      {pt}
    </div>
  );
}
