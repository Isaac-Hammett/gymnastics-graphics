# Future Feature: Competition Templates

**Status:** Pinned for future development (not started)
**Date noted:** 2026-03-06

## Concept

There are two distinct concepts that should be separated:

### Meet Theme (one-off branding)
- Examples: Pink Meet, Military Appreciation
- Custom colors, event logo, event sponsors
- Same graphics as normal, just re-skinned with theme colors/logos
- Typically unique to a single competition
- **Currently being built** (theme system in ThemeEditorPage)

### Competition Template (recurring format)
- Examples: Senior Night, Senior Day, Alumni Meet
- Adds **extra graphics** to the producer panel (e.g., a "Seniors" graphic showing graduating athletes)
- May also have colors/branding, but the real value is **unique graphics specific to that competition type**
- Reused every season — every team has a Senior Night

## Key Insight

These are **two independent layers** that can overlap:
- A Senior Night could also be a Pink Meet (pink-themed Senior Night)
- **Theme** = colors + logos + event sponsors (visual skin)
- **Template** = additional graphics specific to that competition type (functional)

## Architecture Consideration

Currently `compType` is `mens-dual`, `womens-tri`, etc. — determines team count and apparatus.
A template would be a second axis: "this is a `womens-quad` AND it's a `senior-night`."

## Priority

Focus on nailing the theme system first, then build out competition templates as a separate feature.
