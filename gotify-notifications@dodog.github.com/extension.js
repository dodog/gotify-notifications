//  Gotify notifications extension
//  Custom Gotify notifications
//  https://github.com/dodog/gotify-notifications    

'use strict';

import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Soup from 'gi://Soup';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

// Notification Manager class to handle notification-related functionality
const NotificationManager = GObject.registerClass(
class NotificationManager extends GObject.Object {
    constructor(extension) {
        super();
        this.extension = extension;
        this._notifications = [];
    }

    showCustomNotification(title, message) {
        // Use debug mode setting if available
        const debugMode = this.extension._settings?.get_boolean('debug-mode') || false;
        if (debugMode) {
            console.log(`Gotify: Creating custom notification: ${title}`);
        }
        
        // Calculate needed height based on message length
        const lineHeight = 18;
        const maxLines = 8;
        const baseHeight = 80;
        
        const wrappedText = this._wrapText(message || '', 50);
        const lineCount = Math.min(maxLines, wrappedText.split('\n').length);
        const messageHeight = lineCount * lineHeight;
        const totalHeight = baseHeight + messageHeight;
        
        // Create main container
        const container = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: 'gotify-notification',
            reactive: true,
            track_hover: true,
            width: 500,
            height: totalHeight
        });
        
        // Header with title and close button
        const header = new St.BoxLayout({
            orientation: Clutter.Orientation.HORIZONTAL, 
            style_class: 'gotify-header'
        });
        
        const titleLabel = new St.Label({
            text: title || 'Gotify',
            style_class: 'gotify-title',
            x_expand: true
        });
        
        const closeButton = new St.Button({
            style_class: 'gotify-close-button',
            child: new St.Label({ text: '✖', style_class: 'gotify-close-icon' })
        });
        
        // Store close button reference for safe disconnection
        container._closeButton = closeButton;
        container._closeHandlerId = closeButton.connect('clicked', () => {
            if (debugMode) {
                console.log('Gotify: Closing notification');
            }
            this._removeNotification(container);
        });
        
        header.add_child(titleLabel);
        header.add_child(closeButton);
        
        // Message content with manual wrapping
        const messageLabel = new St.Label({
            text: wrappedText,
            style_class: 'gotify-message'
        });
        
        container.add_child(header);
        container.add_child(messageLabel);
        
        // Position the notification
        const monitor = Main.layoutManager.primaryMonitor;
        container.x = Math.floor((monitor.width - 400) / 2);
        container.y = 20 + (this._notifications.length * (totalHeight + 10));
        
        // Add to UI
        Main.uiGroup.add_child(container);
        
        // Store reference
        this._notifications.push(container);
        
        // Auto-close if timeout is set (0 = never auto-close)
        const timeoutSeconds = this.extension._settings.get_int('notification-timeout');
        if (timeoutSeconds > 0) {
            // STORE the timeout ID so it can be removed later
            container._autoCloseTimeoutId = GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT, 
                timeoutSeconds, 
                () => {
                    if (this._notifications.includes(container)) {
                        this._removeNotification(container);
                    }
                    return GLib.SOURCE_REMOVE;
                }
            );
        }
        
        // Fade in animation
        container.opacity = 0;
        container.ease({
            opacity: 255,
            duration: 300,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD
        });
    }

    // Wrapping helper function 
    _wrapText(text, maxLineLength = 50) {
        if (!text) return '';
        
        const words = text.split(' ');
        let lines = [];
        let currentLine = '';
        
        words.forEach(word => {
            // If adding this word would make the line too long, start a new line
            if (currentLine.length + word.length + 1 > maxLineLength) {
                if (currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    // Single word is longer than maxLineLength, split it
                    while (word.length > maxLineLength) {
                        lines.push(word.substring(0, maxLineLength));
                        word = word.substring(maxLineLength);
                    }
                    currentLine = word;
                }
            } else {
                currentLine = currentLine ? currentLine + ' ' + word : word;
            }
        });
        
        // Add the last line
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines.join('\n');
    }

    clearAllNotificationsSync() {
        const debugMode = this.extension._settings?.get_boolean('debug-mode') || false;
        if (debugMode) {
            console.log('Gotify: Synchronously clearing all notifications');
        }
        
        // Create a copy to avoid modification during iteration
        const notificationsCopy = [...this._notifications];
        
        notificationsCopy.forEach(notification => {
            // Remove the auto-close timeout if it exists
            if (notification._autoCloseTimeoutId) {
                GLib.source_remove(notification._autoCloseTimeoutId);
                notification._autoCloseTimeoutId = null;
            }   

            // Disconnect the close button signal safely
            if (notification._closeHandlerId && notification._closeButton) {
                notification._closeButton.disconnect(notification._closeHandlerId);
                notification._closeHandlerId = null;
                notification._closeButton = null;
            }
            
            // Destroy immediately without animation
            notification.destroy();
        });
        
        // Clear the array
        this._notifications.length = 0;
        
        if (debugMode) {
            console.log('Gotify: All notifications cleared synchronously');
        }
    }

    // Keep the existing animated version for normal use
    clearAllNotifications() {
        const debugMode = this.extension._settings?.get_boolean('debug-mode') || false;
        if (debugMode) {
            console.log('Gotify: Clearing all notifications with animation');
        }
        const notificationsCopy = [...this._notifications];
        notificationsCopy.forEach(notification => {
            this._removeNotification(notification);
        });
    }

    _removeNotification(notification) {
        const debugMode = this.extension._settings?.get_boolean('debug-mode') || false;
        if (debugMode) {
            console.log('Gotify: Removing notification');
        }

        // Remove the auto-close timeout if it exists
        if (notification._autoCloseTimeoutId) {
            GLib.source_remove(notification._autoCloseTimeoutId);
            notification._autoCloseTimeoutId = null;
        }
        
        // Disconnect the close button signal safely
        if (notification._closeHandlerId && notification._closeButton) {
            notification._closeButton.disconnect(notification._closeHandlerId);
            notification._closeHandlerId = null;
            notification._closeButton = null;
        }

        // Try animation, but have fallback for immediate destruction
        notification.ease({
            opacity: 0,
            duration: 200,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                // Remove from array
                const index = this._notifications.indexOf(notification);
                if (index > -1) {
                    this._notifications.splice(index, 1);
                }
                
                // Destroy the widget
                notification.destroy();
                // Reposition remaining notifications
                this._repositionNotifications();
            }
        });
    }

    _repositionNotifications() {
        this._notifications.forEach((notification, index) => {
            notification.y = 20 + (index * 130);
        });
    }
});

