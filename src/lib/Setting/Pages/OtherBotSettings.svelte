<script lang="ts">
    import { PlusIcon, PencilIcon, TrashIcon, DownloadIcon, HardDriveUploadIcon } from "@lucide/svelte";
    import Check from "src/lib/UI/GUI/CheckInput.svelte";
    import { language } from "src/lang";
    import Help from "src/lib/Others/Help.svelte";
    import { selectSingleFile } from "src/ts/util";
    import { DBState, selectedCharID } from 'src/ts/stores.svelte';
    import { downloadFile } from "src/ts/globalApi.svelte";
    import NumberInput from "src/lib/UI/GUI/NumberInput.svelte";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";
    import SelectInput from "src/lib/UI/GUI/SelectInput.svelte";
    import OptionInput from "src/lib/UI/GUI/OptionInput.svelte";
    import SliderInput from "src/lib/UI/GUI/SliderInput.svelte";
    import Accordion from "src/lib/UI/Accordion.svelte";
    import CheckInput from "src/lib/UI/GUI/CheckInput.svelte";
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
    import { untrack } from "svelte";
    import { tokenizePreset } from "src/ts/process/prompt";
    import { getCharToken } from "src/ts/tokenizer";
    import { alertError, alertInput, alertConfirm, alertNormal } from "src/ts/alert";
    import { createHypaV3Preset } from "src/ts/process/memory/hypav3";
    import SettingRenderer from "../SettingRenderer.svelte";
    import { imageGenerationSettingsItems } from "src/ts/setting/imageGenerationSettingsData";

    let submenu = $state(DBState.db.useLegacyGUI ? -1 : 0);

    // HypaV3
    $effect(() => {
        const settings = DBState.db.hypaV3Presets?.[DBState.db.hypaV3PresetId]?.settings;
        const currentValue = settings?.similarMemoryRatio;

        if (!currentValue) return;

        untrack(() => {
            const newValue = Math.min(currentValue, 1);

            settings.similarMemoryRatio = newValue;

            if (newValue + settings.recentMemoryRatio > 1) {
                settings.recentMemoryRatio = 1 - newValue;
            }
        })
    });

    $effect(() => {
        const settings = DBState.db.hypaV3Presets?.[DBState.db.hypaV3PresetId]?.settings;
        const currentValue = settings?.recentMemoryRatio;

        if (!currentValue) return;

        untrack(() => {
            const newValue = Math.min(currentValue, 1);

            settings.recentMemoryRatio = newValue;

            if (newValue + settings.similarMemoryRatio > 1) {
                settings.similarMemoryRatio = 1 - newValue;
            }
        })
    });

    async function getMaxMemoryRatio(): Promise<number> {
        const promptTemplateToken = await tokenizePreset(DBState.db.promptTemplate);
        const char = DBState.db.characters[$selectedCharID];
        const charToken = await getCharToken(char);
        const maxLoreToken = char.loreSettings?.tokenBudget ?? DBState.db.loreBookToken;
        const maxResponse = DBState.db.maxResponse;
        const requiredToken = promptTemplateToken + charToken.persistant + Math.min(charToken.dynamic, maxLoreToken) + maxResponse * 3;
        const maxContext = DBState.db.maxContext;

        if (maxContext === 0) {
            return 0;
        }

        const maxMemoryRatio = Math.max((maxContext - requiredToken) / maxContext, 0);

        return parseFloat(maxMemoryRatio.toFixed(2));
    }
    // End HypaV3

</script>
<h2 class="mb-2 text-2xl font-bold mt-2">{language.otherBots}</h2>


