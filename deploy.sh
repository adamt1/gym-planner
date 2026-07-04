#!/bin/bash
# פריסה אוטומטית: שומר גרסה (git) ומעלה ל-Vercel בפקודה אחת.
# שימוש:  ./deploy.sh   (מתוך תיקיית gym-planner)
set -e
cd "$(dirname "$0")"

echo "→ שומר שינויים ב-git…"
git add -A
git commit -m "update $(date '+%Y-%m-%d %H:%M')" || echo "  (אין שינויים חדשים)"

echo "→ מעלה ל-Vercel (production)…"
npx -y vercel --prod --yes --scope adams-projects-6b7cadd5

echo "✓ הסתיים. האתר: https://gym-planner-fawn.vercel.app"