// Network Client class to handle HTTP requests using Soup
const NetworkClient = GObject.registerClass(
class NetworkClient extends GObject.Object {
    constructor(settings) {
        super();
        this._session = new Soup.Session();
        this._settings = settings;
        
        if (settings && settings.get_int) {
            this._session.timeout = settings.get_int('request-timeout');
        } else {
            this._session.timeout = 10;
        }
        
        this._session.user_agent = 'gotify-notifications-extension/1.0';
    }

    _isDebugMode() {
        return this._settings && this._settings.get_boolean('debug-mode');
    }

    async httpGet(url) {
        return new Promise((resolve, reject) => {
            const debugMode = this._isDebugMode();
            
            if (debugMode) {
                console.log('Gotify: Making HTTP request with Soup to:', url);
            }
            
            const message = Soup.Message.new('GET', url);
            
            if (!message) {
                reject(new Error('Could not create message for URL: ' + url));
                return;
            }

            // Set headers
            const headers = message.get_request_headers();
            
            // Use Authorization header instead of URL parameter
            const clientToken = this._settings?.get_string('client-token') || '';
            if (clientToken) {
                headers.append('X-Gotify-Key', clientToken);
            }
            
            headers.append('Accept', 'application/json');
            headers.append('User-Agent', 'gotify-notifications-extension/1.0');

            this._session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                const bytes = this._session.send_and_read_finish(result);
                const status = message.get_status();
                
                if (debugMode) {
                    console.log('Gotify: HTTP status:', status);
                }
                
                if (status === Soup.Status.OK && bytes) {
                    if (debugMode) {
                        console.log('Gotify: HTTP request successful');
                    }
                    resolve(bytes);
                } else {
                    const errorMsg = `HTTP error ${status}`;
                    if (debugMode) {
                        console.error('Gotify: Soup request failed:', errorMsg);
                    }
                    
                    // Provide more specific error messages
                    if (status === Soup.Status.SSL_FAILED) {
                        reject(new Error('SSL certificate error - check if your Gotify URL uses HTTPS'));
                    } else if (status === Soup.Status.CANT_RESOLVE) {
                        reject(new Error('Cannot resolve server address - check your Gotify URL'));
                    } else if (status === Soup.Status.CANT_CONNECT) {
                        reject(new Error('Cannot connect to server - check your Gotify URL and network connection'));
                    } else if (status === Soup.Status.UNAUTHORIZED) {
                        reject(new Error('Authentication failed - check your client token'));
                    } else {
                        reject(new Error(errorMsg));
                    }
                }
            });
        });
    }

    destroy() {
        if (this._session) {
            this._session.abort();
            this._session.close();
            this._session = null;
        }
    }
});

