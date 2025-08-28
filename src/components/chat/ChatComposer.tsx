import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, Mic, Camera, X, Flashlight, FlashlightOff, Timer, TimerOff } from "lucide-react";

interface ChatComposerProps {
  onSend: (message: string) => void;
  onUpload: (files: File[]) => void;
  disabled?: boolean;
}

const PLACEHOLDERS = [
  "Ask about your notes...",
  "Try /summary, /explain, /quiz, /mindmap",
  "Attach an image to analyze",
];

export function ChatComposer({ onSend, onUpload, disabled }: ChatComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [message, setMessage] = useState("");
  const [phText, setPhText] = useState("");
  const [phIndex, setPhIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [videoKey, setVideoKey] = useState(0);
  const [torchOn, setTorchOn] = useState(false);
  const [timerOn, setTimerOn] = useState(false); // 3s timer when true
  const [countdown, setCountdown] = useState<number | null>(null);

  const isLiveStream = (s: MediaStream | null) => {
    if (!s) return false;
    const vt = s.getVideoTracks?.() ?? [];
    if (!vt.length) return false;
    return vt.some(t => t.readyState === 'live' && t.enabled);
  };

  // Typing animation for placeholder
  useEffect(() => {
    if (disabled) return; // pause when disabled
    const current = PLACEHOLDERS[phIndex % PLACEHOLDERS.length];
    const speed = isDeleting ? 40 : 70;
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        const next = current.slice(0, phText.length + 1);
        setPhText(next);
        if (next === current) {
          setIsDeleting(true);
          // small hold before deleting
          setTimeout(() => {}, 600);
        }
      } else {
        const next = current.slice(0, Math.max(0, phText.length - 1));
        setPhText(next);
        if (next.length === 0) {
          setIsDeleting(false);
          setPhIndex((i) => (i + 1) % PLACEHOLDERS.length);
        }
      }
    }, speed);
    return () => clearTimeout(timeout);
  }, [phText, isDeleting, phIndex, disabled]);

  // Cleanup: stop camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage("");
    }
  };

  // When camera modal is open and no captured image, ensure stream is attached and playing
  useEffect(() => {
    if (!cameraOpen || capturedDataUrl) return;
    let stream = streamRef.current;
    // if stream not live, reacquire
    if (!isLiveStream(stream)) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
        .then((newStream) => {
          // stop old
          if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = newStream;
          setVideoKey(k => k + 1);
          stream = newStream;
          const v = videoRef.current;
          if (!v) return;
          try { v.pause(); } catch (_err) { /* ignore pause() errors */ }
          v.srcObject = null;
          v.load();
          v.srcObject = newStream;
          const tryPlay = () => v.play().catch(() => {});
          if (v.readyState < 2) v.onloadedmetadata = () => { tryPlay(); v.onloadedmetadata = null; }; else tryPlay();
        })
        .catch(() => {});
      return;
    }
    const v = videoRef.current;
    if (!stream || !v) return;
    // reset the element to avoid black frames on some browsers
    try { v.pause(); } catch (_err) { /* ignore pause() errors */ }
    v.srcObject = null;
    v.load();
    v.srcObject = stream;
    const tryPlay = () => v.play().catch(() => { /* ignore */ });
    if (v.readyState < 2) {
      v.onloadedmetadata = () => { tryPlay(); v.onloadedmetadata = null; };
    } else {
      tryPlay();
    }
  }, [cameraOpen, capturedDataUrl, videoKey]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      onUpload(Array.from(event.target.files));
    }
  };

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const closeCamera = useCallback(() => {
    // Pause and clear video element before stopping stream
    const v = videoRef.current;
    if (v) {
      try { v.pause(); } catch (_err) { /* ignore pause() errors */ }
      v.srcObject = null;
      v.load();
    }
    stopStream();
    setCapturedDataUrl(null);
    setCameraOpen(false);
  }, [stopStream]);

  // Close on Escape when camera is open (placed after closeCamera is defined)
  useEffect(() => {
    if (!cameraOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeCamera();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cameraOpen, closeCamera]);

  const handleCameraClick = async () => {
    if (disabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
      setVideoKey((k) => k + 1);
      // attach stream after modal renders
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 0);
    } catch (err) {
      // Fallback to camera input (mobile) or file picker
      cameraInputRef.current?.click();
    }
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedDataUrl(dataUrl);
  };

  const handleRetake = async () => {
    setCapturedDataUrl(null);
    setVideoKey((k) => k + 1);
    // If stream exists, ensure video element is attached and playing
    if (isLiveStream(streamRef.current)) {
      if (videoRef.current) {
        if (videoRef.current.srcObject !== streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
        }
        const v = videoRef.current;
        // reset the element before playing again
        try { v.pause(); } catch (_err) { /* ignore pause() errors */ }
        v.srcObject = null;
        v.load();
        v.srcObject = streamRef.current;
        const tryPlay = () => v.play().catch(() => { /* ignore play() errors */ });
        if (v.readyState < 2) {
          v.onloadedmetadata = () => {
            tryPlay();
            v.onloadedmetadata = null;
          };
        } else {
          await tryPlay();
        }
      }
      return;
    }
    // Otherwise, ask for camera again
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        const v = videoRef.current;
        v.srcObject = stream;
        const tryPlay = () => v.play().catch(() => { /* ignore play() errors */ });
        if (v.readyState < 2) {
          v.onloadedmetadata = () => {
            tryPlay();
            v.onloadedmetadata = null;
          };
        } else {
          await tryPlay();
        }
      }
    } catch (err) {
      // As a fallback, allow picking again
      cameraInputRef.current?.click();
    }
  };

  // removed flip camera per request

  const toggleTorch = async () => {
    const stream = streamRef.current;
    if (!stream) return;
    const track = stream.getVideoTracks?.()[0];
    if (!track) return;
    const capabilities = (track.getCapabilities && track.getCapabilities()) as MediaTrackCapabilities | undefined;
    if (!capabilities || !("torch" in capabilities)) return; // not supported
    try {
      const constraints = { advanced: [{ torch: !torchOn }] } as unknown as MediaTrackConstraints;
      await track.applyConstraints(constraints);
      setTorchOn(v => !v);
    } catch (_err) {
      // ignore
    }
  };

  const handleUsePhoto = async () => {
    if (!capturedDataUrl) return;
    const res = await fetch(capturedDataUrl);
    const blob = await res.blob();
    const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
    onUpload([file]);
    closeCamera();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface/80 backdrop-blur supports-[backdrop-filter]:bg-surface/70 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="max-w-4xl mx-auto">
        <div className="relative">
          <Textarea
            placeholder={phText || "Ask about your notes..."}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={disabled}
            className="min-h-[52px] sm:min-h-[60px] pr-16 sm:pr-24 resize-none focus-ring"
          />
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            multiple
            accept="image/*,application/pdf"
          />
          <input
            type="file"
            ref={cameraInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*"
            capture="environment"
          />
          {/* Camera Modal (Portal) */}
          {cameraOpen && createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={closeCamera} onMouseDown={closeCamera}>
              <div
                className="relative w-full max-w-md bg-background rounded-2xl shadow-lg overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-background/70 backdrop-blur border-b">
                  <div>
                    <h3 className="text-sm font-medium">Take a Photo</h3>
                    <p className="text-xs text-muted-foreground">Using your camera</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={closeCamera} aria-label="Close camera" className="hover:bg-muted">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="w-full aspect-video bg-black flex items-center justify-center relative">
                  {!capturedDataUrl ? (
                    <video key={videoKey} ref={videoRef} className="w-full h-full object-contain" playsInline autoPlay muted />
                  ) : (
                    <img src={capturedDataUrl} alt="Captured" className="w-full h-full object-contain" />
                  )}
                  {countdown !== null && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-white text-6xl font-bold drop-shadow-lg">{countdown}</div>
                    </div>
                  )}
                  {/* Controls overlay within preview to avoid footer overlap */}
                  {!capturedDataUrl && (
                    <div className="absolute bottom-3 inset-x-0 px-4 z-20 flex items-center justify-between">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={toggleTorch}
                        disabled={!isLiveStream(streamRef.current)}
                        aria-label="Toggle torch"
                        className="bg-black/35 text-white hover:bg-black/45"
                      >
                        {torchOn ? <Flashlight className="w-5 h-5" /> : <FlashlightOff className="w-5 h-5" />}
                      </Button>
                      <Button
                        type="button"
                        onClick={async () => {
                          if (timerOn) {
                            setCountdown(3);
                            await new Promise<void>((resolve) => {
                              let n = 3;
                              const id = setInterval(() => {
                                n -= 1;
                                if (n <= 0) {
                                  clearInterval(id);
                                  setCountdown(null);
                                  resolve();
                                }
                                setCountdown(n);
                              }, 1000);
                            });
                          }
                          handleCapture();
                        }}
                        className="w-16 h-16 rounded-full p-0 grid place-items-center bg-white text-black hover:bg-white/90 shadow-xl"
                        aria-label="Capture photo"
                      >
                        <Camera className="w-7 h-7" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setTimerOn(v => !v)}
                        aria-label="Toggle timer"
                        className="bg-black/35 text-white hover:bg-black/45 px-2 h-9"
                      >
                        {timerOn ? (
                          <span className="flex items-center gap-1"><Timer className="w-4 h-4" /> 3s</span>
                        ) : (
                          <span className="flex items-center gap-1"><TimerOff className="w-4 h-4" /> Off</span>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
                {capturedDataUrl ? (
                  <div className="p-3 flex items-center justify-center gap-3">
                    <Button type="button" variant="outline" onClick={handleRetake}>Retake</Button>
                    <Button type="button" onClick={handleUsePhoto}>Use Photo</Button>
                  </div>
                ) : null}
                {/* Footer removed as per request: no caption or upload from device in modal */}
                {/* Hidden canvas for capture */}
                <canvas ref={canvasRef} className="hidden" />
              </div>
            </div>,
            document.body
          )}
          <div className="absolute bottom-2 sm:bottom-3 right-2 sm:right-3 flex gap-1.5 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 hidden sm:inline-flex"
              disabled={disabled}
              onClick={handleUploadClick}
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8"
              disabled={disabled}
              onClick={handleCameraClick}
            >
              <Camera className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 hidden sm:inline-flex"
              disabled={disabled}
            >
              <Mic className="w-4 h-4" />
            </Button>
            
            <Button
              onClick={handleSend}
              disabled={!message.trim() || disabled}
              size="icon"
              className="w-10 h-10 sm:w-8 sm:h-8"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="mt-1.5 sm:mt-2 text-[11px] sm:text-xs text-muted">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}