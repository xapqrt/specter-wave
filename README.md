# spectervise

spectervise is a chrome extension i made lel
it is more or less for the css guys

if you just want to inspect a page fast and find weird hidden UI, u can js spot it easily with this

# what it does

### 1) refactor-vision overlay
- press **cmd/ctrl + shift + s**
- applies this globally:
- '* {outline: 1px solid cyan !important;}'
- useful when spacing, overlap, and container boundaries are hard to see

### 2) ghost hunter 
- scans the dom for elements that look hidden but still occupy layout space.

flags style combos like:
'opacity: 0'
'visibility: hidden'
'display: none'(plus edge conditions from stable layout)

then it outline them in neon purple('#bc13fe') so you can spot ghost nodes instantly.

### 3) contrast sentry
run wcag luminace/contrast math against text-ish elements.

if ratio '<4.5', nodes is treated as fail and get a red dashed marker.

### 4) hud (top-right)
show a quick counter panel with:
run count
ghost count
contrast fail count
total flagged
last scan timing



## how to run locally

1. clone/open this repo
2. open 'chrome://extensions'
3. turn on **developer mode**
4. click **load unpacked**
5. select the respository folder
6. open any site and press **cmd/ctrl + shift + s** or just click on the extension




