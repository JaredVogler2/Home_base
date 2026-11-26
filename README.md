# HOMEBASE

A private family command center for an Apolosign 27-inch 4K Android wall display and parents' iPhones. Designed for pre-readers first: a living illustrated home, not a spreadsheet.

## Build with Claude Fable 5.2 Max

Start with [`prompt-series/00-START-HERE.md`](prompt-series/00-START-HERE.md), then work through the numbered files in order. They define minimum functional outcomes, not a ceiling on creative or technical ambition. Implement, test, document and commit each phase; use judgment and record departures. The actual app is not implemented by these documents.

Recommended topology: one modular HOMEBASE Vercel project with shared database and two responsive modes, plus the existing [Training Academy](https://github.com/JaredVogler2/Training_Academy) deployment. Split only if evidence warrants it. Keep Apolosign native calendar and Google Photos as first-class device integrations; no undocumented native API assumptions.

**Privacy:** this repository is public. Only synthetic fixtures, code and documentation belong here. Never commit family names/photos, calendar credentials, private events, child records, production exports, API keys or real device tokens. Store real family data behind authentication in private storage.
