# Product Photo Replacement & Site Knowledge - November 27, 2025

## Summary
Completed photo replacement for 4 renamed products on the Beyond RV website. This document contains all implementation details, site knowledge, product information, and technical learnings from the session.

---

## Completed Tasks ✅

### 1. Mercedes Sprinter 4.7m Motorhome (4.7m Truck Camper)
- **Page URL**: Not documented (user provided HTML directly)
- **Photos**: 13 photos in specific order
- **URL Pattern**: `https://beyondrv.com.au/wp-content/uploads/2025/11/4.7m-Truck-Camper-XX.jpg`
- **Photos Used**: 17, 03, 01, 14, 16, 02, 11, 07, 12, 13, 06, 08, 18
- **Price**: $240,000
- **Status**: ✅ Complete

### 2. Beyond RV 2300 Advent Series
- **Status**: ✅ Already completed by user
- **Notes**: User confirmed "that is done" when this product was mentioned

### 3. 3.5m Truck Camper w/ Cabover
- **Page URL**: Not documented
- **Photos**: 15 photos (initially attempted 22, but only 15 existed in WordPress)
- **URL Pattern**: `https://beyondrv.com.au/wp-content/uploads/2025/11/truck-3.5m-box-XX-scaled.jpg`
- **Photos Available**: 01, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 16, 20, 22, 25
- **Photos Missing**: 02, 03, 04, 15, 17, 18, 19, 21
- **Price**: $66,800
- **Specifications**:
  - 3500 x 2100mm base
  - North/South queen bed over cabover
  - U-shaped club lounge
  - 300ah lithium battery
  - Ready for immediate delivery
- **Status**: ✅ Complete

### 4. Beyond RV Sunpatch 15-XC
- **Page URL**: `https://beyondrv.com.au/sunpatch-15xc-couples-offroad-van/`
- **Photos**: 24 photos
- **URL Pattern**: `https://beyondrv.com.au/wp-content/uploads/2025/11/sunpatch-15xc-XX-scaled.jpg`
- **Photos Used**: 01 through 24 (sequential)
- **Price**: $78,999
- **Specifications**:
  - 15 feet (4.5m) hardtop
  - Couples offroad caravan
  - Full composite construction
  - Queen bed with innerspring mattress
  - Full ensuite with separate shower
  - 300ah lithium battery system
  - 120L fresh water capacity
  - Full kitchen with gas cooktop
  - 400W solar panel system
  - Heavy-duty offroad chassis
  - Independent coil suspension
  - Ready for immediate delivery
- **Status**: ✅ Complete - User updated carousel after code provided

---

## Beyond RV Website Knowledge

### Site Structure

**Main Website**: `https://beyondrv.com.au/`

**Key Pages**:
- **Homepage**: Main landing page with clearance sale banner
- **Sales Page**: `/on-sale` - Inventory page with promotional banner
- **Inquiry Form**: `/inquiry-form/` - Contact form for product inquiries
- **Navigation**: Dropdown menu system with "Our Caravans" category

### Product Categories

**1. Slide-on Campers (Advent Series)**
- Advent 2150 Hardtop Slide-on - $75,000
  - 2150mm base
  - TARE: ~700kg
  - Full composite construction
  - 200ah lithium batteries
  - Ready for immediate delivery

- Advent 2450 Hardtop Slide-on - $75,000
  - 2450mm base
  - TARE: ~800-850kg
  - Full composite construction
  - 200ah lithium batteries
  - Currently in Melbourne
  - Badge: "IN MELBOURNE"

**2. Truck Campers**
- 3.5m Poptop Truck Camper - $68,000
  - Combined shower/toilet
  - Queen bed with innerspring mattress
  - 200ah lithium battery
  - Electric poptop roof
  - Ready for immediate delivery

- 3.5m Truck Camper w/ Cabover - $66,800
  - 3500 x 2100mm base
  - North/South queen bed over cabover
  - U-shaped club lounge
  - 300ah lithium battery
  - Ready for immediate delivery

