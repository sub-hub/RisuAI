<script lang="ts">
    import { language } from "src/lang";
    import { DataBase, saveImage } from "src/ts/storage/database";
    import { changeFullscreen, selectSingleFile, sleep } from "src/ts/util";
    import Check from "src/lib/UI/GUI/CheckInput.svelte";
    import Help from "src/lib/Others/Help.svelte";
    import SliderInput from "src/lib/UI/GUI/SliderInput.svelte";
    import SelectInput from "src/lib/UI/GUI/SelectInput.svelte";
    import OptionInput from "src/lib/UI/GUI/OptionInput.svelte";
    import { updateAnimationSpeed } from "src/ts/gui/animation";
    import { changeColorScheme, colorSchemeList, exportColorScheme, importColorScheme, updateColorScheme, updateTextTheme } from "src/ts/gui/colorscheme";
    import { DownloadIcon, FolderUpIcon } from "lucide-svelte";
    import { guiSizeText, updateGuisize } from "src/ts/gui/guisize";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";
    import ColorInput from "src/lib/UI/GUI/ColorInput.svelte";

    const onSchemeInputChange = (e:Event) => {
        changeColorScheme((e.target as HTMLInputElement).value)
    }

    let submenu = $DataBase.useLegacyGUI ? -1 : 0
</script>

<h2 class="mb-2 text-2xl font-bold mt-2">{language.display}</h2>

