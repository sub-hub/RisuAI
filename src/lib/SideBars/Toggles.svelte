<script lang="ts">
    import { getModuleToggles } from "src/ts/process/modules";
    import { DBState, MobileGUI } from "src/ts/stores.svelte";
    import { parseToggleSyntax, type sidebarToggle, type sidebarToggleGroup } from "src/ts/util";
    import { language } from "src/lang";
    import type { PromptItem } from "src/ts/process/prompt";
    import type { character, groupChat } from "src/ts/storage/database.svelte";
    import Accordion from '../UI/Accordion.svelte'
    import CheckInput from "../UI/GUI/CheckInput.svelte";
    import SelectInput from "../UI/GUI/SelectInput.svelte";
    import OptionInput from "../UI/GUI/OptionInput.svelte";
    import TextAreaInput from '../UI/GUI/TextAreaInput.svelte'
    import TextInput from "../UI/GUI/TextInput.svelte";
    import Button from "../UI/GUI/Button.svelte";
    import { alertInput, alertConfirm } from "src/ts/alert";

    interface Props {
        chara?: character|groupChat
        noContainer?: boolean
    }

    let { chara = $bindable(), noContainer }: Props = $props();

    let currentPromptName = $derived(DBState.db.botPresets[DBState.db.botPresetsId]?.name || 'default');
    let currentPresets = $derived(DBState.db.togglePresets?.[currentPromptName] || {});
    let selectedPreset = $state('');

    async function savePreset() {
        const name = await alertInput(language.presetNamePrompt);
        if (!name) return;
        if (currentPresets[name] && !(await alertConfirm(language.presetExists))) return;
        
        if (!DBState.db.togglePresets) DBState.db.togglePresets = {};
        if (!DBState.db.togglePresets[currentPromptName]) DBState.db.togglePresets[currentPromptName] = {};
        
        const currentToggles: {[key:string]:string} = {};
        for (const key in DBState.db.globalChatVariables) {
            if (key.startsWith('toggle_')) {
                currentToggles[key] = DBState.db.globalChatVariables[key];
            }
        }
        
        DBState.db.togglePresets[currentPromptName][name] = currentToggles;
        selectedPreset = name;
    }

    function updatePreset() {
        if (!selectedPreset) return;
        const currentToggles: {[key:string]:string} = {};
        for (const key in DBState.db.globalChatVariables) {
            if (key.startsWith('toggle_')) {
                currentToggles[key] = DBState.db.globalChatVariables[key];
            }
        }
        DBState.db.togglePresets[currentPromptName][selectedPreset] = currentToggles;
    }

    async function renamePreset() {
        if (!selectedPreset) return;
        const newName = await alertInput(language.presetNamePrompt, undefined, selectedPreset);
        if (!newName || newName === selectedPreset) return;
        if (currentPresets[newName] && !(await alertConfirm(language.presetExists))) return;
        
        DBState.db.togglePresets[currentPromptName][newName] = DBState.db.togglePresets[currentPromptName][selectedPreset];
        delete DBState.db.togglePresets[currentPromptName][selectedPreset];
        selectedPreset = newName;
    }

    async function deletePreset() {
        if (!selectedPreset) return;
        if (!(await alertConfirm(language.deleteTogglePreset + '?'))) return;
        delete DBState.db.togglePresets[currentPromptName][selectedPreset];
        selectedPreset = '';
    }

    function loadPreset(name: string) {
        if (!name || !currentPresets[name]) return;
        const preset = currentPresets[name];
        for (const key in preset) {
            DBState.db.globalChatVariables[key] = preset[key];
        }
        selectedPreset = name;
    }

    async function resetToggles() {
        if (!(await alertConfirm(language.resetToggleConfirm))) return;
        for (const key in DBState.db.globalChatVariables) {
            if (key.startsWith('toggle_')) {
                delete DBState.db.globalChatVariables[key];
            }
        }
        DBState.db.jailbreakToggle = false;
        if (chara) chara.supaMemory = false;
        selectedPreset = '';
    }

    const jailbreakToggleToken = '{{jbtoggled}}'
    const usesJailbreakToggle = (value?: string) =>
        typeof value === 'string' && value.includes(jailbreakToggleToken)
    const templateUsesJailbreakToggle = (template: PromptItem[]) =>
        template.some(item => {
            if (item.type === 'jailbreak') {
                return true
            }
            if ('text' in item && usesJailbreakToggle(item.text)) {
                // plain, jailbreak, cot
                return true
            }
            if ('innerFormat' in item && usesJailbreakToggle(item.innerFormat)) {
                // persona, description, lorebook, postEverything, memory
                return true
            }
            if ('defaultText' in item && usesJailbreakToggle(item.defaultText)) {
                // author note
                return true
            }
            return false
        })

    let hasJailbreakPrompt = $derived.by(() => {
        const template = DBState.db.promptTemplate
        if (!template) {
            return (DBState.db.jailbreak ?? '').trim().length > 0
        }
        return templateUsesJailbreakToggle(template)
    })

    let groupedToggles = $derived.by(() => {
        const ungrouped = parseToggleSyntax(DBState.db.customPromptTemplateToggle + getModuleToggles())

        let groupOpen = false
        // group toggles together between group ... groupEnd
        return ungrouped.reduce<sidebarToggle[]>((acc, toggle) => {
            if (toggle.type === 'group') {
                groupOpen = true
                acc.push(toggle)
            } else if (toggle.type === 'groupEnd') {
                groupOpen = false
            } else if (groupOpen) {
                (acc.at(-1) as sidebarToggleGroup).children.push(toggle)
            } else {
                acc.push(toggle)
            }
            return acc
        }, [])
    })

    let hasAnyToggles = $derived(groupedToggles.length > 0 || hasJailbreakPrompt || DBState.db.supaModelType !== 'none' || DBState.db.hanuraiEnable || DBState.db.hypaV3);
