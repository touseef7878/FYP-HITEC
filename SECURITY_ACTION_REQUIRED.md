# ⚠️ IMMEDIATE ACTION REQUIRED

The following credentials were exposed in git history and **must be rotated now**.
Even though they are removed from the current code, they exist in old commits.

## Keys to Revoke & Regenerate

| Service | Action |
|---|---|
| **Gemini API Key** (`AIzaSyC-BVuqAvdo3cSPz3e7kZZsj5zAhP9p31Y`) | Go to https://aistudio.google.com/app/apikey → Delete this key → Create new one |
| **NOAA CDO Token** (`YuoMnpMUJjkEoFtMqxUEQecyvIRGbTmb`) | Go to https://www.ncdc.noaa.gov/cdo-web/token → Request new token |
| **WAQI Token** (`e680d5cdc241cb13b5dd11bdff8b44702c1d4394`) | Go to https://aqicn.org/api/ → Request new token |
| **Email** (`touseefurrehman5554@gmail.com`) | Change your Gmail password |
| **Copernicus Password** (`@Touseef5554`) | Go to https://identity.dataspace.copernicus.eu → Change password |
| **JWT Secret** | Already a placeholder — generate new one for production |

## After Rotating Keys

1. Update your local `backend/.env` with the new keys
2. Update your local `.env` with the new Gemini key
3. These files are now in `.gitignore` — they will NOT be committed again

## Optional: Purge History (Advanced)

If you want to completely remove the keys from git history:
```bash
# Install git-filter-repo: pip install git-filter-repo
git filter-repo --path backend/.env --invert-paths --force
git filter-repo --path .env --invert-paths --force
git push origin master --force
```
Note: This rewrites history — all collaborators must re-clone.

## Delete This File After Reading
