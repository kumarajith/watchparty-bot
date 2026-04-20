# Movie Night Discord Bot

Control video playback across Netflix, Hotstar, Prime Video, and VLC from a Discord channel via slash commands, with a live "Now Playing" embed and interactive buttons.

You stream the movie over Discord screen share as usual. This bot gives your friends playback controls and a live status display in the channel.

## Features

- Slash commands for play, pause, rewind, and fast-forward
- Live "Now Playing" embed with a Unicode progress bar, auto-refreshed every 30 seconds
- Interactive button row (⏪ / ⏯ / ⏩ / 🔄) directly on the embed
- Action log: posts a message when someone presses a button, so everyone sees who did what
- Multi-source support: Netflix, Hotstar/Disney+, Prime Video, and VLC
- Multiple active tabs tracked simultaneously; pick the active source with `/source`
- Netflix controlled via its internal `cadmium` API (direct `currentTime` writes crash the player)

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  YOUR MACHINE                                                    │
│                                                                  │
│  ┌─────────────────┐     WebSocket      ┌──────────────────────┐ │
│  │ Chrome Extension │◄──────────────────►│                      │ │
│  │                  │   localhost:9393   │  Local Companion App │ │
│  │ Content Scripts: │                   │  (Node.js)           │ │
│  │  - Netflix       │                   │                      │ │
│  │  - Hotstar       │                   │  - WS Server         │ │
│  │  - Prime Video   │                   │  - VLC HTTP Client   │ │
│  └─────────────────┘                   │  - PotPlayer Bridge  │ │
│                                         │  - Discord Bot       │ │
│  ┌─────────────────┐  HTTP :8080        │  - State Manager     │ │
│  │ VLC Player       │◄────────────────►│                      │ │
│  └─────────────────┘                   │                      │ │
│                                         │                      │ │
│  ┌─────────────────┐  SendMessage/WM    │                      │ │
│  │ PotPlayer        │◄────────────────►│                      │ │
│  └─────────────────┘                   └──────────┬───────────┘ │
│                                                    │             │
└────────────────────────────────────────────────────┼─────────────┘
                                                     │ Discord API
                                                     ▼
                                            ┌────────────────┐
                                            │ Discord Server │
                                            │                │
                                            │ #movie-night   │
                                            │ Now Playing    │
                                            │ embed +        │
                                            │ buttons        │
                                            └────────────────┘
```

**Chrome Extension** injects content scripts into streaming sites, reads playback state every 2 seconds, and relays commands from the local app to the page's video player.

**Local Companion App** is the brain: it runs the WebSocket server, talks to VLC over HTTP, runs the Discord bot, and routes all commands through the orchestrator to the right player.

**Discord Bot** exposes slash commands and maintains the Now Playing embed. It only talks to the orchestrator and never directly to individual providers.

## Prerequisites

- Node.js >= 22.12.0
- Chrome or Chromium (for the browser extension)
- A Discord bot token and application ID
- VLC (optional, for local file playback)

## Installation

```bash
git clone https://github.com/your-username/watchparty-bot.git
cd watchparty-bot
npm install
```

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Register slash commands with Discord (run once, or whenever you change commands):

```bash
npm run deploy-commands
```

## Usage

Start the bot in development mode:

```bash
npm run dev
```

Load the Chrome extension:

1. Open `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked" and select the `extension/` folder

Then in Discord, go to your server and run `/go-live` to start a session. The bot posts the Now Playing embed. Open a streaming site in Chrome and start playing something. The embed updates automatically.

## Discord Commands

| Command | Description |
|---|---|
| `/go-live` | Start a movie night session and post the Now Playing embed |
| `/end` | End the current session |
| `/pause` | Pause playback |
| `/play` | Resume playback |
| `/rewind [seconds]` | Rewind (default: 10s) |
| `/forward [seconds]` | Fast-forward (default: 10s) |
| `/np` | Re-post or refresh the Now Playing embed |
| `/source` | Show active sources and pick one |

