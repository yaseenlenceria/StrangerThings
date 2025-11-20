# Stranger Voice - Random Voice Chat WebApp

A simple, clean WebRTC-based application that connects strangers for audio-only voice calls. Built with React, TypeScript, Node.js, and WebSockets.

## Features

- 🎙️ **Voice-Only Calls**: Audio-only WebRTC peer-to-peer connections
- 🔀 **Random Matching**: Automatic matchmaking pairs waiting users
- ⏭️ **Next Button**: Skip to the next stranger instantly
- 📱 **Mobile Friendly**: Responsive design with touch-optimized buttons
- 🎨 **Clean UI**: Minimal, distraction-free interface
- 🔊 **Audio Quality**: Echo cancellation, noise suppression, auto gain control

## How It Works

1. **Click "Start Chat"** → Joins matchmaking queue
2. **Automatic Pairing** → When two users are waiting, they get matched
3. **WebRTC Handshake** → Automatic peer-to-peer connection setup
4. **Voice Call Starts** → Talk with your random partner
5. **Click "Next"** → Disconnect and find someone new

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, WebSocket (ws)
- **Real-time**: WebRTC for peer-to-peer audio, WebSocket for signaling
- **Hosting**: Replit

## Getting Started

### Prerequisites

- Node.js 20+ installed
- Modern web browser with WebRTC support (Chrome, Firefox, Safari, Edge)
- Microphone access

### Installation

```bash
npm install
```

### Running the Application

```bash
npm run dev
```

The server will start on port 5000. Open your browser to:
```
http://localhost:5000
```

## Testing the Application

Since this is a peer-to-peer voice chat app, you need **two separate browser instances** to test it properly:

### Manual Testing Steps

1. **Open two browser windows/tabs**:
   - Window A: `http://localhost:5000`
   - Window B: `http://localhost:5000` (or open in a different browser/incognito)

2. **User A clicks "Start Chat"**:
   - Allow microphone access when prompted
   - Status changes to "Finding Someone..."

3. **User B clicks "Start Chat"**:
   - Allow microphone access when prompted
   - Both users should see "Connecting..." then "Connected"

4. **Test the connection**:
   - Speak in one window and listen in the other
   - You should hear your voice in the other window (with slight delay)
   - Soundwave animation appears when connected

5. **Test "Next" button**:
   - Click "Next" in one window
   - Both users should disconnect and return to searching
   - Can match with new partners

6. **Test "Cancel" button**:
   - Click "Start Chat" in one window
   - Click "Cancel" while searching
   - Should return to idle state

### Testing with Multiple Users

To test with real strangers:
1. Deploy the app to Replit (click Deploy/Publish)
2. Share the URL with friends
3. Open the app in different browsers/devices
4. Everyone clicks "Start Chat" to be randomly paired

## Connection States

| State | Description | UI Elements |
|-------|-------------|-------------|
| **Idle** | Ready to connect | "Start Chat" button visible |
| **Searching** | Looking for partner | "Cancel" button, loading spinner |
| **Connecting** | WebRTC handshake | Loading spinner |
| **Connected** | Active call | Soundwave animation, "Next" button |

## Architecture

### WebSocket Signaling Server (`server/routes.ts`)

- Manages matchmaking queue
- Pairs waiting users
- Routes WebRTC signaling messages (offer, answer, ICE candidates)
- Handles disconnections and partner changes

### WebRTC Client (`client/src/pages/voice-chat.tsx`)

- Requests microphone access
- Creates RTCPeerConnection with STUN servers
- Exchanges SDP offer/answer through WebSocket
- Handles ICE candidate exchange
- Plays remote audio stream

### Message Flow

```
User A                    Server                    User B
  |                         |                         |
  |---(match request)------>|                         |
  |                         |<---(match request)------|
  |<---match(initiator)-----|                         |
  |                         |----match(wait)--------->|
  |---(WebRTC offer)------->|                         |
  |                         |-----(offer)------------>|
  |                         |<----(answer)------------|
  |<---(answer)-------------|                         |
  |---(ICE candidates)----->|-----(ICE)-------------->|
  |<---(ICE candidates)-----|<-----(ICE)-------------|
  |                                                   |
  |<=============== WebRTC P2P Connection ===========>|
```

## Browser Compatibility

- ✅ Chrome/Chromium 60+
- ✅ Firefox 60+
- ✅ Safari 11+
- ✅ Edge 79+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Troubleshooting

### No Audio?
- Check microphone permissions in browser settings
- Ensure microphone is not muted
- Try using headphones to prevent echo
- Check browser console for WebRTC errors

### Can't Connect?
- Make sure both users clicked "Start Chat"
- Check that WebSocket connection is established (browser console)
- Firewall may block WebRTC connections
- Try reloading the page

### Connection Drops?
- Network instability can disconnect WebRTC
- Click "Next" to find a new partner
- Check browser console for errors

## Security & Privacy

- **No Data Storage**: Conversations are not recorded or stored
- **Peer-to-Peer**: Audio streams directly between users (not through server)
- **Anonymous**: No user accounts or tracking
- **Ephemeral**: All connections are temporary

## Limitations

- Audio only (no video)
- No chat history
- No user profiles
- Requires microphone access
- NAT traversal may fail on some networks (consider adding TURN server for production)

## Future Enhancements

- Text chat alongside voice
- Interest-based matching
- User reporting/moderation
- Connection quality indicators
- Call duration timer
- Geographic region selection

## License

MIT

## Support

For issues or questions, please open an issue on the repository.

---

Built with ❤️ using WebRTC, WebSockets, and React
