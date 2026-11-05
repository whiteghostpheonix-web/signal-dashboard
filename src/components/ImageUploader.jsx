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
  const label = device.label || '';
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
      setCameraError('Live camera requires a secure HTTPS page and a browser that supports camera access.');
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
      } catch (firstError) {
        if (deviceId) throw firstError;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
      }
      streamRef.current = stream;
      const activeTrack = stream.getVideoTracks()[0];
      const settings = activeTrack?.getSettings?.() || {};
      const activeCameraId = settings.deviceId || deviceId;
      if (activeCameraId) setCameraId(activeCameraId);
      setFacingMode(facing);
      if (enumerate && navigator.mediaDevices.enumerateDevices) {
        const available = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'videoinput');
        setCameras(available);
        if (activeCameraId) setCameraId(activeCameraId);
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
        ? 'Camera permission was denied. Allow camera access in your browser settings, then try again.'
        : 'Could not open that camera. Check browser permissions and try the other camera.');
    } finally {
      setCameraBusy(false);
    }
  }

  async function openCamera() {
    setCameras([]);
    setCameraId('');
    await startCamera({ facing: 'environment', enumerate: true });
  }

  function selectCamera(nextId) {
    const selected = cameras.find(camera => camera.deviceId === nextId);
    setCameraId(nextId);
    startCamera({ deviceId: nextId, facing: facingFor(selected, facingMode) });
  }

  function switchFacing() {
    if (cameras.length > 1) {
      const next = cameras.find(camera => camera.deviceId !== cameraId && facingFor(camera, facingMode) !== facingMode)
        || cameras.find(camera => camera.deviceId !== cameraId);
      if (next) {
        selectCamera(next.deviceId);
        return;
      }
    }
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    startCamera({ facing: nextFacing, enumerate: true });
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) {
      setCameraError('Camera is still starting. Please try again in a moment.');
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
      <video ref={videoRef} className="camera-fullscreen-preview" autoPlay muted playsInline aria-label={`${label} live camera preview`} />
      <header className="camera-topbar">
        <div className="camera-title">Capture {label.toLowerCase()}</div>
        <button type="button" className="camera-icon-button" onClick={closeCamera} aria-label="Close camera">×</button>
      </header>
      <div className="camera-options">
        {cameras.length > 1 && (
          <label className="camera-option-select">
            <span>Camera</span>
            <select value={cameraId} onChange={event => selectCamera(event.target.value)} disabled={cameraBusy}>
              {cameras.map((camera, index) => (
                <option key={camera.deviceId} value={camera.deviceId}>{cameraName(camera, index)}</option>
              ))}
            </select>
          </label>
        )}
        <button type="button" className="camera-flip-button" onClick={switchFacing} disabled={cameraBusy}>
          ⇄ <span>Switch camera</span>
        </button>
      </div>
      {cameraError && <p className="camera-fullscreen-error" role="alert">{cameraError}</p>}
      <footer className="camera-bottom-bar">
        <button type="button" className="camera-cancel-button" onClick={closeCamera}>Cancel</button>
        <button type="button" className="camera-capture-button" onClick={capturePhoto} disabled={cameraBusy} aria-label="Capture photo">
          <span />
        </button>
        <div className="camera-bottom-spacer" aria-hidden="true" />
      </footer>
    </div>,
    document.body,
  ) : null;

  return (
    <div className="image-uploader">
      {value ? <img className="image-preview" src={value} alt={label} /> : (
        <div className="image-placeholder">📷<br />No {label.toLowerCase()} photo yet</div>
      )}
      {cameraError && !cameraOpen && <p className="camera-error" role="status">{cameraError}</p>}
      <div className="image-uploader-actions">
        <button type="button" className="btn btn-primary" onClick={openCamera} disabled={cameraBusy}>
          {cameraBusy ? 'Opening camera…' : value ? 'Retake with camera' : 'Open live camera'}
        </button>
        {value && <button type="button" className="btn btn-sm" onClick={() => onChange(null)}>Remove photo</button>}
      </div>
      {cameraView}
    </div>
  );
}