## Now Playing Embed

The embed shows the title, a progress bar, source, and playback status:

```
🎬  NOW STREAMING

Inception

`1:14:32 ━━━━━━━━━━━━━━●━━━━━━ 2:28:00`

Source: Netflix    Status: ▶ Playing

Streamed by Kumaji
```

The progress bar is built from Unicode characters (`━` and `●`), 20 characters wide. The color is `#E74C3C` (red) while playing and `#95A5A6` (grey) while paused.

Below the embed, a button row lets anyone in the channel control playback:

```
[ ⏪ 10s ]  [ ⏯ ]  [ 10s ⏩ ]  [ 🔄 ]
```

When `ACTION_LOG_ENABLED=true`, pressing a button posts a message to the channel:

```
⏩ @Alex skipped forward 10s
⏸ @Jordan paused playback
```

The embed auto-refreshes every 30 seconds to keep the progress bar current.

## Configuration

Create a `.env` file at the project root. All variables:

| Variable | Description | Default |
|---|---|---|
| `DISCORD_TOKEN` | Bot token from the Discord developer portal | required |
| `DISCORD_CLIENT_ID` | Application ID from the developer portal | required |
| `DISCORD_GUILD_ID` | Guild ID for dev (guild-scoped commands register instantly) | required |
| `WS_PORT` | Port the WebSocket server listens on | `9393` |
| `VLC_HOST` | Hostname where VLC's HTTP interface is running | `localhost` |
| `VLC_PORT` | Port for VLC's HTTP interface | `8080` |
| `VLC_PASSWORD` | Password set in VLC's Lua HTTP settings | required for VLC |
| `ACTION_LOG_ENABLED` | Post action messages to the channel when buttons are pressed | `true` |

```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_app_client_id
DISCORD_GUILD_ID=your_test_server_id

WS_PORT=9393

VLC_HOST=localhost
VLC_PORT=8080
VLC_PASSWORD=your_vlc_password

ACTION_LOG_ENABLED=true
```

## Chrome Extension

The extension connects to the local app over WebSocket (`ws://localhost:9393`) and injects content scripts into supported streaming sites. Each content script reads playback state every 2 seconds and listens for commands from the background service worker.

Supported sites:

| Site | URL patterns | Notes |
|---|---|---|
| Netflix | `netflix.com/*` | Uses internal `cadmium` API via page script injection |
| Hotstar / Disney+ | `hotstar.com/*`, `disneyplus.com/*` | Standard `<video>` DOM API |
| Prime Video | `primevideo.com/*`, `amazon.com/gp/video/*`, `amazon.in/gp/video/*` | Standard `<video>` DOM API; picks the longest-duration element when multiple exist |

To load the extension:

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `extension/` folder in this repo

No Chrome Web Store listing. Load it unpacked every time you reinstall Chrome, or pin the folder somewhere stable.

## VLC Setup

VLC's HTTP interface is disabled by default. To enable it:

1. Open VLC and go to **Preferences** (Ctrl+P)
2. At the bottom left, switch from "Simple" to **All**
3. Navigate to **Interface > Main interfaces** and check **Web**
4. Navigate to **Interface > Main interfaces > Lua** and set a **Lua HTTP password**
5. Restart VLC

Set `VLC_PASSWORD` in your `.env` to match the password you chose. The bot connects to `http://localhost:8080/requests/status.json`.

## Project Structure

