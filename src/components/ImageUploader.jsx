import React, { useEffect, useRef, useState } from 'react';

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
        // Some browsers expose only one camera or don't support exact facingMode.
        if (deviceId) throw firstError;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
      }
      streamRef.current = stream;
      const activeTrack = stream.getVideoTracks()[0];
      const settings = activeTrack?.getSettings?.() || {};
      if (settings.deviceId) setCameraId(settings.deviceId);
      if (enumerate && navigator.mediaDevices.enumerateDevices) {
        const available = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'videoinput');
        setCameras(available);
        if (settings.deviceId) setCameraId(settings.deviceId);
      }
      setFacingMode(facing);
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

  function switchCamera(event) {
    const nextId = event.target.value;
    const selected = cameras.find((camera) => camera.deviceId === nextId);
    const nextFacing = /front|user|selfie/i.test(selected?.label || '') ? 'user' : 'environment';
    setCameraId(nextId);
    startCamera({ deviceId: nextId, facing: nextFacing });
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

  return (
    <div className="image-uploader">
      {cameraOpen ? (
        <div className="camera-panel">
          <video ref={videoRef} className="camera-preview" autoPlay muted playsInline aria-label={`${label} live camera preview`} />
          {cameras.length > 1 && (
            <label className="field camera-select">
              <span>Choose camera</span>
              <select value={cameraId} onChange={switchCamera} disabled={cameraBusy}>
                {cameras.map((camera, index) => (
                  <option key={camera.deviceId} value={camera.deviceId}>{cameraName(camera, index)}</option>
                ))}
              </select>
            </label>
          )}
          {cameras.length <= 1 && <small className="camera-hint">Using the {facingMode === 'user' ? 'front' : 'rear'} camera when available.</small>}
          <div className="camera-actions">
            <button type="button" className="btn btn-primary" onClick={capturePhoto} disabled={cameraBusy}>Capture photo</button>
            <button type="button" className="btn" onClick={closeCamera}>Cancel camera</button>
          </div>
        </div>
      ) : value ? (
        <img className="image-preview" src={value} alt={label} />
      ) : (
        <div className="image-placeholder">📷<br />No {label.toLowerCase()} photo yet</div>
      )}
      {cameraError && <p className="camera-error" role="status">{cameraError}</p>}
      {!cameraOpen && (
        <div className="image-uploader-actions">
          <button type="button" className="btn btn-primary" onClick={openCamera} disabled={cameraBusy}>
            {cameraBusy ? 'Opening camera…' : value ? 'Retake with camera' : 'Open live camera'}
          </button>
          {value && <button type="button" className="btn btn-sm" onClick={() => onChange(null)}>Remove photo</button>}
        </div>
      )}
    </div>
  );
}
