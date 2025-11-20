import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Phone, PhoneOff, SkipForward, Volume2, VolumeX } from "lucide-react";

type ConnectionState = "idle" | "searching" | "connecting" | "connected";

export default function VoiceChat() {
  const [state, setState] = useState<ConnectionState>("idle");
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const partnerIdRef = useRef<string | null>(null);
  const iceCandidateBufferRef = useRef<RTCIceCandidate[]>([]);
  const isIntentionalCloseRef = useRef(false);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const disconnectTimerRef = useRef<number | null>(null);
  const iceRestartAttemptsRef = useRef<number>(0);
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (heartbeatIntervalRef.current) {
      window.clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (disconnectTimerRef.current) {
      window.clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (wsRef.current) {
      isIntentionalCloseRef.current = true;
      // Only send leave if connection is open
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "leave" }));
      }
      // Always close the socket regardless of state
      wsRef.current.close();
      wsRef.current = null;
    }
    iceCandidateBufferRef.current = [];
    partnerIdRef.current = null;
    setIsAudioEnabled(false);
    setState("idle");
  };

  const setupWebSocket = () => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connected");
      // Start heartbeat ping every 25s (app-level)
      if (heartbeatIntervalRef.current) {
        window.clearInterval(heartbeatIntervalRef.current);
      }
      heartbeatIntervalRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping", ts: Date.now() }));
        }
      }, 25000);
      // Request to be matched with a partner
      ws.send(JSON.stringify({ type: "match" }));
    };

    ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("Received message:", message.type);

        switch (message.type) {
          case "match": {
            console.log("Matched with partner:", message.partnerId);
            partnerIdRef.current = message.partnerId;
            setState("connecting");
            await setupPeerConnection(message.initiator);
            break;
          }
          case "pong": {
            // Heartbeat acknowledgement from server
            break;
          }

          case "offer": {
            console.log("Received offer from:", message.from);
            if (!pcRef.current) {
              setState("connecting");
              await setupPeerConnection(false);
            }
            if (pcRef.current) {
              try {
                await pcRef.current.setRemoteDescription(
                  new RTCSessionDescription({ type: "offer", sdp: message.sdp })
                );
                
                if (iceCandidateBufferRef.current.length > 0) {
                  console.log(`Flushing ${iceCandidateBufferRef.current.length} buffered ICE candidates`);
                  for (const candidate of iceCandidateBufferRef.current) {
                    try {
                      await pcRef.current.addIceCandidate(candidate);
                    } catch (err) {
                      console.error("Error adding buffered ICE candidate:", err);
                    }
                  }
                  iceCandidateBufferRef.current = [];
                }
                
                console.log("Creating answer");
                const answer = await pcRef.current.createAnswer({
                  offerToReceiveAudio: true,
                  offerToReceiveVideo: false,
                });
                await pcRef.current.setLocalDescription(answer);
                console.log("Sending answer");
                ws.send(JSON.stringify({
                  type: "answer",
                  sdp: answer.sdp,
                }));
                console.log("Answer sent successfully");
              } catch (err) {
                console.error("Error handling offer:", err);
                toast({
                  title: "Connection error",
                  description: "Failed to establish connection",
                  variant: "destructive",
                });
                resetForNext();
              }
            }
            break;
          }

          case "answer": {
            console.log("Received answer from:", message.from);
            if (pcRef.current) {
              try {
                await pcRef.current.setRemoteDescription(
                  new RTCSessionDescription({ type: "answer", sdp: message.sdp })
                );
                
                if (iceCandidateBufferRef.current.length > 0) {
                  console.log(`Flushing ${iceCandidateBufferRef.current.length} buffered ICE candidates`);
                  for (const candidate of iceCandidateBufferRef.current) {
                    try {
                      await pcRef.current.addIceCandidate(candidate);
                    } catch (err) {
                      console.error("Error adding buffered ICE candidate:", err);
                    }
                  }
                  iceCandidateBufferRef.current = [];
                }
                
                console.log("Answer processed successfully");
              } catch (err) {
                console.error("Error handling answer:", err);
              }
            }
            break;
          }

          case "ice": {
            console.log("Received ICE candidate from:", message.from);
            if (pcRef.current && message.candidate) {
              try {
                const candidate = new RTCIceCandidate(message.candidate);
                if (pcRef.current.remoteDescription) {
                  await pcRef.current.addIceCandidate(candidate);
                  console.log("ICE candidate added successfully");
                } else {
                  console.log("Buffering ICE candidate (remote description not yet set)");
                  iceCandidateBufferRef.current.push(candidate);
                }
              } catch (err) {
                console.error("Error adding ICE candidate:", err);
              }
            }
            break;
          }

          case "next": {
            console.log("Partner disconnected");
            toast({
              title: "Partner disconnected",
              description: "Looking for someone new...",
            });
            resetForNext();
            break;
          }

          case "error": {
            console.error("Server error:", message.message);
            toast({
              title: "Error",
              description: message.message,
              variant: "destructive",
            });
            break;
          }
        }
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      toast({
        title: "Connection error",
        description: "Failed to connect to server",
        variant: "destructive",
      });
      cleanup();
    };

    ws.onclose = () => {
      console.log("WebSocket closed");
      if (heartbeatIntervalRef.current) {
        window.clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      
      // Check if this was an intentional close (from cleanup)
      if (isIntentionalCloseRef.current) {
        isIntentionalCloseRef.current = false;
        return;
      }
      
      // Unexpected close - clean up and show error
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      iceCandidateBufferRef.current = [];
      partnerIdRef.current = null;
      wsRef.current = null;
      
      // Use functional state update to get current state
      setState((currentState) => {
        if (currentState !== "idle") {
          toast({
            title: "Connection lost",
            description: "Please try connecting again",
          });
        }
        return "idle";
      });
    };

    wsRef.current = ws;
  };

  const setupPeerConnection = async (isInitiator: boolean) => {
    try {
      // Stream should already be acquired in startChat, but fallback just in case
      if (!localStreamRef.current) {
        console.warn("Stream not found, acquiring now...");
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }, 
          video: false 
        });
        localStreamRef.current = stream;
        setIsAudioEnabled(true);
      }

      const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
      const turnUser = import.meta.env.VITE_TURN_USER as string | undefined;
      const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;

      const iceServers: RTCIceServer[] = [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
      ];
      if (turnUrl && turnUser && turnCredential) {
        console.log("Using TURN server:", turnUrl);
        iceServers.push({ urls: turnUrl, username: turnUser, credential: turnCredential });
      } else {
        console.warn("No TURN server configured, may have issues with restrictive NATs");
      }

      const configuration: RTCConfiguration = {
        iceServers,
        bundlePolicy: "max-bundle",
        iceTransportPolicy: "all",
      };

      const pc = new RTCPeerConnection(configuration);
      pcRef.current = pc;

      // Add local audio tracks
      const tracks = localStreamRef.current.getTracks();
      console.log(`Adding ${tracks.length} local tracks to peer connection`);
      tracks.forEach(track => {
        console.log(`Adding track: ${track.kind}, enabled: ${track.enabled}, muted: ${track.muted}`);
        pc.addTrack(track, localStreamRef.current!);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("Generated ICE candidate:", event.candidate.type);
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: "ice",
              candidate: event.candidate.toJSON(),
            }));
          } else {
            console.warn("Cannot send ICE candidate, WebSocket not open");
          }
        } else {
          console.log("ICE gathering complete");
        }
      };

      pc.ontrack = (event) => {
        console.log("Received remote track:", event.track.kind);
        if (remoteAudioRef.current && event.streams[0]) {
          console.log("Setting up remote audio stream");
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.volume = 1.0;
          remoteAudioRef.current.muted = false;

          // Attempt to play audio
          const playPromise = remoteAudioRef.current.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log("Remote audio playing successfully");
                toast({
                  title: "Connected!",
                  description: "Audio call is active",
                });
              })
              .catch(err => {
                console.error("Error playing remote audio:", err);
                toast({
                  title: "Audio blocked",
                  description: "Click anywhere to enable audio",
                  variant: "destructive",
                });
                const playAudio = () => {
                  if (remoteAudioRef.current) {
                    remoteAudioRef.current.play()
                      .then(() => console.log("Audio started after user interaction"))
                      .catch(e => console.error("Still cannot play audio:", e));
                  }
                };
                document.addEventListener('click', playAudio, { once: true });
              });
          }
          setState("connected");
        }
      };

      pc.onconnectionstatechange = () => {
        console.log("Connection state:", pc.connectionState);
        if (pc.connectionState === "connected") {
          setState("connected");
        }
        // Don't auto-disconnect on "failed" - let WebRTC try to recover
        // Calls should stay connected until user manually clicks "Next" or "Cancel"
      };

      const attemptIceRestart = async () => {
        if (!pcRef.current || wsRef.current?.readyState !== WebSocket.OPEN) return;
        if (iceRestartAttemptsRef.current >= 2) return; // cap restarts
        iceRestartAttemptsRef.current += 1;
        try {
          console.log("Attempting ICE restart", { attempt: iceRestartAttemptsRef.current });
          const offer = await pcRef.current.createOffer({ iceRestart: true });
          await pcRef.current.setLocalDescription(offer);
          wsRef.current?.send(JSON.stringify({ type: "offer", sdp: offer.sdp }));
        } catch (e) {
          console.error("ICE restart failed", e);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", pc.iceConnectionState);
        const state = pc.iceConnectionState;
        if (state === "connected" || state === "completed") {
          console.log("ICE connected successfully");
          iceRestartAttemptsRef.current = 0;
          if (disconnectTimerRef.current) {
            window.clearTimeout(disconnectTimerRef.current);
            disconnectTimerRef.current = null;
          }
        } else if (state === "disconnected") {
          console.log("ICE disconnected, will attempt restart in 10s if not recovered");
          if (!disconnectTimerRef.current) {
            disconnectTimerRef.current = window.setTimeout(() => {
              if (pcRef.current?.iceConnectionState === "disconnected") {
                console.log("Still disconnected after 10s, attempting ICE restart");
                attemptIceRestart();
              }
            }, 10000);
          }
        } else if (state === "failed") {
          console.log("ICE failed, attempting immediate restart");
          attemptIceRestart();
        }
        // Only disconnect when user manually clicks "Next" or "Cancel"
      };

      if (isInitiator) {
        console.log("Creating offer as initiator");
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false,
        });
        await pc.setLocalDescription(offer);
        console.log("Local description set, sending offer");
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: "offer",
            sdp: offer.sdp,
          }));
        } else {
          console.error("Cannot send offer, WebSocket not open");
        }
      }
    } catch (error) {
      console.error("Error setting up peer connection:", error);
      toast({
        title: "Microphone error",
        description: "Please allow microphone access to continue",
        variant: "destructive",
      });
      cleanup();
    }
  };

  const resetForNext = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    
    iceCandidateBufferRef.current = [];
    partnerIdRef.current = null;

    // Check WebSocket state before sending
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setState("searching");
      wsRef.current.send(JSON.stringify({ type: "next" }));
    } else {
      // WebSocket is closed, reset to idle and let user retry
      toast({
        title: "Connection lost",
        description: "Please start a new chat",
      });
      setState("idle");
    }
  };

  const startChat = async () => {
    try {
      console.log("Requesting microphone access...");
      // Request microphone permission before connecting
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false
      });

      // Ensure all tracks are enabled
      stream.getAudioTracks().forEach(track => {
        track.enabled = true;
        console.log("Microphone track acquired:", track.label, "enabled:", track.enabled);
      });

      localStreamRef.current = stream;
      setIsAudioEnabled(true);

      // Now set up WebSocket connection
      setState("searching");
      setupWebSocket();
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast({
        title: "Microphone access required",
        description: "Please allow microphone access to use voice chat",
        variant: "destructive",
      });
      setState("idle");
    }
  };

  const nextChat = () => {
    resetForNext();
  };

  const cancelSearch = () => {
    cleanup();
  };

  const toggleMute = () => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !remoteAudioRef.current.muted;
      setIsMuted(!isMuted);
    }
  };

  const getStatusText = () => {
    switch (state) {
      case "idle":
        return "Ready to Connect";
      case "searching":
        return "Finding Someone...";
      case "connecting":
        return "Connecting...";
      case "connected":
        return "Connected";
      default:
        return "Ready to Connect";
    }
  };

  return (
    <div className="relative min-h-screen bg-background flex flex-col overflow-hidden">
      {/* Aurora Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col">
        {/* Header */}
        <header className="backdrop-blur-md bg-background/30 border-b border-white/10">
          <div className="container mx-auto px-6 py-4 md:py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/20 border border-primary/30">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground tracking-tight">Stranger Voice</h1>
                  <p className="text-xs text-muted-foreground">Anonymous voice calls</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Compact dialer controls in header */}
                {state === "idle" && (
                  <Button size="sm" onClick={startChat} className="glass-button">Connect</Button>
                )}
                {(state === "searching" || state === "connecting") && (
                  <Button size="sm" variant="outline" onClick={cancelSearch} className="glass-button-outline">Cancel</Button>
                )}
                {state === "connected" && (
                  <>
                    <Button size="sm" variant="secondary" onClick={nextChat} className="glass-button-secondary">Next</Button>
                    <Button size="icon" variant="ghost" onClick={toggleMute} className="glass-button" data-testid="button-mute">
                      {isMuted ? (
                        <VolumeX className="w-5 h-5 text-destructive" />
                      ) : (
                        <Volume2 className="w-5 h-5 text-accent" />
                      )}
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelSearch} className="glass-button-outline">End</Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content - Hero */}
        <div className="flex-1 flex items-center justify-center p-6 md:p-8">
          <div className="w-full max-w-2xl">
            <div className="flex flex-col items-center space-y-8 md:space-y-12">
              {/* Animated Connection Orb */}
              <div className="relative flex items-center justify-center">
                {/* Pulsing Rings - Searching State */}
                {state === "searching" && (
                  <>
                    <div className="pulse-ring pulse-ring-1" />
                    <div className="pulse-ring pulse-ring-2" />
                    <div className="pulse-ring pulse-ring-3" />
                  </>
                )}

                {/* Main Orb */}
                <div className={`
                  connection-orb
                  ${state === "idle" ? "orb-idle" : ""}
                  ${state === "searching" ? "orb-searching" : ""}
                  ${state === "connecting" ? "orb-connecting" : ""}
                  ${state === "connected" ? "orb-connected" : ""}
                `}>
                  <Phone className="w-16 h-16 md:w-20 md:h-20 text-white/90" />
                </div>
              </div>

              {/* Soundwave Visualization - Connected State */}
              {state === "connected" && (
                <div className="flex items-end justify-center space-x-2 h-20" data-testid="soundwave-visualization">
                  {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <div
                      key={i}
                      className="soundwave-bar"
                      style={{
                        animationDelay: `${i * 0.15}s`,
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Status Text */}
              <div className="text-center space-y-3">
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground tracking-tight" data-testid="text-status">
                  {getStatusText()}
                </h2>
                {state === "idle" && (
                  <p className="text-sm md:text-base text-muted-foreground max-w-md mx-auto">
                    Click below to start an anonymous voice conversation with a random stranger
                  </p>
                )}
                {state === "searching" && (
                  <p className="text-sm md:text-base text-muted-foreground animate-pulse" data-testid="text-hint">
                    Waiting for someone to join...
                  </p>
                )}
              </div>

              {/* Glass Card with Actions */}
              <div className="glass-card w-full max-w-md p-8 space-y-6">
                {/* Primary Action Button */}
                {state === "idle" ? (
                  <Button
                    size="lg"
                    className="w-full min-h-16 text-xl font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
                    onClick={startChat}
                    data-testid="button-start-chat"
                  >
                    <Phone className="mr-3 h-6 w-6" />
                    Start Chat
                  </Button>
                ) : state === "searching" || state === "connecting" ? (
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full min-h-16 text-xl font-semibold glass-button-outline"
                    onClick={cancelSearch}
                    data-testid="button-cancel"
                  >
                    <PhoneOff className="mr-3 h-6 w-6" />
                    Cancel
                  </Button>
                ) : null}

                {/* Next Button - Connected State */}
                {state === "connected" && (
                  <Button
                    size="default"
                    variant="secondary"
                    className="w-full min-h-14 text-lg font-semibold glass-button-secondary"
                    onClick={nextChat}
                    data-testid="button-next"
                  >
                    <SkipForward className="mr-2 h-5 w-5" />
                    Next Stranger
                  </Button>
                )}

                {/* Status Indicator */}
                {state === "connected" && (
                  <div className="flex items-center justify-center space-x-2 text-sm font-medium">
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-lg shadow-accent/50"></div>
                    <span className="text-accent">Call Active</span>
                  </div>
                )}
              </div>

              {/* Privacy Badge */}
              <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent"></div>
                  <span>Anonymous</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                  <span>Encrypted</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-chart-3"></div>
                  <span>No Recording</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="backdrop-blur-md bg-background/20 border-t border-white/10">
          <div className="container mx-auto px-6 py-6 md:py-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
              <div>
                <p className="text-sm text-muted-foreground">
                  Connect with strangers worldwide through instant voice calls
                </p>
                <p className="text-xs text-muted-foreground/80 mt-1">
                  Powered by WebRTC • Peer-to-peer technology
                </p>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Audio element for remote stream */}
      <audio 
        ref={remoteAudioRef} 
        autoPlay 
        playsInline
        data-testid="audio-remote" 
      />

      {/* Styles */}
      <style>{`
        /* Aurora Background Animation */
        .aurora-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.3;
          animation: aurora-drift 30s ease-in-out infinite;
        }

        .aurora-blob-1 {
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, hsl(217, 91%, 55%), transparent);
          top: -10%;
          left: -10%;
          animation-duration: 35s;
        }

        .aurora-blob-2 {
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, hsl(180, 85%, 45%), transparent);
          bottom: -10%;
          right: -10%;
          animation-duration: 40s;
          animation-delay: -10s;
        }

        .aurora-blob-3 {
          width: 550px;
          height: 550px;
          background: radial-gradient(circle, hsl(280, 65%, 55%), transparent);
          top: 40%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation-duration: 45s;
          animation-delay: -20s;
        }

        @keyframes aurora-drift {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -30px) scale(1.1);
          }
          66% {
            transform: translate(-30px, 30px) scale(0.9);
          }
        }

        /* Glassmorphism */
        .glass-card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 1.5rem;
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        }

        .glass-button {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .glass-button-outline {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .glass-button-secondary {
          background: rgba(180, 230, 240, 0.1);
          backdrop-filter: blur(10px);
          border: 1px solid hsl(var(--accent) / 0.3);
        }

        /* Connection Orb */
        .connection-orb {
          position: relative;
          width: 240px;
          height: 240px;
          display: flex;
          align-items: center;
          justify-center;
          border-radius: 50%;
          transition: all 600ms ease;
        }

        @media (min-width: 768px) {
          .connection-orb {
            width: 320px;
            height: 320px;
          }
        }

        .orb-idle {
          background: radial-gradient(circle, hsl(180, 85%, 45%) 0%, hsl(180, 85%, 35%) 100%);
          box-shadow: 0 0 60px hsl(180, 85%, 45% / 0.3);
        }

        .orb-searching {
          background: radial-gradient(circle, hsl(217, 91%, 55%) 0%, hsl(217, 91%, 45%) 100%);
          box-shadow: 0 0 80px hsl(217, 91%, 55% / 0.5);
          animation: orb-pulse 2s ease-in-out infinite;
        }

        .orb-connecting {
          background: radial-gradient(circle, hsl(217, 91%, 60%) 0%, hsl(217, 91%, 50%) 100%);
          box-shadow: 0 0 100px hsl(217, 91%, 55% / 0.6);
          animation: orb-pulse-fast 1s ease-in-out infinite;
        }

        .orb-connected {
          background: radial-gradient(circle, hsl(180, 85%, 50%) 0%, hsl(180, 85%, 40%) 100%);
          box-shadow: 0 0 100px hsl(180, 85%, 45% / 0.6);
          animation: orb-breathe 3s ease-in-out infinite;
        }

        @keyframes orb-pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        @keyframes orb-pulse-fast {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.08);
          }
        }

        @keyframes orb-breathe {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 100px hsl(180, 85%, 45% / 0.6);
          }
          50% {
            transform: scale(1.02);
            box-shadow: 0 0 120px hsl(180, 85%, 45% / 0.8);
          }
        }

        /* Pulsing Rings */
        .pulse-ring {
          position: absolute;
          border: 2px solid hsl(217, 91%, 55%);
          border-radius: 50%;
          animation: ring-pulse 1.5s ease-out infinite;
        }

        .pulse-ring-1 {
          width: 240px;
          height: 240px;
          animation-delay: 0s;
        }

        .pulse-ring-2 {
          width: 240px;
          height: 240px;
          animation-delay: 0.5s;
        }

        .pulse-ring-3 {
          width: 240px;
          height: 240px;
          animation-delay: 1s;
        }

        @media (min-width: 768px) {
          .pulse-ring-1, .pulse-ring-2, .pulse-ring-3 {
            width: 320px;
            height: 320px;
          }
        }

        @keyframes ring-pulse {
          0% {
            transform: scale(1);
            opacity: 0.6;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }

        /* Soundwave Bars */
        .soundwave-bar {
          width: 6px;
          background: linear-gradient(to top, hsl(180, 85%, 45%), hsl(217, 91%, 55%));
          border-radius: 3px;
          animation: soundwave 0.8s ease-in-out infinite;
        }

        @keyframes soundwave {
          0%, 100% {
            height: 20px;
          }
          50% {
            height: 60px;
          }
        }

        .soundwave-bar:nth-child(1) { animation-delay: 0s; }
        .soundwave-bar:nth-child(2) { animation-delay: 0.1s; }
        .soundwave-bar:nth-child(3) { animation-delay: 0.2s; }
        .soundwave-bar:nth-child(4) { animation-delay: 0.3s; }
        .soundwave-bar:nth-child(5) { animation-delay: 0.2s; }
        .soundwave-bar:nth-child(6) { animation-delay: 0.1s; }
        .soundwave-bar:nth-child(7) { animation-delay: 0s; }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          .aurora-blob,
          .connection-orb,
          .pulse-ring,
          .soundwave-bar {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
