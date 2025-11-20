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
              await pcRef.current.setRemoteDescription(
                new RTCSessionDescription({ type: "offer", sdp: message.sdp })
              );
              const answer = await pcRef.current.createAnswer();
              await pcRef.current.setLocalDescription(answer);
              ws.send(JSON.stringify({
                type: "answer",
                sdp: answer.sdp,
              }));
            }
            break;
          }

          case "answer": {
            console.log("Received answer from:", message.from);
            if (pcRef.current) {
              await pcRef.current.setRemoteDescription(
                new RTCSessionDescription({ type: "answer", sdp: message.sdp })
              );
            }
            break;
          }

          case "ice": {
            console.log("Received ICE candidate from:", message.from);
            if (pcRef.current && message.candidate) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(message.candidate));
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
          setState("connected");
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log("Connection state:", pc.connectionState);
        if (pc.connectionState === "connected") {
          setState("connected");
        } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          toast({
            title: "Connection lost",
            description: "Trying to reconnect...",
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
      {/* Main Content - Centered */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md flex flex-col items-center space-y-8">
          {/* Status Icon */}
          <div className="flex items-center justify-center">
            {getStatusIcon()}
          </div>

          {/* Soundwave Visualization - Only show when connected */}
          {state === "connected" && (
            <div className="flex items-center justify-center space-x-2 h-16" data-testid="soundwave-visualization">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-2 bg-primary rounded-full animate-soundwave"
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
          <h1 className="text-4xl font-semibold text-center" data-testid="text-status">
            {getStatusText()}
          </h1>

          {/* Action Buttons */}
          <div className="flex flex-col items-center space-y-4 w-full">
            {/* Start/Stop Button */}
            {state === "idle" ? (
              <Button
                size="lg"
                className="min-h-16 w-full md:w-auto md:min-w-64 text-xl font-medium"
                onClick={startChat}
                data-testid="button-start-chat"
              >
                <Phone className="mr-2 h-6 w-6" />
                Start Chat
              </Button>
            ) : state === "searching" || state === "connecting" ? (
              <Button
                size="lg"
                variant="outline"
                className="min-h-16 w-full md:w-auto md:min-w-64 text-xl font-medium"
                onClick={cancelSearch}
                data-testid="button-cancel"
              >
                <PhoneOff className="mr-2 h-6 w-6" />
                Cancel
              </Button>
            ) : null}

            {/* Next Button - Only show when connected */}
            {state === "connected" && (
              <Button
                size="default"
                variant="secondary"
                className="min-h-14 w-full md:w-auto md:min-w-64 text-lg font-medium"
                onClick={nextChat}
                data-testid="button-next"
              >
                <SkipForward className="mr-2 h-5 w-5" />
                Next
              </Button>
            )}
          </div>

          {/* Connection hint */}
          {state === "searching" && (
            <p className="text-muted-foreground text-center text-sm" data-testid="text-hint">
              Waiting for someone to join...
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 text-center">
        <p className="text-sm text-muted-foreground">
          Stranger Voice - Connect with random people worldwide
        </p>
      </footer>

      {/* Hidden audio element for remote stream */}
      <audio ref={remoteAudioRef} autoPlay playsInline data-testid="audio-remote" />

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
