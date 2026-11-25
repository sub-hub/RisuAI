<script lang="ts">
    import { DBState } from 'src/ts/stores.svelte';
    import { selectSingleFile } from 'src/ts/util';
    import { alertError } from 'src/ts/alert';
    import SelectInput from 'src/lib/UI/GUI/SelectInput.svelte';
    import OptionInput from 'src/lib/UI/GUI/OptionInput.svelte';
    import SliderInput from 'src/lib/UI/GUI/SliderInput.svelte';
</script>

<div class="relative">
    <button class="mb-4" onclick={async () => {
        const file = await selectSingleFile(['naiv4vibe'])
        if(!file){
            return null
        }
        try {
            const vibeData = JSON.parse(new TextDecoder().decode(file.data))
            if (vibeData.version !== 1 || vibeData.identifier !== "novelai-vibe-transfer") {
                alertError("Invalid vibe file. Version must be 1.")
                return
            }

            // Store the vibe data
            DBState.db.NAIImgConfig.vibe_data = vibeData

            // Set the thumbnail as preview image for display
            if (vibeData.thumbnail) {
                // Clear the array and add the thumbnail
                DBState.db.NAIImgConfig.reference_image_multiple = [];

                // Set default model selection based on current model
                if (DBState.db.NAIImgModel.includes('nai-diffusion-4-full')) {
                    DBState.db.NAIImgConfig.vibe_model_selection = 'v4full';
                } else if (DBState.db.NAIImgModel.includes('nai-diffusion-4-curated')) {
                    DBState.db.NAIImgConfig.vibe_model_selection = 'v4curated';
                } else if (DBState.db.NAIImgModel.includes('nai-diffusion-4-5-full')) {
                    DBState.db.NAIImgConfig.vibe_model_selection = 'v4-5full';
                } else if (DBState.db.NAIImgModel.includes('nai-diffusion-4-5-curated')) {
                    DBState.db.NAIImgConfig.vibe_model_selection = 'v4-5curated';
                }

                // Set InfoExtracted to the first value for the selected model
                const selectedModel = DBState.db.NAIImgConfig.vibe_model_selection;
                if (selectedModel && vibeData.encodings[selectedModel]) {
                    const encodings = vibeData.encodings[selectedModel];
                    const firstKey = Object.keys(encodings)[0];
                    if (firstKey) {
                        DBState.db.NAIImgConfig.InfoExtracted = Number(encodings[firstKey].params.information_extracted);
                    }
                }
            }

            // Initialize reference_strength_multiple if not set
            if (!DBState.db.NAIImgConfig.reference_strength_multiple || !Array.isArray(DBState.db.NAIImgConfig.reference_strength_multiple)) {
                DBState.db.NAIImgConfig.reference_strength_multiple = [0.7];
            }
        } catch (error) {
            alertError("Error parsing vibe file: " + error)
        }
    }}>
        {#if !DBState.db.NAIImgConfig.vibe_data || !DBState.db.NAIImgConfig.vibe_data.thumbnail}
            <div class="rounded-md h-20 w-20 shadow-lg bg-textcolor2 cursor-pointer hover:text-green-500 flex items-center justify-center">
                <span class="text-sm">Upload<br />Vibe</span>
            </div>
        {:else}
            <img src={DBState.db.NAIImgConfig.vibe_data.thumbnail} alt="Vibe Preview" class="rounded-md h-40 shadow-lg bg-textcolor2 cursor-pointer hover:text-green-500" />
        {/if}
    </button>

    {#if DBState.db.NAIImgConfig.vibe_data}
        <button
            onclick={() => {
                DBState.db.NAIImgConfig.vibe_data = undefined;
                DBState.db.NAIImgConfig.vibe_model_selection = undefined;
            }}
            class="absolute top-2 right-2 bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded-sm"
        >
            Delete
        </button>
    {/if}
</div>

{#if DBState.db.NAIImgConfig.vibe_data}

    <span class="text-textcolor">Vibe Model</span>
    <SelectInput className="mb-2" bind:value={DBState.db.NAIImgConfig.vibe_model_selection} onchange={(e) => {
        // When vibe model changes, set InfoExtracted to the first value
        if (DBState.db.NAIImgConfig.vibe_data?.encodings &&
            DBState.db.NAIImgConfig.vibe_model_selection &&
            DBState.db.NAIImgConfig.vibe_data.encodings[DBState.db.NAIImgConfig.vibe_model_selection]) {
            const encodings = DBState.db.NAIImgConfig.vibe_data.encodings[DBState.db.NAIImgConfig.vibe_model_selection];
            const firstKey = Object.keys(encodings)[0];
            if (firstKey) {
                DBState.db.NAIImgConfig.InfoExtracted = Number(encodings[firstKey].params.information_extracted);
            }
        }
    }}>
        {#if DBState.db.NAIImgConfig.vibe_data.encodings?.v4full}
            <OptionInput value="v4full">nai-diffusion-4-full</OptionInput>
        {/if}
        {#if DBState.db.NAIImgConfig.vibe_data.encodings?.v4curated}
            <OptionInput value="v4curated">nai-diffusion-4-curated</OptionInput>
        {/if}
        {#if DBState.db.NAIImgConfig.vibe_data.encodings?.['v4-5full']}
            <OptionInput value="v4-5full">nai-diffusion-4-5-full</OptionInput>
        {/if}
        {#if DBState.db.NAIImgConfig.vibe_data.encodings?.['v4-5curated']}
            <OptionInput value="v4-5curated">nai-diffusion-4-5-curated</OptionInput>
        {/if}
    </SelectInput>

    <span class="text-textcolor">Information Extracted</span>
    <SelectInput className="mb-2" bind:value={DBState.db.NAIImgConfig.InfoExtracted}>
        {#if DBState.db.NAIImgConfig.vibe_model_selection && DBState.db.NAIImgConfig.vibe_data.encodings[DBState.db.NAIImgConfig.vibe_model_selection]}
            {#each Object.entries(DBState.db.NAIImgConfig.vibe_data.encodings[DBState.db.NAIImgConfig.vibe_model_selection]) as [key, value]}
                <OptionInput value={value.params.information_extracted}>{value.params.information_extracted}</OptionInput>
            {/each}
        {/if}
    </SelectInput>

    <span class="text-textcolor">Reference Strength Multiple</span>
    <SliderInput marginBottom min={0} max={1} step={0.1} fixed={2} bind:value={DBState.db.NAIImgConfig.reference_strength_multiple[0]} />
{/if}
