<script lang="ts">
    import type { SettingItem, SettingContext } from 'src/ts/setting/types';
    import { customComponents } from 'src/ts/setting/customComponents';

    interface Props {
        item: SettingItem;
        ctx: SettingContext;
    }

    let { item }: Props = $props();
    let CustomComponent = $derived(item.componentId ? customComponents[item.componentId] : null);
</script>

{#if CustomComponent}
    {#if item.classes}
        <div class={item.classes}>
            <CustomComponent {...item.componentProps} />
        </div>
    {:else}
        <CustomComponent {...item.componentProps} />
    {/if}
{/if}