// Main extension class - focused on coordination
export default class GotifyExtension extends Extension {
    constructor(metadata) {
        super(metadata);
    }

    enable() {
        // Initialize settings
        this._settings = this.getSettings();
        
        const debugMode = this._settings?.get_boolean('debug-mode') || false;
        if (debugMode) {
            console.log('Gotify: Enabling extension...');
        }

        // All property initialization
        this._pollTimeoutId = null;
        this._isConnected = false;
        this._statusIndicator = null;
        this._statusIcon = null;
        this._lastMessageId = 0;
        this._notificationManager = null;
        this._networkClient = null;
        this._consecutiveErrors = 0;
        this._handlerIds = []; 
        this._menuItems = []; 
        this._pollIntervalChangedId = null; 
        this._requestTimeoutChangedId = null; 
      
        // Initialize managers
        this._notificationManager = new NotificationManager(this);
        this._networkClient = new NetworkClient(this._settings);
        
        // Set up settings change listeners
        this._setupSettingsListeners();

        // Create status indicator
        this._createStatusIndicator();
                
        // Start polling
        this._startPolling();
        
        if (debugMode) {
            console.log('Gotify Notifications extension enabled');
        }
    }

    disable() {
        const debugMode = this._settings?.get_boolean('debug-mode') || false;
        if (debugMode) {
            console.log('Gotify: Disabling extension...');
        }
        
        this._stopPolling();

        // Clean up settings change listeners
        if (this._pollIntervalChangedId) {
            this._settings.disconnect(this._pollIntervalChangedId);
            this._pollIntervalChangedId = null;
        }
        
        // Clean up request timeout listener
        if (this._requestTimeoutChangedId) {
            this._settings.disconnect(this._requestTimeoutChangedId);
            this._requestTimeoutChangedId = null;
        }

        // SIGNAL CLEANUP: Disconnect all stored signal handlers
        if (this._handlerIds) {
            this._handlerIds.forEach(({obj, id}) => {
                if (obj && typeof obj.disconnect === 'function') {
                    obj.disconnect(id);
                }
            });
            this._handlerIds = null;
        }
        
        // MENU ITEM CLEANUP: Destroy stored menu items
        if (this._menuItems) {
            this._menuItems.forEach(item => {
                if (item && typeof item.destroy === 'function') {
                    item.destroy();
                }
            });
            this._menuItems = null;
        }
        
        // Clear all notifications
        if (this._notificationManager) {
            this._notificationManager.clearAllNotificationsSync();
            this._notificationManager = null;
        }
        
        // Clean up status indicator
        if (this._statusIndicator) {
            this._statusIndicator.destroy();
            this._statusIndicator = null;
        }
        
        if (this._statusIcon) {
            this._statusIcon.destroy();
            this._statusIcon = null;
        }
        
        // Clean up network client
        if (this._networkClient) {
            this._networkClient.destroy();
            this._networkClient = null;
        }
        
        if (this._settings) {
            this._settings = null;
        }
        
        // Reset error counter
        this._consecutiveErrors = 0;
        
        if (debugMode) {
            console.log('Gotify Notifications extension disabled');
        }
    }