- 4.6m Poptop Truck Camper - $68,000
  - 4600 x 2200mm
  - 2x north/south single beds
  - Electric poptop roof
  - U-shape club lounge
  - Unique one-off build
  - Badge: "ONE OFF SPECIAL"

- 4.7m Truck Camper (Mercedes Sprinter Motorhome) - $240,000
  - 2022 Mercedes-Benz Sprinter
  - Complete turnkey motorhome
  - 4.7m camper body
  - All wheel drive
  - Ready to drive away

**3. Caravans**
- Sunpatch 12C Couples Caravan - $38,500
  - 12ft couples hardtop
  - 5550 x 2050 x 2750mm
  - TARE: 2000kg
  - Ensuite bathroom
  - Multiple units available
  - Badge: "2 UNITS AVAILABLE"

- Sunpatch 15-XC Hardtop Couples Offroad Van - $78,999
  - 15 feet (4.5m) hardtop
  - Full composite construction
  - 300ah lithium battery system
  - 400W solar panel system
  - Independent coil suspension
  - Status: "Coming Soon" (as of Nov 27)

### Brand Colors & Design System

**Primary Colors**:
- Orange: `#FF6B35` (primary brand color, used for CTAs and highlights)
- Red: `#E31E24` (secondary CTA color for urgent actions)
- Black: `#000000` (backgrounds, text, hover states)
- White: `#ffffff` (text on dark backgrounds)

**Secondary Colors**:
- Light Gray: `#f9f9f9` (section backgrounds)
- Medium Gray: `#666666` (body text)
- Dark Gray: `#333333` (headings)
- Border Gray: `#e0e0e0` (borders, dividers)

**Typography**:
- Font Family: Arial, sans-serif
- Hero Headings: 48px (32px mobile)
- Section Headings: 32px
- Body Text: 16px
- Small Text: 14px

**Button Styling**:
- Border Radius: 50px (pill shape)
- Padding: 18px 45px (desktop), 8px 20px (mobile)
- Hover Effect: Background swap with color, scale(1.05) transform
- Box Shadow: 0 4px 15px rgba(0,0,0,0.3)

**Responsive Breakpoints**:
- Mobile: `max-width: 768px`
- Tablet: `max-width: 992px`

### WordPress Implementation Patterns

**Photo Upload Naming Convention**:
- WordPress adds `-scaled.jpg` suffix to large images
- Numbering may not be sequential after upload
- Always verify actual Media Library URLs before generating code
- Example: `truck-3.5m-box-01-scaled.jpg`

**Media Upload Path**:
- Base URL: `https://beyondrv.com.au/wp-content/uploads/`
- Current uploads: `/2025/11/` directory
- Full path example: `https://beyondrv.com.au/wp-content/uploads/2025/11/filename.jpg`

**Page Editing Process**:
1. Log into WordPress admin panel
2. Navigate to Pages → Find the page → Click "Edit"
3. Switch to Code/HTML editor (Gutenberg: three dots → "Code editor")
4. Paste/replace HTML code
5. Click "Update" or "Publish"
6. Test on desktop and mobile

---

## Product Page Code Structure

### Standard Product Page Pattern

Every product page follows this structure:

**1. Styles Section** (`<style>`)
- Hero section styling
- Gallery section with main image and thumbnails
- Specifications grid
- Contact section
- Lightbox modal
- Mobile responsive breakpoints

**2. Hero Section**
- Full-width banner image with product name and price overlay
- Positioned absolutely at bottom-left
- Mobile responsive sizing

**3. Photo Gallery Section**
- Main clickable image (opens lightbox)
- Thumbnail grid (responsive: 3 columns mobile, auto-fill desktop)
- Active state highlighting on selected thumbnail
- Click to change main image

