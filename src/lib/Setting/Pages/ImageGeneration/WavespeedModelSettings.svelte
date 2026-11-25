<script lang="ts">
    import { DBState } from 'src/ts/stores.svelte';
    import { globalFetch } from 'src/ts/globalApi.svelte';
    import { alertError, alertNormal } from 'src/ts/alert';
    import TextInput from 'src/lib/UI/GUI/TextInput.svelte';
    import SelectInput from 'src/lib/UI/GUI/SelectInput.svelte';
    import OptionInput from 'src/lib/UI/GUI/OptionInput.svelte';
    import SliderInput from 'src/lib/UI/GUI/SliderInput.svelte';
    import AssetImageUpload from './AssetImageUpload.svelte';

    interface WavespeedModel {
        model_id: string;
        name: string;
        base_price: number;
        supportsImageInput: boolean;
        supportsLoras: boolean;
    }
    interface LoraItem {
        path: string;
        scale: number;
    }
    let wavespeedModels = $state<WavespeedModel[]>([]);
    let isWavespeedLoading = $state(false);
    let wavespeedSearchQuery = $state("");
    // Three LoRA slots, filled from the saved ones so the sync effect below does not wipe them
    const savedLoras = DBState.db.wavespeedImage.loras ?? [];
    let wavespeedLoras = $state<LoraItem[]>([0, 1, 2].map((i) => ({
        path: savedLoras[i]?.path ?? "",
        scale: savedLoras[i]?.scale ?? 1.0,
    })));

    /**
     * Fetch models from WaveSpeed API dynamically
     * https://wavespeed.ai/docs/docs-common-api/models
     */
    async function fetchWavespeedModels() {
        if (!DBState.db.wavespeedImage.key || DBState.db.wavespeedImage.key.trim() === '') {
            alertError('WaveSpeed API Key not set');
            return;
        }

        isWavespeedLoading = true;
        try {
            const result = await globalFetch('https://api.wavespeed.ai/api/v3/models', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${DBState.db.wavespeedImage.key}`
                },
            });

            if (!result.ok || !result.data) {
                alertError('Failed to fetch WaveSpeed models');
                return;
            }

            let responseData;
            try {
                responseData = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
            } catch (e) {
                alertError('Failed to parse WaveSpeed response');
                return;
            }

            if (responseData.code !== 200 || !Array.isArray(responseData.data)) {
                alertError('Invalid WaveSpeed API response');
                return;
            }

            // Filter, transform, and sort models by name
            const filteredModels: WavespeedModel[] = responseData.data
              .filter((model: any) =>
                model.type === 'text-to-image' || model.type === 'image-to-image'
              )
              .map((model: any) => {
                  // Check if model supports LoRAs
                  const supportsLoras = model.api_schema?.api_schemas?.some((schema: any) =>
                    schema.request_schema?.properties?.loras !== undefined
                  ) ?? false;

                  return {
                      model_id: model.model_id,
                      name: model.name,
                      base_price: model.base_price,
                      type: model.type,
                      supportsImageInput: model.type === 'image-to-image',
                      supportsLoras: supportsLoras,
                  };
              })
              .sort((a, b) => a.name.localeCompare(b.name));

            wavespeedModels = filteredModels;
            alertNormal(`Successfully loaded ${filteredModels.length} models`);
        } catch (error) {
            alertError(`Failed to fetch models: ${error}`);
        } finally {
            isWavespeedLoading = false;
        }
    }

    /**
     * Handle model selection change
     */
    function handleModelChange() {
        const selectedModel = wavespeedModels.find(m => m.model_id === DBState.db.wavespeedImage.model);

        // Reset reference_mode for text-to-image models
        if (selectedModel?.supportsImageInput) {
            DBState.db.wavespeedImage.reference_mode = '';
            DBState.db.wavespeedImage.reference_image = undefined;
            DBState.db.wavespeedImage.reference_base64image = undefined;
        }

        // Reset loras if model doesn't support them
        if (!selectedModel?.supportsLoras) {
            DBState.db.wavespeedImage.loras = undefined;
        }
    }

    /**
     * Get display name for a WaveSpeed model
     * @param model - The model to get display name for
     */
    function getModelDisplayName(model: WavespeedModel): string {
        const imageInputIcon = model.supportsImageInput ? '✓' : '✗';
        const loraIcon = model.supportsLoras ? '✓' : '✗';
        return `${model.name} (price: ${model.base_price}) [${imageInputIcon} Image] [${loraIcon} LoRA]`;
    }

    /**
     * Filter and sort models based on search query
     */
    function getFilteredModels(): WavespeedModel[] {
        if (wavespeedSearchQuery === "") return wavespeedModels;

        const searchTerms = wavespeedSearchQuery.toLowerCase().trim().split(/\s+/);
        return wavespeedModels.filter(model => {
            const modelText = (model.name + " " + model.model_id).toLowerCase();
            return searchTerms.every(term => modelText.includes(term));
        });
    }

    $effect(() => {
        // Sync loras to DB, filtering out empty URLs
        if (DBState.db.wavespeedImage) {
            DBState.db.wavespeedImage.loras = wavespeedLoras
              .filter(item => item.path && item.path.trim() !== "")
              .map(item => ({
                  path: item.path,
                  scale: item.scale
              }));
        }
    });
</script>

<span class="text-textcolor">Model</span>
<button
  class="px-3 py-2 bg-darkbutton rounded-md hover:bg-textcolor2 transition-colors disabled:opacity-50"
  disabled={isWavespeedLoading}
  onclick={fetchWavespeedModels}
>
    {isWavespeedLoading ? 'Loading...' : 'Refresh Models'}
</button>
<TextInput
  bind:value={wavespeedSearchQuery}
  placeholder="Search models..."
  size="sm"
  marginBottom
/>
<SelectInput className="mb-4" bind:value={DBState.db.wavespeedImage.model} onchange={handleModelChange}>
    <OptionInput value="" >Select a model...</OptionInput>
    {#if wavespeedModels.length > 0}
        {#each getFilteredModels() as model}
            <OptionInput value={model.model_id}>
                {getModelDisplayName(model)}
            </OptionInput>
        {/each}
    {:else if DBState.db.wavespeedImage.model}
        <OptionInput value={DBState.db.wavespeedImage.model}> {DBState.db.wavespeedImage.model} </OptionInput>
    {/if}
</SelectInput>

<span class="text-textcolor mt-4">LoRAs</span>
{#if wavespeedModels.find(m => m.model_id === DBState.db.wavespeedImage.model)?.supportsLoras}
    {#each wavespeedLoras as lora, index}
        <TextInput
          size="sm"
          marginBottom
          marginTop
          placeholder={`LoRA ${index + 1} URL (optional)`}
          bind:value={lora.path}
        />
        <SliderInput
          marginBottom
          min={0}
          max={4}
          step={0.1}
          fixed={1}
          bind:value={lora.scale}
        />
    {/each}
    <span class="text-textcolor2 text-xs mb-2 block">
        Only .safetensors files are supported. Use owner/model-name (Hugging Face) or direct URL (Civitai).
    </span>
{:else}
    <span class="text-textcolor2 text-xs mb-2 block">
        Model does not support LoRA. Or refresh model list to update model status.
    </span>
{/if}

<span class="text-textcolor">Image Reference</span>
{#if wavespeedModels.find(m => m.model_id === DBState.db.wavespeedImage.model)?.supportsImageInput}
    <SelectInput className="mb-4" bind:value={DBState.db.wavespeedImage.reference_mode}>
        <OptionInput value="" >None</OptionInput>
        <OptionInput value="image" >Upload Image</OptionInput>
        <OptionInput value="character" >Use Character Image</OptionInput>
    </SelectInput>

    {#if DBState.db.wavespeedImage.reference_mode === 'image'}
        <AssetImageUpload config="wavespeedImage" imageKey="reference_image" base64Key="reference_base64image" />
    {/if}
    {#if DBState.db.wavespeedImage.reference_mode === 'character'}
        <span class="text-textcolor2 text-xs mb-2 block">Use the character's default image.</span>
    {/if}
{:else}
    <span class="text-textcolor2 text-xs mb-2 block">
        Model does not support image input. Or refresh model list to update model status.
    </span>
{/if}