```
watchparty-bot/
├── src/
│   ├── index.ts                      # Entry point, wires everything together
│   ├── config.ts                     # Loads .env, exports typed config object
│   ├── server/
│   │   └── ws-server.ts              # WebSocket server (port 9393) for the extension
│   ├── providers/
│   │   ├── types.ts                  # PlayerProvider interface, PlaybackState, PlayerSession
│   │   ├── browser-provider.ts       # Manages WS connections, tracks browser tabs as sessions
│   │   └── vlc-provider.ts           # VLC HTTP API client
│   ├── orchestrator/
│   │   └── orchestrator.ts           # Registers providers, picks active session, routes commands
│   └── discord/
│       ├── bot.ts                    # Discord client setup, slash command and button handlers
│       ├── commands.ts               # Slash command definitions
│       ├── embeds.ts                 # Embed builder, progress bar, button row
│       └── deploy-commands.ts        # One-time script to register commands with Discord
└── extension/
    ├── manifest.json                 # Manifest V3, declares content scripts and permissions
    ├── background.js                 # Service worker, manages WS connection, routes messages
    ├── providers/
    │   ├── base-video-provider.js    # Abstract base: standard <video> element logic
    │   ├── hotstar-provider.js       # Extends base (no overrides needed)
    │   ├── prime-provider.js         # Overrides getVideo() to pick longest-duration element
    │   └── netflix-provider.js       # Overrides all controls to use Netflix's cadmium API
    └── content/
        ├── hotstar.js                # Instantiates HotstarProvider, wires to background
        ├── prime.js                  # Instantiates PrimeProvider, wires to background
        └── netflix.js                # Instantiates NetflixProvider, wires to background
```

## Adding a New Streaming Site

The extension is designed so adding a new site touches only three files:

1. **Create a provider** at `extension/providers/youtube-provider.js`. Extend `BaseVideoProvider`. Override `getVideo()` if the site uses a non-standard video element, or leave it empty if the default `document.querySelector('video')` works.

   ```js
   class YouTubeProvider extends BaseVideoProvider {
     constructor() {
       super('youtube');
     }
     // Override getVideo() here if needed
   }
   ```

2. **Create a content script** at `extension/content/youtube.js`. Copy any existing content script and swap the provider class name.

   ```js
   const provider = new YouTubeProvider();

   setInterval(() => {
     const state = provider.getState();
     if (state) chrome.runtime.sendMessage({ type: 'state', data: state });
   }, 2000);

   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
     if (msg.type !== 'command') return;
     switch (msg.action) {
       case 'play':         provider.play(); break;
       case 'pause':        provider.pause(); break;
       case 'seek':         provider.seek(msg.value); break;
       case 'seekRelative': provider.seekRelative(msg.value); break;
       case 'getState':     sendResponse(provider.getState()); return true;
     }
   });
   ```

3. **Add a `content_scripts` entry** in `extension/manifest.json`:

   ```json
   {
     "matches": ["https://www.youtube.com/*"],
     "js": [
       "providers/base-video-provider.js",
       "providers/youtube-provider.js",
       "content/youtube.js"
     ],
     "run_at": "document_idle"
   }
   ```

No changes needed to the local app, background script, or Discord bot.

## Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `npm run dev` | Run with `tsx` and hot reload via `--env-file` |
| `build` | `npm run build` | Compile to `dist/` with `tsup` |
| `start` | `npm start` | Run the compiled output from `dist/` |
| `deploy-commands` | `npm run deploy-commands` | Register slash commands with Discord (run once) |

## Tech Stack

| Component | Technology | Version |
|---|---|---|
| Runtime | Node.js | >= 22.12.0 |
| Discord library | discord.js | ^14.18.0 |
| WebSocket server | ws | ^8.18.0 |
| HTTP client (VLC) | `fetch` (built into Node 22) | built-in |
| Browser extension | Chrome Manifest V3 | n/a |
| Language | TypeScript (ESM) | ^5.8.3 |
| Dev runner | tsx | ^4.19.4 |
| Build | tsup | ^8.4.0 |

## Known Limitations / Roadmap

- **Title detection**: Currently uses `document.title` which can be inaccurate (includes site name, may not update for all content). Should be replaced with per-provider DOM scraping from the actual title element on the page.
- **PotPlayer support**: Planned for a future phase (WM_COMMAND via PowerShell helper + window title parsing for position).