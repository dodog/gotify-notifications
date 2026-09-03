//  Gotify notifications extension
//  Custom Gotify notifications
//  https://github.com/dodog/gotify-notifications

'use strict';

import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
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

    showCustomNotification(title, message, msgDate, messageId = null) {
        this.extension._log(`Creating custom notification: ${title}`);

        // Calculate needed height based on message length
        const lineHeight = 18;
        const maxLines = 16;
        const maxMessageAreaHeight = maxLines * lineHeight;

        const messageText = message || '';

        // Create main container
        const container = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            style_class: 'gotify-notification',
            reactive: true,
            track_hover: true,
            width: 500
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
            child: new St.Icon({ icon_name: 'window-close-symbolic', style_class: 'gotify-close-icon' })
        });

        // Store close button reference for safe disconnection
        container._closeButton = closeButton;
        container._closeHandlerId = closeButton.connect('clicked', () => {
            this.extension._log('Closing notification');
            this._removeNotification(container);
        });

        header.add_child(titleLabel);

        // Show delete-on-server button for Gotify messages
        if (messageId !== null && messageId !== undefined) {
            const deleteButton = new St.Button({
                style_class: 'gotify-delete-button',
                child: new St.Icon({ icon_name: 'user-trash-symbolic', style_class: 'gotify-delete-icon' })
            });

            container._deleteButton = deleteButton;
            container._deleteHandlerId = deleteButton.connect('clicked', () => {
                this.extension._log(`Deleting message ${messageId} on server`);
                deleteButton.reactive = false; // prevent double-clicks
                this._deleteMessageOnServer(messageId, container);
            });

            header.add_child(deleteButton);
        }

        header.add_child(closeButton);

        // Message content with native wrapping
        const messageLabel = new St.Label({
            text: messageText,
            style_class: 'gotify-message'
        });
        messageLabel.clutter_text.line_wrap = true;
        messageLabel.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        messageLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;

        const dateStr = new Date(msgDate).toLocaleString();
        const dateLabel = new St.Label({
            text: dateStr,
            style_class: 'gotify-footer'
        });

        // Wrap the message label
        const messageWrapper = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true
        });
        messageWrapper.add_child(messageLabel);

        container.add_child(header);
        container.add_child(messageWrapper);
        container.add_child(dateLabel);

        // Add to the UI
        Main.uiGroup.add_child(container);

        // Clip only the message area
        let [, messageNaturalHeight] = messageLabel.get_preferred_height(470);
        if (messageNaturalHeight > maxMessageAreaHeight) {
            messageWrapper.height = maxMessageAreaHeight;
            messageWrapper.clip_to_allocation = true;

            // Add info when message too long
            const truncatedLabel = new St.Label({
                text: '⋯ message too long - truncated',
                style_class: 'gotify-truncated-notice'
            });
            container.insert_child_below(truncatedLabel, dateLabel);
        }

        let [, naturalHeight] = container.get_preferred_height(500);
        container._notificationHeight = naturalHeight;

        // Fix for fullscreen overlay (unredirecting)
        global.compositor.disable_unredirect();
        container._unredirectDisabled = true;

        // Position the notification
        const monitor = Main.layoutManager.primaryMonitor;
        container.x = Math.floor((monitor.width - 400) / 2);

        let offsetY = 20;
        this._notifications.forEach(n => {
            offsetY += n._notificationHeight + 10;
        });
        container.y = offsetY;

        // Store reference
        this._notifications.push(container);

        // Auto-close if timeout is set (0 = never auto-close)
        const timeoutSeconds = this.extension._settings.get_int('notification-timeout');
        if (timeoutSeconds > 0) {
            // Track the timeout ID so it can be cancelled if the notification is closed early
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

    // Delete the message on the Gotify server
    async _deleteMessageOnServer(messageId, container) {
        const gotifyUrl = this.extension._settings.get_string('gotify-url');

        if (!gotifyUrl) {
            this.extension._log('Cannot delete message: no Gotify URL configured', true);
            this._removeNotification(container);
            return;
        }

        const url = `${gotifyUrl}/message/${messageId}`;

        try {
            await this.extension._networkClient.httpDelete(url);
            this.extension._log(`Message ${messageId} deleted on server`);
        } catch (error) {
            this.extension._log(`Failed to delete message ${messageId} on server: ${error}`, true);
        }

        this._removeNotification(container);
    }

    destroy() {
        this.extension._log('Clearing all notifications');

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

            // Disconnect the delete button signal safely
            if (notification._deleteHandlerId && notification._deleteButton) {
                notification._deleteButton.disconnect(notification._deleteHandlerId);
                notification._deleteHandlerId = null;
                notification._deleteButton = null;
            }

            // Re-allow compositor unredirection 
            if (notification._unredirectDisabled) {
                global.compositor.enable_unredirect();
                notification._unredirectDisabled = false;
            }

            // Destroy immediately without animation
            notification.destroy();
        });

        // Clear the array
        this._notifications.length = 0;
    }

    // Animated close for user-triggered clearing
    clearAllNotifications() {
        this.extension._log('Clearing all notifications with animation');
        const notificationsCopy = [...this._notifications];
        notificationsCopy.forEach(notification => {
            this._removeNotification(notification);
        });
    }

    _removeNotification(notification) {
        this.extension._log('Removing notification');

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

        // Disconnect the delete button signal safely
        if (notification._deleteHandlerId && notification._deleteButton) {
            notification._deleteButton.disconnect(notification._deleteHandlerId);
            notification._deleteHandlerId = null;
            notification._deleteButton = null;
        }

        // Re-allow compositor unredirection
        if (notification._unredirectDisabled) {
            global.compositor.enable_unredirect();
            notification._unredirectDisabled = false;
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
        let offsetY = 20;
        this._notifications.forEach(notification => {
            notification.y = offsetY;
            offsetY += notification._notificationHeight + 10;
        });
    }
});

