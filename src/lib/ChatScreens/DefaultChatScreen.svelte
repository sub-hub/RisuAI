<script lang="ts">
	import Suggestion from './Suggestion.svelte';
	import AdvancedChatEditor from './AdvancedChatEditor.svelte';
    import { CameraIcon, DatabaseIcon, DicesIcon, GlobeIcon, ImagePlusIcon, LanguagesIcon, Laugh, MenuIcon, MicOffIcon, PackageIcon, Plus, RefreshCcwIcon, ReplyIcon, Send, StepForwardIcon } from "lucide-svelte";
    import { CurrentCharacter, CurrentChat, CurrentUsername, selectedCharID, CurrentUserIcon, CurrentShowMemoryLimit,CurrentSimpleCharacter, PlaygroundStore, UserIconProtrait } from "../../ts/stores";
    import Chat from "./Chat.svelte";
    import { DataBase, type Message, type character, type groupChat } from "../../ts/storage/database";
    import { getCharImage } from "../../ts/characters";
    import { chatProcessStage, doingChat, sendChat } from "../../ts/process/index";
    import { findCharacterbyId, messageForm, sleep } from "../../ts/util";
    import { language } from "../../lang";
    import { isExpTranslator, translate } from "../../ts/translator/translator";
    import { alertError, alertNormal, alertWait } from "../../ts/alert";
    import sendSound from '../../etc/send.mp3'
    import { processScript } from "src/ts/process/scripts";
    import CreatorQuote from "./CreatorQuote.svelte";
    import { stopTTS } from "src/ts/process/tts";
    import MainMenu from '../UI/MainMenu.svelte';
    import AssetInput from './AssetInput.svelte';
    import { downloadFile } from 'src/ts/storage/globalApi';
    import { runTrigger } from 'src/ts/process/triggers';
    import { v4 } from 'uuid';
    import { PreUnreroll, Prereroll } from 'src/ts/process/prereroll';
    import { processMultiCommand } from 'src/ts/process/command';
    import { postChatFile } from 'src/ts/process/files/multisend';
    import { getInlayImage } from 'src/ts/process/files/image';
    import PlaygroundMenu from '../Playground/PlaygroundMenu.svelte';
    import { get } from 'svelte/store';

    let messageInput:string = ''
    let messageInputTranslate:string = ''
    let openMenu = false
    let loadPages = 30
    let autoMode = false
    let rerolls:Message[][] = []
    let rerollid = -1
    let lastCharId = -1
    let doingChatInputTranslate = false
    let currentCharacter:character|groupChat = $CurrentCharacter
    let toggleStickers:boolean = false
    let fileInput:string[] = []
    export let openModuleList = false
    export let openChatList:boolean = false 

    async function send(){
        return sendMain(false)
    }
    async function sendContinue(){
        return sendMain(true)
    }

    async function sendMain(continueResponse:boolean) {
        let selectedChar = $selectedCharID
        if($doingChat){
            return
        }
        if(lastCharId !== $selectedCharID){
            rerolls = []
            rerollid = -1
        }

        let cha = $DataBase.characters[selectedChar].chats[$DataBase.characters[selectedChar].chatPage].message

        if(messageInput.startsWith('/')){
            const commandProcessed = await processMultiCommand(messageInput)
            if(commandProcessed !== false){
                messageInput = ''
                return
            }
        }

        if(fileInput.length > 0){
            for(const file of fileInput){
                messageInput += `{{inlay::${file}}}`
            }
            fileInput = []
        }

        if(messageInput === ''){
            if($DataBase.characters[selectedChar].type !== 'group'){
                if(cha.length === 0 || cha[cha.length - 1].role !== 'user'){
                    if($DataBase.useSayNothing){
                        cha.push({
                            role: 'user',
                            data: '*says nothing*'
                        })
                    }
                }
            }
        }
        else{
            const char = $DataBase.characters[selectedChar]
            if(char.type === 'character'){
                let triggerResult = await runTrigger(char,'input', {chat: char.chats[char.chatPage]})
                if(triggerResult){
                    cha = triggerResult.chat.message
                }

                cha.push({
                    role: 'user',
                    data: await processScript(char,messageInput,'editinput'),
                    time: Date.now()
                })
            }
            else{
                cha.push({
                    role: 'user',
                    data: messageInput,
                    time: Date.now()
                })
            }
        }
        messageInput = ''
        messageInputTranslate = ''
        $DataBase.characters[selectedChar].chats[$DataBase.characters[selectedChar].chatPage].message = cha
        rerolls = []
        await sleep(10)
        updateInputSizeAll()
        await sendChatMain(continueResponse)

    }

    async function reroll() {
        if($doingChat){
            return
        }
        if(lastCharId !== $selectedCharID){
            rerolls = []
            rerollid = -1
        }
        const genId = $CurrentChat.message.at(-1)?.generationInfo?.generationId
        if(genId){
            const r = Prereroll(genId)
            if(r){
                $CurrentChat.message[$CurrentChat.message.length - 1].data = r
                return
            }
        }
        if(rerollid < rerolls.length - 1){
            if(Array.isArray(rerolls[rerollid + 1])){
                let db = $DataBase
                rerollid += 1
                let rerollData = structuredClone(rerolls[rerollid])
                let msgs = db.characters[$selectedCharID].chats[$CurrentCharacter.chatPage].message
                for(let i = 0; i < rerollData.length; i++){
                    msgs[msgs.length - rerollData.length + i] = rerollData[i]
                }
                db.characters[$selectedCharID].chats[$CurrentCharacter.chatPage].message = msgs
                $DataBase = db
            }
            return
        }
        if(rerolls.length === 0){
            rerolls.push(structuredClone([$CurrentChat.message.at(-1)]))
            rerollid = rerolls.length - 1
        }
        let cha = structuredClone($CurrentChat.message)
        if(cha.length === 0 ){
            return
        }
        openMenu = false
        const saying = cha[cha.length - 1].saying
        let sayingQu = 2
        while(cha[cha.length - 1].role !== 'user'){
            if(cha[cha.length - 1].saying === saying){
                sayingQu -= 1
                if(sayingQu === 0){
                    break
                }   
            }
            let msg = cha.pop()
            if(!msg){
                return
            }
        }
        $CurrentChat.message = cha
        await sendChatMain()
    }

    async function unReroll() {
        if($doingChat){
            return
        }
        if(lastCharId !== $selectedCharID){
            rerolls = []
            rerollid = -1
        }
        const genId = $CurrentChat.message.at(-1)?.generationInfo?.generationId
        if(genId){
            const r = PreUnreroll(genId)
            if(r){
                $CurrentChat.message[$CurrentChat.message.length - 1].data = r
                return
            }
        }
        if(rerollid <= 0){
            return
        }
        if(Array.isArray(rerolls[rerollid - 1])){
            let db = $DataBase
            rerollid -= 1
            let rerollData = structuredClone(rerolls[rerollid])
            let msgs = db.characters[$selectedCharID].chats[$CurrentCharacter.chatPage].message
            for(let i = 0; i < rerollData.length; i++){
                msgs[msgs.length - rerollData.length + i] = rerollData[i]
            }
            db.characters[$selectedCharID].chats[$CurrentCharacter.chatPage].message = msgs
            $DataBase = db
        }
    }

    let abortController:null|AbortController = null

    async function sendChatMain(continued:boolean = false) {

        let previousLength = $CurrentChat.message.length
        messageInput = ''
        abortController = new AbortController()
        try {
            await sendChat(-1, {
                signal:abortController.signal,
                continue:continued
            })
            if(previousLength < $CurrentChat.message.length){
                rerolls.push(structuredClone($CurrentChat.message).slice(previousLength))
                rerollid = rerolls.length - 1
            }
        } catch (error) {
            console.error(error)
            alertError(`${error}`)
        }
        lastCharId = $selectedCharID
        $doingChat = false
        if($DataBase.playMessage){
            const audio = new Audio(sendSound);
            audio.play();
        }
    }

    function abortChat(){
        if(abortController){
            abortController.abort()
        }
    }

    async function runAutoMode() {
        if(autoMode){
            autoMode = false
            return
        }
        const selectedChar = $selectedCharID
        autoMode = true
        while(autoMode){
            await sendChatMain()
            if(selectedChar !== $selectedCharID){
                autoMode = false
            }
        }
    }

    export let customStyle = ''
    let inputHeight = "44px"
    let inputEle:HTMLTextAreaElement
    let inputTranslateHeight = "44px"
    let inputTranslateEle:HTMLTextAreaElement

    function updateInputSizeAll() {
        updateInputSize()
        updateInputTranslateSize()
    }

    function updateInputTranslateSize() {
        if(inputTranslateEle) {
            inputTranslateEle.style.height = "0";
            inputTranslateHeight = (inputTranslateEle.scrollHeight) + "px";
            inputTranslateEle.style.height = inputTranslateHeight
        }
    }
    function updateInputSize() {
        if(inputEle){
            inputEle.style.height = "0";
            inputHeight = (inputEle.scrollHeight) + "px";
            inputEle.style.height = inputHeight
        }
    }

    $: updateInputSizeAll()

    async function updateInputTransateMessage(reverse: boolean) {
        if(isExpTranslator()){
            if(!reverse){
                messageInputTranslate = ''
                return
            }
            if(messageInputTranslate === '') {
                messageInput = ''
                return
            }
            const lastMessageInputTranslate = messageInputTranslate
            await sleep(1500)
            if(lastMessageInputTranslate === messageInputTranslate){
                translate(reverse ? messageInputTranslate : messageInput, reverse).then((translatedMessage) => {
                    if(translatedMessage){
                        if(reverse)
                            messageInput = translatedMessage
                        else
                            messageInputTranslate = translatedMessage
                    }
                })
            }
            return

        }
        if(reverse && messageInputTranslate === '') {
            messageInput = ''
            return
        }
        if(!reverse && messageInput === '') {
            messageInputTranslate = ''
            return
        }
        translate(reverse ? messageInputTranslate : messageInput, reverse).then((translatedMessage) => {
            if(translatedMessage){
                if(reverse)
                    messageInput = translatedMessage
                else
                    messageInputTranslate = translatedMessage
            }
        })
    }

    async function screenShot(saveChatsSeparately = false){
        const db = get(DataBase)
        const customBackgroundColor = db.textScreenColor ?? 'var(--risu-theme-bgcolor)';
        try {
            loadPages = Infinity
            const html2canvas = await import('html-to-image');
            const chats = document.querySelectorAll('.default-chat-screen .risu-chat')
            alertWait("Taking screenShot...")
            let canvases:HTMLCanvasElement[] = []

            for(const chat of chats){
                const cnv = await html2canvas.toCanvas(chat as HTMLElement)
                alertWait("Taking screenShot... "+canvases.length+"/"+chats.length)
                canvases.push(cnv)
            }

            canvases.reverse()

            if (saveChatsSeparately) {
                loadPages = 20;
                // Save chats separately and return early
                for (let i = 0; i < canvases.length; i++) {
                    const canvas = canvases[i];

                    // Create a new canvas to apply background color
                    let tempCanvas = document.createElement('canvas');
                    tempCanvas.width = canvas.width;
                    tempCanvas.height = canvas.height;
                    let tempCtx = tempCanvas.getContext('2d');
                    
                    tempCtx.fillStyle = customBackgroundColor;
                    tempCtx.fillRect(0, 0, canvas.width, canvas.height);

                    // Draw the original canvas onto the new canvas with background
                    tempCtx.drawImage(canvas, 0, 0);

                    await downloadFile(`${i}-chat.png`, Buffer.from(tempCanvas.toDataURL('png').split(',').at(-1), 'base64'));
                    canvas.remove();
                    tempCanvas.remove();
                }
                alertNormal(language.screenshotSaved);
                loadPages = 10;
                return;
            }


            alertWait("Merging images...")
            
            let mergedCanvas = document.createElement('canvas');
            mergedCanvas.width = 0;
            mergedCanvas.height = 0;
            let mergedCtx = mergedCanvas.getContext('2d');

            let totalHeight = 0;
            let maxWidth = 0;
            for(let i = 0; i < canvases.length; i++) {
                let canvas = canvases[i];
                totalHeight += canvas.height;
                maxWidth = Math.max(maxWidth, canvas.width);

                mergedCanvas.width = maxWidth;
                mergedCanvas.height = totalHeight;
            }

            mergedCtx.fillStyle = customBackgroundColor;
            mergedCtx.fillRect(0, 0, maxWidth, totalHeight);
            let indh = 0
            for(let i = 0; i < canvases.length; i++) {
                let canvas = canvases[i];
                indh += canvas.height
                mergedCtx.drawImage(canvas, 0, indh - canvas.height);
                canvases[i].remove();
            }

            if(mergedCanvas){
                await downloadFile(`chat-${v4()}.png`, Buffer.from(mergedCanvas.toDataURL('png').split(',').at(-1), 'base64'))
                mergedCanvas.remove();
            }
            alertNormal(language.screenshotSaved)
            loadPages = 10
        } catch (error) {
            console.error(error)
            alertError("Error while taking screenshot")
        }
    }

    $: {
        currentCharacter = $CurrentCharacter
    }
