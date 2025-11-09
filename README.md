Gotify Notifications GNOME Extension
====================================

A GNOME Shell extension that displays persistent notifications from your Gotify server. Features custom notification windows that stay visible until manually closed, completely independent of GNOME's native notification system.

<img src="https://img.shields.io/badge/GNOME-48+-orange?style=flat-square&logo=gnome"/> <img src="https://img.shields.io/badge/Gotify-Compatible-success?style=flat-square"/>

✨ Features
----------

*   🔔 **Persistent Notifications** - Custom notification windows that stay until manually closed
    
*   📝 **Text Wrapping** - Automatic wrapping for long messages with manual line breaking
    
*   ⚙️ **Configurable Settings** - Easy GUI configuration for server URL, token, and behavior
    
*   🔄 **Auto-Polling** - Automatically checks for new notifications at configurable intervals
    
*   🎨 **Custom Styling** - Beautiful rounded notifications with custom colors
    
*   📱 **Status Indicator** - System tray icon showing connection status (bell icons)
    
*   🚫 **Non-Intrusive** - Doesn't interfere with GNOME's native notifications
    
*   🎯 **Stacking Notifications** - Multiple notifications stack neatly at top of screen
    
*   🎪 **Smooth Animations** - Fade in/out effects for notifications
    

🖼️ Screenshots
---------------


*   Notifications example
  
  ![gotify-notifications](https://github.com/user-attachments/assets/05c7debd-58a0-4835-a4c9-bfa1db19fbcf)

    
*   Settings panel

   ![gotify-notifications-settings](https://github.com/user-attachments/assets/229937ea-664a-49de-b086-cbf631e61e87)

    

📦 Installation
---------------

### Method 1: From GNOME Extensions Website

1.  Visit [extensions.gnome.org](https://extensions.gnome.org/)
    
2.  Search for "Gotify Notifications"
    
3.  Click install
    

### Method 2: Manual Installation

 ```bash

# Clone or download this repository
git clone https://github.com/dodog/gotify-notifications.git

# Copy to extensions directory
cp \-r gotify-notifications/gotify-notifications@dodog.github.com ~/.local/share/gnome-shell/extensions/

# Compile schemas
cd ~/.local/share/gnome-shell/extensions/gotify-notifications@dodog.github.com
glib-compile-schemas schemas/

# Enable the extension
gnome-extensions enable gotify-notifications@dodog.github.com

# Restart GNOME Shell (Alt+F2, type 'r', press Enter)
 ```
⚙️ Configuration
----------------

### Gotify Server Setup

1.  **Get Your Client Token:**
    
    *   Open your Gotify web interface
        
    *   Go to Clients → Create a client
        
    *   Copy the client token
        
2.  **Extension Settings:**
    
    *   Click the bell icon in your system tray
        
    *   Select "Settings"
        
    *   Or run: `gnome-extensions prefs gotify-notifications@dodog.github.com`
        

### Available Settings

| Setting              | Type    | Default                  | Description                                          |
|----------------------|---------|--------------------------|------------------------------------------------------|
| Server URL           | String  | https://gotify.funguj.eu | Your Gotify server address                           |
| Client Token         | String  | (empty)                  | Your Gotify application token                        |
| Poll Interval        | Integer | 10                       | How often to check for notifications (5-300 seconds) |
| Notification Timeout | Integer | 0                        | Auto-close timer (0 = never auto-close)              |

🚀 Usage
--------

### Basic Operation

*   The extension automatically polls your Gotify server for new messages
    
*   Notifications appear as custom windows at the top center of your screen
    
*   Click the `✖` button to close individual notifications
    
*   Use the status menu to test notifications or clear all
    

### Status Indicator

*   **Bell Icon** (🔔): Connected and polling for notifications
    
*   **Crossed Bell** (🔕): Disconnected or polling stopped
    
*   **Right-click**: Access quick actions and settings
    

### Menu Options

*   **Test Custom Notification**: Send a test notification
    
*   **Connect/Disconnect**: Toggle automatic polling
    
*   **Settings**: Open configuration panel
    
*   **Clear All Notifications**: Remove all active notifications
    

🏗️ Building from Source
------------------------

### Prerequisites

*   GNOME Shell 46+
    
*   `glib-compile-schemas`
    
*   Git
    

### Development Setup

 ```bash

git clone https://github.com/yourusername/gnome-gotify-notifications.git
cd gnome-gotify-notifications

# Enable development mode
gnome-extensions enable gotify-notifications@dodog.github.com

# Monitor logs for debugging
journalctl \-f \-o cat | grep \-i gotify
 ```

📁 File Structure
-----------------

 ```bash


gotify-notifications@dodog.github.com/
├── extension.js          # Main extension code
├── prefs.js             # Settings panel
├── metadata.json        # Extension metadata
├── stylesheet.css       # Notification styling
└── schemas/
    └── org.gnome.shell.extensions.gotify-notifications.gschema.xml

 ```


🐛 Troubleshooting
------------------

### Common Issues

**Notifications not appearing:**

*   Verify your Gotify server URL and client token
    
*   Check if curl is installed: `which curl`
    
*   Check logs: `journalctl -f -o cat | grep -i gotify`
    

**Extension not loading:**

*   Restart GNOME Shell: `Alt+F2` → `r` → `Enter`
    
*   Check if schemas are compiled: `glib-compile-schemas schemas/`
    
*   Verify installation path
    

**Settings not saving:**

*   Ensure schemas are properly compiled
    
*   Check file permissions
    

### Debugging

Enable debug logging by monitoring system logs:

 ```bash

journalctl \-f \-o cat | grep \-i gotify
 ```

🔧 Technical Details
--------------------

### Notification System

*   Custom `St.Widget` containers (not GNOME's notification system)
    
*   Completely independent and persistent
    
*   Stacking with automatic positioning
    
*   Smooth Clutter animations
    

📋 Compatibility
----------------

*   **GNOME Shell**: 46, 47, 48+
    
*   **Gotify Server**: 2.0+
    
*   **Dependencies**: curl
    

🤝 Contributing
---------------

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

### Development Guidelines

*   Follow GNOME extension best practices
    
*   Test on multiple GNOME Shell versions
    
*   Ensure compatibility with Gotify API
    

📄 License
----------

This project is licensed under the GPL-3.0 License - see the [LICENSE](https://license/) file for details.

🙏 Acknowledgments
------------------

*   Gotify team for the excellent notification server
    
*   GNOME project for the extension system
    
*   Contributors and testers
    

❓ Support
---------

*   **Issues**: [GitHub Issues](https://github.com/yourusername/gnome-gotify-notifications/issues)
    
*   **Gotify Documentation**: [gotify.net](https://gotify.net/docs)
    
*   **GNOME Extensions**: [extensions.gnome.org](https://extensions.gnome.org/)
    

* * *

**Note**: This extension is not officially affiliated with Gotify or GNOME.