**4. Specifications Section**
- Grid layout (1 column mobile, auto-fit desktop)
- Spec cards with title and description
- Light background (#f9f9f9)

**5. Contact Section**
- Dark background (#1a1a1a)
- CTA button linking to `/inquiry-form/`
- Phone link `tel:0430863819`
- Orange button with hover effects

**6. Lightbox Modal**
- Full-screen overlay
- Image navigation (prev/next buttons)
- Keyboard support (arrow keys, ESC to close)
- Click outside to close

**7. JavaScript Functionality**
```javascript
- changeImage(index) - Switch main image and update active thumbnail
- openLightbox(index) - Open lightbox at specific image
- closeLightbox(event) - Close lightbox modal
- navigateLightbox(direction, event) - Navigate between images
- Keyboard event listener for arrow keys and ESC
```

### Image Array Pattern
```javascript
const images = [
  'https://beyondrv.com.au/wp-content/uploads/2025/11/product-name-01-scaled.jpg',
  'https://beyondrv.com.au/wp-content/uploads/2025/11/product-name-02-scaled.jpg',
  // ... more images
];
```

---

## Technical Learnings & Best Practices

### WordPress Photo Management

**Lesson 1: Always Verify Media Library URLs**
- Don't assume sequential numbering (photos 01-22 doesn't mean all exist)
- WordPress may skip numbers during upload
- User should provide actual Media Library screenshot or listing
- Example: Expected 22 photos, only 15 actually existed (missing 02, 03, 04, 15, 17, 18, 19, 21)

**Lesson 2: URL Pattern Recognition**
- Different products use different naming patterns:
  - `4.7m-Truck-Camper-XX.jpg` (no -scaled suffix)
  - `truck-3.5m-box-XX-scaled.jpg` (with -scaled suffix)
  - `sunpatch-15xc-XX-scaled.jpg` (lowercase, no spaces)
- Check existing uploads to determine pattern

**Lesson 3: File Organization**
- Local folders may contain more photos than uploaded to WordPress
- Local folder: "Beyond RV Sunpatch 15-XC" (24 photos)
- Separate folder: "15-XC" (30 photos)
- Confirm which folder and how many photos to use

### Code Delivery Standards

**User Requirement**: "Give me the full code always"
- Never provide partial code snippets
- Always include complete HTML structure:
  - Full `<style>` section
  - All HTML markup
  - Complete `<script>` section
- User wants ready-to-paste code blocks

### Responsive Design Patterns

**Mobile Optimization**:
- Hero text sizing: 48px → 32px
- Hero height: 600px → 400px
- Thumbnail grid: auto-fill → 3 columns → 1 column
- Button text: 20px → 11px
- Lightbox controls: 48px → 32px

**Image Handling**:
- Use `object-fit: cover` for consistent sizing
- Set explicit heights for thumbnails (120px desktop, 80px mobile)
- Main image: width 100%, height auto for responsive scaling

### Performance Considerations

**Image Optimization**:
- Large images (>1MB) cause slow loading
- Smush plugin installed for automatic compression
- Ideal image size: <500KB
- User encountered 1.3MB banner causing performance issues

**Loading Strategy**:
- All images load at once (no lazy loading implemented)
- Consider lazy loading for galleries with 20+ photos
- Thumbnails use same URLs as full images (no separate thumbnail files)

---

## Inventory Summary

### Current Available Stock (as of Nov 27, 2025)

| Product | Category | Price | Status |
|---------|----------|-------|--------|
| Advent 2150 Hardtop Slide-on | Slide-on Camper | $75,000 | Available |
| Advent 2450 Hardtop Slide-on | Slide-on Camper | $75,000 | In Melbourne |
| 3.5m Poptop Truck Camper | Truck Camper | $68,000 | Available |
| 3.5m Truck Camper w/ Cabover | Truck Camper | $66,800 | Available |
| 4.6m Poptop Truck Camper | Truck Camper | $68,000 | One-off Special |
| Mercedes Sprinter 4.7m | Motorhome | $240,000 | Available |
| Sunpatch 12C Couples Caravan | Caravan | $38,500 | 2 units available |
| Sunpatch 15-XC | Caravan | $78,999 | Coming Soon |

**Price Range**: $38,500 - $240,000
**Total Units**: 8 different models
**Special Offers**: Clearance sale ongoing (see banners)

---

## Banner Implementation Reference

### Homepage Banner
- **Desktop**: `Clearance-Sale.png`
- **Mobile**: `Chiristmas-stock.png` (note: typo in filename)
- **Button**: Orange "VIEW AVAILABLE STOCK" → `/on-sale`
- **Button Position**: Desktop: bottom 18%, Mobile: bottom 5%

### Sales Page Banner
- **Desktop**: `15-Feet-Sunpatch-Hybrid.png`
- **Mobile**: `78-999.png`
- **Button**: Red "CONTACT US NOW FOR THIS AMAZING DEAL" → `/inquiry-form/`
- **Button Position**: Desktop: bottom 5% / left 35%, Mobile: bottom 20% / left 50%

**Responsive Method**: `<picture>` element with `<source media="(max-width: 768px)">`

---

## Contact Information

- **Phone**: 0430 863 819
- **Website**: https://beyondrv.com.au
- **Sales Page**: https://beyondrv.com.au/on-sale
- **Inquiry Form**: https://beyondrv.com.au/inquiry-form/

---

## Project File Structure

```
/Users/thabonel/Code/Byond_RV/
├── docs/
│   ├── clearance-sale-banner-implementation.md
│   ├── product-photo-replacement-session.md (this file)
│   ├── inventory-light-theme.html
│   └── inventory-dark-theme.html
├── Beyond RV Sunpatch 15-XC/ (24 photos: 01-24)
├── 15-XC/ (30 photos: 01-30)
├── 4.7m Truck Camper/ (19 photos)
├── 3.5m Truck Camper w- Cabover/ (22 photos locally, 15 in WordPress)
├── Beyond RV 2300 Advent Series/ (17 photos)
└── [other product folders...]
```

---

## Common Issues & Solutions

### Issue 1: Missing Photos in WordPress
**Problem**: Generated code for all photos in local folder, but some don't exist in WordPress
**Solution**: Request Media Library screenshot/listing from user, regenerate code with only available photos
**Example**: 3.5m Cabover - expected 22, only 15 existed

### Issue 2: URL Pattern Uncertainty
**Problem**: Different products use different URL naming conventions
**Solution**: Check local folder filenames for pattern, verify with user-provided URLs
**Example**: Some use `-scaled.jpg`, others don't; some use spaces, others use hyphens

### Issue 3: Incomplete Code Requests
**Problem**: Initially provided partial code sections
**Solution**: User requires "full code always" - complete HTML with styles, markup, and scripts
**Learning**: Never provide snippets, always complete ready-to-paste blocks

### Issue 4: Photo Order Specification
**Problem**: Which photos to use and in what order
**Solution**: User provides specific photo list when order matters (e.g., 4.7m Truck Camper: 17, 03, 01, 14...)
**Alternative**: Use sequential numbering when user says "use all photos"

---

## WordPress Plugins Used

### Smush Image Optimizer
- **Purpose**: Automatic image compression
- **Installation Date**: During this project (Nov 26-27)
- **Reason**: Site performance issues with 1.3MB+ images
- **Benefit**: Reduces file sizes without manual compression

### Page Editor
- **Type**: Gutenberg block editor with HTML/Code mode
- **Usage**: Switch to "Code editor" via three dots menu
- **Note**: Paste full HTML blocks directly into code editor

---

## Key Technical Specifications

### Typical Product Features

**Power Systems**:
- Lithium batteries: 200ah (smaller units) to 300ah (larger units)
- Solar panels: 400W system (higher-end models)

**Construction**:
- Full composite construction (premium models)
- Standard construction (entry-level models)

**Sleeping**:
- Queen beds with innerspring mattresses (most models)
- Single beds (4.6m Poptop - 2x singles)
- North/South orientation (cabover models)

**Bathrooms**:
- Full ensuite with separate shower (larger caravans)
- Combined shower/toilet (smaller campers)

**Kitchens**:
- Gas cooktop (standard)
- Full kitchen facilities

**Chassis & Suspension**:
- Heavy-duty offroad chassis
- Independent coil suspension (offroad models)

**Water**:
- 120L fresh water capacity (typical)

**Dimensions**:
- Compact: 2150mm - 3500mm base
- Mid-size: 4600mm - 4700mm
- Large: 5550mm (12ft caravans)

**Weight (TARE)**:
- Slide-ons: 700kg - 850kg
- Caravans: 2000kg

---

## Naming Conventions & Product Taxonomy

### Product Naming Pattern
- **Format**: `[Brand] [Model] [Size] [Type] [Special Features]`
- **Examples**:
  - "Beyond RV Sunpatch 15-XC" = Brand + Model + Size + Series
  - "3.5m Truck Camper w/ Cabover" = Size + Type + Feature
  - "Advent 2150 Hardtop Slide-on" = Model + Size + Type

### Common Terms
- **Hardtop**: Fixed roof (not pop-top)
- **Poptop**: Roof that raises for standing room
- **Slide-on**: Camper that slides onto truck tray
- **Cabover**: Extends over truck cabin for extra space
- **Couples**: Designed for 2 people
- **Offroad**: Reinforced for rough terrain
- **Hybrid**: Combination of features/technologies

---

## Session Timeline

1. **Start**: Continued from previous session on photo replacement task
2. **Product 1**: Completed 4.7m Truck Camper with 13 specific photos
3. **Product 2**: User confirmed Beyond RV 2300 Advent already done
4. **Product 3**: Completed 3.5m Truck Camper w/ Cabover
   - Initial attempt: 22 photos (some broken)
   - User provided Media Library listing
   - Final: 15 working photos
5. **Product 4**: Completed Beyond RV Sunpatch 15-XC
   - 24 photos sequential
   - Found page URL: `/sunpatch-15xc-couples-offroad-van/`
   - User updated carousel after receiving code
6. **Documentation**: Created this comprehensive session document

---

## Future Maintenance Notes

### Updating Product Photos
1. Upload photos to WordPress Media Library first
2. Note exact filenames (WordPress may modify them)
3. Verify all photos uploaded successfully
4. Update product page code with actual URLs
5. Test on desktop and mobile before publishing

### Adding New Products
1. Follow established product page pattern (see code structure above)
2. Use brand colors: Orange #FF6B35 for CTAs
3. Maintain responsive breakpoint at 768px
4. Include all standard sections: hero, gallery, specs, contact, lightbox
5. Test lightbox keyboard navigation
6. Verify phone link works: `tel:0430863819`

### Performance Optimization
1. Keep images under 500KB when possible
2. Use Smush plugin for automatic compression
3. Consider lazy loading for galleries with 20+ photos
4. Test page load speed after updates
5. Clear WordPress cache after major changes

---

## Site Knowledge Summary

### Beyond RV Business Model
- **Focus**: Custom-built RV solutions
- **Range**: $38K - $240K price points
- **Specialties**:
  - Slide-on truck campers
  - Offroad caravans
  - Custom motorhome conversions
  - Lightweight composite construction

### Customer Journey
1. **Discovery**: Homepage with clearance sale banner
2. **Browse**: Sales page (`/on-sale`) with inventory
3. **Learn**: Individual product pages with galleries and specs
4. **Contact**: Inquiry form (`/inquiry-form/`) or phone (0430 863 819)

### Unique Selling Points
- Full composite construction (lightweight, durable)
- Lithium battery systems (modern, efficient)
- Ready for immediate delivery (several models in stock)
- Custom builds available (one-off specials)
- Offroad capability (independent suspension, heavy-duty chassis)

---

*Document created: November 27, 2025*
*Session: Product Photo Replacement*
*Total Products Updated: 4*
*Total Photos Replaced: 13 + 15 + 24 = 52 photos*
