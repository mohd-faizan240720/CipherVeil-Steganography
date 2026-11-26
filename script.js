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

const MAGIC=new Uint8Array([67,86,76,49]); // "CVL1"
const HEADER_SIZE=8; // 4-byte signature + 4-byte UTF-8 payload length
let selectedFile=null;
let selectedImage=null;
let currentDownloadUrl=null;

message.addEventListener("input",()=>count.textContent=`${message.value.length.toLocaleString()} CHARACTERS`);
document.getElementById("changeFile").addEventListener("click",()=>imageInput.click());
imageInput.addEventListener("change",e=>{if(e.target.files[0])setImage(e.target.files[0]);});
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
  if(file.type!=="image/png"&&!file.name.toLowerCase().endsWith(".png")){status("PNG REQUIRED","Please select a PNG image file.","error");return;}
  if(file.size>20*1024*1024){status("FILE TOO LARGE","Maximum image size is 20 MB.","error");return;}
  selectedFile=file;
  const url=URL.createObjectURL(file);
  const img=new Image();
  img.onload=()=>{
    selectedImage=img;
    previewImg.src=url;
    fileName.textContent=file.name;
    dropzone.classList.add("hidden");preview.classList.remove("hidden");
    fileStatus.textContent=`${img.naturalWidth} × ${img.naturalHeight}`;
    fileStatus.style.color="var(--cyan)";
    downloadLink.classList.add("hidden");
    status("IMAGE LOADED","Your PNG is ready. Choose Hide Message or Reveal Message.");
  };
  img.onerror=()=>{URL.revokeObjectURL(url);status("IMAGE ERROR","The selected PNG could not be opened.","error");};
  img.src=url;
}
function canvasData(){
  const canvas=document.createElement("canvas");
  canvas.width=selectedImage.naturalWidth;canvas.height=selectedImage.naturalHeight;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  ctx.drawImage(selectedImage,0,0);
  return {canvas,ctx,data:ctx.getImageData(0,0,canvas.width,canvas.height)};
}
function bitAt(bytes,index){return(bytes[index>>3]>>(7-(index&7)))&1;}
function setBit(bytes,index,value){
  const byte=index>>3,shift=7-(index&7);
  if(value)bytes[byte]|=(1<<shift);else bytes[byte]&=~(1<<shift);
}
function channelOffset(bitIndex){
  const pixel=Math.floor(bitIndex/3),channel=bitIndex%3;
  return pixel*4+channel;
}
function makePayload(text){
  const textBytes=new TextEncoder().encode(text);
  const payload=new Uint8Array(HEADER_SIZE+textBytes.length);
  payload.set(MAGIC,0);
  new DataView(payload.buffer).setUint32(4,textBytes.length,false);
  payload.set(textBytes,HEADER_SIZE);
  return payload;
}
function setBusy(value){
  hideBtn.disabled=value;revealBtn.disabled=value;
  hideBtn.innerHTML=value?"PROCESSING...":"<span>↳</span> HIDE &amp; DOWNLOAD";
  revealBtn.innerHTML=value?"PLEASE WAIT...":"<span>⌕</span> REVEAL MESSAGE";
}
hideBtn.addEventListener("click",async()=>{
  if(!selectedImage){status("NO IMAGE SELECTED","Please load an image first.","error");return;}
  if(!message.value.trim()){status("MESSAGE REQUIRED","Please enter a secret message.","error");return;}
  setBusy(true);
  try{
    const {canvas,ctx,data}=canvasData();
    const payload=makePayload(message.value);
    const capacity=Math.floor((data.data.length/4)*3/8);
    if(payload.length>capacity)throw new Error(`Message is too large. This image can store about ${Math.max(0,capacity-HEADER_SIZE)} bytes.`);
    const bits=payload.length*8;
    for(let i=0;i<bits;i++){
      const offset=channelOffset(i);
      data.data[offset]=(data.data[offset]&254)|bitAt(payload,i);
    }
    ctx.putImageData(data,0,0);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
    if(!blob)throw new Error("Browser could not export the PNG.");
    if(currentDownloadUrl)URL.revokeObjectURL(currentDownloadUrl);
    currentDownloadUrl=URL.createObjectURL(blob);
    downloadLink.href=currentDownloadUrl;
    downloadLink.download="cipherveil_hidden.png";
    downloadLink.classList.remove("hidden");
    const hiddenFile=new File([blob],"cipherveil_hidden.png",{type:"image/png"});
    setImage(hiddenFile);
    const a=document.createElement("a");a.href=currentDownloadUrl;a.download="cipherveil_hidden.png";
    document.body.appendChild(a);a.click();a.remove();
    status("MESSAGE HIDDEN SUCCESSFULLY","Your PNG has been downloaded. The hidden image is selected, so click Reveal Message to verify it.");
  }catch(err){status("HIDE FAILED",err.message,"error");}
  finally{setBusy(false);}
});
revealBtn.addEventListener("click",()=>{
  if(!selectedImage){status("NO IMAGE SELECTED","Please load the PNG that contains the hidden message.","error");return;}
  setBusy(true);
  try{
    const {data}=canvasData();
    const pixels=data.data;
    const headerBits=HEADER_SIZE*8;
    const capacityBits=Math.floor((pixels.length/4)*3);
    if(capacityBits<headerBits)throw new Error("Image is too small to contain a message.");
    const header=new Uint8Array(HEADER_SIZE);
    for(let i=0;i<headerBits;i++)setBit(header,i,pixels[channelOffset(i)]&1);
    for(let i=0;i<4;i++)if(header[i]!==MAGIC[i])throw new Error("No hidden message found in this PNG.");
    const length=new DataView(header.buffer).getUint32(4,false);
    if(length===0||length>Math.floor((capacityBits-headerBits)/8))throw new Error("No valid hidden message found.");
    const payload=new Uint8Array(length);
    for(let i=0;i<length*8;i++)setBit(payload,i,pixels[channelOffset(headerBits+i)]&1);
    const recovered=new TextDecoder("utf-8",{fatal:true}).decode(payload);
    message.value=recovered;
    count.textContent=`${recovered.length.toLocaleString()} CHARACTERS`;
    status("MESSAGE REVEALED SUCCESSFULLY",`Recovered: ${recovered}`);
  }catch(err){status("REVEAL FAILED",err.message,"error");}
  finally{setBusy(false);}
});
