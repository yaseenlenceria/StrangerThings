# Design Guidelines: Stranger Voice Call WebApp

## Design Approach
**Utility-Focused, Minimalist Design System**
This is a single-purpose utility app focused on instant connection. Design should be clean, modern, and distraction-free with emphasis on functionality over decoration.

## Core Design Principles
- **Immediate clarity**: User should instantly understand the single action available
- **Status transparency**: Connection state must be continuously visible
- **Touch-first**: All interactive elements optimized for mobile touch targets
- **Minimal distractions**: No unnecessary visual elements competing for attention

## Typography
- **Headline (Status)**: text-2xl to text-4xl, font-semibold, center-aligned
- **Button Text**: text-lg to text-xl, font-medium
- **Body/Footer**: text-sm to text-base, regular weight
- **Font Stack**: System fonts (sans-serif) for instant load

## Layout System
- **Spacing Units**: Tailwind units of 4, 6, 8, 12, 16 for consistent rhythm
- **Container**: Centered vertical layout, max-width 480px for mobile-first
- **Vertical Centering**: Use flexbox to center main content vertically on viewport

## Component Library

### Primary Button ("Start Chat")
- **Size**: Very large - min-h-16 to min-h-20, full-width on mobile, min-w-64 on desktop
- **Typography**: Bold, uppercase or sentence case, 18-20px
- **States**: Clear hover, active, and disabled states
- **Positioning**: Centered, prominent placement

### Secondary Button ("Next")
- **Size**: Medium - min-h-12 to min-h-14, slightly smaller than primary
- **Visibility**: Hidden by default, shown only when connected
- **Position**: Below status indicator

### Status Indicator
- **Display**: Large, centered text with icon/animation
- **States**: 
  - Idle: Neutral, inviting
  - Searching: Animated (pulsing dot or spinner)
  - Connecting: Progress indicator
  - Connected: Success state with checkmark or active indicator
- **Animation**: Smooth transitions between states (300ms)

### Soundwave Visualization
- **Type**: Simple CSS animation bars (3-5 vertical bars)
- **Behavior**: Animate when connected, static when idle
- **Position**: Above or beside status text
- **Style**: Minimalist, single color, gentle movement

### Footer
- **Content**: Minimal - app name or tagline
- **Position**: Bottom of viewport, small text
- **Padding**: py-6 to py-8

## Visual Hierarchy
1. **Primary**: Start Chat button (largest visual element)
2. **Secondary**: Status text with animation
3. **Tertiary**: Next button (when visible)
4. **Quaternary**: Footer information

## Responsive Behavior
- **Mobile (default)**: Single column, full-width buttons with px-4 spacing
- **Desktop (md:)**: Centered card-like container, max-width buttons
- **Touch Targets**: Minimum 44px height for all interactive elements

## Animations
- **Status transitions**: Fade in/out (200-300ms)
- **Button states**: Subtle scale on press (transform: scale(0.98))
- **Soundwave**: Continuous gentle animation when active
- **Loading state**: Simple spinner or pulsing indicator

## Layout Structure
```
Viewport (full height)
└── Centered Container
    ├── Soundwave Visualization (when connected)
    ├── Status Text (large, prominent)
    ├── Start Chat Button (primary action)
    ├── Next Button (conditional, below primary)
    └── Footer (bottom-aligned)
```

## Images
**No images required** - This is a utility app focused on functionality. All visual interest comes from clean typography, status animations, and the soundwave visualization.

## State Management (Visual)
- **Idle**: Show "Start Chat" button, no animation
- **Searching**: Hide button or show "Searching..." with spinner
- **Connecting**: Show progress state, disable interactions
- **Connected**: Show soundwave animation, reveal "Next" button

## Accessibility
- Clear focus states on all interactive elements
- ARIA labels for status changes
- Screen reader announcements for connection state changes