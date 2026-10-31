TJ WikkiD Urban Legend - Browser version (PC Beta v2.2)
(c) 2026 T.J. WikkiD. All rights reserved. Game design and concept by A. Edwards.

The PC version for desktop browsers, phones and tablets: the same game, HD art, story, modes, unlocks and album, with keyboard,
on-screen soft keys or a Bluetooth/USB controller.

PLAY
  Open the game's web address in Chrome (Android) or Safari (iPhone/iPad) and turn the phone sideways.
  Tap PRESS START. Sound starts with that tap.

INSTALL ON THE HOME SCREEN
  This folder is a complete web app. Put it on any https web host (GitHub Pages, Netlify, itch.io as an
  HTML game, your own site), open index.html on the phone, then:
    Android (Chrome): menu > Add to Home screen / Install app
    iPhone (Safari):  Share > Add to Home Screen
  It then opens full screen like an app. The game core and the art you've seen work offline; music streams.
  Saves stay on the phone.

CONTROLS
  Touch: drag anywhere on the left side for the stick (double-tap a direction to run).
         PUNCH, KICK, JUMP, RAGE on the right. II (top right) pauses, the arrow (top left) goes back.
         A finger can slide from one button to the next. The phone's own Back gesture also goes back.
  Controller: stick or d-pad to move, X punch, B kick, A jump, Y/RB/RT rage, Menu pauses, View goes back.
         Using a controller hides the touch buttons; touch the screen to bring them back.
         Two controllers: player 2 presses Start to join, and Fighter Mode is 2 players.
  Options > CONTROLS shows this in the game.

OPTIONS
  VIEW: HD is the widescreen look; Old School is the pixel-art CRT look (as on PC).
  Everything else matches the PC version, including hidden modes and the Urban Legend album unlock.

BETA v2.2 PERFORMANCE AND HOSTING
  Built from the same PC game sources as Windows v2.2. All 52 enemy/boss poses
  remain. Browser HD uses the existing 2x assets; Windows keeps its native 4x art.
  Lossless atlas packing removes unused padding, retaining exact browser pixels.
  Canvas backing size is bounded to 1920x1080 on desktop and 1280x720 on touch
  devices, with linear HD filtering and nearest filtering in Old School.
  Animation cache: 192 MiB desktop / 96 MiB touch; tint cache: 32 / 16 MiB.
  These are individual cache limits, not a total browser-memory guarantee.
  The game runs its unchanged 60 Hz simulation and skips duplicate display
  draws between ticks. Static background blur is cached once per picture.

  Upload ALL files/folders together to an HTTPS static host. index.html must
  be at the web root (or the root of the game's subfolder). The standalone
  Web Beta ZIP is prepared with index.html at ZIP root for HTML-game hosts.
  A GitHub archive adds an outer folder: extract it before hosting, or re-ZIP
  its contents for itch.io. A GitHub code/download URL does not host the game.
  Do not double-click index.html using file://. For a desktop local preview:
      python -m http.server 8000
  Run inside this folder, then open http://localhost:8000 in a browser.
  Phones need an accessible HTTPS host for full install/offline features.
  Saves remain in this browser and origin; changing host does not move saves.
  Chromium desktop and emulated touch/controller checks passed. Actual phones,
  Safari and physical GPU performance remain to be tested; 60+ FPS is a target,
  not a hardware certification. Keep browser hardware acceleration enabled.

Build source commit: b6585d392709f98764efa868e5a41cb498bfcfb2
Physical phone/GPU acceptance remains pending.
