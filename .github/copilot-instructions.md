# Project Guidelines

## Code Style
Use Astro best practices: Create pages and components in `.astro` files. Leverage server-side rendering with the Node adapter. Enforce TypeScript strict mode for type safety.

## Architecture
This is an Astro application building a GitHub contribution battle arena—a retro arcade-themed website comparing contribution graphs. Structure includes:
- Pages in `src/pages/`
- API routes in `src/pages/api/` using dynamic segments like `[username].ts`
- Server output mode for dynamic rendering

## Build and Test
- `npm run dev`: Start the local development server
- `npm run build`: Build the application for production
- `npm run preview`: Preview the built site locally

## Conventions
- Use file-based routing for pages and API endpoints
- Disable prerendering (`prerender = false`) for dynamic API routes
- Reference existing styling assets in `docs/` for retro themes when implementing UI</content>
<parameter name="filePath">c:\Users\Ory00404\Desktop\Gihub Dev Days\mona-mayhem\mono-mayhem\.github\copilot-instructions.md