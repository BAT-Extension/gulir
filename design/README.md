# Gulir identity

An open G becomes a downward scroll arrow: one page, one image. Teal (#007D75) matches the extension UI; white keeps the G readable and lime (#BFFF75) emphasizes the direction. The rounded tile has transparent outer corners.

Master: `extension/icons/gulir.svg`. Chrome uses the PNG assets at16,32,48 and128px;512px is available for future store artwork. No external fonts or image dependencies.

Render with `NODE_PATH=<existing Playwright installation> node scripts/render-icons.cjs`. The script uses an isolated headless Chromium process, never a personal browser profile.
