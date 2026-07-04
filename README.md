# Gym Planner — בונה תוכניות אימון

אפליקציית ווב מקומית שבונה תוכנית אימון שבועית מבוססת-מחקר: מחולל תוכניות עם שאלון,
מאגר 96 תרגילים, התמקדות לפי פלג גוף, סינון ציוד/מגבלות, מעקב סטים, טיימר מנוחה,
הדפסה, והדגמת GIF אמיתית לכל תרגיל.

## הרצה מקומית
```bash
node server.js
# פתח http://localhost:4173
```

## פריסה
מחובר ל-Vercel — כל דחיפה ל-`main` מתפרסמת אוטומטית.
לפריסה ידנית: `./deploy.sh`

**אתר חי:** https://gym-planner-fawn.vercel.app

## מבנה
- `index.html`, `styles.css`, `app.js` — האפליקציה
- `data/exercises.js` — מאגר התרגילים
- `data/animations.js` — אנימציות SVG (גיבוי)
- `data/exercise_media.js` — מיפוי לתרגיל→GIF
- `gifs/` — קובצי ההדגמה
- `server.js` — שרת סטטי מקומי
