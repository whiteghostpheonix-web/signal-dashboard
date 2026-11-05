import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MAX_IMAGE_EDGE = 1440;
const JPEG_QUALITY = 0.82;

function imageToJpeg(video) {
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare the photo');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

function cameraName(device, index) {
  const label = device?.label || '';
  if (/front|user|selfie/i.test(label)) return `Front camera${label ? ` — ${label}` : ''}`;
  if (/back|rear|environment/i.test(label)) return `Rear camera${label ? ` — ${label}` : ''}`;
  return label || `Camera ${index + 1}`;
}

function facingFor(device, fallback = 'environment') {
  if (/front|user|selfie/i.test(device?.label || '')) return 'user';
  if (/back|rear|environment/i.test(device?.label || '')) return 'environment';
  return fallback;
}

export function ImageUploader({ value, onChange, label = 'Photo' }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [cameraId, setCameraId] = useState('');
  const [facingMode, setFacingMode] = useState('environment');

  function stopTracks() {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function closeCamera() {
    stopTracks();
    setCameraOpen(false);
    setCameraBusy(false);
  }

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  async function startCamera({ deviceId = '', facing = 'environment', enumerate = false } = {}) {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access needs HTTPS and a supported browser.');
      return;
    }
    setCameraBusy(true);
    setCameraError('');
    stopTracks();
    try {
      let stream;
      try {
        const video = deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { facingMode: { exact: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } };
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video });
      } catch (error) {
        if (deviceId) throw error;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
      }
      streamRef.current = stream;
      const settings = stream.getVideoTracks()[0]?.getSettings?.() || {};
      const activeId = settings.deviceId || deviceId;
      if (activeId) setCameraId(activeId);
      setFacingMode(facing);
      if (enumerate && navigator.mediaDevices.enumerateDevices) {
        const devices = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'videoinput');
        setCameras(devices);
        if (activeId) setCameraId(activeId);
      }
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (error) {
      setCameraError(error?.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access in browser settings.'
        : 'Could not open the camera. Check permissions and try again.');
    } finally {
      setCameraBusy(false);
    }
  }

  async function openCamera() {
    setCameras([]);
    setCameraId('');
    await startCamera({ facing: 'environment', enumerate: true });
  }

  function changeCamera() {
    const otherCamera = cameras.find(camera => camera.deviceId !== cameraId && facingFor(camera, facingMode) !== facingMode)
      || cameras.find(camera => camera.deviceId !== cameraId);
    if (otherCamera) {
      startCamera({ deviceId: otherCamera.deviceId, facing: facingFor(otherCamera, facingMode === 'user' ? 'environment' : 'user') });
    } else {
      startCamera({ facing: facingMode === 'user' ? 'environment' : 'user', enumerate: true });
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) {
      setCameraError('Camera is still starting. Try again in a moment.');
      return;
    }
    try {
      onChange(imageToJpeg(video));
      setCameraError('');
      closeCamera();
    } catch (error) {
      setCameraError(error?.message || 'Could not capture photo');
    }
  }

  const cameraView = cameraOpen && typeof document !== 'undefined' ? createPortal(
    <div className="camera-fullscreen" role="dialog" aria-modal="true" aria-label={`${label} camera`}>
      <style>{`
        .camera-fullscreen{position:fixed;inset:0;z-index:10000;width:100vw;height:100vh;height:100dvh;overflow:hidden;background:#050505;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;isolation:isolate;}
        .camera-fullscreen-preview{position:absolute;inset:0;z-index:-1;width:100%;height:100%;object-fit:cover;background:#050505;}
        .camera-topbar{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;padding:max(12px,env(safe-area-inset-top)) 16px 18px;background:linear-gradient(180deg,rgba(0,0,0,.68),transparent);}
        .camera-title{font-size:16px;font-weight:600;text-shadow:0 1px 5px #000;}
        .camera-close,.camera-control{display:inline-flex;align-items:center;justify-content:center;min-height:46px;border:1px solid rgba(255,255,255,.32);background:rgba(20,20,20,.62);color:#fff;font:inherit;cursor:pointer;touch-action:manipulation;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);}
        .camera-close{width:46px;border-radius:50%;font-size:27px;line-height:1;}
        .camera-current-name{position:absolute;top:calc(max(68px,env(safe-area-inset-top) + 60px));left:50%;transform:translateX(-50%);max-width:75vw;overflow:hidden;padding:7px 12px;border-radius:18px;background:rgba(0,0,0,.48);font-size:12px;text-overflow:ellipsis;white-space:nowrap;}
        .camera-error-message{position:absolute;top:calc(max(106px,env(safe-area-inset-top) + 98px));left:16px;right:16px;margin:0;padding:12px;border-radius:10px;background:rgba(150,20,20,.9);font-size:14px;}
        .camera-bottom-controls{position:absolute;left:0;right:0;bottom:0;display:grid;grid-template-columns:1fr 1fr 1fr;align-items:center;justify-items:center;padding:18px 16px max(24px,env(safe-area-inset-bottom));background:linear-gradient(0deg,rgba(0,0,0,.78),transparent);}
        .camera-control{min-width:76px;padding:0 12px;border-radius:24px;font-size:13px;}
        .camera-shutter{display:grid;place-items:center;width:78px;height:78px;border:4px solid #fff;border-radius:50%;background:rgba(255,255,255,.2);cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,.5);}
        .camera-shutter span{width:58px;height:58px;border-radius:50%;background:#fff;}
        .camera-shutter:disabled,.camera-control:disabled{opacity:.55;}
        .camera-bottom-empty{width:76px;}
        @media(min-width:700px){.camera-fullscreen{max-width:560px;left:50%;transform:translateX(-50%);box-shadow:0 0 0 100vmax #000;}.camera-bottom-controls{padding-bottom:28px;}}
      `}</style>
      <video ref={videoRef} className="camera-fullscreen-preview" autoPlay muted playsInline aria-label={`${label} live camera preview`} />
      <header className="camera-topbar">
        <div className="camera-title">{label}</div>
        <button type="button" className="camera-close" onClick={closeCamera} aria-label="Close camera">×</button>
      </header>
      {cameras.length > 1 && <div className="camera-current-name">{cameraName(cameras.find(camera => camera.deviceId === cameraId) || cameras[0], Math.max(0, cameras.findIndex(camera => camera.deviceId === cameraId)))}</div>}
      {cameraError && <p className="camera-error-message" role="alert">{cameraError}</p>}
      <footer className="camera-bottom-controls">
        <button type="button" className="camera-control" onClick={closeCamera}>Cancel</button>
        <button type="button" className="camera-shutter" onClick={capturePhoto} disabled={cameraBusy} aria-label="Capture photo"><span /></button>
        <button type="button" className="camera-control" onClick={changeCamera} disabled={cameraBusy}>Change camera</button>
      </footer>
    </div>,
    document.body,
  ) : null;

  const imageView = imageOpen && value && typeof document !== 'undefined' ? createPortal(
    <div className="captured-image-fullscreen" role="dialog" aria-modal="true" aria-label={`${label} image`} onClick={() => setImageOpen(false)}>
      <button type="button" className="camera-close captured-image-close" onClick={() => setImageOpen(false)} aria-label="Close image preview">×</button>
      <img src={value} alt={`${label} captured`} />
    </div>,
    document.body,
  ) : null;

  return (
    <div className="image-uploader">
      <div className="preview" role="button" tabIndex={0} aria-label={value ? `Retake ${label} photo` : `Take ${label} photo`}
        onClick={openCamera} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openCamera(); } }}>
        {value ? <img src={value} alt={label} /> : <div className="placeholder">📷<br />Tap to take {label.toLowerCase()}</div>}
      </div>
      {cameraError && !cameraOpen && <p className="camera-error" role="status">{cameraError}</p>}
      {value && <div className="image-uploader-actions">
        <button type="button" className="btn btn-sm" onClick={() => setImageOpen(true)}>View image</button>
        <button type="button" className="btn btn-sm" onClick={() => { onChange(null); setImageOpen(false); }}>Remove image</button>
      </div>}
      {cameraBusy && !cameraOpen && <small className="camera-hint">Opening camera…</small>}
      {cameraView}
      {imageView}
    </div>
  );
}
