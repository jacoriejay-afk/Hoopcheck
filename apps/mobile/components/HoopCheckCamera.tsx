import type { NativeCapture } from "../src/native/cameraCapture";

// Native Metro resolves HoopCheckCamera.native.tsx. The web bundle must never
// import expo-camera, which otherwise loads an external QR-scanner script.
export function HoopCheckCamera(_props:{onClose:()=>void;onCapture:(capture:NativeCapture)=>boolean}) {
  return null;
}
