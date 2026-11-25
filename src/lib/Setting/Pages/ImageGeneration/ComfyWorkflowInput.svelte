<script lang="ts">
    import { HardDriveUploadIcon } from '@lucide/svelte';
    import { language } from 'src/lang';
    import Help from 'src/lib/Others/Help.svelte';
    import TextAreaInput from 'src/lib/UI/GUI/TextAreaInput.svelte';
    import { alertError } from 'src/ts/alert';
    import { DBState } from 'src/ts/stores.svelte';
    import { selectSingleFile } from 'src/ts/util';

    async function importComfyWorkflow() {
        const file = await selectSingleFile(['json'])
        if (!file) {
            return
        }
        const text = new TextDecoder().decode(file.data)
        try {
            JSON.parse(text)
        } catch {
            alertError(language.comfyWorkflowInvalidJson)
            return
        }
        DBState.db.comfyConfig.workflow = text
    }
</script>

<span class="text-textcolor">{language.comfyWorkflow} <Help key="comfyWorkflow" /></span>
<TextAreaInput size="sm" fullwidth height="32" bind:value={DBState.db.comfyConfig.workflow}/>
<div class="mt-2 mb-4 flex items-center">
    <button class="text-textcolor2 hover:text-green-500 cursor-pointer" onclick={importComfyWorkflow}><HardDriveUploadIcon size={24}/></button>
</div>
