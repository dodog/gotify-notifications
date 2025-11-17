//  Gotify notifications extension
//  Custom Gotify notifications
//  https://github.com/dodog/gotify-notifications   
// 

'use strict';

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class GotifyPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        
        // Helper function to update poll interval limits
        const updatePollIntervalLimits = (pollRow, timeoutValue) => {
            const minPollInterval = Math.max(15, timeoutValue + 5); // At least 5s more than timeout, minimum 15s
            
            // Get the current adjustment and update its limits
            const adjustment = pollRow.get_adjustment();
            adjustment.set_lower(minPollInterval);
            
            // If current value is below minimum, adjust it
            const currentValue = adjustment.get_value();
            if (currentValue < minPollInterval) {
                adjustment.set_value(minPollInterval);
            }
            
            // Update subtitle with current UI value
            const currentDisplayValue = pollRow.get_value();
            pollRow.set_subtitle(`Check for notifications every ${currentDisplayValue}s (must be ≥ ${minPollInterval}s = ${timeoutValue}s timeout + 5s buffer)`);
        };
            
        // Helper: update notification timeout subtitle dynamically
        const updateNotificationTimeoutSubtitle = () => {
            const timeout = settings.get_int('notification-timeout');
            const subtitle = timeout === 0
                ? 'Notifications persist until manually closed'
                : `Notifications auto-close after ${timeout} seconds`;
            notificationTimeoutRow.set_subtitle(subtitle);
        };
        
        // Main page
        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'dialog-information-symbolic'
        });
        const group = new Adw.PreferencesGroup({
            title: 'Gotify Settings',
            description: 'Configure your Gotify server connection'
        });
        
        // Gotify URL with validation
        const urlRow = new Adw.EntryRow({
            title: 'Server URL',
            text: settings.get_string('gotify-url')
        });
        settings.bind('gotify-url', urlRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        
        // Add URL validation
        urlRow.connect('changed', () => {
            const url = urlRow.get_text();
            if (url && !/^https?:\/\//.test(url)) {
                urlRow.add_css_class('error');
                urlRow.set_title('Server URL (should start with http:// or https://)');
            } else {
                urlRow.remove_css_class('error');
                urlRow.set_title('Server URL');
            }
        });
        group.add(urlRow);
        
        // Client Token with security note
        const tokenRow = new Adw.PasswordEntryRow({
            title: 'Client Token',
            text: settings.get_string('client-token')
        });
        settings.bind('client-token', tokenRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        group.add(tokenRow);
        
        // Request Timeout
        const requestTimeoutRow = new Adw.SpinRow({
            title: 'Request Timeout (seconds)',
            subtitle: 'How long to wait for server response',
            adjustment: new Gtk.Adjustment({
                value: settings.get_int('request-timeout') || 10,
                lower: 5,
                upper: 30,
                step_increment: 5
            }),
            digits: 0
        });
        settings.bind('request-timeout', requestTimeoutRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(requestTimeoutRow);
    
        // Poll Interval with dynamic validation
        const pollRow = new Adw.SpinRow({
            title: 'Poll Interval (seconds)',
            subtitle: 'How often to check for new notifications',
            adjustment: new Gtk.Adjustment({
                value: settings.get_int('poll-interval'),
                lower: 15, // Initial safe minimum
                upper: 300,
                step_increment: 5
            }),
            digits: 0
        });
        settings.bind('poll-interval', pollRow, 'value', Gio.SettingsBindFlags.DEFAULT);

        // Update poll interval limits when poll interval itself changes
        pollRow.connect('changed', () => {
            updatePollIntervalLimits(pollRow, requestTimeoutRow.get_value());
        });

        group.add(pollRow);

        // Update poll interval limits when request timeout changes
        requestTimeoutRow.connect('changed', () => {
            updatePollIntervalLimits(pollRow, requestTimeoutRow.get_value());
        });

        // Set initial limits based on current timeout value
        updatePollIntervalLimits(pollRow, requestTimeoutRow.get_value());
        
        // Notification Timeout
        const notificationTimeoutRow = new Adw.SpinRow({
            title: 'Notification Timeout (seconds)',
            subtitle: '0 = never auto-close, other values = auto-close after X seconds',
            adjustment: new Gtk.Adjustment({
                value: settings.get_int('notification-timeout'),
                lower: 0,
                upper: 3600,
                step_increment: 5
            }),
            digits: 0
        });
        settings.bind('notification-timeout', notificationTimeoutRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        
        // Add dynamic subtitle for notification timeout
        notificationTimeoutRow.connect('changed', updateNotificationTimeoutSubtitle);
        group.add(notificationTimeoutRow);
        
        // Initialize notification timeout subtitle
        updateNotificationTimeoutSubtitle();
        
        // Debug Mode with performance note
        const debugRow = new Adw.SwitchRow({
            title: 'Debug Mode',
            subtitle: 'Show detailed logs in console for troubleshooting (disabling improves performance)',
            active: settings.get_boolean('debug-mode')
        });
        settings.bind('debug-mode', debugRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(debugRow);
        
        page.add(group);
        window.add(page);
    }
}