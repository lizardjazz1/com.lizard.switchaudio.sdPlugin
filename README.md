# Audio Switch Pro

> **🇬🇧 English** | [🇷🇺 Русский](README_ru.md)

StreamDock plugin for Windows to manage audio devices and volume with a single click.

## Features

### Audio Device Switching
- **One-click switching** between two audio devices (output or input)
- **Dual device management** - changes both Default and Communication audio roles
- **Input device support** - switch microphones too
- **Two modes**: Toggle between two devices OR switch to a specific device

### Volume Control
- **Mute Toggle** - mute/unmute system volume or microphone
- **Push to Talk** - hold to unmute, release to mute (for Discord/Teams)
- **Volume Up/Down** - adjust system volume
- **Set Volume** - set system volume to a specific level (0-100%)
- **App Volume Up/Down** - adjust volume of the focused application

### Media Control
- **Play / Pause** - toggle media playback
- **Next Track** - skip to next track
- **Previous Track** - go to previous track

### Utilities
- **Sound Settings** - quickly open Windows sound settings

### General
- **Modern UI** with dark theme Property Inspector
- **Multi-language support** - English, Russian, Chinese
- **Smart fallback system** - uses C# helper, NirCmd, or PowerShell
- **Auto device detection** - automatically lists all available audio devices

## Actions

| Action | Description |
|--------|-------------|
| **Audio Switch** | Toggle between two audio devices (Default + Communication) |
| **Mute Toggle** | Mute/unmute system volume or microphone |
| **Push to Talk** | Hold to unmute, release to mute |
| **Volume Up** | Increase system volume |
| **Volume Down** | Decrease system volume |
| **Set Volume** | Set system volume to specific level (0-100%) |
| **App Volume Up** | Increase focused application volume |
| **App Volume Down** | Decrease focused application volume |
| **Play / Pause** | Toggle media play/pause |
| **Next Track** | Skip to next track |
| **Previous Track** | Go to previous track |
| **Sound Settings** | Open Windows sound settings |

## Installation

### Prerequisites

- Windows 10 or later
- StreamDock 3.10.188.226 or later

### Quick Install

**Option 1: Download Ready-to-Use Plugin**

1. **Download** the latest release from [GitHub Releases](../../releases)
2. **Extract** the `com.lizard.switchaudio.sdPlugin` folder to:
   - `%APPDATA%\HotSpot\StreamDock\plugins\`
3. **Restart** StreamDock

**Option 2: Build from Source**

1. **Clone** this repository
2. **Run** `install.bat` (compiles AudioSwitch.exe and downloads nircmd)
3. **Copy** the `.sdPlugin` folder to plugins directory
4. **Restart** StreamDock

## Usage

### Audio Switch
1. Drag "Audio Switch" to your StreamDock
2. Select device type (Output/Input)
3. Choose mode (Toggle between two / Switch to selected)
4. Select your devices
5. Press the button to switch

### Mute Toggle
1. Drag "Mute Toggle" to your StreamDock
2. Choose mute type (System Volume / Microphone)
3. Press the button to toggle mute

### Volume Controls
Just drag the volume action to your StreamDock - no configuration needed.

## How It Works

The plugin uses multiple methods (in order of preference):

1. **AudioSwitch.exe** (C# helper) - Native Windows API
2. **NirCmd** - Reliable fallback utility
3. **PowerShell** - Last resort for device listing

## Building from Source

### Compile C# Helper

```batch
cd plugin
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /nologo /optimize /out:AudioSwitch.exe AudioSwitch.cs
```

### Create Release

```batch
prepare-release.bat
```

## Troubleshooting

**Plugin not loading?**
- Run `install.bat` first
- Check that `plugin/node_modules` exists
- Restart StreamDock

**No devices found?**
- Click "Refresh Devices"
- Check Windows Sound settings

**Mute not working?**
- Make sure nircmd.exe is in the `plugin` folder
- Try running StreamDock as Administrator

## Credits

- **[NirSoft](https://www.nirsoft.net/)** for [NirCmd](https://www.nirsoft.net/utils/nircmd.html)

## License

MIT License - feel free to use and modify.

## Author

**Lizard** - [GitHub](https://github.com/Lizardjazz1)

## Version History

### 1.3.0
- **Fixed** app volume control for applications (Core Audio API fix - correct IAudioSessionControl2 interface)
- **Fixed** Play/Pause no longer restores/focuses window if app is already running
- **Added** "Process name" field for Play/Pause - now works with UWP/Store apps
- **Added** play/pause icon toggle - button shows current playback state
- **Added** dynamic Set Volume icons - icon changes based on selected volume level (0%, 25%, 50%, 75%, 100%)
- **Added** 6 new icons: pause.svg, volume_0.svg, volume_25.svg, volume_50.svg, volume_75.svg, volume_100.svg

### 1.2.1
- Added "Play / Pause" with optional application launcher
- Added "Browse..." button for selecting application path
- Fixed icon updates for mute toggle and device switching
- All actions now have unique icons
- Improved Property Inspector UI (removed unnecessary title field)

### 1.0.0
- Audio device switching (output + input)
- Mute toggle (system + microphone)
- Volume controls (system + app)
- Multi-language support (EN, RU, ZH)
