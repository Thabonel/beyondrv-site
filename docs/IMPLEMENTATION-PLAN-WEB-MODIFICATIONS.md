# Beyond RV Website Modifications - Implementation Plan
**Date:** December 1, 2025
**Based on:** WEB MODIFICATIONS 17.11.25 (3).docx

---

## PHASE 1: PAGE REMOVALS & TITLE CHANGES

### Task 1.1: Remove Pages Completely
**Pages to delete:**
- [ ] Sunpatch 17 Family van
- [ ] Sunpatch 15PF Offroad poptop van

**Action:**
1. WordPress Admin → Pages → Find each page
2. Move to Trash (or delete permanently)
3. Remove from any menus if present
4. Check for broken links sitewide

---

### Task 1.2: Update Page Title
**Current:** Sunpatch 12ft family/couple off road van
**New:** Sunpatch 12ft couples off road van

**Action:**
1. WordPress Admin → Pages → Find page
2. Edit page title
3. Update URL slug if needed (e.g., `sunpatch-12ft-couples-offroad-van`)
4. Update menu label to match

---

## PHASE 2: NAVIGATION MENU RESTRUCTURE

### Task 2.1: Remove "Our Range" Parent Menu
**Current structure:**
```
Our Range
  ├─ Our Caravans
  └─ Our Slide Ons
```

**New structure:**
```
Our Caravans (dropdown)
Our Slide Ons (dropdown)
```

**Action:**
1. WordPress Admin → Appearance → Menus
2. Remove "Our Range" parent item
3. Move "Our Caravans" and "Our Slide Ons" to top level
4. Ensure both have dropdown functionality

---

### Task 2.2: Configure "Our Slide Ons" Dropdown
**Items (5 total):**
1. Advent 2150 Hardtop Camper
2. Advent 2300 Hardtop Camper
3. Advent 2450 Hardtop Camper
4. 7ft Electric Poptop Camper
5. 4.7m Hardtop Truck Camper

