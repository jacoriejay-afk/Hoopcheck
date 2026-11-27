import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Modal, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraMode, type CameraType, type FlashMode } from "expo-camera";
import { preparePhoto } from "../src/native/mediaSelection";
import { CAMERA_MAX_BYTES, CAMERA_MAX_SECONDS, discardCameraFile, isCameraCacheFile, prepareCameraVideo, type NativeCapture } from "../src/native/cameraCapture";

type Props = { onClose:()=>void; onCapture:(capture:NativeCapture)=>boolean };
export function HoopCheckCamera({onClose,onCapture}:Props) {
  const [permission,requestPermission] = useCameraPermissions();
  const [microphone,requestMicrophone] = useMicrophonePermissions();
  const [facing,setFacing] = useState<CameraType>("back");
  const [mode,setMode] = useState<CameraMode>("picture");
  const [flash,setFlash] = useState<FlashMode>("off");
  const [zoom,setZoom] = useState(0);
  const [timer,setTimer] = useState(0);
  const [audio,setAudio] = useState(false);
  const [ready,setReady] = useState(false);
  const [busy,setBusy] = useState(false);
  const [recording,setRecording] = useState(false);
  const [message,setMessage] = useState("");
  const camera = useRef<CameraView>(null);
  const alive = useRef(true);
  const locked = useRef(false);
  const running = useRef(false);
  const held = useRef(false);
  const stopRequested = useRef(false);
  const delay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeRef = useRef(onClose);
  const captureRef = useRef(onCapture);
  useEffect(()=>{closeRef.current=onClose;captureRef.current=onCapture;},[onClose,onCapture]);
  const stop = useCallback(()=>{
    if (!running.current || stopRequested.current) return;
    stopRequested.current=true;
    try { camera.current?.stopRecording(); } catch { /* native may already have stopped */ }
  },[]);
  const cancel = useCallback(()=>{
    alive.current=false;
    if (delay.current) clearTimeout(delay.current);
    delay.current=null;stop();
    closeRef.current();
  },[stop]);
  useEffect(()=>{
    alive.current=true;
    const subscription=AppState.addEventListener("change",state=>{if(state==="background")cancel();});
    return ()=>{alive.current=false;subscription.remove();if(delay.current)clearTimeout(delay.current);stop();};
  },[cancel,stop]);
  useFocusEffect(useCallback(()=>()=>{if(alive.current)cancel();},[cancel]));
  async function take() {
    const view=camera.current;
    if(!view||!alive.current){locked.current=false;return;}
    let raw:string|undefined,prepared:string|undefined,accepted=false;
    try {
      const picture=await view.takePictureAsync({quality:1,exif:false,base64:false,skipProcessing:false});
      raw=picture?.uri;
      if(!raw||!isCameraCacheFile(raw)||!alive.current)throw Error("Photo capture was interrupted.");
      const photo=await preparePhoto(picture);prepared=photo.uri;
      if(alive.current)accepted=captureRef.current({kind:"photo",photo});
      if(accepted)alive.current=false;
      else if(alive.current)setMessage("Capture could not be kept. Try again.");
    }catch(error){if(alive.current)setMessage(error instanceof Error?error.message:"Photo capture failed.");}
    finally {
      if(raw&&raw!==prepared)discardCameraFile(raw);
      if(prepared&&!accepted)discardCameraFile(prepared);
      locked.current=false;if(alive.current)setBusy(false);
    }
  }
  function photo() {
    if(!alive.current||locked.current||!ready||!camera.current)return;
    locked.current=true;setBusy(true);setMessage(timer?`Taking photo in ${timer} seconds…`:"Capturing photo…");
    if(timer)delay.current=setTimeout(()=>{delay.current=null;void take();},timer*1000);
    else void take();
  }
  async function startVideo(fromHold=false) {
    const view=camera.current;
    if(!alive.current||locked.current||!ready||!view)return;
    if(audio&&!microphone?.granted){setMessage("Allow microphone access or switch audio off.");return;}
    locked.current=true;running.current=true;held.current=fromHold;stopRequested.current=false;
    setBusy(true);setRecording(true);setMessage("Recording · up to 60 seconds / 50 MB");
    let raw:string|undefined,accepted=false;
    try {
      const result=await view.recordAsync({maxDuration:CAMERA_MAX_SECONDS,maxFileSize:CAMERA_MAX_BYTES,...(Platform.OS==="ios"?{codec:"avc1" as const}:{})});
      raw=result?.uri;
      if(!raw||!alive.current)throw Error("Recording was interrupted.");
      const video=prepareCameraVideo(raw);
      if(alive.current)accepted=captureRef.current({kind:"video",video});
      if(accepted)alive.current=false;
      else if(alive.current)setMessage("Recording could not be kept. Try again.");
    }catch(error){if(alive.current)setMessage(error instanceof Error?error.message:"Video capture failed.");}
    finally{
      if(raw&&!accepted)discardCameraFile(raw);
      running.current=false;held.current=false;stopRequested.current=false;locked.current=false;
      if(alive.current){setRecording(false);setBusy(false);}
    }
  }
  function setCameraMode(value:CameraMode){if(locked.current||mode===value)return;setReady(false);setMessage("");setMode(value);}
  function flip(){if(locked.current)return;setReady(false);setZoom(0);setFlash("off");setFacing(f=>f==="back"?"front":"back");}
  async function toggleAudio(){
    if(locked.current)return;
    if(audio){setAudio(false);return;}
    try {const allowed=microphone?.granted?microphone:await requestMicrophone();if(!alive.current)return;setAudio(allowed.granted);if(!allowed.granted)setMessage("Microphone access was denied. Silent video is available.");}
    catch {if(alive.current)setMessage("Microphone is unavailable. Silent video is available.");}
  }
  const control=(label:string,action:()=>void,disabled=false,selected=false)=><Pressable key={label} accessibilityRole="button" accessibilityState={{disabled,selected}} disabled={disabled} onPress={action} style={{minHeight:44,paddingHorizontal:12,justifyContent:"center",borderRadius:20,borderWidth:1,borderColor:selected?"#ff7a25":"#777",opacity:disabled?.45:1}}><Text style={{color:"#fff",fontWeight:"700",textAlign:"center"}}>{label}</Text></Pressable>;
  return <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={cancel}>
    <SafeAreaView style={{flex:1,backgroundColor:"#090909"}}>
      <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",padding:12}}>
        <Text accessibilityRole="header" style={{color:"#fff",fontSize:19,fontWeight:"900"}}>HoopCheck Camera</Text>{control("Close",cancel)}
      </View>
      {!permission?.granted ? <View style={{flex:1,justifyContent:"center",padding:24,gap:14}}>
        <Text style={{color:"#fff",fontSize:17}}>Allow camera access to capture basketball photos and videos. Nothing is published automatically.</Text>
        {control("Allow camera",()=>{void requestPermission().catch(()=>{if(alive.current)setMessage("Camera permission is unavailable.");});},!permission)}
        {permission&&!permission.canAskAgain?control("Device Settings",()=>{void Linking.openSettings().catch(()=>{if(alive.current)setMessage("Open device Settings to allow camera access.");});}):null}
      </View>:<>
        <View style={{flex:1,overflow:"hidden",borderRadius:16,marginHorizontal:8,backgroundColor:"#181818"}}>
          <CameraView key={mode+":"+facing} ref={camera} style={{flex:1}} facing={facing} mode={mode} flash={facing==="back"&&mode==="picture"?flash:"off"} zoom={zoom} mute={!audio||!microphone?.granted} videoQuality="1080p" onCameraReady={()=>{if(alive.current)setReady(true);}} onMountError={()=>{if(alive.current){setReady(false);setMessage("Camera preview could not start. Close and reopen or use the system camera.");}}} />
        </View>
        <View style={{gap:8,padding:10}}>
          <View style={{flexDirection:"row",flexWrap:"wrap",justifyContent:"center",gap:6}}>
            {control("Photo",()=>setCameraMode("picture"),busy,mode==="picture")}{control("Video",()=>setCameraMode("video"),busy,mode==="video")}
            {control("Flip",flip,busy)}{control("Zoom −",()=>setZoom(z=>Math.max(0,Math.round((z-.1)*10)/10)),busy||zoom===0)}
            {control("Zoom +",()=>setZoom(z=>Math.min(1,Math.round((z+.1)*10)/10)),busy||zoom===1)}
            {mode==="picture"?<>{control("Flash "+flash,()=>setFlash(f=>f==="off"?"auto":f==="auto"?"on":"off"),busy||facing==="front")}{control(timer?`Timer ${timer}s`:"Timer off",()=>setTimer(t=>t===0?3:t===3?10:0),busy)}</>:control(audio?"Audio on":"Audio off",()=>void toggleAudio(),busy,audio)}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={mode==="picture"?"Take photo":recording?"Stop recording":"Record video; tap to start or hold to record"} disabled={!ready||(busy&&!recording)} onPress={()=>{if(mode==="picture")photo();else if(running.current)stop();else if(!held.current)void startVideo();}} onLongPress={mode==="video"?()=>void startVideo(true):undefined} delayLongPress={250} onPressOut={()=>{if(held.current)stop();}} style={{alignSelf:"center",width:76,height:76,borderRadius:38,borderWidth:5,borderColor:"#fff",backgroundColor:mode==="video"?"#f04444":"#fff",opacity:!ready?.5:1,alignItems:"center",justifyContent:"center"}}>
            {recording?<View style={{width:26,height:26,borderRadius:5,backgroundColor:"#fff"}}/>:null}
          </Pressable>
          <Text style={{color:"#ddd",textAlign:"center"}}>{mode==="picture"?"Tap to capture":"Tap to start/stop, or hold to record"}</Text>
        </View>
      </>}
      {message?<Text accessibilityLiveRegion="polite" style={{paddingHorizontal:12,paddingBottom:8,color:"#fff",textAlign:"center"}}>{message}</Text>:null}
    </SafeAreaView>
  </Modal>;
}
