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
        
        // Main page
        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'dialog-information-symbolic'
        });
        const group = new Adw.PreferencesGroup({
            title: 'Gotify Settings',
            description: 'Configure your Gotify server connection'
        });
        
        // Gotify URL
        const urlRow = new Adw.EntryRow({
            title: 'Server URL',
            text: settings.get_string('gotify-url')
        });
        settings.bind('gotify-url', urlRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        group.add(urlRow);
        
        // Client Token
        const tokenRow = new Adw.PasswordEntryRow({
            title: 'Client Token',
            text: settings.get_string('client-token')
        });
        settings.bind('client-token', tokenRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        group.add(tokenRow);
        
        // Poll Interval
        const pollRow = new Adw.SpinRow({
            title: 'Poll Interval (seconds)',
            subtitle: 'How often to check for new notifications',
            adjustment: new Gtk.Adjustment({
                value: settings.get_int('poll-interval'),
                lower: 5,
                upper: 300,
                step_increment: 5
            }),
            digits: 0
        });
        settings.bind('poll-interval', pollRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(pollRow);
        
        // Notification Timeout
        const timeoutRow = new Adw.SpinRow({
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
        settings.bind('notification-timeout', timeoutRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(timeoutRow);
        
        page.add(group);
        window.add(page);
    }
}