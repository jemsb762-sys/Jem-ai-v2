const form=document.getElementById("chatForm");
const input=document.getElementById("messageInput");
const messagesEl=document.getElementById("messages");
const welcome=document.getElementById("welcome");
const sendBtn=document.getElementById("sendBtn");
const sidebar=document.getElementById("sidebar");
const history=[];
let busy=false;
let mode="general";

const modes={
 general:{label:"AI Assistant"},
 writing:{label:"Writing studio"},
 learning:{label:"Learn anything"},
 coding:{label:"Coding assistant"},
 translation:{label:"Translator"},
 islamic:{label:"Islamic learning"},
 creative:{label:"Creative studio"}
};

function setMode(next){
 if(!modes[next])return;
 mode=next;
 const modeLabel=document.getElementById("modeLabel");
 const composerMode=document.getElementById("composerMode");
 if(modeLabel)modeLabel.textContent=modes[mode].label;
 if(composerMode)composerMode.textContent=modes[mode].label;
 document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
 sidebar?.classList.remove("open");
 input.placeholder=mode==="translation"?"Enter text to translate...":mode==="coding"?"Describe what you want to build or fix...":"Message Jem AI...";
}

function addMessage(role,text){
 if(welcome)welcome.style.display="none";
 const wrap=document.createElement("div");
 wrap.className=`message ${role}`;
 const avatar=document.createElement("div");
 avatar.className="avatar";
 avatar.textContent=role==="user"?"Y":"✦";
 const body=document.createElement("div");
 body.className="bubble";
 body.textContent=text;
 wrap.append(avatar,body);

 if(role==="assistant"){
  const actions=document.createElement("div");
  actions.className="message-actions";
  const copy=document.createElement("button");
  copy.className="copy-btn";
  copy.textContent="▢  Copy response";
  copy.onclick=async()=>{
   try{
    await navigator.clipboard.writeText(text);
    copy.textContent="✓ Copied";
   }catch{
    copy.textContent="Copy unavailable";
   }
  };
  actions.appendChild(copy);
  body.appendChild(actions);
 }
 messagesEl.appendChild(wrap);
 messagesEl.scrollTop=messagesEl.scrollHeight;
 return wrap;
}

function newChat(){
 history.length=0;
 messagesEl.innerHTML="";
 if(welcome)welcome.style.display="block";
 input.value="";
 input.focus();
}

document.getElementById("newChat")?.addEventListener("click",newChat);
document.getElementById("menuBtn")?.addEventListener("click",()=>sidebar?.classList.toggle("open"));
document.querySelectorAll(".nav-item").forEach(button=>{
 button.addEventListener("click",()=>setMode(button.dataset.mode));
});
document.querySelectorAll(".tool-card").forEach(button=>{
 button.addEventListener("click",()=>{
  setMode(button.dataset.mode);
  input.value=button.dataset.prompt||"";
  input.focus();
  input.style.height="auto";
  input.style.height=Math.min(input.scrollHeight,140)+"px";
 });
});
document.getElementById("themeBtn")?.addEventListener("click",()=>{
 document.body.classList.toggle("light");
 const themeColor=document.querySelector('meta[name="theme-color"]');
 if(themeColor)themeColor.content=document.body.classList.contains("light")?"#f5f6fc":"#0b0d18";
});
input.addEventListener("input",()=>{
 input.style.height="auto";
 input.style.height=Math.min(input.scrollHeight,140)+"px";
});
input.addEventListener("keydown",event=>{
 if(event.key==="Enter"&&!event.shiftKey){
  event.preventDefault();
  sendMessage();
 }
});
form.addEventListener("submit",event=>{
 event.preventDefault();
 sendMessage();
});

async function sendMessage(){
 const userText=input.value.trim();
 if(!userText||busy)return;

 input.value="";
 input.style.height="auto";
 addMessage("user",userText);
 history.push({role:"user",content:userText});

 busy=true;
 sendBtn.disabled=true;
 const pending=addMessage("assistant","Thinking…");
 pending.querySelector(".bubble")?.classList.add("typing");

 try{
  const response=await fetch("/api/chat",{
   method:"POST",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify({messages:history,mode})
  });

  const responseText=await response.text();
  let data;
  try{
   data=responseText?JSON.parse(responseText):{};
  }catch{
   throw new Error(`The server returned an unreadable response (HTTP ${response.status}). Check that the Vercel /api/chat deployment is available.`);
  }

  if(!response.ok){
   throw new Error(data.error||`Server error: HTTP ${response.status}`);
  }

  const answer=data.reply||"Gemini returned an empty answer. Please try again.";
  pending.remove();
  addMessage("assistant",answer);
  history.push({role:"assistant",content:answer});
 }catch(error){
  pending.remove();
  addMessage("assistant",`Sorry, I could not answer: ${error.message}`);
  history.pop();
  console.error("Jem AI Gemini error:",error);
 }finally{
  busy=false;
  sendBtn.disabled=false;
  input.focus();
 }
}

setMode("general");
if("serviceWorker" in navigator){
 window.addEventListener("load",()=>{
  navigator.serviceWorker.register("/sw.js").catch(error=>{
   console.error("Service Worker error:",error);
  });
 });
}
