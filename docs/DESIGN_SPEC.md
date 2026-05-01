# Cabin — Visual and Experience Design Specification

## Product Thesis

Cabin is not a timer with airplane wallpaper. It is a diegetic, first-person productivity environment in which every functional control exists as part of the simulated aircraft suite. The user does not operate an app; the user inhabits a seat.

The design goal is to leverage three focus amplifiers simultaneously:

1. **Spatial memory** — the user remembers where things are in space rather than in menus.
2. **Atmosphere** — lighting, sound, and motion create a psychologically bounded work session.
3. **Ritual** — boarding, takeoff, cruise, breaks, and landing give work a dramatic arc.

---

## Experience Principles

### 1. Fully Diegetic
No floating HUDs, modal popups, or conventional productivity chrome should appear over the rendered cabin scene except when platform constraints require a temporary onboarding overlay before the session begins.

### 2. First-Person Embodiment
The screen is the user’s eyes. All interactions should reinforce the illusion that the user is seated inside a luxury long-haul business-class suite.

### 3. Gate-to-Gate Structure
The full productivity session should feel like a real flight:
- boarding
- pushback / taxi
- takeoff
- cruise
- scheduled break walk or seated service
- descent
- landing
- gate arrival

### 4. Calm Precision
All materials, typography, sound cues, and animation timings should feel premium, restrained, and deliberate. Avoid gamification aesthetics.

### 5. Focus First
Every visual flourish must strengthen concentration rather than distract from it.

---

## Cabin Layout

Cabin uses a staggered 1-2-1 premium business-class configuration inspired by modern long-haul suites.

### Seat Variants

| Seat ID | Name | Description |
|---------|------|-------------|
| 1A | True Left Window | Seat flush against left window; console shields aisle |
| 2B | Left Aisle | Seat beside left aisle; console toward window |
| 1D | Center Left — Aisle Facing | Seat borders left aisle; console centered |
| 2D | Center Left — Center Facing | Honeymoon seat; tucked inward with aisle shield |
| 2G | Center Right — Center Facing | Mirror of 2D |
| 1G | Center Right — Aisle Facing | Seat borders right aisle; console centered |
| 2J | Right Aisle | Seat beside right aisle; console toward window |
| 1L | True Right Window | Seat flush against right window; console shields aisle |

### Seat Selection UX
During onboarding, the user sees a stylized top-down seat map with eight tappable suites.

Each seat card previews:
- privacy level
- window access
- openness level
- likely outside view character
- a one-line emotional descriptor

Examples:
- 1A: “Most private. Cocooned beside the window.”
- 2B: “Open and airy. Best for less enclosed focus.”
- 2D / 2G: “Tucked inward. Intimate and sheltered.”

Seat changes are allowed mid-session through the IFE settings pane, but the transition should fade to black and re-seat the user as if they have moved cabins.

---

## First-Person Point of View

### Default Framing
The user begins with a forward-facing seated composition:
- large IFE centered in the upper-middle frame
- tray table stowed beneath the monitor
- side console visible left or right depending on seat
- ottoman and folded duvet visible at bottom edge
- window visible off-axis for window seats
- aisle edge visible for aisle-facing seats

### Camera Movement
- drag to pan on Mac/iPad
- iPad gyroscope optionally augments look direction
- camera motion should feel weighted, not frictionless
- extremely subtle idle breathing drift may be added during cruise

### Look Targets
Interactive hotspots should coincide with real objects:
- tray table latch
- seat control buttons
- storage cubby door
- IFE screen
- headphones hook
- window shutter area if implemented

---

## Hard Product Design

### 1. IFE Monitor
The IFE is the emotional center of the experience.

**Spec:**
- visually reads as a 24-inch 4K OLED display
- matte black bezel
- tight edge tolerances
- slightly recessed into the suite shell
- subtle screen reflections from window and cabin light

**Behavior:**
- single tap cycles between flight map, big clock, and tail camera
- long-press opens deeper session controls if needed
- emissive bloom should be restrained, premium, and realistic

### 2. Tray Table
The tray table is stowed directly beneath the IFE.

**Material:**
- faux-walnut laminate
- satin clear-coat finish
- precision chamfered edge
- brushed metal rails underneath

**Interaction:**
- tap deploys with a satisfying mechanical slide and clunk
- table occupies lower center frame
- meals and drinks appear only when table is deployed, unless auto-service mode is enabled

### 3. Side Console
The console is the command surface.

**Material options:**
- faux-marble composite for luxe seat variants
- brushed slate or graphite composite for restrained variants

**Contains:**
- capacitive seat-control buttons
- amenity placement zone
- reading-light button if simulated
- headphone cubby / storage cubby access

### 4. Seat Controls
Seat controls are tactile-looking capacitive buttons with gentle white LED edge-lighting.

**Buttons:**
- Upright
- Lounge
- Bed
- Lumbar

**Visual behavior:**
- selected mode glows subtly
- button press animates seat micro-adjustment
- no exaggerated sci-fi lighting

