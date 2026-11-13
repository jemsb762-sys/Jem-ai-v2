const form=document.getElementById("chatForm");
const input=document.getElementById("messageInput");
const messagesEl=document.getElementById("messages");
const welcome=document.getElementById("welcome");
const sendBtn=document.getElementById("sendBtn");
const sidebar=document.getElementById("sidebar");
const history=[];
let busy=false;
let mode="general";

// እዚህ ጋር የ OpenAI API ቁልፍዎን ያስገቡ (ለምሳሌ: "sk-proj-...")
const OPENAI_API_KEY = "YOUR_OPENAI_API_KEY_HERE";

const modes={
 general:{label:"AI Assistant",instruction:"You are Jem AI, a capable, friendly, accurate general-purpose AI assistant. Help with a broad range of topics. Be clear, practical, honest about uncertainty, and adapt to the user's language."},
 writing:{label:"Writing studio",instruction:"Act as an expert writing partner. Help draft, rewrite, edit, brainstorm, and improve writing. Match the requested tone and format."},
 learning:{label:"Learn anything",instruction:"Act as a patient tutor. Explain concepts step by step, use examples, check understanding when useful, and adapt to the learner's level."},
 coding:{label:"Coding assistant",instruction:"Act as a senior software engineering assistant. Help design, write, debug, explain, and review code. Give runnable examples and mention assumptions."},
 translation:{label:"Translator",instruction:"Act as a professional translator. Preserve meaning, tone, and context. If source or target language is unclear, ask a concise clarification."},
 islamic:{label:"Islamic learning",instruction:"You are a careful Islamic learning assistant. Answer questions about Islam, Qur'an, Hadith, worship, history, and Muslim daily life. Never invent verses, hadith, citations, or rulings. Distinguish scholarly disagreement and recommend a qualified scholar for personal fatwas."},
 creative:{label:"Creative studio",instruction:"Act as a creative partner. Brainstorm original ideas, concepts, names, stories, plans, and practical next steps."}
};

function setMode(next){
 if(!modes[next])return;mode=next;
 document.getElementById("modeLabel").textContent=modes[mode].label;
 document.getElementById("composerMode").textContent=modes[mode].label;
 document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
 sidebar.classList.remove("open");
 input.placeholder=mode==="translation"?"Enter text to translate...":mode==="coding"?"Describe what you want to build or fix...":"Message Jem AI...";
}

function addMessage(role,text){
 welcome.style.display="none";
 const wrap=document.createElement("div");wrap.className=`message ${role}`;
 const avatar=document.createElement("div");avatar.className="avatar";avatar.textContent=role==="user"?"Y":"✦";
 const body=document.createElement("div");body.className="bubble";body.textContent=text;
 wrap.append(avatar,body);messagesEl.appendChild(wrap);
 if(role==="assistant"){
  const actions=document.createElement("div");actions.className="message-actions";
  const copy=document.createElement("button");copy.className="copy-btn";copy.textContent="▢  Copy response";
  copy.onclick=async()=>{try{await navigator.clipboard.writeText(text);copy.textContent="✓ Copied";}catch{copy.textContent="Copy unavailable";}};
  actions.appendChild(copy);body.appendChild(actions);
 }
 messagesEl.scrollTop=messagesEl.scrollHeight;
 return wrap;
}

function newChat(){history.length=0;messagesEl.innerHTML="";welcome.style.display="block";input.value="";input.focus();}

document.getElementById("newChat").addEventListener("click",newChat);
document.getElementById("menuBtn").addEventListener("click",()=>sidebar.classList.toggle("open"));
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode)));
document.querySelectorAll(".tool-card").forEach(b=>b.addEventListener("click",()=>{setMode(b.dataset.mode);input.value=b.dataset.prompt;input.focus();input.style.height="auto";input.style.height=Math.min(input.scrollHeight,140)+"px";}));
document.getElementById("themeBtn").addEventListener("click",()=>{document.body.classList.toggle("light");document.querySelector('meta[name="theme-color"]').content=document.body.classList.contains("light")?"#f5f6fc":"#0b0d18";});
input.addEventListener("input",()=>{input.style.height="auto";input.style.height=Math.min(input.scrollHeight,140)+"px";});
input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}});
form.addEventListener("submit",e=>{e.preventDefault();sendMessage();});

async function sendMessage(){
 const text=input.value.trim();if(!text||busy)return;
 
 if(!OPENAI_API_KEY || OPENAI_API_KEY.includes("YOUR_OPENAI_API_KEY")) {
  addMessage("assistant","እባክዎ በኮዱ ውስጥ (app.js) ላይ ትክክለኛውን የ OpenAI API ቁልፍ (API Key) ያስገቡ።");
  return;
 }

 input.value="";input.style.height="auto";addMessage("user",text);
 history.push({role:"user",content:text});
 busy=true;sendBtn.disabled=true;
 const pending=addMessage("assistant","Thinking…");pending.querySelector(".bubble").classList.add("typing");
 
 try{
  // የሲስተም ትዕዛዝ (System instruction) እና የቻት ሂስቶሪን ማዘጋጀት
  const apiMessages = [
    { role: "system", content: modes[mode].instruction },
    ...history
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini", // ወይም gpt-3.5-turbo መጠቀም ይችላሉ
      messages: apiMessages,
      temperature: 0.7
    })
  });

  const data = await response.json();
  if(!response.ok) throw new Error(data.error?.message || "OpenAI API error occurred.");
  
  const answer = data.choices[0]?.message?.content || "I could not create an answer. Please try again.";
  pending.remove();
  addMessage("assistant", answer);
  history.push({role:"assistant", content: answer});
 }catch(err){
  pending.remove();
  addMessage("assistant", `Sorry, something went wrong: ${err.message}`);
  history.pop();
 }finally{
  busy=false;
  sendBtn.disabled=false;
  input.focus();
 }
}

setMode("general");
if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));}
