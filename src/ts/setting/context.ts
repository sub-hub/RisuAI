import type { SettingContext } from './types';
import type { LLMModel } from '../model/types';
import { DBState } from '../stores.svelte';
import { getModelInfo } from '../model/modellist';

/**
 * Context for setting conditions. Shared by SettingRenderer and the Custom Sidebar (with its picker),
 * so the picker's "active" items are the ones the sidebar would show.
 */
export function getSettingContext(modelInfo?: LLMModel, subModelInfo?: LLMModel): SettingContext {
    return {
        db: DBState.db,
        modelInfo: modelInfo ?? getModelInfo(DBState.db.aiModel),
        subModelInfo: subModelInfo ?? getModelInfo(DBState.db.subModel),
    };
}
