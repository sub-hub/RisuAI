import type { SettingItem, SettingContext } from './types';
import { DBState } from '../stores.svelte';
import { language } from 'src/lang';
import { accessibilitySettingsItems } from './accessibilitySettingsData';
import { advancedSettingsItems } from './advancedSettingsData';
import { basicParameterItems, modelSpecificParameterItems, penaltyParameterItems, samplingParameterItems, seedSetting } from './botSettingsParamsData';
import { chatFormatSettingsItems } from './chatFormatSettingsData';
import { displaySettingsItems } from './displaySettingsData.svelte';
import { imageGenerationSettingsItems } from './imageGenerationSettingsData';

/**
 * Sentinel value representing an uninitialized local state in wrapper components.
 * Used instead of `undefined` so that a legitimate `undefined` DB value
 * can still be written back without being silently ignored.
 */
export const UNINITIALIZED = Symbol('uninitialized');

export function getLabel(item: SettingItem): string {
    const label = (item.labelKey && (language as any)[item.labelKey]) || (item.fallbackLabel ?? '');
    const prefix = item.labelPrefixKey ? (language as any)[item.labelPrefixKey] : item.labelPrefix;
    return prefix ? `${prefix} ${label}` : label;
}

/**
 * The item as shown without its page around it (Custom Sidebar and its picker):
 * the group replaces any label prefix, so "WebUI Provider URL" becomes "Stable Diffusion WebUI Provider URL".
 * Headers are plain text, not settings, and keep their own label.
 */
export function toSidebarItem(item: SettingItem): SettingItem {
    if (!item.group || item.type === 'header') return item;
    return { ...item, labelPrefix: item.group, labelPrefixKey: undefined };
}

export function getSidebarLabel(item: SettingItem): string {
    return getLabel(toSidebarItem(item));
}

export function getSettingValue(item: SettingItem, ctx: SettingContext): any {
    if (item.getValue) {
        return item.getValue(DBState.db, ctx);
    }
    if (item.bindPath) {
        const parts = item.bindPath.split('.');
        let value: any = DBState.db;
        for (const part of parts) {
            value = value?.[part];
        }
        return value;
    }
    if (item.bindKey) {
        return (DBState.db as any)[item.bindKey];
    }
    return undefined;
}

export function setSettingValue(item: SettingItem, newValue: any, ctx: SettingContext): void {
    if (item.setValue) {
        item.setValue(DBState.db, newValue, ctx);
    } else if (item.bindPath) {
        const parts = item.bindPath.split('.');
        let obj: any = DBState.db;
        for (let i = 0; i < parts.length - 1; i++) {
            obj = obj[parts[i]] ??= {};
        }
        obj[parts[parts.length - 1]] = newValue;
    } else if (item.bindKey) {
        (DBState.db as any)[item.bindKey] = newValue;
    }
    
    if (item.onChange) {
        item.onChange(newValue, ctx);
    }
}

/**
 * Check if item should be visible based on condition
 */
export function checkCondition(item: SettingItem, ctx: SettingContext): boolean {
    if (!item.condition) return true;
    return item.condition(ctx);
}

export function getFullSettingsData(searchTerm = '') {
    const full =  accessibilitySettingsItems.concat(
        advancedSettingsItems,
        basicParameterItems,
        seedSetting,
        samplingParameterItems,
        penaltyParameterItems,
        modelSpecificParameterItems,
        chatFormatSettingsItems,
        displaySettingsItems,
        imageGenerationSettingsItems,
    );

    if(!searchTerm) return full;

    const lowerSearch = searchTerm.toLowerCase();
    return full.filter(item => {
        // only the Custom Sidebar picker searches, so match the labels it shows
        const label = getSidebarLabel(item).toLowerCase();
        const keywords = item.keywords?.map(k => k.toLowerCase()) || [];
        return label.includes(lowerSearch) || keywords.some(k => k.includes(lowerSearch));
    });


}
