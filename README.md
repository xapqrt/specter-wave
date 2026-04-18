# SpecterVise 

**SpecterVise** is a lightweight, zero-dependency Chrome extension tailored for developers, designers, and QA engineers who need to forensically audit layouts and visual accessibility bugs in real-time.

It tracks bounding box discrepancies, hidden geometry, and contrast failures mathematically down to the hex code instantly on any page without breaking a sweat.

##  Features

### 1. Refactor-Vision
Struggling with CSS Grid or fighting margin overlaps? Refactor-vision injects a 1px solid cyan boundary around every single visible node in the DOM. This gives you X-ray vision across the entire structured layout.

### 2. Ghost Hunter
"Ghost" geometry happens when you hide an element using methods like opacity: 0, visibility: hidden or display: none but forget they're still bloating your DOM and intercepting clicks. SpecterVise seeks out these invisible components and paints a bright, neon purple overlay exactly where they are floating.

### 3. Contrast Sentry
Never push unreadable text to production again. SpecterVise dynamically traces the foreground color against the computed background layer stack, resolving alpha blends to calculate the exact WCAG contrast luminance ratio. Anything dipping below 4.5 is flagged locally to you with a red dashed underline!

---

##  How to Use

1. Load unpacked extension via chrome://extensions/
2. Open any webpage
3. Hit Ctrl + Shift + S or click the extension Action in your toolbar.
4. An overlay **HUD** will spawn detailing exact numeric violations found.
5. Hit the shortcut again to disable effortlessly without reloading the page.
