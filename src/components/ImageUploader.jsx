import React, { useEffect, useRef, useState } from 'react';

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

export function ImageUploader({ value, onChange, label = 'Photo' }) {
  const inputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraBusy, setCameraBusy] = useState(false);

  function stopCamera() {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
    setCameraBusy(false);
  }

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  async function openCamera() {
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Live camera is unavailable in this browser. Use Take photo / choose image instead.');
      return;
    }
    setCameraBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (error) {
      setCameraError(error?.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access in your browser settings, or choose an image.'
        : 'Could not open the camera. Use Take photo / choose image instead.');
    } finally {
      setCameraBusy(false);
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) {
      setCameraError('Camera is still starting. Please try again in a moment.');
      return;
    }
    try {
      onChange(imageToJpeg(video, video.videoWidth, video.videoHeight));
      setCameraError('');
      stopCamera();
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
        } catch (error) {
          setCameraError(error?.message || 'Could not prepare the photo');
        }
      };
      image.onerror = () => setCameraError('Could not read the selected image.');
      image.src = String(reader.result);
    };
    reader.onerror = () => setCameraError('Could not read the selected image.');
    reader.readAsDataURL(file);
  }

  return (
    <div className="image-uploader">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="image-file-input"
        onChange={handleFile}
      />
      {cameraOpen ? (
        <div className="camera-panel">
          <video ref={videoRef} className="camera-preview" autoPlay muted playsInline aria-label={`${label} camera preview`} />
          <div className="camera-actions">
            <button type="button" className="btn btn-primary" onClick={capturePhoto}>Capture photo</button>
            <button type="button" className="btn" onClick={stopCamera}>Cancel camera</button>
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
            {cameraBusy ? 'Opening camera…' : 'Open live camera'}
          </button>
          <button type="button" className="btn" onClick={() => inputRef.current?.click()}>
            Take photo / choose image
          </button>
          {value && <button type="button" className="btn btn-sm" onClick={() => onChange(null)}>Remove photo</button>}
        </div>
      )}
    </div>
  );
}
