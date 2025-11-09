//  Gotify notifications extension
//  Custom Gotify notifications
//  https://github.com/dodog/gotify-notifications    

'use strict';

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

export default class GotifyExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._pollTimeoutId = null;
        this._isConnected = false;
        this._statusIndicator = null;
        this._statusIcon = null;
        this._lastMessageId = 0;
        this._notifications = [];
        this._settings = null;
    }

    enable() {
        console.log('Gotify: Enabling extension...');
        
        // Initialize settings
        this._settings = this.getSettings();
        
        // Create status indicator
        this._createStatusIndicator();
        
        // Test with immediate custom notification
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
            console.log('Gotify: Showing test custom notification');
            this._showCustomNotification('Gotify Test', 'Setup your Gotify url and token in extension settings! Click the X to close.');
            return GLib.SOURCE_REMOVE;
        });
        
        // Start polling
        this._startPolling();
        
        console.log('Gotify Notifications extension enabled');
    }

    disable() {
        console.log('Gotify: Disabling extension...');
        this._stopPolling();
        
        // Close all active notifications and clear the array
        this._clearAllNotifications();
        this._notifications = []; // Ensure the array is cleared
        
        if (this._statusIndicator) {
            this._statusIndicator.destroy();
            this._statusIndicator = null;
        }
        
        // Destroy the status icon if it exists independently
        if (this._statusIcon) {
            this._statusIcon.destroy();
            this._statusIcon = null;
        }
        
        if (this._settings) {
            this._settings = null;
        }
        
        console.log('Gotify Notifications extension disabled');
    }

    _createStatusIndicator() {
        this._statusIndicator = new PanelMenu.Button(0.0, this.metadata.uuid, false);
        
        this._statusIcon = new St.Icon({
            gicon: new Gio.ThemedIcon({ name: 'bell-outline-symbolic' }),
            style_class: 'system-status-icon'
        });
        
        this._statusIndicator.add_child(this._statusIcon);
        
        // Add menu items
        const menu = this._statusIndicator.menu;
        
        const testItem = new PopupMenu.PopupMenuItem('Test Custom Notification');
        testItem.connect('activate', () => {
            console.log('Gotify: Manual custom test notification triggered');
            this._showCustomNotification('Manual Test', 'This is a persistent custom notification! Close with X button.');
        });
        menu.addMenuItem(testItem);
        
        const connectionItem = new PopupMenu.PopupMenuItem('Connect/Disconnect');
        connectionItem.connect('activate', () => {
            this._toggleConnection();
        });
        menu.addMenuItem(connectionItem);
        
        const settingsItem = new PopupMenu.PopupMenuItem('Settings');
        settingsItem.connect('activate', () => {
            this._openSettings();
        });
        menu.addMenuItem(settingsItem);
        
        const clearItem = new PopupMenu.PopupMenuItem('Clear All Notifications');
        clearItem.connect('activate', () => {
            this._clearAllNotifications();
        });
        menu.addMenuItem(clearItem);
        
        Main.panel.addToStatusArea(this.metadata.uuid, this._statusIndicator);
        console.log('Gotify: Status indicator created');
    }

    _openSettings() {
        try {
            // Open extension preferences
            let command = 'gnome-extensions prefs ' + this.metadata.uuid;
            GLib.spawn_command_line_async(command);
        } catch (error) {
            console.error('Gotify: Failed to open settings:', error);
            this._showCustomNotification('Gotify Error', 'Failed to open settings. Please open Extensions app manually.');
        }
    }

    _showCustomNotification(title, message) {
        console.log(`Gotify: Creating custom notification: ${title}`);
        
        // Calculate needed height based on message length
        const lineHeight = 18; // Approximate pixels per line
        const maxLines = 8; // Maximum lines to show
        const baseHeight = 80; // Height for header and padding
        
        // Simple manual text wrapping
        const wrappedText = this._wrapText(message || '', 50); // 50 chars per line
        const lineCount = Math.min(maxLines, wrappedText.split('\n').length);
        const messageHeight = lineCount * lineHeight;
        const totalHeight = baseHeight + messageHeight;
        
        // Create main container
        const container = new St.BoxLayout({
            vertical: true,
            style_class: 'gotify-notification',
            reactive: true,
            track_hover: true,
            width: 400,
            height: totalHeight
        });
        
        // Header with title and close button
        const header = new St.BoxLayout({
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
        
        closeButton.connect('clicked', () => {
            console.log('Gotify: Closing notification');
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
        const timeout = this._settings.get_int('notification-timeout');
        if (timeout > 0) {
            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, timeout, () => {
                if (this._notifications.includes(container)) {
                    this._removeNotification(container);
                }
                return GLib.SOURCE_REMOVE;
            });
        }
        
        // Fade in animation
        container.opacity = 0;
        container.ease({
            opacity: 255,
            duration: 300,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD
        });
        
        console.log(`Gotify: Custom notification created with ${lineCount} lines, height ${totalHeight}`);
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

    _removeNotification(notification) {
        console.log('Gotify: Removing notification');
        
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

    _clearAllNotifications() {
        console.log('Gotify: Clearing all notifications');
        const notificationsCopy = [...this._notifications];
        notificationsCopy.forEach(notification => {
            this._removeNotification(notification);
        });
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
        if (this._pollTimeoutId) {
            GLib.source_remove(this._pollTimeoutId);
        }
        
        const pollInterval = this._settings.get_int('poll-interval');
        
        this._pollTimeoutId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            pollInterval,
            () => {
                console.log('Gotify: Polling for notifications...');
                this._pollNotifications();
                return GLib.SOURCE_CONTINUE;
            }
        );
        
        this._isConnected = true;
        this._updateStatusIcon();
        console.log(`Gotify: Started polling every ${pollInterval} seconds`);
    }

    _stopPolling() {
        if (this._pollTimeoutId) {
            GLib.source_remove(this._pollTimeoutId);
            this._pollTimeoutId = null;
        }
        
        this._isConnected = false;
        this._updateStatusIcon();
        console.log('Gotify: Stopped polling');
    }

    _pollNotifications() {
        const gotifyUrl = this._settings.get_string('gotify-url');
        const clientToken = this._settings.get_string('client-token');
        
        const url = `${gotifyUrl}/message?token=${clientToken}&limit=5`;
        
        console.log('Gotify: Fetching from URL:', url);
        
        this._httpGet(url).then(bytes => {
            if (!bytes) {
                console.log('Gotify: No data received');
                return;
            }
            
            try {
                const data = new TextDecoder().decode(bytes);
                console.log('Gotify: Raw response received');
                const jsonData = JSON.parse(data);
                
                if (jsonData.messages && jsonData.messages.length > 0) {
                    console.log(`Gotify: Found ${jsonData.messages.length} messages`);
                    for (let i = jsonData.messages.length - 1; i >= 0; i--) {
                        const message = jsonData.messages[i];
                        console.log(`Gotify: Message ${message.id}: ${message.title} - ${message.message}`);
                        if (message.id > this._lastMessageId) {
                            console.log(`Gotify: New message found, showing custom notification: ${message.title}`);
                            this._showCustomNotification(message.title, message.message);
                            this._lastMessageId = Math.max(this._lastMessageId, message.id);
                        }
                    }
                } else {
                    console.log('Gotify: No messages in response');
                }
            } catch (error) {
                console.error('Gotify: Failed to parse response:', error);
            }
        }).catch(error => {
            console.error('Gotify: Failed to poll:', error);
            this._isConnected = false;
            this._updateStatusIcon();
            this._showCustomNotification('Gotify Error', 'Failed to connect to Gotify server. Check your settings.');
        });
    }

    _httpGet(url) {
        return new Promise((resolve) => {
            try {
                console.log('Gotify: Making HTTP request...');
                const [success, stdout, stderr] = GLib.spawn_command_line_sync(`curl -s -H "Accept: application/json" "${url}"`);
                if (success && stdout) {
                    console.log('Gotify: HTTP request successful');
                    resolve(stdout);
                } else {
                    const errorMsg = stderr ? new TextDecoder().decode(stderr) : 'Unknown error';
                    console.error('Gotify: curl command failed:', errorMsg);
                    resolve(null);
                }
            } catch (e) {
                console.error('Gotify: HTTP request failed:', e);
                resolve(null);
            }
        });
    }
}