{#if submenu !== -1}
    <div class="flex w-full rounded-md border border-darkborderc mb-4 risu-seg">
        <button onclick={() => {
            submenu = 0
        }} class="p-2 flex-1 border-r border-darkborderc" class:bg-darkbutton={submenu === 0}>
            <span>{language.longTermMemory}</span>
        </button>
        <button onclick={() => {
            submenu = 1
        }} class="p2 flex-1 border-r border-darkborderc" class:bg-darkbutton={submenu === 1}>
            <span>TTS</span>
        </button>
        <button onclick={() => {
            submenu = 2
        }} class="p-2 flex-1 border-r border-darkborderc" class:bg-darkbutton={submenu === 2}>
            <span>{language.emotionImage}</span>
        </button>
        <button onclick={() => {
            submenu = 3
        }} class="p-2 flex-1" class:bg-darkbutton={submenu === 3}>
            <span>{language.imageGeneration}</span>
        </button>
    </div>
{/if}

{#if submenu === 3 || submenu === -1}
    <Accordion name={language.imageGeneration} styled disabled={submenu !== -1}>
        <SettingRenderer items={imageGenerationSettingsItems} />
    </Accordion>
{/if}

{#if submenu === 1 || submenu === -1}
<Accordion name="TTS" styled disabled={submenu !== -1}>
    <CheckInput bind:check={DBState.db.ttsAutoSpeech} name="Auto Speech" className="mt-2"/>

    <span class="text-textcolor mt-2">ElevenLabs API key</span>
    <TextInput size="sm" marginBottom bind:value={DBState.db.elevenLabKey}/>

    <span class="text-textcolor mt-2">VOICEVOX URL</span>
    <TextInput size="sm" marginBottom bind:value={DBState.db.voicevoxUrl}/>

    <span class="text-textcolor">OpenAI Key</span>
    <TextInput size="sm" marginBottom bind:value={DBState.db.openAIKey}/>

    <span class="text-textcolor mt-2">NovelAI API key</span>
    <TextInput size="sm" marginBottom placeholder="pst-..." bind:value={DBState.db.NAIApiKey}/>

    <span class="text-textcolor">Huggingface Key</span>
    <TextInput size="sm" marginBottom bind:value={DBState.db.huggingfaceKey} placeholder="hf_..."/>

    <span class="text-textcolor">fish-speech API Key</span>
    <TextInput size="sm" marginBottom bind:value={DBState.db.fishSpeechKey}/>

</Accordion>
{/if}

{#if submenu === 2 || submenu === -1}
<Accordion name={language.emotionImage} styled disabled={submenu !== -1}>
    <span class="text-textcolor mt-2">{language.emotionMethod}</span>

    <SelectInput className="mt-2 mb-4" bind:value={DBState.db.emotionProcesser}>
        <OptionInput value="submodel" >Ax. Model</OptionInput>
        <OptionInput value="embedding" >MiniLM-L6-v2</OptionInput>
    </SelectInput>
</Accordion>
{/if}

{#if submenu === 0 || submenu === -1}
    <Accordion name={language.longTermMemory} styled disabled={submenu !== -1}>
        <span class="text-textcolor mt-4">{language.type}</span>

        <SelectInput className="mb-4" value={
            DBState.db.hypaV3 ? 'hypaV3' :
            DBState.db.hypav2 ? 'hypaV2' :
            DBState.db.supaModelType !== 'none' ? 'supaMemory' :
            DBState.db.hanuraiEnable ? 'hanuraiMemory' : 'none'
        } onchange={(v) => {
            //@ts-expect-error 'value' doesn't exist on EventTarget, but target is HTMLSelectElement here
            const value = v.target.value
            if (value === 'supaMemory'){
                DBState.db.supaModelType = 'distilbart'
                DBState.db.memoryAlgorithmType = 'supaMemory'
                DBState.db.hypav2 = false
                DBState.db.hanuraiEnable = false
                DBState.db.hypaV3 = false
            } else if (value === 'hanuraiMemory'){
                DBState.db.supaModelType = 'none'
                DBState.db.memoryAlgorithmType = 'hanuraiMemory'
                DBState.db.hypav2 = false
                DBState.db.hanuraiEnable = true
                DBState.db.hypaV3 = false
            } else if (value === 'hypaV2') {
                DBState.db.supaModelType = 'distilbart'
                DBState.db.memoryAlgorithmType = 'hypaMemoryV2'
                DBState.db.hypav2= true
                DBState.db.hanuraiEnable = false
                DBState.db.hypaV3 = false
            } else if (value === 'hypaV3') {
                DBState.db.memoryAlgorithmType = 'hypaMemoryV3'
                DBState.db.supaModelType = 'none'
                DBState.db.hanuraiEnable = false
                DBState.db.hypav2 = false
                DBState.db.hypaV3 = true
            } else {
                DBState.db.supaModelType = 'none'
                DBState.db.memoryAlgorithmType = 'none'
                DBState.db.hypav2 = false
                DBState.db.hanuraiEnable = false
                DBState.db.hypaV3 = false
            }
        }}>
            <OptionInput value="none" >None</OptionInput>
            <OptionInput value="supaMemory" >{language.SuperMemory}</OptionInput>
            <OptionInput value="hypaV2" >{language.HypaMemory} V2</OptionInput>
            <OptionInput value="hanuraiMemory" >{language.hanuraiMemory}</OptionInput>
            <OptionInput value="hypaV3" >{language.HypaMemory} V3</OptionInput>
        </SelectInput>

        {#if DBState.db.hanuraiEnable}
            <span class="mb-2 text-textcolor2 text-sm text-wrap wrap-break-word max-w-full">{language.hanuraiDesc}</span>
            <span>Chunk Size</span>
            <NumberInput size="sm" marginBottom bind:value={DBState.db.hanuraiTokens} min={100} />
            <div class="flex mb-4">
                <Check bind:check={DBState.db.hanuraiSplit} name="Text Spliting"/>
            </div>
        {:else if DBState.db.hypav2}
            <span class="mb-2 text-textcolor2 text-sm text-wrap wrap-break-word max-w-full">{language.hypaV2Desc}</span>
            <span class="text-textcolor mt-4">{language.SuperMemory} {language.model}</span>
            <SelectInput className="mt-2 mb-2" bind:value={DBState.db.supaModelType}>
                <OptionInput value="distilbart">distilbart-cnn-6-6 (Free/Local)</OptionInput>
                <OptionInput value="instruct35">OpenAI 3.5 Turbo Instruct</OptionInput>
                <OptionInput value="subModel">{language.submodel}</OptionInput>
            </SelectInput>
            {#if DBState.db.supaModelType === 'davinci' || DBState.db.supaModelType === 'curie' || DBState.db.supaModelType === 'instruct35'}
            <span class="text-textcolor">{language.SuperMemory} OpenAI Key</span>
            <TextInput size="sm" marginBottom bind:value={DBState.db.supaMemoryKey}/>
            {/if}
            <span class="text-textcolor">{language.summarizationPrompt} <Help key="summarizationPrompt" /></span>
            <TextAreaInput size="sm" bind:value={DBState.db.supaMemoryPrompt} placeholder="Leave it blank to use default"/>
            <span class="text-textcolor">{language.hypaChunkSize}</span>
            <NumberInput size="sm" marginBottom bind:value={DBState.db.hypaChunkSize} min={100} />
            <span class="text-textcolor">{language.hypaAllocatedTokens}</span>
            <NumberInput size="sm" marginBottom bind:value={DBState.db.hypaAllocatedTokens} min={100} />
        {:else if DBState.db.hypaV3}
            <span class="max-w-full mb-6 text-sm text-wrap wrap-break-word text-textcolor2">{language.hypaV3Settings.descriptionLabel}</span>
            <span class="text-textcolor">Preset</span>
            <select class={"risu-select border border-darkborderc focus:border-borderc rounded-md shadow-xs text-textcolor bg-transparent focus:ring-borderc focus:ring-2 focus:outline-hidden transition-colors duration-200 text-md px-4 py-2 mb-1"}
                bind:value={DBState.db.hypaV3PresetId}
            >
                {#each DBState.db.hypaV3Presets as preset, i}
                    <option class="bg-darkbg appearance-none" value={i}>{preset.name}</option>
                {/each}
            </select>

            <div class="flex items-center mb-8">
                <button class="mr-2 text-textcolor2 hover:text-green-500 cursor-pointer" onclick={() => {
                    const newPreset = createHypaV3Preset()
                    const presets = DBState.db.hypaV3Presets

                    presets.push(newPreset)
                    DBState.db.hypaV3Presets = presets
                    DBState.db.hypaV3PresetId = DBState.db.hypaV3Presets.length - 1
                }}>
                    <PlusIcon size={24}/>
                </button>

                <button class="mr-2 text-textcolor2 hover:text-green-500 cursor-pointer" onclick={async () => {
                    const presets = DBState.db.hypaV3Presets

                    if(presets.length === 0){
                        alertError("There must be least one preset.")
                        return
                    }

                    const id = DBState.db.hypaV3PresetId
                    const preset = presets[id]
                    const newName = await alertInput(`Enter new name for ${preset.name}`, [], preset.name)

                    if (!newName || newName.trim().length === 0) return

                    preset.name = newName
                    DBState.db.hypaV3Presets = presets
                }}>
                    <PencilIcon size={24}/>
                </button>

                <button class="mr-2 text-textcolor2 hover:text-green-500 cursor-pointer" onclick={async (e) => {
                    const presets = DBState.db.hypaV3Presets

                    if(presets.length <= 1){
                        alertError("There must be least one preset.")
                        return
                    }

                    const id = DBState.db.hypaV3PresetId
                    const preset = presets[id]
                    const confirmed = await alertConfirm(`${language.removeConfirm}${preset.name}`)

                    if (!confirmed) return

                    DBState.db.hypaV3PresetId = 0
                    presets.splice(id, 1)
                    DBState.db.hypaV3Presets = presets
                }}>
                    <TrashIcon size={24}/>
                </button>

                <div class="ml-2 mr-4 w-px h-full bg-darkborderc"></div>

                <button class="mr-2 text-textcolor2 hover:text-green-500 cursor-pointer" onclick={async() => {
                    try {
                        const presets = DBState.db.hypaV3Presets
                        
                        if(presets.length === 0){
                            alertError("There must be least one preset.")
                            return
                        }

                        const id = DBState.db.hypaV3PresetId
                        const preset = presets[id]
                        const bytesExport = Buffer.from(JSON.stringify({
                            type: 'risu',
                            ver: 1,
                            data: preset
                        }), 'utf-8')
                        
                        await downloadFile(`hypaV3_export_${preset.name}.json`, bytesExport)
                        alertNormal(language.successExport)
                    } catch (error) {
                        alertError(`${error}`)
                    }
                }}>
                    <DownloadIcon size={24}/>
                </button>

                <button class="mr-2 text-textcolor2 hover:text-green-500 cursor-pointer" onclick={async() => {
                    try {
                        const bytesImport = (await selectSingleFile(['json'])).data

                        if(!bytesImport) return

                        const objImport = JSON.parse(Buffer.from(bytesImport).toString('utf-8'))

                        if(objImport.type !== 'risu' || !objImport.data) return

                        const newPreset = createHypaV3Preset(
                            objImport.data.name || "Imported Preset",
                            objImport.data.settings || {}
                        );
                        const presets = DBState.db.hypaV3Presets
                        
                        presets.push(newPreset)
                        DBState.db.hypaV3Presets = presets
                        DBState.db.hypaV3PresetId = DBState.db.hypaV3Presets.length - 1

                        alertNormal(language.successImport)
                    } catch (error) {
                        alertError(`${error}`)
                    }
                }}>
                    <HardDriveUploadIcon size={24}/>
                </button>
            </div>

            {#if DBState.db.hypaV3Presets?.[DBState.db.hypaV3PresetId]?.settings}
                {@const settings = DBState.db.hypaV3Presets[DBState.db.hypaV3PresetId].settings}

                <span class="text-textcolor">{language.SuperMemory} {language.model}</span>
                <SelectInput className="mb-4" bind:value={settings.summarizationModel}>
                    <OptionInput value="subModel">{language.submodel}</OptionInput>
                    {#if "gpu" in navigator}
                        <OptionInput value="Qwen3-1.7B-q4f32_1-MLC">Qwen3 1.7B (GPU)</OptionInput>
                        <OptionInput value="Qwen3-4B-q4f32_1-MLC">Qwen3 4B (GPU)</OptionInput>
                        <OptionInput value="Qwen3-8B-q4f32_1-MLC">Qwen3 8B (GPU)</OptionInput>
                    {/if}
                </SelectInput>
                <span class="text-textcolor">{language.summarizationPrompt} <Help key="summarizationPrompt"/></span>
                <div class="mb-4">
                    <TextAreaInput size="sm" placeholder={language.hypaV3Settings.supaMemoryPromptPlaceHolder} bind:value={settings.summarizationPrompt} />
                </div>
                <span class="text-textcolor">{language.reSummarizationPrompt} <Help key="reSummarizationPrompt"/></span>
                <div class="mb-4">
                    <TextAreaInput size="sm" placeholder={language.hypaV3Settings.supaMemoryPromptPlaceHolder} bind:value={settings.reSummarizationPrompt} />
                </div>
                {#await getMaxMemoryRatio() then maxMemoryRatio}
                <span class="text-textcolor">{language.hypaV3Settings.maxMemoryTokensRatioLabel}</span>
                <NumberInput marginBottom disabled size="sm" value={maxMemoryRatio} />
                {:catch error}
                <span class="mb-4 text-red-400">{language.hypaV3Settings.maxMemoryTokensRatioError}</span>
                {/await}
                <span class="text-textcolor">{language.hypaV3Settings.memoryTokensRatioLabel} <Help key="hypaV3MemoryTokensRatio"/></span>
                <SliderInput marginBottom min={0} max={1} step={0.01} fixed={2} bind:value={settings.memoryTokensRatio} />
                <span class="text-textcolor">{language.hypaV3Settings.extraSummarizationRatioLabel} <Help key="hypaV3ExtraSummarizationRatio"/></span>
                <SliderInput marginBottom min={0} max={1 - settings.memoryTokensRatio} step={0.01} fixed={2} bind:value={settings.extraSummarizationRatio} />
                <span class="text-textcolor">{language.hypaV3Settings.maxChatsPerSummaryLabel} <Help key="hypaV3MaxChatsPerSummary"/></span>
                <NumberInput marginBottom size="sm" min={1} bind:value={settings.maxChatsPerSummary} />
                <span class="text-textcolor">{language.hypaV3Settings.queryChatCountLabel} <Help key="hypaV3QueryChatCount"/></span>
                <NumberInput marginBottom size="sm" min={1} max={20} bind:value={settings.queryChatCount} />
                <span class="text-textcolor">{language.hypaV3Settings.summaryChunkSeparatorLabel} <Help key="hypaV3SummaryChunkSeparator"/></span>
                <TextInput marginBottom size="sm" bind:value={settings.summaryChunkSeparator} />
                <span class="text-textcolor">{language.hypaV3Settings.recentMemoryRatioLabel} <Help key="hypaV3RecentMemoryRatio"/></span>
                <SliderInput marginBottom min={0} max={1} step={0.01} fixed={2} bind:value={settings.recentMemoryRatio} />
                <span class="text-textcolor">{language.hypaV3Settings.similarMemoryRatioLabel} <Help key="hypaV3SimilarMemoryRatio"/></span>
                <SliderInput marginBottom min={0} max={1} step={0.01} fixed={2} bind:value={settings.similarMemoryRatio} />
                <span class="text-textcolor">{language.hypaV3Settings.randomMemoryRatioLabel} <Help key="hypaV3RandomMemoryRatio"/></span>
                <NumberInput marginBottom disabled size="sm" value={parseFloat((1 - settings.recentMemoryRatio - settings.similarMemoryRatio).toFixed(2))} />
                <div class="mb-2 flex items-center">
                    <Check name={language.hypaV3Settings.preserveOrphanedMemoryLabel} bind:check={settings.preserveOrphanedMemory} />
                    <Help key="hypaV3PreserveOrphanedMemory"/>
                </div>
                <div class="mb-2 flex items-center">
                    <Check name={language.hypaV3Settings.applyRegexScriptWhenRerollingLabel} bind:check={settings.processRegexScript} />
                    <Help key="hypaV3ProcessRegexScript"/>
                </div>
                <div class="mb-2 flex items-center">
                    <Check name={language.hypaV3Settings.doNotSummarizeUserMessageLabel} bind:check={settings.doNotSummarizeUserMessage} />
                    <Help key="hypaV3DoNotSummarizeUserMessage"/>
                </div>
                <Accordion name="Advanced Settings" styled>
                    <div class="mb-2 flex items-center">
                        <Check name="Use Experimental Implementation" bind:check={settings.useExperimentalImpl} />
                        <Help key="hypaV3UseExperimentalImpl"/>
                    </div>
                    <div class="mb-2 flex items-center">
                        <Check name="Always Toggle On" bind:check={settings.alwaysToggleOn} />
                        <Help key="hypaV3AlwaysToggleOn"/>
                    </div>
                    {#if settings.useExperimentalImpl}
                        <span class="text-textcolor">Summarization Requests Per Minute <Help key="hypaV3SummarizationRequestsPerMinute"/></span>
                        <NumberInput marginBottom size="sm" min={1} bind:value={settings.summarizationRequestsPerMinute} />
                        <span class="text-textcolor">Summarization Max Concurrent <Help key="hypaV3SummarizationMaxConcurrent"/></span>
                        <NumberInput marginBottom size="sm" min={1} max={10} bind:value={settings.summarizationMaxConcurrent} />
                        <span class="text-textcolor">Embedding Requests Per Minute <Help key="hypaV3EmbeddingRequestsPerMinute"/></span>
                        <NumberInput marginBottom size="sm" min={1} bind:value={settings.embeddingRequestsPerMinute} />
                        <span class="text-textcolor">Embedding Max Concurrent <Help key="hypaV3EmbeddingMaxConcurrent"/></span>
                        <NumberInput marginBottom size="sm" min={1} max={10} bind:value={settings.embeddingMaxConcurrent} />
                    {:else}
                        <div class="mb-2 flex items-center">
                            <Check name={language.hypaV3Settings.enableSimilarityCorrectionLabel} bind:check={settings.enableSimilarityCorrection} />
                            <Help key="hypaV3EnableSimilarityCorrection"/>
                        </div>
                    {/if}
                </Accordion>
            {/if}

            <div class="mb-8"></div>
        {:else if (DBState.db.supaModelType !== 'none' && DBState.db.hypav2 === false && DBState.db.hypaV3 === false)}
            <span class="mb-2 text-textcolor2 text-sm text-wrap wrap-break-word max-w-full">{language.supaDesc}</span>
            <span class="text-textcolor mt-4">{language.SuperMemory} {language.model}</span>
            <SelectInput className="mt-2 mb-2" bind:value={DBState.db.supaModelType}>
                <OptionInput value="distilbart" >distilbart-cnn-6-6 (Free/Local)</OptionInput>
                <OptionInput value="instruct35" >OpenAI 3.5 Turbo Instruct</OptionInput>
                <OptionInput value="subModel" >{language.submodel}</OptionInput>
            </SelectInput>
            <span class="text-textcolor">{language.maxSupaChunkSize}</span>
            <NumberInput size="sm" marginBottom bind:value={DBState.db.maxSupaChunkSize} min={100} />
            {#if DBState.db.supaModelType === 'davinci' || DBState.db.supaModelType === 'curie' || DBState.db.supaModelType === 'instruct35'}
                <span class="text-textcolor">{language.SuperMemory} OpenAI Key</span>
                <TextInput size="sm" marginBottom bind:value={DBState.db.supaMemoryKey}/>
            {/if}
            {#if DBState.db.supaModelType !== 'none'}
                <span class="text-textcolor">{language.SuperMemory} Prompt</span>
                <TextInput size="sm" marginBottom bind:value={DBState.db.supaMemoryPrompt} placeholder="Leave it blank to use default"/>
            {/if}
            <div class="flex mb-4">
                <Check bind:check={DBState.db.hypaMemory} name={language.enable + ' ' + language.HypaMemory}/>
            </div>
        {/if}

        <span class="text-textcolor">{language.embedding} <Help key="embedding"/></span>
        <SelectInput className="mb-4" bind:value={DBState.db.hypaModel}>
            {#if 'gpu' in navigator}
                <OptionInput value="MiniLMGPU">MiniLM L6 v2 (GPU)</OptionInput>
                <OptionInput value="nomicGPU">Nomic Embed Text v1.5 (GPU)</OptionInput>
                <OptionInput value="bgeSmallEnGPU">BGE Small English (GPU)</OptionInput>
                <OptionInput value="bgem3GPU">BGE Medium 3 (GPU)</OptionInput>
                <OptionInput value="multiMiniLMGPU">Multilingual MiniLM L12 v2 (GPU)</OptionInput>
                <OptionInput value="bgeM3KoGPU">BGE Medium 3 Korean (GPU)</OptionInput>
            {/if}
            <OptionInput value="MiniLM">MiniLM L6 v2 (CPU)</OptionInput>
            <OptionInput value="nomic">Nomic Embed Text v1.5 (CPU)</OptionInput>
            <OptionInput value="bgeSmallEn">BGE Small English (CPU)</OptionInput>
            <OptionInput value="bgem3">BGE Medium 3 (CPU)</OptionInput>
            <OptionInput value="multiMiniLM">Multilingual MiniLM L12 v2 (CPU)</OptionInput>
            <OptionInput value="bgeM3Ko">BGE Medium 3 Korean (CPU)</OptionInput>
            <OptionInput value="openai3small">OpenAI text-embedding-3-small</OptionInput>
            <OptionInput value="openai3large">OpenAI text-embedding-3-large</OptionInput>
            <OptionInput value="ada">OpenAI Ada</OptionInput>
            <OptionInput value="voyageContext3">Voyage Context 3</OptionInput>
            <OptionInput value="custom">Custom (OpenAI-compatible)</OptionInput>
        </SelectInput>

        {#if DBState.db.hypaModel === 'openai3small' || DBState.db.hypaModel === 'openai3large' || DBState.db.hypaModel === 'ada'}
            <span class="text-textcolor">OpenAI API Key</span>
            <TextInput size="sm" marginBottom bind:value={DBState.db.supaMemoryKey}/>
        {/if}

        {#if DBState.db.hypaModel === 'custom'}
            <span class="text-textcolor">URL</span>
            <TextInput size="sm" marginBottom bind:value={DBState.db.hypaCustomSettings.url}/>
            <span class="text-textcolor">Key/Password</span>
            <TextInput size="sm" marginBottom bind:value={DBState.db.hypaCustomSettings.key}/>
            <span class="text-textcolor">Request Model</span>
            <TextInput size="sm" marginBottom bind:value={DBState.db.hypaCustomSettings.model}/>
        {/if}

        {#if DBState.db.hypaModel === 'voyageContext3'}
            <span class="text-textcolor">Voyage API Key</span>
            <TextInput size="sm" marginBottom hideText={DBState.db.hideApiKey} bind:value={DBState.db.voyageApiKey}/>
        {/if}

    </Accordion>
{/if}
