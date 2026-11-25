<script lang="ts">
    import { DBState } from 'src/ts/stores.svelte';
    import { selectSingleFile } from 'src/ts/util';
    import { saveAsset } from 'src/ts/globalApi.svelte';
    import { getCharImage } from 'src/ts/characters';

    interface Props {
        /** Database object holding the image fields */
        config: 'NAIImgConfig' | 'wavespeedImage';
        /** Field that stores the saved asset id */
        imageKey: string;
        /** Field that stores the same image as base64 for the request */
        base64Key: string;
        note?: string;
        noteClass?: string;
    }

    let { config, imageKey, base64Key, note, noteClass = '' }: Props = $props();

    let target = $derived(DBState.db[config] as Record<string, any>);
</script>

<div class="relative">
    <button class="mb-2" onclick={async () => {
        const img = await selectSingleFile([
            'jpg',
            'jpeg',
            'png',
            'webp'
        ])
        if(!img){
            return null
        }
        target[base64Key] = Buffer.from(img.data).toString('base64');
        target[imageKey] = await saveAsset(img.data)
    }}>
        {#if !target[imageKey] || target[imageKey] === ''}
            <div class="rounded-md h-20 w-20 shadow-lg bg-textcolor2 cursor-pointer hover:text-green-500 flex items-center justify-center">
                <span class="text-sm">Upload<br />Image</span>
            </div>
        {:else}
            {#await getCharImage(target[imageKey], 'plain')}
                <div class="rounded-md h-20 w-20 shadow-lg bg-textcolor2 cursor-pointer hover:text-green-500 flex items-center justify-center">
                    <span class="text-sm">Uploading<br />Image..</span>
                </div>
            {:then im}
                <img src={im} class="rounded-md h-40 shadow-lg bg-textcolor2 cursor-pointer hover:text-green-500" alt="Base Preview"/>
            {/await}
        {/if}
    </button>

    {#if target[imageKey] && target[imageKey] !== ''}
        <button
            onclick={() => {
                target[imageKey] = undefined;
                target[base64Key] = undefined;
            }}
            class="absolute top-2 right-2 bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded-sm"
        >
            Delete
        </button>
    {/if}
</div>
{#if note}
    <span class="text-textcolor2 text-xs block {noteClass}">{note}</span>
{/if}
