import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MAX_IMAGE_EDGE = 1440;
const JPEG_QUALITY = 0.82;
function imageToJpeg(source, width, height) {
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare the photo');
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}
function cameraName(device, index) {
  const label = device?.label || '';
  if (/front|user|selfie/i.test(label)) return 'Front camera';
  if (/back|rear|environment/i.test(label)) return 'Rear camera';
  return label || 'Camera ' + (index + 1);
}
function facingFor(device, fallback = 'environment') {
  if (/front|user|selfie/i.test(device?.label || '')) return 'user';
  if (/back|rear|environment/i.test(device?.label || '')) return 'environment';
  return fallback;
}

export function ImageUploader({ value, onChange, label = 'Photo' }) {
  const inputRef = useRef(null);
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
  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.play().catch(() => setCameraError('Camera preview could not start. Close and reopen the camera.'));
    return () => { if (video.srcObject) video.srcObject = null; };
  }, [cameraOpen]);
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  async function startCamera({ deviceId = '', facing = 'environment', enumerate = false } = {}) {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Live camera requires HTTPS and a supported browser. You can still choose an image below.');
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
      setCameraId(activeId || '');
      setFacingMode(facing);
      if (enumerate && navigator.mediaDevices.enumerateDevices) {
        const devices = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'videoinput');
        setCameras(devices);
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => setCameraError('Camera preview could not start. Close and reopen the camera.'));
      } else {
        setCameraOpen(true);
      }
    } catch (error) {
      setCameraError(error?.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access in browser settings, or choose an image.'
        : error?.name === 'NotFoundError'
          ? 'No camera was found on this device. Choose an image instead.'
          : 'Could not open the camera. Check camera permission and try again, or choose an image.');
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
    const other = cameras.find(camera => camera.deviceId !== cameraId && facingFor(camera, facingMode) !== facingMode)
      || cameras.find(camera => camera.deviceId !== cameraId);
    if (other) startCamera({ deviceId: other.deviceId, facing: facingFor(other, facingMode === 'user' ? 'environment' : 'user') });
    else startCamera({ facing: facingMode === 'user' ? 'environment' : 'user', enumerate: true });
  }
  function capturePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) {
      setCameraError('Camera is still starting. Please wait a moment and try again.');
      return;
    }
    try {
      onChange(imageToJpeg(video, video.videoWidth, video.videoHeight));
      setCameraError('');
      closeCamera();
    } catch (error) {
      setCameraError(error?.message || 'Could not capture photo');
    }
  }
  function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setCameraError('Choose an image file or take a photo.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        try {
          onChange(imageToJpeg(image, image.naturalWidth, image.naturalHeight));
          setCameraError('');
        } catch (error) { setCameraError(error?.message || 'Could not prepare the photo'); }
      };
      image.onerror = () => setCameraError('Could not read the selected image.');
      image.src = String(reader.result);
    };
    reader.onerror = () => setCameraError('Could not read the selected image.');
    reader.readAsDataURL(file);
  }

  const cameraView = cameraOpen && typeof document !== 'undefined' ? createPortal(
    <div className="camera-fullscreen" role="dialog" aria-modal="true" aria-label={label + ' camera'}>
      <video ref={videoRef} className="camera-fullscreen-preview" autoPlay muted playsInline aria-label={label + ' live camera preview'} />
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
    </div>, document.body
  ) : null;
  const imageView = imageOpen && value && typeof document !== 'undefined' ? createPortal(
    <div className="captured-image-fullscreen" role="dialog" aria-modal="true" aria-label={label + ' image'} onClick={() => setImageOpen(false)}>
      <button type="button" className="camera-close captured-image-close" onClick={() => setImageOpen(false)} aria-label="Close image preview">×</button>
      <img src={value} alt={label + ' captured'} />
    </div>, document.body
  ) : null;

  return (
    <div className="image-uploader">
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="image-file-input" onChange={handleFile} />
      <div className="preview" role="button" tabIndex={0} aria-label={value ? 'Retake ' + label + ' photo' : 'Take ' + label + ' photo'}
        onClick={openCamera} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openCamera(); } }}>
        {value ? <img src={value} alt={label} /> : <div className="placeholder">📷<br />Tap to take {label.toLowerCase()}</div>}
      </div>
      {cameraError && !cameraOpen && <p className="camera-error" role="status">{cameraError}</p>}
      <div className="image-uploader-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={openCamera} disabled={cameraBusy}>{cameraBusy ? 'Opening…' : 'Open live camera'}</button>
        <button type="button" className="btn btn-sm" onClick={() => inputRef.current?.click()}>Take photo / choose image</button>
        {value && <button type="button" className="btn btn-sm" onClick={() => { onChange(null); setImageOpen(false); }}>Remove</button>}
        {value && <button type="button" className="btn btn-sm" onClick={() => setImageOpen(true)}>View</button>}
      </div>
      {cameraBusy && <small className="camera-hint">Opening camera…</small>}
      {cameraView}
      {imageView}
    </div>
  );
}