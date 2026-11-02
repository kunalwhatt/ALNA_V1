# al:na — landing page

"I keep the light on, in case you ever find your way back."

A single-screen, mobile-first landing page: a Van Gogh-style seascape in a light theme, with a lighthouse whose lamp is half of a broken heart.

## Files
- `index.html` — page structure and SVG artwork (lighthouse, heart, boat)
- `css/style.css` — design system, layout and animations
- `js/main.js` — counter, visitor stats, heart animation, beam, painted canvas

## Run it
Open `index.html` in a browser, or upload the whole folder to any static host (Netlify, Vercel, GitHub Pages, cPanel).

## Things to know
- **Counter** starts from 3 August 2022, 00:00 IST. Change `START` at the top of the counter section in `js/main.js`.
- **Visitor IP** loads from api.ipify.org and works on your own domain.
- **Visits and Last seen** use the visitor's own browser storage when hosted outside claude.ai, so each person only sees their own count. For one shared count for everyone, connect a backend (Firebase, Supabase or a small PHP/MySQL endpoint) in the "visits + last seen" section of `js/main.js`.
- **Progress bar** is set to 34%. Change `scaleX(.34)` in `css/style.css` and the `34` in the progress count-up in `js/main.js`.
- Fonts load from Google Fonts: Bodoni Moda, Homemade Apple, DM Sans.
# ALNA_2.O
