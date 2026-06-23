---
name: Umami Chubby
colors:
  surface: '#faf9f8'
  surface-dim: '#dadad9'
  surface-bright: '#faf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f2'
  surface-container: '#eeeeed'
  surface-container-high: '#e9e8e7'
  surface-container-highest: '#e3e2e1'
  on-surface: '#1a1c1c'
  on-surface-variant: '#5b403d'
  inverse-surface: '#2f3130'
  inverse-on-surface: '#f1f0f0'
  outline: '#8f6f6c'
  outline-variant: '#e4beba'
  surface-tint: '#ba1a20'
  primary: '#af101a'
  on-primary: '#ffffff'
  primary-container: '#d32f2f'
  on-primary-container: '#fff2f0'
  inverse-primary: '#ffb3ac'
  secondary: '#785900'
  on-secondary: '#ffffff'
  secondary-container: '#fdc003'
  on-secondary-container: '#6c5000'
  tertiary: '#11651d'
  on-tertiary: '#ffffff'
  tertiary-container: '#307f34'
  on-tertiary-container: '#d8ffd0'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad6'
  primary-fixed-dim: '#ffb3ac'
  on-primary-fixed: '#410003'
  on-primary-fixed-variant: '#930010'
  secondary-fixed: '#ffdf9e'
  secondary-fixed-dim: '#fabd00'
  on-secondary-fixed: '#261a00'
  on-secondary-fixed-variant: '#5b4300'
  tertiary-fixed: '#a3f69c'
  tertiary-fixed-dim: '#88d982'
  on-tertiary-fixed: '#002204'
  on-tertiary-fixed-variant: '#005312'
  background: '#faf9f8'
  on-background: '#1a1c1c'
  surface-variant: '#e3e2e1'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
    letterSpacing: -1px
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 38px
    letterSpacing: -0.5px
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '800'
    lineHeight: 34px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 26px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-bold:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
  price-display:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '800'
    lineHeight: 22px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-margin: 20px
  gutter: 16px
  stack-sm: 4px
  stack-md: 12px
  stack-lg: 24px
---

## Brand & Style

The brand identity is built around the concept of "Joyful Abundance." It is a vibrant, appetizing, and approachable design system specifically tailored for high-energy dining environments like hot pot or bustling eateries. The personality is generous, cheerful, and friendly, taking direct inspiration from the 3D "chubby" aesthetic of the character mascot.

The visual style is **Tactile Modernism**. It blends clean, functional layouts with soft, "squishy" 3D-inspired elements. By using subtle gradients, inner glows, and soft shadows, the UI mimics the rounded, touchable quality of the mascot, making the digital ordering process feel as satisfying and physical as the food itself. This approach evokes an emotional response of hunger, comfort, and playfulness.

## Colors

The palette is driven by the psychological triggers of appetite and warmth. 

- **Primary (Chili Red):** A bold, high-energy red used for primary actions and highlights. It stimulates the appetite and mirrors the traditional aesthetic of the mascot’s attire.
- **Secondary (Golden Glaze):** A rich, warm gold used for secondary accents, reviews, and premium categories. It adds a touch of high-quality "gilded" appeal.
- **Tertiary (Fresh Bok Choy):** A deep, natural green extracted from the mascot's vegetables, used sparingly for "healthy" indicators or "added to cart" confirmations.
- **Neutral (Rice Steam):** A soft, warm off-white that prevents the high-contrast red from feeling too aggressive, providing a clean canvas for food photography.
- **Surface:** Backgrounds use a very light cream tint to maintain warmth compared to a clinical pure white.

## Typography

This design system utilizes **Plus Jakarta Sans** across all levels for its modern, friendly, and geometric proportions. The typeface’s open apertures and soft curves complement the "chubby" aesthetic of the brand.

Headlines are set with extra-bold weights and tight letter-spacing to create a sense of presence and impact, similar to bold food signage. Body text is kept clean and legible with generous line heights to ensure readability in dimly lit restaurant environments. A dedicated "price-display" style is used to ensure the cost of items is always the most prominent secondary information on a menu card.

## Layout & Spacing

The layout philosophy follows a **Fluid Content Model** optimized for mobile-first QR code scanning. 

- **Grid:** A 4-column fluid grid for mobile and a 12-column centered grid for tablets.
- **Rhythm:** An 8px baseline grid ensures vertical consistency. 
- **Safe Zones:** High-contrast bottom "Command Bars" are used for checkout and cart summaries, ensuring they are always within thumb-reach.
- **Reflow:** On wider screens (tablets), the menu categories and the cart summary reflow into a split-pane view to reduce vertical scrolling.

## Elevation & Depth

Visual hierarchy is achieved through **Soft Tonal Layering** and **Cloud Shadows**. Instead of harsh shadows, this design system uses wide-spread, low-opacity shadows tinted with the primary red or neutral brown tones.

1.  **Level 0 (Base):** The "Rice Steam" background.
2.  **Level 1 (Cards):** Menu items sit on cards with a subtle white-to-cream gradient and a soft 15% opacity shadow.
3.  **Level 2 (Interaction):** Active buttons and floating action buttons (FABs) use an inner glow (top-down light source) to create a "squishy" 3D effect, making them look like they can be physically pressed into the screen.
4.  **Level 3 (Overlays):** Modals for item customization use a 20px backdrop blur (Glassmorphism) to keep the restaurant atmosphere visible while focusing the user on their selection.

## Shapes

The shape language is defined by "Chubby Radius." Every corner is softened to remove any sense of sharpness or clinical precision. 

- **Containers:** Standard cards use a 1rem (16px) radius. 
- **Interactive Elements:** Buttons and input fields use a fully rounded "Pill" shape (32px+) to invite touch.
- **Image Containers:** Food photography is always presented in rounded-square or circular frames with a subtle 1px inner stroke to "contain" the vibrancy of the food images.

## Components

### Buttons
Primary buttons are high-gloss Chili Red with white text. They should feature a subtle "inflated" look using a slight top-edge highlight. Secondary buttons use the Golden Glaze with a transparent background and a bold border.

### Chips
Used for food categories (e.g., "Spicy," "Vegan," "Chef's Choice"). These are pill-shaped with background colors that match the ingredient's natural tone, using a 10% opacity tint of the primary or tertiary colors.

### Menu Cards
Cards feature a large, high-resolution food image on the left or top. The "Add" button is a floating "+" circle that overlaps the bottom-right corner of the image, appearing as if it's popping out of the card.

### Input Fields
Used for "Special Instructions" or "Table Number." These are soft-gray wells with a 16px radius. When focused, the border glows with the Secondary Gold color.

### Cart "Bubble"
A floating, high-elevation circular component that shows the current item count. It uses a pulsing animation when an item is first added to provide tactile feedback.