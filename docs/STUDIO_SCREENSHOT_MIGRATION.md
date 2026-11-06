# Screenshot-match Studio migration

The reference is `ompatil279/screenshot-match` (user-owned Lovable UI project).
We reuse its public, light-first/dark-ready design tokens and user preferences.
ATLAS itself remains the production source of truth for API calls, trust boundaries,
real CLI/SDK, Arkiv canonical data and full Explorer/Decoder/Event/Transaction pages.

The original reference's `/developers`, `/integrations` and `/settings` routes
were construction placeholders; they are now implemented in ATLAS. Integrations
reports backend-verified states instead of claiming unbuilt sponsor connections.
All ten routes are tested; generated routeTree is not checked into Git.

Source inspection: https://github.com/ompatil279/screenshot-match
No deployment, Arkiv writes or sponsor-chain interactions are caused by UI migration.
