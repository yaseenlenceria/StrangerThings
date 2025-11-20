import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, SkipForward, Loader2, Radio } from "lucide-react";
import type { ConnectionState } from "@shared/schema";

export default function VoiceChat() {
  const [state, setState] = useState<ConnectionState>("idle");
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

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
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsAudioEnabled(false);
  };

  const startChat = async () => {
    // This will be implemented in the integration phase
    console.log("Start chat clicked");
  };

  const nextChat = () => {
    // This will be implemented in the integration phase
    console.log("Next clicked");
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
                onClick={cleanup}
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
