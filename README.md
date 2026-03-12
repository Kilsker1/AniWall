✦ AniWall
AniWall is a sleek, lightweight desktop wallpaper engine built with Electron. It pulls high-quality anime and general wallpapers from popular APIs and lets you instantly crop, save, or apply them to any of your monitors.

✨ Features
Multi-Source Fetching: Browse thousands of wallpapers from Wallhaven, Waifu.pics, and Nekos.best.

Smart Crop Tool: Automatically detects your monitors and locks the crop box to the exact aspect ratio of the display you are applying it to.

Instant Apply: Set wallpapers instantly without cluttering your hard drive (images are downloaded to a temporary folder and cleaned up automatically by Windows).

Local Collection: ❤️ Heart your favorite wallpapers to save them to your personal Collection tab for easy access later.

Infinite Scroll & Masonry Grid: Butter-smooth browsing with an automatic flexbox masonry layout that adapts to your window size.

Advanced Filtering: Filter by Landscape/Portrait, SFW/NSFW, minimum resolution, and specific tags or categories.

Clickable Tags: Click any tag on an image to instantly start a new Wallhaven search for similar wallpapers.

🚀 Prerequisites
OS: Windows (AniWall uses the native Windows IDesktopWallpaper COM API via PowerShell to set wallpapers across multiple monitors).

Node.js: Ensure you have Node.js installed to run and build the app.

🛠️ Installation & Setup
Clone or download the repository.

Open a terminal in the project folder and install the dependencies:

Bash
npm install
Start the app in development mode:

Bash
npm start
⚙️ Building the .exe
To package the app into a standalone Windows installer/executable, run your packager command. (If you haven't set up Electron Forge or Builder in your package.json, you can run the builder directly):

Bash
npx electron-builder --win
The finished .exe will be located in your dist or out folder.

🔑 Wallhaven API Key (Optional but Recommended)
By default, Wallhaven limits how many searches you can do per minute and hides NSFW/Sketchy content.

Create a free account at Wallhaven.cc

Go to your Account Settings to find your API Key.

Paste it into the Settings menu in AniWall.
(Your key is stored safely and locally on your machine in your %APPDATA%\aniwall folder).

📁 Where are my saved images?
When you click the Save button, images are downloaded directly to your native Windows Pictures folder (C:\Users\YourName\Pictures).
