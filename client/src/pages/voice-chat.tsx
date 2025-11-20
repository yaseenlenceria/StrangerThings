import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, SkipForward, Loader2, Radio } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ConnectionState, WSMessage } from "@shared/schema";

export default function VoiceChat() {
  const [state, setState] = useState<ConnectionState>("idle");
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const partnerIdRef = useRef<string | null>(null);
  const iceCandidateBufferRef = useRef<RTCIceCandidate[]>([]);
  const { toast } = useToast();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "leave" }));
      wsRef.current.close();
      wsRef.current = null;
    }
    // Clear ICE candidate buffer to prevent stale candidates
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
      // Request to be matched
      ws.send(JSON.stringify({ type: "match" }));
    };

    ws.onmessage = async (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        
        switch (message.type) {
          case "match": {
            console.log("Matched with partner:", message.partnerId, "initiator:", message.initiator);
            partnerIdRef.current = message.partnerId;
            setState("connecting");
            // Only initiate if we're designated as the initiator
            await setupPeerConnection(message.initiator);
            break;
          }

          case "offer": {
            console.log("Received offer from:", message.from);
            // Guard: only setup peer connection if we don't already have one
            if (!pcRef.current) {
              setState("connecting");
              await setupPeerConnection(false);
            }
            if (pcRef.current) {
              try {
                await pcRef.current.setRemoteDescription(
                  new RTCSessionDescription({ type: "offer", sdp: message.sdp })
                );
                
                // Flush buffered ICE candidates
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
                
                const answer = await pcRef.current.createAnswer();
                await pcRef.current.setLocalDescription(answer);
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
                
                // Flush buffered ICE candidates
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
                // Only add ICE candidate if remote description is set
                if (pcRef.current.remoteDescription) {
                  await pcRef.current.addIceCandidate(candidate);
                  console.log("ICE candidate added successfully");
                } else {
                  // Buffer ICE candidates until remote description is set
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
      if (state !== "idle") {
        cleanup();
      }
    };

    wsRef.current = ws;
  };

  const setupPeerConnection = async (isInitiator: boolean) => {
    try {
      // Get local audio stream
      if (!localStreamRef.current) {
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

      // Create peer connection
      const configuration: RTCConfiguration = {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      };

      const pc = new RTCPeerConnection(configuration);
      pcRef.current = pc;

      // Add local audio tracks
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: "ice",
            candidate: event.candidate.toJSON(),
          }));
        }
      };

      // Handle remote stream
      pc.ontrack = (event) => {
        console.log("Received remote track");
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
          // Ensure audio plays
          remoteAudioRef.current.play().catch(err => {
            console.error("Error playing remote audio:", err);
            // Try again after user interaction
            toast({
              title: "Audio ready",
              description: "Click anywhere to enable audio",
            });
            document.addEventListener('click', () => {
              remoteAudioRef.current?.play();
            }, { once: true });
          });
          setState("connected");
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log("Connection state:", pc.connectionState);
        if (pc.connectionState === "connected") {
          setState("connected");
        } else if (pc.connectionState === "failed") {
          console.log("Connection failed, resetting...");
          toast({
            title: "Connection failed",
            description: "Looking for a new stranger...",
            variant: "destructive",
          });
          resetForNext();
        }
        // Note: "disconnected" is a temporary state, don't reset on it
      };

      // Monitor ICE connection state (more reliable than connection state)
      pc.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", pc.iceConnectionState);
        if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          console.log("ICE connected successfully");
        } else if (pc.iceConnectionState === "failed") {
          console.log("ICE connection failed");
          toast({
            title: "Connection failed",
            description: "Looking for a new stranger...",
            variant: "destructive",
          });
          resetForNext();
        }
      };

      // If initiator, create and send offer
      if (isInitiator && wsRef.current?.readyState === WebSocket.OPEN) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        wsRef.current.send(JSON.stringify({
          type: "offer",
          sdp: offer.sdp,
        }));
      }
    } catch (error) {
      console.error("Error setting up peer connection:", error);
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access to use voice chat",
        variant: "destructive",
      });
      cleanup();
    }
  };

  const resetForNext = () => {
    // Close peer connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    
    // Clear ICE candidate buffer
    iceCandidateBufferRef.current = [];
    
    partnerIdRef.current = null;
    setState("searching");

    // Request new match
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "next" }));
    }
  };

  const startChat = async () => {
    setState("searching");
    setupWebSocket();
  };

  const nextChat = () => {
    resetForNext();
  };

  const cancelSearch = () => {
    cleanup();
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

  const getStatusIcon = () => {
    switch (state) {
      case "idle":
        return <Phone className="w-12 h-12 text-primary" />;
      case "searching":
        return <Loader2 className="w-12 h-12 text-primary animate-spin" />;
      case "connecting":
        return <Loader2 className="w-12 h-12 text-primary animate-spin" />;
      case "connected":
        return <Radio className="w-12 h-12 text-primary animate-pulse" />;
      default:
        return <Phone className="w-12 h-12 text-primary" />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary">
                <Phone className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Stranger Voice</h1>
                <p className="text-xs text-muted-foreground">Connect with random people</p>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-2 text-sm text-muted-foreground">
              <Radio className="w-4 h-4" />
              <span>{state === "connected" ? "Live" : "Ready"}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Centered */}
      <div className="flex-1 flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/20">
        <div className="w-full max-w-lg">
          {/* Dialer Card */}
          <div className="bg-card border border-card-border rounded-lg shadow-lg p-8 md:p-12">
            <div className="flex flex-col items-center space-y-8">
              {/* Status Icon with Circle Background */}
              <div className="relative">
                <div className={`absolute inset-0 rounded-full ${state === "connected" ? "bg-primary/10 animate-pulse" : "bg-muted"} blur-xl`}></div>
                <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 border-2 border-primary/20">
                  {getStatusIcon()}
                </div>
              </div>

              {/* Soundwave Visualization - Only show when connected */}
              {state === "connected" && (
                <div className="flex items-center justify-center space-x-2 h-16" data-testid="soundwave-visualization">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-3 bg-primary rounded-full animate-soundwave"
                      style={{
                        height: "100%",
                        animationDelay: `${i * 0.1}s`,
                        animationDuration: "1s",
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Status Text */}
              <div className="text-center space-y-2">
                <h2 className="text-4xl md:text-5xl font-semibold text-foreground" data-testid="text-status">
                  {getStatusText()}
                </h2>
                {state === "idle" && (
                  <p className="text-sm text-muted-foreground">
                    Click below to start talking with a random stranger
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col items-center space-y-4 w-full pt-4">
                {/* Start/Stop Button */}
                {state === "idle" ? (
                  <Button
                    size="lg"
                    className="min-h-16 w-full text-xl font-medium shadow-lg hover:shadow-xl transition-shadow"
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
                    className="min-h-16 w-full text-xl font-medium"
                    onClick={cancelSearch}
                    data-testid="button-cancel"
                  >
                    <PhoneOff className="mr-3 h-6 w-6" />
                    Cancel
                  </Button>
                ) : null}

                {/* Next Button - Only show when connected */}
                {state === "connected" && (
                  <Button
                    size="default"
                    variant="secondary"
                    className="min-h-14 w-full text-lg font-medium"
                    onClick={nextChat}
                    data-testid="button-next"
                  >
                    <SkipForward className="mr-2 h-5 w-5" />
                    Next Stranger
                  </Button>
                )}
              </div>

              {/* Connection hint */}
              {state === "searching" && (
                <p className="text-muted-foreground text-center text-sm animate-pulse" data-testid="text-hint">
                  Waiting for someone to join...
                </p>
              )}

              {state === "connected" && (
                <div className="flex items-center space-x-2 text-sm text-green-600 dark:text-green-400">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="font-medium">Call Active</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <p className="text-sm text-muted-foreground">
                Connect with strangers worldwide through instant voice calls
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Anonymous • Secure • Peer-to-peer
              </p>
            </div>
            <div className="flex items-center space-x-6 text-xs text-muted-foreground">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>Audio Only</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span>WebRTC</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                <span>No Recording</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Hidden audio element for remote stream */}
      <audio 
        ref={remoteAudioRef} 
        autoPlay 
        playsInline
        controls={false}
        style={{ display: 'none' }}
        data-testid="audio-remote" 
      />

      {/* Soundwave animation styles */}
      <style>{`
        @keyframes soundwave {
          0%, 100% {
            transform: scaleY(0.3);
          }
          50% {
            transform: scaleY(1);
          }
        }
        .animate-soundwave {
          animation: soundwave 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
