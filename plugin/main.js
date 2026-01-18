const WebSocket = require('ws');
const { exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const pluginDir = __dirname;
const helperPath = path.join(pluginDir, 'AudioSwitch.exe');
const nircmdPath = path.join(pluginDir, 'nircmd.exe');

let ws;
let buttonContexts = {};

// Store action UUIDs for routing
let actionUUIDs = {};

// Check which tools are available
const hasHelper = fs.existsSync(helperPath);
const hasNircmd = fs.existsSync(nircmdPath);

console.log('AudioSwitch.exe available:', hasHelper);
console.log('nircmd.exe available:', hasNircmd);

// Get list of audio devices
function getAudioDevices(deviceType = 'output') {
    return new Promise((resolve) => {
        if (hasHelper) {
            // Use C# helper (best option)
            exec(`"${helperPath}" list ${deviceType}`, { encoding: 'utf8' }, (err, stdout) => {
                if (err) {
                    console.log('Helper error:', err.message);
                    fallbackGetDevices(resolve);
                    return;
                }
                try {
                    const devices = JSON.parse(stdout.trim());
                    if (devices.error) {
                        console.log('Helper error:', devices.error);
                        fallbackGetDevices(resolve);
                        return;
                    }
                    resolve(devices);
                } catch (e) {
                    console.log('Parse error:', e.message);
                    fallbackGetDevices(resolve);
                }
            });
        } else {
            fallbackGetDevices(resolve);
        }
    });
}

// Fallback: use PowerShell to get device list
function fallbackGetDevices(resolve) {
    const ps = `
        Add-Type -AssemblyName System.Runtime.InteropServices
        $devices = Get-CimInstance Win32_SoundDevice | Where-Object { $_.Status -eq 'OK' } | Select-Object Name
        $result = @()
        foreach ($d in $devices) {
            $result += @{ name = $d.Name; id = $d.Name }
        }
        $result | ConvertTo-Json -Compress
    `;

    exec(`powershell -Command "${ps.replace(/\n/g, ' ')}"`, { encoding: 'utf8' }, (err, stdout) => {
        if (err) {
            console.log('PowerShell error:', err.message);
            resolve([]);
            return;
        }
        try {
            let devices = JSON.parse(stdout.trim());
            if (!Array.isArray(devices)) devices = [devices];
            resolve(devices.map(d => ({ id: d.id || d.name, name: d.name })));
        } catch (e) {
            console.log('Parse error:', e.message);
            resolve([]);
        }
    });
}

// Switch audio device (sets BOTH Default and Communication)
function switchDevice(deviceId, deviceName, deviceType = 'output') {
    return new Promise((resolve) => {
        if (hasHelper) {
            // Use C# helper (sets all roles: Console, Multimedia, Communications)
            exec(`"${helperPath}" set "${deviceId}" ${deviceType}`, { encoding: 'utf8' }, (err, stdout) => {
                if (err) {
                    console.log('Helper error:', err.message);
                    fallbackSwitch(deviceName, resolve, deviceType);
                    return;
                }
                try {
                    const result = JSON.parse(stdout.trim());
                    if (result.success) {
                        console.log(`Switched to: ${deviceName} (Default + Communication)`);
                        resolve(true);
                    } else {
                        console.log('Switch failed:', result.error);
                        fallbackSwitch(deviceName, resolve, deviceType);
                    }
                } catch (e) {
                    fallbackSwitch(deviceName, resolve, deviceType);
                }
            });
        } else {
            fallbackSwitch(deviceName, resolve, deviceType);
        }
    });
}

// Fallback: use nircmd to switch devices
function fallbackSwitch(deviceName, resolve, deviceType = 'output') {
    if (hasNircmd) {
        // nircmd setdefaultsounddevice "Device Name" {Role}
        // Role: 0 = Console (default), 1 = Multimedia), 2 = Communications
        // Works for both input and output devices - just use correct device name
        // Set all three roles: Console (0), Multimedia (1), Communications (2)
        const cmd = `"${nircmdPath}" setdefaultsounddevice "${deviceName}" 0 && "${nircmdPath}" setdefaultsounddevice "${deviceName}" 1 && "${nircmdPath}" setdefaultsounddevice "${deviceName}" 2`;
        exec(cmd, (err) => {
            if (err) {
                console.log('nircmd error:', err.message);
                resolve(false);
            } else {
                console.log(`Switched to: ${deviceName} (via nircmd, type: ${deviceType})`);
                resolve(true);
            }
        });
    } else {
        console.log('No audio switcher available!');
        resolve(false);
    }
}

function send(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

function setState(context, state) {
    send({
        event: 'setState',
        context: context,
        payload: { state: state }
    });
}

function setSettings(context, settings) {
    send({
        event: 'setSettings',
        context: context,
        payload: settings
    });
}

function setImage(context, imagePath) {
    send({
        event: 'setImage',
        context: context,
        payload: { image: imagePath }
    });
}

// Update mute button icon based on muteType
function updateMuteIcon(context, settings) {
    const muteType = settings.muteType || 'system';
    const currentState = settings.currentState || 0;
    
    if (muteType === 'microphone') {
        // Use microphone icons
        const imagePath = currentState === 0 ? 'images/mic_unmute' : 'images/mic_mute';
        setImage(context, imagePath);
    } else {
        // Use system/speaker icons (device icons)
        const imagePath = currentState === 0 ? 'images/dev_unmute' : 'images/dev_mute';
        setImage(context, imagePath);
    }
}

// Update device switch button icon based on deviceType
function updateDeviceIcon(context, settings) {
    const deviceType = settings.deviceType || 'output';
    const currentState = settings.currentState || 0;
    
    if (deviceType === 'input') {
        // Use microphone device icons
        const imagePath = currentState === 0 ? 'images/mic_device1' : 'images/mic_device2';
        setImage(context, imagePath);
    } else {
        // Use output device icons
        const imagePath = currentState === 0 ? 'images/device1' : 'images/device2';
        setImage(context, imagePath);
    }
}

// Execute NirCmd command (returns Promise)
function executeNircmd(command) {
    return new Promise((resolve) => {
        if (!hasNircmd) {
            console.log('NirCmd not available');
            resolve(false);
            return;
        }
        const fullCommand = `"${nircmdPath}" ${command}`;
        console.log(`[executeNircmd] Executing: ${fullCommand}`);
        exec(fullCommand, { encoding: 'utf8', timeout: 5000 }, (err, stdout, stderr) => {
            if (err) {
                console.log('[executeNircmd] Error:', err.message);
                console.log('[executeNircmd] Exit code:', err.code);
                if (stderr) console.log('[executeNircmd] stderr:', stderr);
                resolve(false);
            } else {
                if (stdout) console.log('[executeNircmd] stdout:', stdout);
                if (stderr) console.log('[executeNircmd] stderr (warning):', stderr);
                console.log('[executeNircmd] Command executed successfully');
                resolve(true);
            }
        });
    });
}

// Handle mute/unmute toggle (System or Microphone)
async function handleMuteToggle(context, settings) {
    console.log('[handleMuteToggle] Called with context:', context);
    console.log('[handleMuteToggle] Settings:', JSON.stringify(settings));
    
    const currentState = settings.currentState || 0;
    const newState = currentState === 0 ? 1 : 0;
    const muteType = settings.muteType || 'system';
    
    console.log('[handleMuteToggle] muteType:', muteType, 'currentState:', currentState, 'newState:', newState);
    
    let command;
    if (muteType === 'microphone') {
        // Use mutesysvolume for microphone with default_record component
        // Format: mutesysvolume [action] {Component}
        // action: 2 = toggle
        // Component: default_record = default recording device (microphone)
        // This is more reliable than mutesubunitvolume which requires exact device/subunit names
        command = `mutesysvolume 2 default_record`;
        console.log('[handleMuteToggle] Microphone mute using default_record');
    } else {
        // Use mutesysvolume for system (output/playback)
        // Format: mutesysvolume [action] {Component}
        // action: 2 = toggle
        // Component: default is 'master' (master volume)
        // This mutes/unmutes the default playback device
        command = `mutesysvolume 2`;
        console.log('[handleMuteToggle] System mute (master volume)');
    }
    
    console.log('[handleMuteToggle] Final command:', command);
    console.log('[handleMuteToggle] NirCmd available:', hasNircmd);
    console.log('[handleMuteToggle] NirCmd path:', nircmdPath);
    
    const success = await executeNircmd(command);
    console.log('[handleMuteToggle] Command execution result:', success);
    
    if (success) {
        // After toggle, update our state tracking
        settings.currentState = newState;
        setSettings(context, settings);
        setState(context, newState);
        // Update icon based on muteType and new state
        updateMuteIcon(context, settings);
        buttonContexts[context] = settings;
        console.log('[handleMuteToggle] State updated successfully');
    } else {
        console.log('[handleMuteToggle] Mute command failed - check NirCmd availability and device names');
    }
}

// Handle volume up/down
async function handleVolumeChange(context, settings, direction) {
    // direction: 'up' or 'down'
    // Default volume change: 3000 units (out of 65535, roughly 4.5%)
    const volumeChange = settings.volumeStep || 3000;
    const change = direction === 'up' ? volumeChange : -volumeChange;
    
    const success = await executeNircmd(`changesysvolume ${change}`);
    console.log(`Volume ${direction}: ${success ? 'success' : 'failed'}`);
}

// Handle app volume change
async function handleAppVolumeChange(context, settings, direction) {
    // direction: 'up' or 'down'
    // Default volume change: 0.1 (10%)
    const volumeChange = settings.appVolumeStep || 0.1;
    const change = direction === 'up' ? volumeChange : -volumeChange;

    const success = await executeNircmd(`changeappvolume focused ${change}`);
    console.log(`App volume ${direction}: ${success ? 'success' : 'failed'}`);
}

// Handle set specific volume level
async function handleSetVolume(context, settings) {
    // Target volume as percentage (0-100)
    const targetVolume = settings.targetVolume !== undefined ? settings.targetVolume : 50;
    // Convert percentage to nircmd value (0-65535)
    const nircmdVolume = Math.round((targetVolume / 100) * 65535);

    console.log(`Setting volume to ${targetVolume}% (${nircmdVolume}/65535)`);
    const success = await executeNircmd(`setsysvolume ${nircmdVolume}`);
    console.log(`Set volume: ${success ? 'success' : 'failed'}`);
}

// Check if process is running by name
function isProcessRunning(processName) {
    try {
        // Remove .exe extension if present, use just the name
        const name = processName.replace(/\.exe$/i, '');
        const result = execSync(`tasklist /FI "IMAGENAME eq ${name}.exe" /NH`, { encoding: 'utf8' });
        return result.includes(name + '.exe');
    } catch (e) {
        return false;
    }
}

// Launch application
function launchApp(appPath) {
    return new Promise((resolve) => {
        // Use Windows 'start' command to launch the app
        // Format: start "" "path\to\app.exe" (empty title "" required)
        const command = `start "" "${appPath}"`;
        
        exec(command, { encoding: 'utf8', timeout: 5000 }, (err) => {
            if (err) {
                console.log('[launchApp] Error launching:', err.message);
                resolve(false);
            } else {
                console.log('[launchApp] Launched:', appPath);
                // Wait a bit for app to start before sending key
                setTimeout(() => resolve(true), 1000);
            }
        });
    });
}

// Handle media controls (play/pause, next, previous)
async function handleMediaControl(context, settings, mediaAction) {
    // If playpause action and appPath is specified, check if app is running
    if (mediaAction === 'playpause' && settings.appPath) {
        const appPath = settings.appPath.trim();
        if (appPath) {
            // Extract process name from path (e.g., "Spotify.exe" or "C:\Program Files\Spotify\Spotify.exe")
            const processName = appPath.split(/[\\\/]/).pop().replace(/\.exe$/i, '');
            
            if (!isProcessRunning(processName)) {
                console.log(`[handleMediaControl] App not running, launching: ${appPath}`);
                const launched = await launchApp(appPath);
                if (launched) {
                    // Wait a bit more for app to initialize
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        }
    }
    
    // nircmd uses sendkeypress for media keys
    // 0x B3 = Play/Pause, 0x B0 = Next, 0x B1 = Previous, 0x B2 = Stop
    let keyCode;
    switch (mediaAction) {
        case 'playpause': keyCode = '0xB3'; break;
        case 'next': keyCode = '0xB0'; break;
        case 'previous': keyCode = '0xB1'; break;
        case 'stop': keyCode = '0xB2'; break;
        default: return;
    }
    const success = await executeNircmd(`sendkeypress ${keyCode}`);
    console.log(`Media ${mediaAction}: ${success ? 'success' : 'failed'}`);
}

// Handle Push to Talk (mute on release) - microphone only
async function handlePushToTalk(context, settings, isKeyDown) {
    // PTT always uses microphone (default_record)
    // 0 = mute, 1 = unmute
    const command = isKeyDown ? `mutesysvolume 1 default_record` : `mutesysvolume 0 default_record`;

    const success = await executeNircmd(command);
    console.log(`PTT ${isKeyDown ? 'TALK' : 'MUTE'}: ${success ? 'ok' : 'failed'}`);

    // Update state: 0 = muted (ptt-off), 1 = talking (ptt-on)
    const newState = isKeyDown ? 1 : 0;
    settings.currentState = newState;
    setSettings(context, settings);
    setState(context, newState);
    buttonContexts[context] = settings;
}

// Handle open sound settings
async function handleSoundSettings(context, settings) {
    exec('start ms-settings:sound', (err) => {
        if (err) {
            // Fallback for older Windows
            exec('control mmsys.cpl sounds');
        }
    });
    console.log('Opened sound settings');
}

async function handleKeyDown(context, settings, actionUUID) {
    // Route to appropriate handler based on action UUID
    if (actionUUID === 'com.lizard.switchaudio.mute') {
        await handleMuteToggle(context, settings);
        return;
    }
    
    if (actionUUID === 'com.lizard.switchaudio.volumeup') {
        await handleVolumeChange(context, settings, 'up');
        return;
    }
    
    if (actionUUID === 'com.lizard.switchaudio.volumedown') {
        await handleVolumeChange(context, settings, 'down');
        return;
    }
    
    if (actionUUID === 'com.lizard.switchaudio.appvolumeup') {
        await handleAppVolumeChange(context, settings, 'up');
        return;
    }
    
    if (actionUUID === 'com.lizard.switchaudio.appvolumedown') {
        await handleAppVolumeChange(context, settings, 'down');
        return;
    }

    if (actionUUID === 'com.lizard.switchaudio.setvolume') {
        await handleSetVolume(context, settings);
        return;
    }

    if (actionUUID === 'com.lizard.switchaudio.playpause') {
        await handleMediaControl(context, settings, 'playpause');
        return;
    }

    if (actionUUID === 'com.lizard.switchaudio.medianext') {
        await handleMediaControl(context, settings, 'next');
        return;
    }

    if (actionUUID === 'com.lizard.switchaudio.mediaprev') {
        await handleMediaControl(context, settings, 'previous');
        return;
    }

    if (actionUUID === 'com.lizard.switchaudio.pushtotalk') {
        await handlePushToTalk(context, settings, true); // keyDown = unmute
        return;
    }

    if (actionUUID === 'com.lizard.switchaudio.soundsettings') {
        await handleSoundSettings(context, settings);
        return;
    }

    // Default: handle device switching (com.lizard.switchaudio.toggle)
    const mode = settings.mode || 'toggle';
    const deviceType = settings.deviceType || 'output';
    
    if (mode === 'selected') {
        // Mode: Switch to selected device (always switch to device1 - the selected device)
        const targetDevice = settings.device1;
        const targetName = settings.device1Name || 'Selected Device';

        if (!targetDevice) {
            console.log('Device not configured');
            return;
        }

        console.log(`Switching to: ${targetName} (${deviceType})`);
        const success = await switchDevice(targetDevice, targetName, deviceType);
        if (success) {
            setState(context, 0); // Always state 0 in selected mode
        }
    } else {
        // Mode: Toggle between two devices
        const device1 = settings.device1;
        const device2 = settings.device2;
        const device1Name = settings.device1Name || 'Device 1';
        const device2Name = settings.device2Name || 'Device 2';

        if (!device1 || !device2) {
            console.log('Devices not configured');
            return;
        }

        // Current state (0 = device1, 1 = device2)
        let currentState = settings.currentState || 0;
        let newState = currentState === 0 ? 1 : 0;
        let targetDevice = newState === 0 ? device1 : device2;
        let targetName = newState === 0 ? device1Name : device2Name;

        console.log(`Switching to: ${targetName} (${deviceType})`);

        const success = await switchDevice(targetDevice, targetName, deviceType);
        if (success) {
            settings.currentState = newState;
            setSettings(context, settings);
            setState(context, newState);
            // Update icon based on deviceType (input/output)
            updateDeviceIcon(context, settings);
            buttonContexts[context] = settings;
        }
    }
}

async function handleMessage(msg) {
    const data = JSON.parse(msg);
    // IMPORTANT: action UUID is in data.action, NOT in payload!
    const { event, context, payload, action } = data;

    console.log('Event:', event, 'Action:', action);

    switch(event) {
        case 'keyDown':
            // Merge saved settings with current payload settings
            const savedSettings = buttonContexts[context] || {};
            const currentSettings = { ...savedSettings, ...payload.settings };
            // Get action UUID from data.action (StreamDock API) or stored value
            const actionUUID = action || actionUUIDs[context] || 'com.lizard.switchaudio.toggle';
            await handleKeyDown(context, currentSettings, actionUUID);
            break;

        case 'keyUp':
            // Handle keyUp for Push to Talk
            const keyUpAction = action || actionUUIDs[context];
            if (keyUpAction === 'com.lizard.switchaudio.pushtotalk') {
                const pttSettings = { ...buttonContexts[context], ...payload.settings };
                await handlePushToTalk(context, pttSettings, false); // keyUp = mute
            }
            break;

        case 'willAppear':
            buttonContexts[context] = payload.settings;
            // Store action UUID for this context (from data.action)
            if (action) {
                actionUUIDs[context] = action;
            }
            // Update icon and state based on action type
            if (action === 'com.lizard.switchaudio.mute') {
                setState(context, payload.settings.currentState || 0);
                updateMuteIcon(context, payload.settings);
            } else if (action === 'com.lizard.switchaudio.toggle') {
                setState(context, payload.settings.currentState || 0);
                updateDeviceIcon(context, payload.settings);
            } else {
                setState(context, payload.settings.currentState || 0);
            }
            break;

        case 'willDisappear':
            delete buttonContexts[context];
            delete actionUUIDs[context];
            break;

        case 'didReceiveSettings':
            buttonContexts[context] = payload.settings;
            // Update icon based on action type
            if (actionUUIDs[context] === 'com.lizard.switchaudio.mute') {
                setState(context, payload.settings.currentState || 0);
                // Update icon AFTER setState to override manifest icons
                updateMuteIcon(context, payload.settings);
            } else if (actionUUIDs[context] === 'com.lizard.switchaudio.toggle') {
                setState(context, payload.settings.currentState || 0);
                // Update icon based on deviceType (input/output)
                updateDeviceIcon(context, payload.settings);
            }
            break;

        case 'sendToPlugin':
            if (payload.requestDevices) {
                const deviceType = payload.deviceType || 'output';
                const devices = await getAudioDevices(deviceType);
                send({
                    event: 'sendToPropertyInspector',
                    context: context,
                    payload: { devices: devices }
                });
            }
            break;
    }
}

function connect() {
    const args = process.argv;
    let port, pluginUUID, registerEvent;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '-port') port = args[i + 1];
        if (args[i] === '-pluginUUID') pluginUUID = args[i + 1];
        if (args[i] === '-registerEvent') registerEvent = args[i + 1];
    }

    if (!port) {
        console.log('No port specified');
        return;
    }

    console.log(`Connecting to ws://127.0.0.1:${port}`);

    ws = new WebSocket(`ws://127.0.0.1:${port}`);

    ws.on('open', () => {
        console.log('Connected to StreamDock');
        send({
            event: registerEvent,
            uuid: pluginUUID
        });
    });

    ws.on('message', (msg) => {
        handleMessage(msg.toString()).catch(err => console.log('Error:', err));
    });

    ws.on('close', () => {
        console.log('Disconnected, reconnecting in 3s...');
        setTimeout(connect, 3000);
    });

    ws.on('error', (err) => {
        console.log('WebSocket error:', err.message);
    });
}

if (!hasHelper && !hasNircmd) {
    console.log('WARNING: Neither AudioSwitch.exe nor nircmd.exe found!');
    console.log('Please run install.bat to set up the plugin.');
}

connect();
