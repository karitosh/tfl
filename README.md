# Liverpool Street live trains web app

Static web app that shows live train services at London Liverpool Street (`LST`) using TfL's public Unified API.

## Local preview

No backend is required. Serve the `public/` folder with any static file server.

Example:

```bash
npx serve public
```

Then open the local URL printed by the command.

## Deploy to GitHub Pages

This repo includes a workflow at `.github/workflows/deploy-pages.yml` that deploys `public/` to GitHub Pages on pushes to `main`.

1. Push this project to a GitHub repository.
2. In GitHub, go to `Settings -> Pages`.
3. Under `Build and deployment`, choose `Source: GitHub Actions`.
4. Push to `main` (or run the workflow manually in `Actions`).

Your site URL will be shown in the workflow output once deployed.

## Notes

- Data is fetched directly from TfL API in the browser (no server proxy).
- The app combines these Liverpool Street feeds:
  - Underground: `940GZZLULVT`
  - Rail/Overground: `910GLIVST`
  - Elizabeth line: `910GLIVSTLL`
- Data refreshes every 30 seconds.