### 5. Storage Cubby
Small side cabinet with sliding door.

**Interior contents:**
- Evian bottle
- noise-canceling headphones hanging from hook
- optional passport / notebook prop in future builds

**Lighting:**
- low amber backlight for premium ambience

### 6. Overhead Architecture
When the user pans up, they should see:
- curved overhead bins
- recessed ceiling lighting strips
- gasper air vent assembly
- illuminated fasten-seatbelt sign in crisp LED orange

The cabin ceiling should feel clean, aerodynamic, and modern rather than retro.

---

## Soft Product Design

### Bedding
A charcoal-grey quilted duvet sits folded on the ottoman.

**Material behavior:**
- high stitch fidelity
- soft but structured folds
- visible fabric roughness under grazing light

### Amenity Kit
A premium amenity kit rests on the console at session start.

**Look:**
- compact rectangular pouch
- dark neutral textile or vegan leather exterior
- subtle embossed Cabin mark possible in future

### Meal Service
Breaks can be represented through “magic meal service.” Items softly fade or settle onto the tray table.

**Examples:**
- espresso cup on saucer
- warm mixed nuts in porcelain ramekin
- tea service
- plated meal for longer sessions

**Sound:**
- subtle porcelain clink
- soft fabric / trolley ambience underneath

The effect should feel elegant, not magical in a fantasy sense. The fade should read as a cinematic time compression.

---

## Material Palette

### Core Palette
- matte charcoal fabrics
- black OLED bezel
- warm walnut woodgrain
- slate / marble console finishes
- soft off-white porcelain accents
- muted metallic details (champagne aluminum / dark brushed steel)

### Accent Lighting
- cool white during boarding and gate phases
- blue-violet cabin wash during taxi / takeoff
- dim neutral cruise ambience during focus phase
- warm localized meal and cubby lighting
- bright neutral white during arrival

### Texture Rules
Materials must avoid noisy over-detailing. Luxury cabins rely on subtle roughness, fine seams, and disciplined surfaces rather than visual clutter.

---

## Diegetic UI — IFE Dashboard

All core productivity UI lives inside the rendered IFE.

### Mode 1 — Flight Map
This is the default deep-work dashboard.

**Visuals:**
- dark high-contrast background
- premium 3D globe or route map
- luminous route arc from departure to destination
- airplane marker progressing in real time
- minimal telemetry strip at bottom

**Telemetry:**
- Time to Destination
- Altitude
- Ground Speed
- Local times optional

**Behavior rules:**
- telemetry should be plausible and phase-aware
- altitude rises during climb, stabilizes in cruise, falls during descent
- speed varies realistically by phase
- if the user selects a fake route, simulation still feels believable

### Mode 2 — Big Clock
For maximum concentration.

**Visuals:**
- pitch-black background
- enormous white countdown typography
- optional smaller label for current sprint / break
- no decorative motion except minimal time transitions

**Mood:**
This mode should feel monastic.

### Mode 3 — Tail Camera
A simulated live camera feed from the aircraft tail.

**Visuals:**
- aircraft tail or aft fuselage framing optional
- cloud deck rushing below
- day/night and weather consistent with current session sky state
- slight sensor noise and compression feel can help realism if subtle

**Purpose:**
Ambient mode for users who want motion without cognitive load.

---

## Productivity Logic

### Session Setup
Before boarding completes, the user chooses:
- departure airport
- arrival airport
- total intended session length
- minimum taxi time
- focus sprint length
- break style (walk / tea service / auto alternate)
- seat selection

### Mapping Work to Flight Time
The total selected productivity session maps directly to simulated gate-to-gate elapsed time.

Example:
- 3 hour work session = full medium-haul long phase simulation
- shorter 45 minute session compresses phases proportionally while preserving narrative order

### Pomodoro Integration
Recommended default:
- 25 min focus
- 5 min break

Longer variants:
- 50/10
- 90/15

During breaks, the simulation either:
- stands the user up and walks to galley / door area
- remains seated and serves tea / espresso

### Session End
The final countdown aligns with descent and landing. The session ends only when the aircraft reaches the virtual gate.

---

## Phase-by-Phase Experience

### Phase 1 — Boarding & Pre-Departure
**Visuals**
- jet bridge visible through window
- ground crew and baggage movement implied outside
- bright white cabin lights
- static seat environment, calm and clean

**Audio**
- low electrical hum of ground power
- soft boarding music
- occasional distant cabin movement
- PA: “Flight attendants, doors to automatic and crosscheck.”

**User Action**
- finalize route and session settings
- settle into seat

### Phase 2 — Taxi & Takeoff
**Visuals**
- jet bridge gone
- tarmac slowly moving outside
- seatbelt sign illuminates and chimes on
- ambient light shifts to moody blue/purple
- during rotation, camera subtly tilts up and vibrates

**Audio**
- engine spool-up rising in intensity
- runway rumble during takeoff roll
- heavier low-frequency masking noise

