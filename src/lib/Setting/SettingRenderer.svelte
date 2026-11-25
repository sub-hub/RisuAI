<script lang="ts">
    import type { SettingItem, SettingContext } from 'src/ts/setting/types';
    import type { LLMModel } from 'src/ts/model/types';
    import { settingRegistry } from 'src/ts/setting/settingRegistry';
    import { checkCondition } from 'src/ts/setting/utils';
    import { getSettingContext } from 'src/ts/setting/context';

    interface Props {
        items: SettingItem[];
        /** Optional modelInfo, derived automatically if not provided */
        modelInfo?: LLMModel;
        /** Optional subModelInfo, derived automatically if not provided */
        subModelInfo?: LLMModel;
    }

    let { items, modelInfo, subModelInfo }: Props = $props();

    // Build context for condition checks
    let ctx: SettingContext = $derived(getSettingContext(modelInfo, subModelInfo));
</script>

{#each items as item (item.id)}
    {#if checkCondition(item, ctx)}
        {@const Component = settingRegistry[item.type]}
        {#if Component}
            <Component {item} {ctx} />
        {:else}
            <div class="text-draculared text-xs mt-2">Unknown setting type: {item.type}</div>
        {/if}
    {/if}
{/each}