**Action:**
1. Create pages for any missing items:
   - Advent 2300 Hardtop Camper (if doesn't exist)
   - 7ft Electric Poptop Camper (if doesn't exist)
2. Add all 5 items as sub-items under "Our Slide Ons"
3. Arrange in order above
4. Test dropdown functionality

**Status Check:**
- [ ] Advent 2150 page exists
- [ ] Advent 2300 page exists/created
- [ ] Advent 2450 page exists
- [ ] 7ft Electric Poptop page exists/created
- [ ] 4.7m Hardtop Truck Camper page exists

---

### Task 2.3: Configure "Our Caravans" Dropdown
**Items (5 total):**
1. Sunpatch 15F Family Offroad Van
2. Sunpatch 15PF Family Poptop Offroad Van
3. Sunpatch 15-XC Hardtop Couples Offroad Van
4. Sunpatch 19-XC Hardtop Couples Offroad Van – **Coming soon**
5. Sunpatch 21-XF Hardtop Family Offroad Van – **Coming soon**

**Action:**
1. Create pages for new models:
   - Sunpatch 19-XC (placeholder with "Coming Soon")
   - Sunpatch 21-XF (placeholder with "Coming Soon")
2. Add all 5 items as sub-items under "Our Caravans"
3. Add "Coming Soon" badge/text to items 4 & 5
4. Create spec pages using same format as existing pages
5. Wait for resources (photos & spec sheets) from client

**Status Check:**
- [ ] Sunpatch 15F page exists
- [ ] Sunpatch 15PF page exists/created
- [ ] Sunpatch 15-XC page exists
- [ ] Sunpatch 19-XC placeholder created
- [ ] Sunpatch 21-XF placeholder created

**Note:** Spec pages will match old style format. Resources needed from client.

---

### Task 2.4: Move Nav Items to Footer
**Items to move:**
- About Us
- Warranty

**Action:**
1. WordPress Admin → Appearance → Menus
2. Remove "About Us" and "Warranty" from main navigation
3. Add both items to footer menu
4. Test footer links work correctly

---

## PHASE 3: CREATE "ON SALE" PAGE

### Task 3.1: Create On Sale Page Structure
**Requirements:**
- New navigation item: "On Sale"
- Grid layout for displaying stock
- Filter system at top

**Action:**
1. Create new page: "On Sale"
2. Add to main navigation menu
3. Design grid layout (similar to current specials page)
4. Implement filter functionality

---

### Task 3.2: Build Filter System
**Filter options:**
- Price (ascending vs descending)
- Date
- Type (caravan, slide on, truck slide on, motorhome)

**Action:**
1. Add filter dropdown/buttons at top of page
2. Implement JavaScript sorting functionality
3. Test all filter combinations
4. Ensure mobile responsive

---

### Task 3.3: Create Grid Display
**Grid format:**
- Product image
- Product title
- Price
- Key specs
- "View Details" button

**Action:**
1. Use existing inventory grid HTML as template
2. Adapt CSS for "On Sale" page styling
3. Make cards clickable to individual product pages
4. Ensure responsive on mobile/tablet

**Reference:** See `/docs/HTML/specials-page-inventory.html` for existing grid code

---

### Task 3.4: Create Individual Product Detail Template
**When clicking product in grid, should display:**
- Full photo gallery
- Complete specifications
- Price
- Contact/inquiry button
- Stock status

**Action:**
1. Create product detail page template
2. Use same format as existing product pages
3. Wait for resources from client (images, spec sheets, pricing)

**Note:** All resources to be provided by client upon request or framework completion.

---

## PHASE 4: FIX 4.7M TRUCK CAMPER FORMATTING

### Task 4.1: Update 4.7m Truck Camper Page Layout
**Issue:** Current formatting doesn't match other specification pages

**Action:**
1. Review existing specification pages for standard format
2. Audit 4.7m Truck Camper page
3. Identify formatting differences:
   - Photo gallery layout
   - Specs section structure
   - Typography/spacing
   - Overall page structure
4. Update 4.7m page to match standard template
5. Test on desktop, tablet, mobile

**Reference standard pages:**
- Advent 2150
- Advent 2450
- Sunpatch 15-XC

---

## PHASE 5: PRICE UPDATES

### Task 5.1: Update Product Prices
**Price changes:**

| Product | Current Price | New Price |
|---------|--------------|-----------|
| 4.7m Truck Camper | Unknown | **$98,000** |
| Sunpatch 15F | Unknown | **$41,500** |

**Action:**
1. WordPress Admin → Pages → 4.7m Truck Camper page
2. Find price display element (Hero section or price block)
3. Update to $98,000
4. Save and verify on live page

5. WordPress Admin → Pages → Sunpatch 15F page
6. Find price display element
7. Update to $41,500
8. Save and verify on live page

**Also update prices in:**
- [ ] On Sale page (if these products listed)
- [ ] Any promotional banners
- [ ] Inventory grids

---

## PRIORITY ORDER

### HIGH PRIORITY (Week 1)
1. ✅ Remove unwanted pages (Sunpatch 17, 15PF)
2. ✅ Update page title (Sunpatch 12ft)
3. ✅ Restructure navigation menu
4. ✅ Move About Us/Warranty to footer
5. ✅ Update prices (4.7m, Sunpatch 15F)

### MEDIUM PRIORITY (Week 2)
6. ⚠️ Create missing product pages (Advent 2300, 7ft Poptop)
7. ⚠️ Create coming soon pages (19-XC, 21-XF)
8. ⚠️ Fix 4.7m Truck Camper formatting
9. ⚠️ Create On Sale page structure

### LOW PRIORITY (Week 3)
10. ⏳ Build filter system for On Sale page
11. ⏳ Wait for client resources (photos, specs)
12. ⏳ Populate new pages with content
13. ⏳ Full site testing

---

## RESOURCES NEEDED FROM CLIENT

### Immediate Need:
- [ ] Photos for Advent 2300 Hardtop Camper
- [ ] Spec sheet for Advent 2300
- [ ] Photos for 7ft Electric Poptop Camper
- [ ] Spec sheet for 7ft Electric Poptop
- [ ] Confirmation on Sunpatch 15PF (create new or rename existing?)

### Future Need (Coming Soon pages):
- [ ] Photos for Sunpatch 19-XC
- [ ] Spec sheet for Sunpatch 19-XC
- [ ] Pricing for Sunpatch 19-XC
- [ ] Photos for Sunpatch 21-XF
- [ ] Spec sheet for Sunpatch 21-XF
- [ ] Pricing for Sunpatch 21-XF

### On Sale Page Content:
- [ ] Current stock inventory list
- [ ] Photos for each stock item
- [ ] Specs for each stock item
- [ ] Pricing for each stock item
- [ ] Stock status (in stock, arriving soon, etc.)

---

## QUESTIONS FOR CLIENT

1. **Sunpatch 15PF:** You're removing "Sunpatch 15PF Offroad poptop van" but also adding "Sunpatch 15PF Family Poptop Offroad Van" to Our Caravans menu. Are these:
   - The same page (just rename)?
   - Different pages (create new one)?

2. **Advent 2300:** Does this page already exist or is it new?

3. **7ft Electric Poptop:** Is this a new product or existing page that needs renaming?

4. **On Sale Page:** Should this replace the current Specials page or be separate?

5. **Coming Soon badges:** How do you want "Coming Soon" displayed?
   - Orange badge like "IN MELBOURNE"?
   - Gray badge?
   - Text only?

6. **Filter system:** Do you want advanced filters (price range slider, checkboxes) or simple dropdowns?

---

## TECHNICAL NOTES

### Navigation Menu
- Ensure dropdown menus work on mobile (hamburger menu)
- Test on all browsers (Chrome, Safari, Firefox, Edge)
- Verify hover states work properly

### On Sale Page
- Use flexbox/grid for responsive layout
- Implement JavaScript for client-side filtering (fast)
- Consider pagination if more than 20 items

### Coming Soon Pages
- Create basic placeholder template
- Add "Coming Soon" hero banner
- Include inquiry form for interest
- Show limited specs/teaser info if available

### URL Structure
Keep consistent naming:
- `/advent-2150-hardtop-camper/`
- `/advent-2300-hardtop-camper/`
- `/sunpatch-19xc-couples-offroad-van/`
- `/on-sale/`

---

## TESTING CHECKLIST

### After Navigation Changes:
- [ ] All dropdown menus work on desktop
- [ ] All dropdown menus work on mobile
- [ ] Footer links work correctly
- [ ] No broken links in navigation
- [ ] Menu matches design mockup

### After Page Creation:
- [ ] All new pages load correctly
- [ ] All photos display properly
- [ ] Specs format matches existing pages
- [ ] Prices display correctly
- [ ] Contact buttons work

### After On Sale Page:
- [ ] Grid displays correctly on desktop
- [ ] Grid displays correctly on tablet
- [ ] Grid displays correctly on mobile
- [ ] All filters work correctly
- [ ] Products link to correct pages
- [ ] Images load quickly

### Before Launch:
- [ ] Full site crawl (no 404 errors)
- [ ] All forms tested
- [ ] All CTAs work
- [ ] Mobile responsive test
- [ ] Speed test (Google PageSpeed)
- [ ] Browser compatibility check

---

## BACKUP & SAFETY

### Before Making Changes:
1. Full WordPress backup (UpdraftPlus)
2. Database export
3. Take screenshots of current navigation
4. Document current page structure

### Staging Environment:
- Use SiteGround staging site for all changes
- Test thoroughly before pushing to live
- Get client approval on staging

---

## TIMELINE ESTIMATE

**Assuming resources are ready:**

| Phase | Tasks | Estimated Time |
|-------|-------|---------------|
| Phase 1 | Deletions & Title Changes | 1 hour |
| Phase 2 | Navigation Restructure | 3-4 hours |
| Phase 3 | On Sale Page | 8-10 hours |
| Phase 4 | 4.7m Formatting Fix | 2-3 hours |
| Phase 5 | Price Updates | 1 hour |
| **Testing** | Full site QA | 4-5 hours |
| **Total** | | **19-24 hours** |

**Additional time needed:**
- Creating content for new pages: +6-8 hours (per page)
- Waiting for client resources: Variable
- Client feedback rounds: +2-4 hours

**Realistic completion:** 2-3 weeks with client collaboration

---

## COMPLETION CHECKLIST

### Phase 1: ✅ Complete
- [ ] Sunpatch 17 removed
- [ ] Sunpatch 15PF removed
- [ ] Sunpatch 12ft title updated

### Phase 2: ✅ Complete
- [ ] Navigation restructured
- [ ] Our Slide Ons dropdown configured (5 items)
- [ ] Our Caravans dropdown configured (5 items)
- [ ] About Us moved to footer
- [ ] Warranty moved to footer

### Phase 3: ✅ Complete
- [ ] On Sale page created
- [ ] Filter system implemented
- [ ] Grid display built
- [ ] Product detail template created

### Phase 4: ✅ Complete
- [ ] 4.7m Truck Camper formatting fixed

### Phase 5: ✅ Complete
- [ ] 4.7m Truck Camper price updated to $98,000
- [ ] Sunpatch 15F price updated to $41,500

### Final: ✅ Launch
- [ ] All testing complete
- [ ] Client approval received
- [ ] Staged to live site
- [ ] Post-launch monitoring

---

**End of Implementation Plan**