</script>

{#if hasAnyToggles}
    <div class="w-full flex flex-col gap-2 mt-2">
        <div class="flex items-center gap-2">
            <span class="text-textcolor shrink-0">{language.togglePresets}</span>
            <SelectInput className="flex-1" bind:value={selectedPreset} onchange={() => loadPreset(selectedPreset)}>
                <OptionInput value="">---</OptionInput>
                {#each Object.keys(currentPresets) as presetName}
                    <OptionInput value={presetName}>{presetName}</OptionInput>
                {/each}
            </SelectInput>
        </div>
        <div class="flex gap-2 flex-wrap">
            <Button size="sm" onclick={savePreset}>{language.saveTogglePreset}</Button>
            {#if selectedPreset}
                <Button size="sm" onclick={updatePreset}>{language.updateTogglePreset}</Button>
                <Button size="sm" onclick={renamePreset}>{language.renameTogglePreset}</Button>
                <Button size="sm" styled="danger" onclick={deletePreset}>{language.deleteTogglePreset}</Button>
            {/if}
            <Button size="sm" styled="danger" onclick={resetToggles}>{language.resetToggles}</Button>
        </div>
    </div>
{/if}

{#snippet toggles(items: sidebarToggle[], reverse: boolean = false)}
    {#each items as toggle, index}
        {#if toggle.type === 'group' && toggle.children.length > 0}
            <div class="w-full">
                <Accordion styled name={toggle.value}>
                    {@render toggles((toggle as sidebarToggleGroup).children, reverse)}
                </Accordion>
            </div>
        {:else if toggle.type === 'select'}
            <div class="w-full flex gap-2 mt-2 items-center" class:justify-end={$MobileGUI} >
                <span>{toggle.value}</span>
                <SelectInput className="w-32" bind:value={DBState.db.globalChatVariables[`toggle_${toggle.key}`]}>
                    {#each toggle.options as option, i}
                        <OptionInput value={i.toString()}>{option}</OptionInput>
                    {/each}
                </SelectInput>
            </div>
        {:else if toggle.type === 'text'}
            <div class="w-full flex gap-2 mt-2 items-center" class:justify-end={$MobileGUI}>
                <span>{toggle.value}</span>
                <TextInput className="w-32" bind:value={DBState.db.globalChatVariables[`toggle_${toggle.key}`]} />
            </div>
        {:else if toggle.type === 'textarea'}
            <div class="w-full flex gap-2 mt-2 items-start" class:justify-end={$MobileGUI}>
                <span class="mt-1.5">{toggle.value}</span>
                <TextAreaInput className="w-32" height='20' bind:value={DBState.db.globalChatVariables[`toggle_${toggle.key}`]} />
            </div>
        {:else if toggle.type === 'caption'}
            <div class="w-full mt-1 text-xs text-textcolor2">
                {toggle.value}
            </div>
        {:else if toggle.type === 'divider'}
            <!-- Prevent multiple dividers appearing in a row -->
            {#if index === 0 || items[index - 1]?.type !== 'divider' || items[index - 1]?.value !== toggle.value}
                <div class="w-full min-h-5 flex gap-2 mt-2 items-center" class:justify-end={!reverse}>
                    {#if toggle.value}
                        <span class="shrink-0">{toggle.value}</span>
                    {/if}
                    <hr class="border-t border-darkborderc m-0 grow" />
                </div>
            {/if}
        {:else}
            <div class="w-full flex mt-2 items-center" class:justify-end={$MobileGUI}>
                <CheckInput check={DBState.db.globalChatVariables[`toggle_${toggle.key}`] === '1'} reverse={reverse} name={toggle.value} onChange={() => {
                    DBState.db.globalChatVariables[`toggle_${toggle.key}`] = DBState.db.globalChatVariables[`toggle_${toggle.key}`] === '1' ? '0' : '1'
                }} />
            </div>
        {/if}
    {/each}
{/snippet}

{#if !noContainer && groupedToggles.length > 4}
    <div class="h-48 border-darkborderc p-2 border rounded-sm flex flex-col items-start mt-2 overflow-y-auto">
        {#if hasJailbreakPrompt}
            <div class="flex mt-2 items-center w-full" class:justify-end={$MobileGUI}>
                <CheckInput bind:check={DBState.db.jailbreakToggle} name={language.jailbreakToggle} reverse />
            </div>
        {/if}
        {@render toggles(groupedToggles, true)}
        {#if DBState.db.supaModelType !== 'none' || DBState.db.hanuraiEnable || DBState.db.hypaV3}
            <div class="flex mt-2 items-center w-full" class:justify-end={$MobileGUI}>
                <CheckInput bind:check={chara.supaMemory} reverse name={DBState.db.hypaV3 ? language.ToggleHypaMemory : DBState.db.hanuraiEnable ? language.hanuraiMemory : DBState.db.hypaMemory ? language.ToggleHypaMemory : language.ToggleSuperMemory}/>
            </div>
        {/if}
    </div>
{:else}
    {#if hasJailbreakPrompt}
        <div class="flex mt-2 items-center">
            <CheckInput bind:check={DBState.db.jailbreakToggle} name={language.jailbreakToggle}/>
        </div>
    {/if}
    {@render toggles(groupedToggles)}
    {#if DBState.db.supaModelType !== 'none' || DBState.db.hanuraiEnable || DBState.db.hypaV3}
        <div class="flex mt-2 items-center">
            <CheckInput bind:check={chara.supaMemory} name={DBState.db.hypaV3 ? language.ToggleHypaMemory : DBState.db.hanuraiEnable ? language.hanuraiMemory : DBState.db.hypaMemory ? language.ToggleHypaMemory : language.ToggleSuperMemory}/>
        </div>
    {/if}
{/if}