{#if submenu !== -1}
    <div class="flex w-full rounded-md border border-darkborderc mb-4">
        <button on:click={() => {
            submenu = 0
        }} class="p-2 flex-1 border-r border-darkborderc" class:bg-darkbutton={submenu === 0}>
            <span>{language.theme}</span>
        </button>
        <button on:click={() => {
            submenu = 1
        }} class="p2 flex-1 border-r border-darkborderc" class:bg-darkbutton={submenu === 1}>
            <span>{language.sizeAndSpeed}</span>
        </button>
        <button on:click={() => {
            submenu = 2
        }} class="p-2 flex-1 border-r border-darkborderc" class:bg-darkbutton={submenu === 2}>
            <span>{language.others}</span>
        </button>
    </div>
{/if}

{#if submenu === 0 || submenu === -1}
    <span class="text-textcolor mt-4">{language.theme}</span>
    <SelectInput className="mt-2" bind:value={$DataBase.theme}>
        <OptionInput value="" >Standard Risu</OptionInput>
        <OptionInput value="waifu" >Waifulike</OptionInput>
        <OptionInput value="waifuMobile" >WaifuCut</OptionInput>
    </SelectInput>


    {#if $DataBase.theme === "waifu"}
        <span class="text-textcolor mt-4">{language.waifuWidth}</span>
        <SliderInput min={50} max={200} bind:value={$DataBase.waifuWidth} />
        <span class="text-textcolor2 text-sm">{($DataBase.waifuWidth)}%</span>

        <span class="text-textcolor mt-4">{language.waifuWidth2}</span>
        <SliderInput min={20} max={150} bind:value={$DataBase.waifuWidth2} />
        <span class="text-textcolor2 text-sm">{($DataBase.waifuWidth2)}%</span>
    {/if}

    <span class="text-textcolor mt-4">{language.colorScheme}</span>
    <SelectInput className="mt-2" value={$DataBase.colorSchemeName} on:change={onSchemeInputChange}>
        {#each colorSchemeList as scheme}
            <OptionInput value={scheme} >{scheme}</OptionInput>
        {/each}
        <OptionInput value="custom" >Custom</OptionInput>
    </SelectInput>

    {#if $DataBase.colorSchemeName === "custom"}
    <div class="border border-darkborderc p-2 m-2 rounded-md">
        <SelectInput className="mt-2" value={$DataBase.colorScheme.type} on:change={updateColorScheme}>
            <OptionInput value="light">Light</OptionInput>
            <OptionInput value="dark">Dark</OptionInput>
        </SelectInput>
        <div class="flex items-center mt-2">
            <ColorInput bind:value={$DataBase.colorScheme.bgcolor} on:input={updateColorScheme} />
            <span class="ml-2">Background</span>
        </div>
        <div class="flex items-center mt-2">
            <ColorInput bind:value={$DataBase.colorScheme.darkbg} on:input={updateColorScheme} />
            <span class="ml-2">Dark Background</span>
        </div>
        <div class="flex items-center mt-2">
            <ColorInput bind:value={$DataBase.colorScheme.borderc} on:input={updateColorScheme} />
            <span class="ml-2">Color 1</span>
        </div>
        <div class="flex items-center mt-2">
            <ColorInput bind:value={$DataBase.colorScheme.selected} on:input={updateColorScheme} />
            <span class="ml-2">Color 2</span>
        </div>
        <div class="flex items-center mt-2">
            <ColorInput bind:value={$DataBase.colorScheme.draculared} on:input={updateColorScheme} />
            <span class="ml-2">Color 3</span>
        </div>
        <div class="flex items-center mt-2">
            <ColorInput bind:value={$DataBase.colorScheme.darkBorderc} on:input={updateColorScheme} />
            <span class="ml-2">Color 4</span>
        </div>
        <div class="flex items-center mt-2">
            <ColorInput bind:value={$DataBase.colorScheme.darkbutton} on:input={updateColorScheme} />
            <span class="ml-2">Color 5</span>
        </div>
        <div class="flex items-center mt-2">
            <ColorInput bind:value={$DataBase.colorScheme.textcolor} on:input={updateColorScheme} />
            <span class="ml-2">Text Color</span>
        </div>
        <div class="flex items-center mt-2">
            <ColorInput bind:value={$DataBase.colorScheme.textcolor2} on:input={updateColorScheme} />
            <span class="ml-2">Text Color 2</span>
        </div>
        <div class="flex-grow flex justify-end">
            <button class="text-textcolor2 hover:text-green-500 mr-2 cursor-pointer" on:click={async (e) => {
                exportColorScheme()
            }}>
                <DownloadIcon size={18}/>
            </button>
            <button class="text-textcolor2 hover:text-green-500 cursor-pointer" on:click={async (e) => {
                importColorScheme()
            }}>
                <FolderUpIcon size={18}/>
            </button>
        </div>
    </div>
    {/if}

    <span class="text-textcolor mt-4">{language.textColor}</span>
    <SelectInput className="mt-2" bind:value={$DataBase.textTheme} on:change={updateTextTheme}>
        <OptionInput value="standard" >{language.classicRisu}</OptionInput>
        <OptionInput value="highcontrast" >{language.highcontrast}</OptionInput>
        <OptionInput value="custom" >Custom</OptionInput>
    </SelectInput>

    {#if $DataBase.textTheme === "custom"}
        <div class="flex items-center mt-2">
            <ColorInput bind:value={$DataBase.customTextTheme.FontColorStandard} on:input={updateTextTheme} />
            <span class="ml-2">Normal Text</span>
        </div>
        <div class="flex items-center mt-2">
            <ColorInput bind:value={$DataBase.customTextTheme.FontColorItalic} on:input={updateTextTheme} />
            <span class="ml-2">Italic Text</span>
        </div>
        <div class="flex items-center mt-2">
            <ColorInput bind:value={$DataBase.customTextTheme.FontColorBold} on:input={updateTextTheme} />
            <span class="ml-2">Bold Text</span>
        </div>
        <div class="flex items-center mt-2">
            <ColorInput bind:value={$DataBase.customTextTheme.FontColorItalicBold} on:input={updateTextTheme} />
            <span class="ml-2">Italic Bold Text</span>
        </div>
        <div class="flex items-center mt-2">
            <ColorInput bind:value={$DataBase.customTextTheme.FontColorQuote1} on:input={updateTextTheme} />
            <span class="ml-2">Single Quote Text</span>
        </div>
        <div class="flex items-center mt-2">
            <ColorInput bind:value={$DataBase.customTextTheme.FontColorQuote2} on:input={updateTextTheme} />
            <span class="ml-2">Double Quote Text</span>
        </div>
    {/if}

    <span class="text-textcolor mt-4">{language.font}</span>
    <SelectInput className="mt-2" bind:value={$DataBase.font} on:change={updateTextTheme}>
        <OptionInput value="default" >Default</OptionInput>
        <OptionInput value="timesnewroman" >Times New Roman</OptionInput>
        <OptionInput value="custom" >Custom</OptionInput>
    </SelectInput>

    {#if $DataBase.font === "custom"}
        <TextInput bind:value={$DataBase.customFont} on:change={updateTextTheme} />
    {/if}

{/if}

{#if submenu === 1 || submenu === -1}

    <span class="text-textcolor mt-4">{language.UISize}</span>
    <SliderInput  min={50} max={200} bind:value={$DataBase.zoomsize} marginBottom/>

    <span class="text-textcolor">{language.lineHeight}</span>
    <SliderInput  min={0.5} max={3} step={0.05} bind:value={$DataBase.lineHeight} marginBottom/>

    <span class="text-textcolor">{language.iconSize}</span>
    <SliderInput min={50} max={200} bind:value={$DataBase.iconsize} marginBottom/>

    <span class="text-textcolor">{language.textAreaSize}</span>
    <SliderInput min={-5} max={5} bind:value={$DataBase.textAreaSize} on:change={updateGuisize} customText={guiSizeText($DataBase.textAreaSize)} marginBottom/>

    <span class="text-textcolor">{language.textAreaTextSize}</span>
    <SliderInput min={0} max={3} bind:value={$DataBase.textAreaTextSize} on:change={updateGuisize} customText={guiSizeText($DataBase.textAreaTextSize)} marginBottom/>

    <span class="text-textcolor">{language.sideBarSize}</span>
    <SliderInput min={0} max={3} bind:value={$DataBase.sideBarSize} on:change={updateGuisize} customText={guiSizeText($DataBase.sideBarSize)} marginBottom/>

    <span class="text-textcolor">{language.assetWidth}</span>
    <SliderInput min={-1} max={40} step={1} bind:value={$DataBase.assetWidth} customText={
        ($DataBase.assetWidth === -1) ? "Unlimited" : 
        ($DataBase.assetWidth === 0) ? "Hidden" : (`${($DataBase.assetWidth).toFixed(1)} rem`)
    } marginBottom />

    <span class="text-textcolor">{language.animationSpeed}</span>
    <SliderInput min={0} max={1} step={0.05} fixed={2} bind:value={$DataBase.animationSpeed} on:change={updateAnimationSpeed} marginBottom />

    {#if $DataBase.showMemoryLimit}
        <span class="text-textcolor">{language.memoryLimitThickness}</span>
        <SliderInput min={1} max={500} step={1} bind:value={$DataBase.memoryLimitThickness} marginBottom />
    {/if}

{/if}

{#if submenu === 2 || submenu === -1}

    <div class="flex items-center mt-2">
        <Check bind:check={$DataBase.fullScreen} onChange={changeFullscreen} name={language.fullscreen}/>
    </div>

    <div class="flex items-center mt-2">
        <Check bind:check={$DataBase.showMemoryLimit} name={language.showMemoryLimit}/>
    </div>

    <div class="flex items-center mt-2">
        <Check bind:check={$DataBase.hideRealm} name={language.hideRealm}/>
    </div>

    <div class="flex items-center mt-2">
        <Check check={$DataBase.customBackground !== ''} onChange={async (check) => {
            if(check){
                $DataBase.customBackground = '-'
                const d = await selectSingleFile(['png', 'webp', 'gif'])
                if(!d){
                    $DataBase.customBackground = ''
                    return
                }
                const img = await saveImage(d.data)
                $DataBase.customBackground = img
            }
            else{
                $DataBase.customBackground = ''
            }
        }} name={language.useCustomBackground}></Check>
    </div>

    <div class="flex items-center mt-2">
        <Check bind:check={$DataBase.playMessage} name={language.playMessage}/>
        <span> <Help key="msgSound" name={language.playMessage}/></span>
    </div>

    <div class="flex items-center mt-2">
        <Check bind:check={$DataBase.roundIcons} name={language.roundIcons}/>
    </div>

    <div class="flex items-center mt-2">
        <Check bind:check={$DataBase.useAdvancedEditor} name={language.useAdvancedEditor}/>
    </div>

    {#if $DataBase.textScreenColor}
        <div class="flex items-center mt-2">
            <Check check={true} onChange={() => {
                $DataBase.textScreenColor = null
            }} name={language.textBackgrounds} hiddenName/>
            <input type="color" class="style2 text-sm mr-2" bind:value={$DataBase.textScreenColor} >
            <span>{language.textBackgrounds}</span>
        </div>
    {:else}
        <div class="flex items-center mt-2">
            <Check check={false} onChange={() => {
                $DataBase.textScreenColor = "#121212"
            }} name={language.textBackgrounds}/>
        </div>


    {/if}

    <div class="flex items-center mt-2">
        <Check bind:check={$DataBase.textBorder} name={language.textBorder}/>
    </div>


    <div class="flex items-center mt-2">
        <Check bind:check={$DataBase.textScreenRounded} name={language.textScreenRound}/>
    </div>

    {#if $DataBase.textScreenBorder}
        <div class="flex items-center mt-2">
            <Check check={true} onChange={() => {
                $DataBase.textScreenBorder = null
            }} name={language.textScreenBorder} hiddenName/>
            <input type="color" class="style2 text-sm mr-2" bind:value={$DataBase.textScreenBorder} >
            <span>{language.textScreenBorder}</span>
        </div>
    {:else}
        <div class="flex items-center mt-2">
            <Check check={false} onChange={() => {
                $DataBase.textScreenBorder = "#121212"
            }} name={language.textScreenBorder}/>
        </div>
    {/if}

    <div class="flex items-center mt-2">
        <Check bind:check={$DataBase.useChatCopy} name={language.useChatCopy}/>
    </div>

    <div class="flex items-center mt-2">
        <Check bind:check={$DataBase.useAdditionalAssetsPreview} name={language.useAdditionalAssetsPreview}/>
    </div>

    <div class="flex items-center mt-2">
        <Check bind:check={$DataBase.useLegacyGUI} name={language.useLegacyGUI}/>
    </div>

    {#if $DataBase.useExperimental}
        <div class="flex items-center mt-2">
            <Check bind:check={$DataBase.useChatSticker} name={language.useChatSticker}/>
            <Help key="experimental" name={language.useChatSticker}/>
        </div>
    {/if}

{/if}