    _createStatusIndicator() {
        this._statusIndicator = new PanelMenu.Button(0.0, this.metadata.uuid, false);
        
        this._statusIcon = new St.Icon({
            gicon: new Gio.ThemedIcon({ name: 'bell-outline-symbolic' }),
            style_class: 'system-status-icon'
        });
        
        this._statusIndicator.add_child(this._statusIcon);
        
        // Store menu item references
        this._menuItems = [];
        
        const menu = this._statusIndicator.menu;
        
        const testItem = new PopupMenu.PopupMenuItem('Test Custom Notification');
        const testHandlerId = testItem.connect('activate', () => {
            const debugMode = this._settings.get_boolean('debug-mode');
            if (debugMode) {
                console.log('Gotify: Manual custom test notification triggered');
            }
            this._notificationManager.showCustomNotification('Manual Test', 'This is a persistent custom notification! Close with X button.');
        });
        this._handlerIds.push({obj: testItem, id: testHandlerId});
        this._menuItems.push(testItem);
        menu.addMenuItem(testItem);
        
        const connectionItem = new PopupMenu.PopupMenuItem('Connect/Disconnect');
        const connectionHandlerId = connectionItem.connect('activate', () => {
            this._toggleConnection();
        });
        this._handlerIds.push({obj: connectionItem, id: connectionHandlerId});
        this._menuItems.push(connectionItem);
        menu.addMenuItem(connectionItem);
        
        const settingsItem = new PopupMenu.PopupMenuItem('Settings');
        const settingsHandlerId = settingsItem.connect('activate', () => {
            this.openPreferences();
        });
        this._handlerIds.push({obj: settingsItem, id: settingsHandlerId});
        this._menuItems.push(settingsItem);
        menu.addMenuItem(settingsItem);
        
        const clearItem = new PopupMenu.PopupMenuItem('Clear All Notifications');
        const clearHandlerId = clearItem.connect('activate', () => {
            this._notificationManager.clearAllNotifications();
        });
        this._handlerIds.push({obj: clearItem, id: clearHandlerId});
        this._menuItems.push(clearItem);
        menu.addMenuItem(clearItem);
        
        Main.panel.addToStatusArea(this.metadata.uuid, this._statusIndicator);
        
        const debugMode = this._settings?.get_boolean('debug-mode') || false;
        if (debugMode) {
            console.log('Gotify: Status indicator created');
        }
        
        // Update initial status
        this._updateStatusIcon();
    }

    _toggleConnection() {
        if (this._isConnected) {
            this._stopPolling();
        } else {
            this._startPolling();
        }
    }

    _updateStatusIcon() {
        const iconName = this._isConnected ? 
            'bell-symbolic' : 'bell-disabled-symbolic';
        this._statusIcon.gicon = new Gio.ThemedIcon({ name: iconName });
    }

    _startPolling() {
        // Remove existing timeout before creating a new one
        this._stopPolling();
        
        const pollInterval = this._settings.get_int('poll-interval');
        
        this._pollTimeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            pollInterval,
            () => {
                const debugMode = this._settings.get_boolean('debug-mode');
                if (debugMode) {
                    console.log('Gotify: Polling for notifications...');
                }
                this._pollNotifications();
                return GLib.SOURCE_CONTINUE;
            }
        );
        
        this._isConnected = true;
        this._updateStatusIcon();
        
