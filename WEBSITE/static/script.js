const imageInput=document.getElementById("imageInput");
const dropzone=document.getElementById("dropzone");
const preview=document.getElementById("preview");
const previewImg=document.getElementById("previewImg");
const fileStatus=document.getElementById("fileStatus");
const fileName=document.getElementById("fileName");
const message=document.getElementById("message");
const count=document.getElementById("count");
const hideBtn=document.getElementById("hideBtn");
const revealBtn=document.getElementById("revealBtn");
const downloadLink=document.getElementById("downloadLink");
let selectedFile=null;
let currentDownloadUrl=null;

message.addEventListener("input",()=>count.textContent=`${message.value.length.toLocaleString()} CHARACTERS`);
document.getElementById("changeFile").addEventListener("click",()=>imageInput.click());
imageInput.addEventListener("change",e=>{if(e.target.files[0]) setImage(e.target.files[0]);});
["dragenter","dragover"].forEach(evt=>dropzone.addEventListener(evt,e=>{e.preventDefault();dropzone.classList.add("dragover");}));
["dragleave","drop"].forEach(evt=>dropzone.addEventListener(evt,e=>{e.preventDefault();dropzone.classList.remove("dragover");}));
dropzone.addEventListener("drop",e=>{const f=e.dataTransfer.files[0];if(f)setImage(f);});

function status(title,text,type="ok"){
  document.getElementById("resultTitle").textContent=title;
  document.getElementById("resultText").textContent=text;
  const mark=document.getElementById("resultMark");
  mark.textContent=type==="error"?"!":"✦";
  mark.style.color=type==="error"?"#ff758b":"var(--cyan)";
}
function setImage(file){
  if(!file.name.toLowerCase().endsWith(".png") && file.type!=="image/png"){
    status("PNG REQUIRED","Please select a PNG image file.","error");return;
  }
  if(file.size>20*1024*1024){status("FILE TOO LARGE","Maximum image size is 20 MB.","error");return;}
  selectedFile=file;
  const url=URL.createObjectURL(file);
  previewImg.onload=()=>URL.revokeObjectURL(url);
  previewImg.src=url;
  fileName.textContent=file.name;
  dropzone.classList.add("hidden");
  preview.classList.remove("hidden");
  fileStatus.textContent="PNG LOADED";
  fileStatus.style.color="var(--cyan)";
  downloadLink.classList.add("hidden");
  status("IMAGE LOADED","Your PNG is ready. Choose Hide Message or Reveal Message.");
}
function busy(value){
  hideBtn.disabled=value;revealBtn.disabled=value;
  hideBtn.textContent=value?"PROCESSING...":"↳ HIDE MESSAGE";
  revealBtn.textContent=value?"PLEASE WAIT...":"⌕ REVEAL MESSAGE";
}
async function parseError(response){
  try{const data=await response.json();return data.message||"Something went wrong.";}
  catch{return "Server error. Check that the Flask app is running.";}
}
hideBtn.addEventListener("click",async()=>{
  if(!selectedFile){status("NO IMAGE SELECTED","Please load an image first.","error");return;}
  if(!message.value.trim()){status("MESSAGE REQUIRED","Please enter a secret message.","error");return;}
  const form=new FormData();form.append("image",selectedFile);form.append("message",message.value.trim());
  busy(true);status("HIDING MESSAGE","Embedding your message with the Stegano LSB library...");
  try{
    const response=await fetch("/hide",{method:"POST",body:form});
    if(!response.ok)throw new Error(await parseError(response));
    const blob=await response.blob();
    if(currentDownloadUrl)URL.revokeObjectURL(currentDownloadUrl);
    currentDownloadUrl=URL.createObjectURL(blob);
    downloadLink.href=currentDownloadUrl;
    downloadLink.download="cipherveil_hidden.png";
    downloadLink.classList.remove("hidden");
    // Set the just-created stego PNG as the current image, matching the desktop app's img_path update.
    const hiddenFile=new File([blob],"cipherveil_hidden.png",{type:"image/png"});
    setImage(hiddenFile);
    status("MESSAGE HIDDEN SUCCESSFULLY","The PNG has been downloaded. The hidden PNG is now selected, so click Reveal Message to test it.");
    const a=document.createElement("a");a.href=currentDownloadUrl;a.download="cipherveil_hidden.png";document.body.appendChild(a);a.click();a.remove();
  }catch(err){status("HIDE FAILED",err.message,"error");}
  finally{busy(false);hideBtn.innerHTML="<span>↳</span> HIDE MESSAGE";revealBtn.innerHTML="<span>⌕</span> REVEAL MESSAGE";}
});
revealBtn.addEventListener("click",async()=>{
  if(!selectedFile){status("NO IMAGE SELECTED","Please load the PNG that contains the hidden message.","error");return;}
  const form=new FormData();form.append("image",selectedFile);
  busy(true);status("READING IMAGE","Checking the selected PNG for a hidden message...");
  try{
    const response=await fetch("/reveal",{method:"POST",body:form});
    const data=await response.json();
    if(!response.ok||!data.success)throw new Error(data.message||"No hidden message found.");
    message.value=data.hidden_text;
    count.textContent=`${message.value.length.toLocaleString()} CHARACTERS`;
    status("MESSAGE REVEALED",`Recovered message: ${data.hidden_text}`);
  }catch(err){status("REVEAL FAILED",err.message,"error");}
  finally{busy(false);hideBtn.innerHTML="<span>↳</span> HIDE MESSAGE";revealBtn.innerHTML="<span>⌕</span> REVEAL MESSAGE";}
});