### Phase 3 — Cruise
**Visuals**
- seatbelt sign dings off
- stable cloud field outside
- lighting synced to time of day: sunrise, daylight, golden hour, or night
- occasional subtle turbulence

**Audio**
- steady jet hum
- gentle air vent hiss
- rare creaks or distant cabin sounds

This is the main deep-focus phase.

### Phase 4 — Scheduled Breaks
**Visuals**
- gentle chime marks sprint completion
- optional stand-up camera transition into aisle
- auto-walk toward galley or aircraft door area
- alternative: tea / espresso fades onto tray table

**Audio**
- footsteps on thick carpet
- faint galley chatter
- trolley and service clinks

### Phase 5 — Descent & Landing
**Visuals**
- globe/map shows approach to destination
- cloud deck parts or ground becomes visible
- cabin lighting brightens gradually
- nose lowers slightly during descent
- landing gear drop implied with motion/sound sync

**Audio**
- PA: “Flight attendants, prepare for arrival.”
- flap / gear mechanical cues
- runway touchdown rumble

### Phase 6 — Gate Arrival
**Visuals**
- taxi-in motion
- terminal / jet bridge environment implied
- cabin at bright neutral light again

**Audio**
- reduced engine presence
- arrival ambience

Session completion should feel earned and calm, not triumphant in a gamified way.

---

## Outside Window System

The window view should be hybridized for realism and performance.

### Components
1. procedural clouds for lighting consistency
2. pre-rendered 4K looping video plates for realism
3. time-of-day light rig
4. atmospheric haze / fog for altitude simulation

### Seat Sensitivity
Window-seat users should have dramatically better exterior composition.
Aisle users may only glimpse the window depending on head angle.
The outside view should therefore be seat-dependent, not globally identical.

### Time-of-Day States
- dawn
- bright midday
- golden hour
- twilight
- night above clouds

Night should include occasional wing / navigation light reflections if technically feasible.

---

## Audio Direction

The soundscape is as important as the visuals.

### Core Focus Layer
- steady engine hum
- filtered broadband noise
- air vent hiss

This forms the concentration bed.

### Event Cues
- seatbelt chime
- tray deploy clunk
- meal service clink
- PA announcements
- landing gear thud

### Spatialization
- window-side ambience slightly biased toward exterior side
- aisle ambience biased toward aisle
- galley chatter localized during walk breaks

Avoid excessive sonic novelty. The loop must be sustainable for multi-hour sessions.

---

## Interaction Design

### Inputs
- drag to pan
- tap physical hotspots
- optional gyro look
- keyboard shortcuts on Mac for IFE mode cycle and seat mode changes

### Hotspot Philosophy
Hotspots should not appear as glowing game objects by default. Use subtle cursor changes, tiny highlight treatments, or context-sensitive affordances.

### Split View
On iPad, Cabin can run alongside another app.

**Critical rule:**
Even in Split View, the Cabin pane must feel whole and atmospheric. The IFE remains legible, and the engine hum continues to structure attention.

---

## Motion and Animation Language

### Motion Characteristics
- smooth ease-in-out transitions
- slight mechanical weight for tray and seat controls
- subtle camera inertia
- restrained turbulence shake
- cinematic but not theatrical fade transitions when changing seat or break mode

### Things to Avoid
- overshoot/bounce UI animations
- neon sci-fi pulses
- arcade-like reward bursts
- aggressive particle effects

---

## Typography on the IFE

Typography inside the IFE should feel aviation-grade and premium.

### Characteristics
- clean sans-serif
- highly legible numerals
- large countdown figures with tight discipline
- restrained tracking
- minimal ornament

The big clock should evoke an expensive OLED timer, not a consumer phone app.

---

## Platform Notes

### Unreal Engine 5.3+
Chosen for:
- Lumen global illumination
- Nanite meshes
- Niagara particles
- Sequencer-driven cinematic motion
- high-end PBR materials

### SwiftUI Companion Layer
Used for:
- app shell
- settings / onboarding scaffolding
- session model
- iPadOS integration
- Metal texture bridge to IFE screen

### Performance Priorities
The most important tradeoff is preserving the illusion of premium realism while still hitting stable frame pacing and reasonable thermal behavior on iPad hardware.

Priority order:
1. believable lighting
2. convincing materials at hand-reach distance
3. stable head / drag motion
4. acceptable battery behavior
5. secondary decorative detail

---

## MVP Scope

The first export-ready version must include:
- seat selection onboarding
- one fully modeled premium suite variant adaptable across eight seat positions
- first-person seated camera
- deployable tray table
- interactive IFE with 3 modes
- phase-based session engine
- dynamic light transitions
- basic outside window system
- core audio loops and cues
- break transition sequence
- descent / landing wrap-up

Optional later expansions:
- additional cabin liveries
- meal selection
- airline themes
- multiplayer co-working flights
- premium route packs

---

## Emotional Target

The user should feel:
- enclosed but calm
- transported
- serious about work
- protected from outside chaos
- gently guided through time

The app should make starting work feel like taking a long-haul flight in a private productivity cocoon.