        const debugMode = this._settings.get_boolean('debug-mode');
        if (debugMode) {
            console.log(`Gotify: Started polling every ${pollInterval} seconds`);
        }
    }

    // Listener for settings change 
    _setupSettingsListeners() {
        const debugMode = this._settings.get_boolean('debug-mode');
        
        // Listen for poll-interval changes
        this._pollIntervalChangedId = this._settings.connect('changed::poll-interval', () => {
            if (debugMode) {
                const newInterval = this._settings.get_int('poll-interval');
                console.log(`Gotify: Poll interval changed to ${newInterval} seconds, restarting polling...`);
            }
            
            // Only restart if we're currently connected and polling
            if (this._isConnected) {
                this._startPolling();
            }
        });
        
        // Listen for request-timeout changes
        this._requestTimeoutChangedId = this._settings.connect('changed::request-timeout', () => {
            if (debugMode) {
                const newTimeout = this._settings.get_int('request-timeout');
                console.log(`Gotify: Request timeout changed to ${newTimeout} seconds`);
            }    
            // NetworkClient will use the new timeout on next request
            // No need to restart anything immediately
        });

        if (debugMode) {
            console.log('Gotify: Settings change listeners registered');
        }
    }

    _stopPolling() {
        if (this._pollTimeoutId) {
            GLib.source_remove(this._pollTimeoutId);
            this._pollTimeoutId = null;
        }
        
        this._isConnected = false;
        this._updateStatusIcon();
        
        const debugMode = this._settings?.get_boolean('debug-mode');
        if (debugMode) {
            console.log('Gotify: Stopped polling');
        }
    }

    async _pollNotifications() {
        const gotifyUrl = this._settings.get_string('gotify-url');
        const debugMode = this._settings.get_boolean('debug-mode');
        
        // Validate settings
        const clientToken = this._settings.get_string('client-token') || '';
        if (!gotifyUrl || !clientToken.trim()) {
            if (debugMode) {
                console.log('Gotify: Missing URL or token in settings');
            }
            
            // Show user-friendly notification only once to avoid spam
            if (this._consecutiveErrors === 0) {
                this._notificationManager.showCustomNotification(
                    'Gotify Configuration Required',
                    'Please set your Gotify server URL in extension settings.'
                );
            }
            
            this._isConnected = false;
            this._updateStatusIcon();
            this._consecutiveErrors++;
            return;
        }
        
        // Reset consecutive errors if we have valid settings
        if (this._consecutiveErrors > 0) {
            this._consecutiveErrors = 0;
        }

        // SECURE URL no longer contains token
        const url = `${gotifyUrl}/message?limit=5`;
        
        if (debugMode) {
            console.log('Gotify: Fetching from URL:', url);
        }
        
        try {
            const bytes = await this._networkClient.httpGet(url);
            
            if (!bytes) {
                if (debugMode) {
                    console.log('Gotify: No data received');
                }
                return;
            }
            
            const data = new TextDecoder().decode(bytes.get_data());
            if (debugMode) {
                console.log('Gotify: Raw response received, length:', data.length);
            }
            
            const jsonData = JSON.parse(data);
            
            if (jsonData.messages && jsonData.messages.length > 0) {
                if (debugMode) {
                    console.log(`Gotify: Found ${jsonData.messages.length} messages`);
                }
                for (let i = jsonData.messages.length - 1; i >= 0; i--) {
                    const message = jsonData.messages[i];
                    if (debugMode) {
                        console.log(`Gotify: Message ${message.id}: ${message.title} - ${message.message}`);
                    }
                    if (message.id > this._lastMessageId) {
                        if (debugMode) {
                            console.log(`Gotify: New message found, showing custom notification: ${message.title}`);
                        }
                        this._notificationManager.showCustomNotification(message.title, message.message);
                        this._lastMessageId = Math.max(this._lastMessageId, message.id);
                    }
                }
            } else {
                if (debugMode) {
                    console.log('Gotify: No messages in response');
                }
            }
            
            // If we got here, we're connected
            this._isConnected = true;
            this._updateStatusIcon();
            this._consecutiveErrors = 0; // Reset on successful poll
            

        } catch (error) {
            if (debugMode) {
                console.error('Gotify: Failed to poll:', error);
            }
            this._isConnected = false;
            this._updateStatusIcon();

            // Show connection error after multiple consecutive failures to avoid spam
            if (this._consecutiveErrors++ > 3) {
                this._notificationManager.showCustomNotification(
                    'Gotify Connection Error',
                    `Cannot connect to server: ${error.message}`
                );
                this._consecutiveErrors = 0; // Reset counter after showing error
            }
        }
    }
}