# Aarogya Assist deployment settings

These settings prepare the repository for Render and Vercel. They do not
deploy the application or change the database.

## Render backend

Configure the existing Render web service with:

- Runtime: Docker
- Root directory: `backend`
- Dockerfile path: `Dockerfile`
- Health check path: `/api/health`

Set these environment variables in the Render dashboard. Do not put their
values in this repository:

- `DATABASE_URL`: the existing Supabase PostgreSQL connection string
- `JWT_SECRET_KEY`: a strong, private signing secret
- `JWT_ALGORITHM`: `HS256`
- `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`: `60`
- `GROQ_API_KEY`: the private Groq API key
- `GROQ_MODEL`: optional; defaults to the model configured by the backend
- `CORS_ORIGINS`: comma-separated exact origins, including the deployed
  Vercel domain and, if needed, its custom domain

The local MySQL configuration remains available when `DATABASE_URL` is unset.
The container excludes `.env` files and installs Tesseract for OCR. No database
setup or migration command runs during build or startup.

## Vercel frontend

Set the Vercel project root directory to `frontend`. Use the existing npm
settings:

- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_URL=https://aarogyaassist.onrender.com`

The example value is the supplied Render API origin. For local development,
omit `VITE_API_URL`; the frontend defaults to `http://localhost:8000`.

After the Vercel domain is known, add that exact origin to Render's
`CORS_ORIGINS`. The default backend configuration allows only the Vite local
development origins. Do not use a wildcard production origin.

## Credential handling

Keep Render secrets in the Render dashboard and frontend environment values in
Vercel project settings. `VITE_*` variables are included in browser assets and
must never contain secrets. Rotate any database credential that was previously
embedded in a source file before relying on it in production.
