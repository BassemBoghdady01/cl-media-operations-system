# Brand assets

Save the official EZ logo artwork (the square black-glass "EZ" poster) in this
folder as:

    ez-logo.png

That single file drives the logo **everywhere**: sidebar, client portal
header, landing page (nav + footer), login, signup, the apple-touch icon and
the social-share (og:image) preview. Small tiles automatically crop-zoom onto
the wordmark (`src/components/brand/BrandLogo.tsx`).

Until the file exists, a monochrome "EZ" fallback tile in the same visual
language is rendered — nothing breaks, but drop the real PNG here for the
actual artwork.

The favicon (`public/ez-icon.svg`) is a hand-built monochrome SVG match of
the same mark, kept as SVG so it stays crisp at 16 px.

Note: the artwork's tagline reads "HANDELED" — if you re-export it, the
correct spelling is "HANDLED".
