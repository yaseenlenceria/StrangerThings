# Stranger Voice Call WebApp

## Overview

This is a real-time voice chat application that connects strangers for anonymous audio-only conversations. Built with a modern tech stack, it enables instant peer-to-peer voice connections through WebRTC technology. Users can click a single button to be matched with a random stranger, engage in voice conversation, and skip to the next person seamlessly.

The application follows a minimalist, utility-focused design philosophy with emphasis on immediate clarity and mobile-first interaction. It's a single-purpose app designed for instant connection without unnecessary features or distractions.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- **React 18** with TypeScript for type-safe component development
- **Vite** as the build tool and development server for fast refresh and optimal bundling
- **Wouter** for lightweight client-side routing (single route application)
- **TanStack Query** for server state management and data synchronization
- **Tailwind CSS** with custom design tokens for styling
- **shadcn/ui** component library (Radix UI primitives) for accessible UI components

**Design System:**
- Custom Tailwind configuration with HSL-based color system
- Responsive breakpoint at 768px for mobile/desktop distinction
- "New York" style variant from shadcn/ui
- Design guidelines emphasize touch-first interactions and minimal distractions
- Component sizing follows consistent spacing units (4, 6, 8, 12, 16)

**State Management Pattern:**
- Local React state for UI and connection status management
- Refs for WebRTC connections and media streams to avoid re-renders
- Connection states: `idle`, `searching`, `connecting`, `connected`
- No global state library needed due to simple application scope

### Backend Architecture

**Technology Stack:**
- **Node.js** with Express.js for HTTP server
- **WebSocket (ws library)** for real-time signaling between peers
- **TypeScript** for type-safe server code
- **ESM modules** throughout the codebase

**Server Responsibilities:**
- Serve static frontend assets in production
- WebSocket signaling server on `/ws` path (separate from Vite HMR)
- Matchmaking queue management (in-memory)
- WebRTC signaling relay (offer, answer, ICE candidates)

**Matchmaking Logic:**
1. Clients connect to WebSocket and join waiting queue
2. Server pairs two waiting clients (FIFO)
3. First client marked as "initiator" (creates WebRTC offer)
4. Server relays WebRTC signaling messages between paired clients
5. On disconnect/next, clients removed from partnerships and can rejoin queue

**Architecture Decision - In-Memory State:**
- **Problem:** Need to track active connections and matchmaking queue
- **Solution:** Map-based in-memory storage for client connections and waiting queue
- **Rationale:** Real-time voice chat is ephemeral; no persistence needed
- **Trade-offs:** 
  - Pro: Simple, fast, no database overhead
  - Con: State lost on server restart (acceptable for this use case)
  - Con: Cannot scale horizontally without additional coordination

### WebRTC Communication Flow

**Peer-to-peer Connection Setup:**
1. Both clients request getUserMedia for audio access
2. Initiator creates RTCPeerConnection and offer SDP
3. Offer sent through WebSocket signaling server
4. Non-initiator receives offer, creates answer SDP
5. Answer relayed back through signaling server
6. ICE candidates exchanged as they're discovered
7. Direct peer-to-peer audio stream established (bypassing server)

**Connection Lifecycle:**
- WebSocket only used for signaling; actual audio flows peer-to-peer
- Multiple state transitions tracked: idle → searching → connecting → connected
- Cleanup on disconnect stops media tracks and closes peer connections
- "Next" functionality triggers cleanup and rejoins matchmaking queue

### External Dependencies

**Third-party Services:**
- None required for core functionality
- STUN servers use default browser configuration for NAT traversal
- No authentication service (anonymous by design)
- No analytics or tracking services

**Database & Storage:**
- **Not applicable** - Application is fully stateless
- No user accounts, chat history, or persistent data
- Drizzle ORM configuration present but unused (likely scaffolding from template)
- PostgreSQL referenced in config but not utilized

**API Integrations:**
- No external APIs
- All communication happens through WebSocket and WebRTC

**Browser APIs:**
- **WebRTC API** (RTCPeerConnection, getUserMedia) for peer-to-peer voice
- **WebSocket API** for signaling communication
- **MediaStream API** for audio capture and playback

**Development Tools:**
- **Replit-specific plugins** for development environment (cartographer, dev-banner, runtime-error-modal)
- **esbuild** for server-side bundle in production
- **tsx** for TypeScript execution in development
- **Drizzle Kit** present but unused (database migration tool)

**CSS & UI Libraries:**
- **Radix UI** primitives (20+ components) for accessible interactions
- **Lucide React** for icon system
- **class-variance-authority** for component variant management
- **tailwind-merge** and **clsx** for conditional class composition

**Architecture Decision - No Database:**
- **Problem:** Need to manage real-time connections
- **Solution:** In-memory WebSocket connection management
- **Rationale:** Voice chat sessions are ephemeral; no need to persist
- **Trade-offs:**
  - Pro: Simpler architecture, faster performance
  - Pro: Privacy-focused (no conversation logs)
  - Con: Cannot implement features like user profiles or chat history
  - Con: Loses all state on server restart