// Network Client class to handle HTTP requests using Soup
const NetworkClient = GObject.registerClass(
class NetworkClient extends GObject.Object {
    constructor(extension) {
        super();
        this.extension = extension;
        this._session = new Soup.Session();
        this._session.timeout = extension._settings.get_int('request-timeout');
        this._session.user_agent = 'gotify-notifications-extension/1.0';
    }

    // Shared auth header used by every request
    _addAuthHeader(headers) {
        const clientToken = this.extension._settings.get_string('client-token') || '';
        if (clientToken) {
            headers.append('X-Gotify-Key', clientToken);
        }
    }

    async httpGet(url) {
        return new Promise((resolve, reject) => {
            this.extension._log(`Making HTTP request with Soup to: ${url}`);

            const message = Soup.Message.new('GET', url);

            if (!message) {
                reject(new Error('Could not create message for URL: ' + url));
                return;
            }

            // Set headers
            const headers = message.get_request_headers();
            this._addAuthHeader(headers);
            headers.append('Accept', 'application/json');

            this._session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                const bytes = session.send_and_read_finish(result);
                const status = message.get_status();

                this.extension._log(`HTTP status: ${status}`);

                if (status === Soup.Status.OK && bytes) {
                    this.extension._log('HTTP request successful');
                    resolve(bytes);
                } else {
                    const errorMsg = `HTTP error ${status}`;
                    this.extension._log(`Soup request failed: ${errorMsg}`, true);

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

    async httpDelete(url) {
        return new Promise((resolve, reject) => {
            this.extension._log(`Making HTTP DELETE request with Soup to: ${url}`);

            const message = Soup.Message.new('DELETE', url);

            if (!message) {
                reject(new Error('Could not create message for URL: ' + url));
                return;
            }

            const headers = message.get_request_headers();
            this._addAuthHeader(headers);
            headers.append('Accept', 'application/json');

            this._session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                session.send_and_read_finish(result);
                const status = message.get_status();

                this.extension._log(`HTTP DELETE status: ${status}`);

                if (status === Soup.Status.OK || status === Soup.Status.NO_CONTENT) {
                    this.extension._log('HTTP DELETE request successful');
                    resolve(true);
                } else {
                    const errorMsg = `HTTP error ${status}`;
                    this.extension._log(`Soup DELETE request failed: ${errorMsg}`, true);
                    reject(new Error(errorMsg));
                }
            });
        });
    }

    destroy() {
        if (this._session) {
            this._session.abort();
            this._session = null;
        }
    }
});

// Main extension class - focused on coordination
export default class GotifyExtension extends Extension {
    constructor(metadata) {
        super(metadata);
    }

    // Centralized debug logger
    _log(message, isError = false) {
        if (!this._settings?.get_boolean('debug-mode')) {
            return;
        }
        if (isError) {
            console.error(`Gotify: ${message}`);
        } else {
            console.log(`Gotify: ${message}`);
        }
    }

    enable() {
        // Initialize settings
        this._settings = this.getSettings();

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

        this._log('Enabling extension...');

        // Initialize managers
        this._notificationManager = new NotificationManager(this);
        this._networkClient = new NetworkClient(this);

        // Set up settings change listeners
        this._setupSettingsListeners();

        // Create status indicator
        this._createStatusIndicator();

        // Start polling
        this._startPolling();

        this._log('Gotify Notifications extension enabled');
    }

    disable() {
        this._log('Disabling extension...');

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

        // Disconnect all stored signal handlers
        if (this._handlerIds) {
            this._handlerIds.forEach(({obj, id}) => obj.disconnect(id));
            this._handlerIds = null;
        }

        // Destroy stored menu items
        if (this._menuItems) {
            this._menuItems.forEach(item => item.destroy());
            this._menuItems = null;
        }

        // Clear all notifications
        if (this._notificationManager) {
            this._notificationManager.destroy();
            this._notificationManager = null;
        }

        // Destroy the icon before its parent, then destroy the parent indicator
        if (this._statusIcon) {
            this._statusIcon.destroy();
            this._statusIcon = null;
        }

        if (this._statusIndicator) {
            this._statusIndicator.destroy();
            this._statusIndicator = null;
        }

        // Clean up network client
        if (this._networkClient) {
            this._networkClient.destroy();
            this._networkClient = null;
        }

        this._log('Gotify Notifications extension disabled');

        this._settings = null;

        // Reset error counter
        this._consecutiveErrors = 0;
    }

    _createStatusIndicator() {
        this._statusIndicator = new PanelMenu.Button(0.0, this.metadata.uuid, false);

        this._statusIcon = new St.Icon({
            gicon: new Gio.ThemedIcon({ name: 'bell-outline-symbolic' }),
            style_class: 'system-status-icon'
        });

        this._statusIndicator.add_child(this._statusIcon);

        const menu = this._statusIndicator.menu;

        const testItem = new PopupMenu.PopupMenuItem('Test Custom Notification');
        const testHandlerId = testItem.connect('activate', () => {
            this._log('Manual custom test notification triggered');
            const dateStr = new Date();
            this._notificationManager.showCustomNotification('Manual Test', 'This is a persistent custom notification! Close with X button.', dateStr);
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

        this._log('Status indicator created');

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
                this._log('Polling for notifications...');
                this._pollNotifications();
                return GLib.SOURCE_CONTINUE;
            }
        );

        this._isConnected = true;
        this._updateStatusIcon();

        this._log(`Started polling every ${pollInterval} seconds`);
    }

    // Listener for settings change
    _setupSettingsListeners() {
        // Listen for poll-interval changes
        this._pollIntervalChangedId = this._settings.connect('changed::poll-interval', () => {
            const newInterval = this._settings.get_int('poll-interval');
            this._log(`Poll interval changed to ${newInterval} seconds, restarting polling...`);

            // Only restart if we're currently connected and polling
            if (this._isConnected) {
                this._startPolling();
            }
        });

        // Listen for request-timeout changes
        this._requestTimeoutChangedId = this._settings.connect('changed::request-timeout', () => {
            const newTimeout = this._settings.get_int('request-timeout');
            this._log(`Request timeout changed to ${newTimeout} seconds`);
            // NetworkClient will use the new timeout on next request
            // No need to restart anything immediately
        });

        this._log('Settings change listeners registered');
    }

    _stopPolling() {
        if (this._pollTimeoutId) {
            GLib.source_remove(this._pollTimeoutId);
            this._pollTimeoutId = null;
        }

        this._isConnected = false;
        this._updateStatusIcon();

        this._log('Stopped polling');
    }

    async _pollNotifications() {
        const gotifyUrl = this._settings.get_string('gotify-url');

        // Validate settings
        const clientToken = this._settings.get_string('client-token') || '';
        if (!gotifyUrl || !clientToken.trim()) {
            this._log('Missing URL or token in settings');

            // Show user-friendly notification only once to avoid spam
            if (this._consecutiveErrors === 0) {
                const dateStr = new Date();
                this._notificationManager.showCustomNotification(
                    'Gotify Configuration Required',
                    'Please set your Gotify server URL in extension settings.',
                    dateStr
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

        // Token is sent via header, not included in the URL
        const url = `${gotifyUrl}/message?limit=5`;

        this._log(`Fetching from URL: ${url}`);

        try {
            const bytes = await this._networkClient.httpGet(url);

            // Extension may have been disabled while this request was in flight
            if (!this._settings || !this._notificationManager) {
                return;
            }

            if (!bytes) {
                this._log('No data received');
                return;
            }

            const data = new TextDecoder().decode(bytes.get_data());
            this._log(`Raw response received, length: ${data.length}`);

            const jsonData = JSON.parse(data);

            if (jsonData.messages && jsonData.messages.length > 0) {
                this._log(`Found ${jsonData.messages.length} messages`);
                for (let i = jsonData.messages.length - 1; i >= 0; i--) {
                    const message = jsonData.messages[i];
                    this._log(`Message ${message.id}: ${message.title} - ${message.message}`);
                    if (message.id > this._lastMessageId) {
                        this._log(`New message found, showing custom notification: ${message.title}`);
                        this._notificationManager.showCustomNotification(message.title, message.message, message.date, message.id);
                        this._lastMessageId = Math.max(this._lastMessageId, message.id);
                    }
                }
            } else {
                this._log('No messages in response');
            }

            // If we got here, we're connected
            this._isConnected = true;
            this._updateStatusIcon();
            this._consecutiveErrors = 0; // Reset on successful poll

        } catch (error) {
            // Extension may have been disabled while this request was in flight
            if (!this._settings || !this._notificationManager) {
                return;
            }

            this._log(`Failed to poll: ${error}`, true);
            this._isConnected = false;
            this._updateStatusIcon();

            // Show connection error after multiple consecutive failures to avoid spam
            if (this._consecutiveErrors++ > 3) {
                const dateStr = new Date();
                this._notificationManager.showCustomNotification(
                    'Gotify Connection Error',
                    `Cannot connect to server: ${error.message}`,
                    dateStr
                );
                this._consecutiveErrors = 0; // Reset counter after showing error
            }
        }
    }
}
