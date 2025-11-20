# Design Guidelines: Stranger Voice Call WebApp

## Design Approach
**Cinematic Utility Design with Futuristic Aesthetics**
Reference-based approach inspired by modern voice/communication apps (Discord, Clubhouse) with cinematic sci-fi interfaces. Dark, immersive experience that makes voice connection feel like entering a futuristic space.

## Core Design Principles
- **Cinematic immersion**: Full-height layouts with depth through layering and gradients
- **Visual feedback**: Every state transition is accompanied by smooth animations
- **Dark-first**: Deep backgrounds with glowing accents create focus
- **Touch-optimized**: 44px minimum touch targets, generous spacing for mobile

## Colors
- **Background**: Deep navy (#040712) with layered radial gradients
- **Primary**: Electric blue (#2563EB) for buttons and active states
- **Accent**: Teal for secondary elements and state indicators
- **Glass effects**: White/blue with 10-20% opacity for glassmorphism

## Typography
- **Font Family**: Geometric sans-serif (Inter, Manrope, or DM Sans)
- **Status Headlines**: text-3xl to text-5xl, font-bold, tracking-tight
- **Button Text**: text-lg to text-xl, font-semibold, uppercase letter-spacing
- **Body**: text-sm to text-base, font-normal
- **Hierarchy**: Large headlines (48-72px desktop), generous line-height (1.2-1.4)

## Layout System
- **Spacing**: Tailwind units of 4, 8, 12, 16, 24 for vertical rhythm
- **Container**: Full viewport height (min-h-screen), centered content
- **Max Width**: 560px for main content area on desktop
- **Padding**: px-6 mobile, px-8 desktop

## Component Library

### Aurora Background Animation
- **Implementation**: 3-4 layered radial gradients (blue, teal, purple)
- **Animation**: Slow drift and scale (20-40s duration), continuous loop
- **Position**: Fixed, full viewport, z-index below content
- **Blur**: Apply backdrop-blur-3xl for depth effect

### Animated Connection Orb
- **Idle State**: Single static circle, subtle glow, teal color
- **Searching State**: Pulsing animation (scale 1 to 1.2), rotating outer rings (2-3 rings)
- **Connecting State**: Rapid pulse, color shift to electric blue
- **Connected State**: Stable glow with gentle breathing animation, multiple orbiting particles
- **Size**: 200-280px diameter on mobile, 300-400px desktop
- **Position**: Center of viewport, above status text

### Glassmorphism Cards
- **Background**: Backdrop blur with semi-transparent white/blue (bg-white/10)
- **Border**: 1px solid with white/20 opacity
- **Shadow**: Large, colored glow matching state (blue for active)
- **Padding**: p-8 to p-12
- **Border Radius**: rounded-2xl to rounded-3xl

### Primary Button ("Start Chat")
- **Size**: min-h-16, min-w-72 desktop, full-width mobile with max-w-md
- **Background**: Electric blue (#2563EB) with gradient overlay
- **Glass Effect**: Semi-transparent backdrop with blur
- **Typography**: Uppercase, font-semibold, text-lg
- **Glow**: Box-shadow with blue spread for depth
- **States**: Hover lifts (translateY -2px), active scales (0.98)

### Secondary Button ("Next")
- **Size**: min-h-14, same width constraints as primary
- **Style**: Outlined ghost button with glassmorphism
- **Border**: 2px solid teal with glow
- **Background**: Blurred backdrop, minimal fill
- **Position**: mt-6 below primary button

### Pulsing Rings (Searching State)
- **Structure**: 3 concentric circles expanding outward
- **Animation**: Scale from 1 to 2, fade out, staggered timing (0.4s intervals)
- **Color**: Electric blue with decreasing opacity
- **Position**: Absolute positioned around central orb

### Soundwave Visualization (Connected)
- **Type**: 5-7 vertical bars, uneven heights
- **Animation**: Randomized height changes (100-600ms intervals)
- **Color**: Gradient from blue to teal
- **Position**: Below orb, horizontally centered
- **Size**: Each bar 4-6px wide, spacing of 2-3px

## Visual Hierarchy
1. **Animated Orb**: Largest, central focal point
2. **Status Text**: Below orb, highly visible
3. **Primary Button**: Strong color contrast, prominent size
4. **Secondary Elements**: Soundwave, rings, next button
5. **Footer**: Minimal presence, bottom-aligned

## Responsive Behavior
- **Mobile**: Full-width layout, px-6 padding, orb 240px
- **Tablet (md:)**: Increased spacing, orb 320px
- **Desktop (lg:)**: Max-width container, orb 380px, increased text sizes

## Animations
- **Aurora Background**: 30-40s continuous drift, smooth easing
- **Orb Pulse**: 2s duration, ease-in-out, infinite loop when searching
- **Ring Expansion**: 1.5s scale animation with fade-out
- **State Transitions**: 400-600ms for color shifts and scale changes
- **Soundwave**: Randomized 300-800ms intervals per bar
- **Button Interactions**: 200ms transforms, subtle scale/lift

## Layout Structure
```
Full Viewport Container
├── Aurora Background (fixed, animated gradients)
├── Centered Content Area (max-w-2xl)
│   ├── Animated Orb (connection state visual)
│   ├── Status Text (large, centered)
│   ├── Glassmorphism Card (on desktop)
│   │   ├── Primary Button
│   │   └── Secondary Button (conditional)
│   └── Soundwave Visualization (when connected)
└── Footer (minimal, bottom-aligned)
```

## State-Specific Visuals
- **Idle**: Static teal orb, soft glow, "Start Chat" button visible
- **Searching**: Blue pulsing orb, expanding rings, status text "Searching..."
- **Connecting**: Rapid pulse, color shifts, disabled buttons
- **Connected**: Breathing glow, soundwave active, "Next" button appears

## Images
**No images required** - Visual interest created entirely through animated gradients, glassmorphism effects, orbs, and particle systems. This maintains fast load times and pure code-based aesthetics.

## Accessibility
- Focus rings visible with high contrast against dark background
- ARIA live regions for status announcements
- Reduced motion preference disables aurora/orb animations
- Minimum 4.5:1 contrast for all text on dark backgrounds