</script>
<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="w-full h-full" style={customStyle} on:click={() => {
    openMenu = false
}}>
    {#if $selectedCharID < 0}
        {#if $PlaygroundStore === 0}
            <MainMenu />
        {:else}
            <PlaygroundMenu />
        {/if}
    {:else}
        <div class="h-full w-full flex flex-col-reverse overflow-y-auto relative default-chat-screen"  on:scroll={(e) => {
            //@ts-ignore  
            const scrolled = (e.target.scrollHeight - e.target.clientHeight + e.target.scrollTop)
            if(scrolled < 100 && $CurrentChat.message.length > loadPages){
                loadPages += 15
            }
        }}>
            <div class="flex items-stretch mt-2 mb-2 w-full">
                {#if $DataBase.useChatSticker && currentCharacter.type !== 'group'}
                    <div on:click={()=>{toggleStickers = !toggleStickers}}
                            class={"ml-4 bg-textcolor2 flex justify-center items-center  w-12 h-12 rounded-md hover:bg-green-500 transition-colors "+(toggleStickers ? 'text-green-500':'text-textcolor')}>
                            <Laugh/>
                    </div>    
                {/if}

                {#if !$DataBase.useAdvancedEditor}
                <textarea class="peer focus:border-textcolor transition-colors outline-none text-textcolor p-2 min-w-0 border border-r-0 bg-transparent rounded-md rounded-r-none input-text text-xl flex-grow ml-4 border-darkborderc resize-none overflow-y-hidden overflow-x-hidden max-w-full"
                    bind:value={messageInput}
                    bind:this={inputEle}
                    on:keydown={(e) => {
                        if(e.key.toLocaleLowerCase() === "enter" && (!e.shiftKey) && !e.isComposing){
                            if($DataBase.sendWithEnter){
                                send()
                                e.preventDefault()
                            }
                        }
                        if(e.key.toLocaleLowerCase() === "m" && (e.ctrlKey)){
                            reroll()
                            e.preventDefault()
                        }
                    }}
                    on:input={()=>{updateInputSizeAll();updateInputTransateMessage(false)}}
                    style:height={inputHeight}
                />
                {:else}
                <AdvancedChatEditor 
                    bind:value={messageInput}
                    bind:translate={messageInputTranslate}
                    on:change={(e) => { updateInputTransateMessage(e.detail.translate);}}
                 />
                {/if}

                
                {#if $doingChat || doingChatInputTranslate} 
                    <button
                        class="peer-focus:border-textcolor  flex justify-center border-y border-darkborderc items-center text-gray-100 p-3 hover:bg-blue-500 transition-colors" on:click={abortChat}
                        style:height={inputHeight}
                    >
                        <div class="loadmove chat-process-stage-{$chatProcessStage}" class:autoload={autoMode} />
                    </button>
                {:else}
                    <button
                        on:click={send}
                        class="flex justify-center border-y border-darkborderc items-center text-gray-100 p-3 peer-focus:border-textcolor hover:bg-blue-500 transition-colors"
                        style:height={inputHeight}
                    >
                        <Send />
                    </button>
                {/if}
                {#if $CurrentCharacter?.chaId !== '§playground'}
                    <button
                        on:click={(e) => {
                            openMenu = !openMenu
                            e.stopPropagation()
                        }}
                        class="peer-focus:border-textcolor mr-2 flex border-y border-r border-darkborderc justify-center items-center text-gray-100 p-3 rounded-r-md hover:bg-blue-500 transition-colors"
                        style:height={inputHeight}
                    >
                        <MenuIcon />
                    </button>
                {:else}
                    <div on:click={(e) => {
                        $CurrentChat.message.push({
                            role: 'char',
                            data: ''
                        })
                        $CurrentChat = $CurrentChat
                    }}
                        class="peer-focus:border-textcolor mr-2 flex border-y border-r border-darkborderc justify-center items-center text-gray-100 p-3 rounded-r-md hover:bg-blue-500 transition-colors"
                        style:height={inputHeight}
                    >
                        <Plus />
                    </div>
                {/if}
            </div>
            {#if $DataBase.useAutoTranslateInput && !$DataBase.useAdvancedEditor && $CurrentCharacter?.chaId !== '§playground'}
                <div class="flex items-center mt-2 mb-2">
                    <label for='messageInputTranslate' class="text-textcolor ml-4">
                        <LanguagesIcon />
                    </label>
                    <textarea id = 'messageInputTranslate' class="text-textcolor rounded-md p-2 min-w-0 bg-transparent input-text text-xl flex-grow ml-4 mr-2 border-darkbutton resize-none focus:bg-selected overflow-y-hidden overflow-x-hidden max-w-full"
                        bind:value={messageInputTranslate}
                        bind:this={inputTranslateEle}
                        on:keydown={(e) => {
                            if(e.key.toLocaleLowerCase() === "enter" && (!e.shiftKey)){
                                if($DataBase.sendWithEnter){
                                    send()
                                    e.preventDefault()
                                }
                            }
                            if(e.key.toLocaleLowerCase() === "m" && (e.ctrlKey)){
                                reroll()
                                e.preventDefault()
                            }
                        }}
                        on:input={()=>{updateInputSizeAll();updateInputTransateMessage(true)}}
                        placeholder={language.enterMessageForTranslateToEnglish}
                        style:height={inputTranslateHeight}
                    />
                </div>
            {/if}

            {#if fileInput.length > 0}
                <div class="flex items-center ml-4 flex-wrap p-2 m-2 border-darkborderc border rounded-md">
                    {#each fileInput as file, i}
                        {#await getInlayImage(file) then inlayImage}
                            <img src={inlayImage.data} alt="Inlay" class="max-w-24 max-h-24">
                        {/await}
                    {/each}
                </div>

            {/if}
            
            {#if toggleStickers}
                <div class="ml-4 flex flex-wrap">
                    <AssetInput bind:currentCharacter={currentCharacter} onSelect={(additionalAsset)=>{
                        let fileType = 'img'
                        if(additionalAsset.length > 2 && additionalAsset[2]) {
                            const fileExtension = additionalAsset[2]
                            if(fileExtension === 'mp4' || fileExtension === 'webm')
                                fileType = 'video'
                            else if(fileExtension === 'mp3' || fileExtension === 'wav')
                                fileType = 'audio'
                        }
                        messageInput += `<span class='notranslate' translate='no'>{{${fileType}::${additionalAsset[0]}}}</span> *${additionalAsset[0]} added*`
                        updateInputSizeAll()
                    }}/>
                </div>    
            {/if}

            {#if $DataBase.useAutoSuggestions}
                <Suggestion messageInput={(msg)=>messageInput=(
                    ($DataBase.subModel === "textgen_webui" || $DataBase.subModel === "mancer" || $DataBase.subModel.startsWith('local_')) && $DataBase.autoSuggestClean
                    ? msg.replace(/ +\(.+?\) *$| - [^"'*]*?$/, '')
                    : msg
                )} {send}/>
            {/if}
            
            {#each messageForm($CurrentChat.message, loadPages) as chat, i}
                {#if chat.role === 'char'}
                    {#if $CurrentCharacter.type !== 'group'}
                        <Chat
                            idx={chat.index}
                            name={$CurrentCharacter.name} 
                            message={chat.data}
                            img={getCharImage($CurrentCharacter.image, 'css')}
                            rerollIcon={i === 0}
                            onReroll={reroll}
                            unReroll={unReroll}
                            isLastMemory={$CurrentChat.lastMemory === (chat.chatId ?? 'none') && $CurrentShowMemoryLimit}
                            character={$CurrentSimpleCharacter}
                            largePortrait={$CurrentCharacter.largePortrait}
                            MessageGenerationInfo={chat.generationInfo}
                        />
                    {:else}
                        <Chat
                            idx={chat.index}
                            name={findCharacterbyId(chat.saying).name} 
                            rerollIcon={i === 0}
                            message={chat.data}
                            onReroll={reroll}
                            unReroll={unReroll}
                            img={getCharImage(findCharacterbyId(chat.saying).image, 'css')}
                            isLastMemory={$CurrentChat.lastMemory === (chat.chatId ?? 'none') && $CurrentShowMemoryLimit}
                            character={chat.saying}
                            largePortrait={findCharacterbyId(chat.saying).largePortrait}
                            MessageGenerationInfo={chat.generationInfo}
                        />
                    {/if}
                {:else}
                    <Chat
                        character={$CurrentSimpleCharacter}
                        idx={chat.index}
                        name={$CurrentUsername} 
                        message={chat.data}
                        img={getCharImage($CurrentUserIcon, 'css')}
                        isLastMemory={$CurrentChat.lastMemory === (chat.chatId ?? 'none') && $CurrentShowMemoryLimit}
                        largePortrait={$UserIconProtrait}
                        MessageGenerationInfo={chat.generationInfo}
                    />
                {/if}
            {/each}
            {#if $CurrentChat.message.length <= loadPages}
                {#if $CurrentCharacter.type !== 'group' }
                    <Chat
                        character={$CurrentSimpleCharacter}
                        name={$CurrentCharacter.name}
                        message={$CurrentCharacter.firstMsgIndex === -1 ? $CurrentCharacter.firstMessage :
                            $CurrentCharacter.alternateGreetings[$CurrentCharacter.firstMsgIndex]}
                        img={getCharImage($CurrentCharacter.image, 'css')}
                        idx={-1}
                        altGreeting={$CurrentCharacter.alternateGreetings.length > 0}
                        largePortrait={$CurrentCharacter.largePortrait}
                        onReroll={() => {
                            const cha = $CurrentCharacter
                            if(cha.type !== 'group'){
                                if (cha.firstMsgIndex >= (cha.alternateGreetings.length - 1)){
                                    cha.firstMsgIndex = -1
                                }
                                else{
                                    cha.firstMsgIndex += 1
                                }
                            }
                            $CurrentCharacter = cha
                        }}
                        unReroll={() => {
                            const cha = $CurrentCharacter
                            if(cha.type !== 'group'){
                                if (cha.firstMsgIndex === -1){
                                    cha.firstMsgIndex = (cha.alternateGreetings.length - 1)
                                }
                                else{
                                    cha.firstMsgIndex -= 1
                                }
                            }
                            $CurrentCharacter = cha
                        }}
                        isLastMemory={false}

                    />
                    {#if !$CurrentCharacter.removedQuotes && $CurrentCharacter.creatorNotes.length >= 2}
                        <CreatorQuote quote={$CurrentCharacter.creatorNotes} onRemove={() => {
                            const cha = $CurrentCharacter
                            if(cha.type !== 'group'){
                                cha.removedQuotes = true
                            }
                            $CurrentCharacter = cha
                        }} />
                    {/if}
                {/if}
            {/if}

            {#if openMenu}
                <div class="absolute right-2 bottom-16 p-5 bg-darkbg flex flex-col gap-3 text-textcolor rounded-md" on:click={(e) => {
                    e.stopPropagation()
                }}>
                    {#if $CurrentCharacter.type === 'group'}
                        <div class="flex items-center cursor-pointer hover:text-green-500 transition-colors" on:click={runAutoMode}>
                            <DicesIcon />
                            <span class="ml-2">{language.autoMode}</span>
                        </div>
                    {/if}

                    
                    <!-- svelte-ignore empty-block -->
                    {#if $CurrentCharacter.ttsMode === 'webspeech' || $CurrentCharacter.ttsMode === 'elevenlab'}
                        <div class="flex items-center cursor-pointer hover:text-green-500 transition-colors" on:click={() => {
                            stopTTS()
                        }}>
                            <MicOffIcon />
                            <span class="ml-2">{language.ttsStop}</span>
                        </div>
                    {/if}

                    <div class="flex items-center cursor-pointer hover:text-green-500 transition-colors"
                        class:text-textcolor2={($CurrentChat.message.length < 2) || ($CurrentChat.message[$CurrentChat.message.length - 1].role !== 'char')}
                        on:click={() => {
                            if(($CurrentChat.message.length < 2) || ($CurrentChat.message[$CurrentChat.message.length - 1].role !== 'char')){
                                return
                            }
                            sendContinue();
                        }}
                    >
                        <StepForwardIcon />
                        <span class="ml-2">{language.continueResponse}</span>
                    </div>


                    {#if $DataBase.showMenuChatList}
                        <div class="flex items-center cursor-pointer hover:text-green-500 transition-colors" on:click={() => {
                            openChatList = true
                            openMenu = false
                        }}>
                            <DatabaseIcon />
                            <span class="ml-2">{language.chatList}</span>
                        </div>
                    {/if}
                    
                    {#if $DataBase.translator !== ''}
                        <div class={"flex items-center cursor-pointer "+ ($DataBase.useAutoTranslateInput ? 'text-green-500':'lg:hover:text-green-500')} on:click={() => {
                            $DataBase.useAutoTranslateInput = !$DataBase.useAutoTranslateInput
                        }}>
                            <GlobeIcon />
                            <span class="ml-2">{language.autoTranslateInput}</span>
                        </div>
                        
                    {/if}
            
                    <div class="flex items-center cursor-pointer hover:text-green-500 transition-colors" on:click={() => {
                        screenShot()
                    }}>
                        <CameraIcon />
                        <span class="ml-2">{language.screenshot}</span>
                    </div>

                    <div class="flex items-center cursor-pointer hover:text-green-500 transition-colors" on:click={() => {
                        screenShot(true)
                    }}>
                        <CameraIcon />
                        <span class="ml-2">분리 스크린샷</span>
                    </div>

                    <div class="flex items-center cursor-pointer hover:text-green-500 transition-colors" on:click={async () => {
                        const res = await postChatFile(messageInput)
                        if(res?.type === 'image'){
                            fileInput.push(res.data)
                            updateInputSizeAll()
                        }
                        if(res?.type === 'text'){
                            messageInput += `{{file::${res.name}::${res.data}}}`
                            updateInputSizeAll()
                        }
                    }}>
                        <ImagePlusIcon />
                        <span class="ml-2">{language.postFile}</span>
                    </div>


                    <div class={"flex items-center cursor-pointer "+ ($DataBase.useAutoSuggestions ? 'text-green-500':'lg:hover:text-green-500')} on:click={async () => {
                        $DataBase.useAutoSuggestions = !$DataBase.useAutoSuggestions
                    }}>
                        <ReplyIcon />
                        <span class="ml-2">{language.autoSuggest}</span>
                    </div>


                    <div class="flex items-center cursor-pointer hover:text-green-500 transition-colors" on:click={() => {
                        $CurrentChat.modules ??= []
                        openModuleList = true
                        openMenu = false
                    }}>
                        <PackageIcon />
                        <span class="ml-2">{language.modules}</span>
                    </div>

                    {#if $DataBase.sideMenuRerollButton}
                        <div class="flex items-center cursor-pointer hover:text-green-500 transition-colors" on:click={reroll}>
                            <RefreshCcwIcon />
                            <span class="ml-2">{language.reroll}</span>
                        </div>
                    {/if}
                </div>

            {/if}
        </div>

    {/if}
</div>
<style>

    .chat-process-stage-1{
        border-top: 0.4rem solid #60a5fa;
        border-left: 0.4rem solid #60a5fa;
    }

    .chat-process-stage-2{
        border-top: 0.4rem solid #db2777;
        border-left: 0.4rem solid #db2777;
    }

    .chat-process-stage-3{
        border-top: 0.4rem solid #34d399;
        border-left: 0.4rem solid #34d399;
    }

    .chat-process-stage-4{
        border-top: 0.4rem solid #8b5cf6;
        border-left: 0.4rem solid #8b5cf6;
    }

    .autoload{
        border-top: 0.4rem solid #10b981;
        border-left: 0.4rem solid #10b981;
    }

    @keyframes spin {
        
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
</style>