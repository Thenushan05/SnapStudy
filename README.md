# SnapStudy

AI-powered study companion that turns photos of notes, textbooks, and diagrams into summaries, quizzes, mind maps, and structured learning content.

## Features

- Convert images to structured learning content (summaries, quizzes, mind maps)
- Chat experience and history page
- Responsive UI with shadcn/ui + Tailwind CSS
- SPA routing with `react-router-dom`

## Tech Stack

- Vite + React + TypeScript
- shadcn/ui + Tailwind CSS
- Radix UI primitives
- TanStack Query

## Getting Started

```bash
npm install
npm run dev
```

Dev server runs on http://localhost:8080 per `vite.config.ts`.

## Build

```bash
npm run build
npm run preview
```

Output is generated to `dist/`.

## Deploy to Netlify

This repo includes `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

You can deploy via either method:

- UI: Connect your Git repo in Netlify → set Build command to `npm run build` and Publish directory to `dist` (already in `netlify.toml`).
- Drag-and-drop: Run `npm run build` locally and drag the `dist/` folder into the Netlify Sites dashboard.
- CLI: `npm i -g netlify-cli` → `netlify deploy` (preview) or `netlify deploy --prod` (requires login).

## Favicon and Branding

Favicon links are defined in `index.html`:

```html
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

Replace the assets in `public/` with your branding:

- `public/favicon.ico` (recommended 32x32 or 48x48)
- `public/favicon.svg` (scalable)
- `public/apple-touch-icon.png` (180x180)

Optionally update OG/Twitter preview images in `index.html` (`og:image` and `twitter:image`).

---

## Legacy README (from template)
> The original Lovable-generated README is preserved below for reference.
> You can remove it if no longer needed.
 

## Project info

**URL**: https://lovable.dev/projects/9712e539-58c5-43d1-80b4-bbd466f39b98

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/9712e539-58c5-43d1-80b4-bbd466f39b98) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/9712e539-58c5-43d1-80b4-bbd466f39b98) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
