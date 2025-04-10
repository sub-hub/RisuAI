<script lang="ts">
    import type { Chat, character, groupChat } from "src/ts/storage/database.svelte";
    
    import { DBState } from 'src/ts/stores.svelte';
    import TextInput from "../UI/GUI/TextInput.svelte";
    import { DownloadIcon, PencilIcon, FolderUpIcon, MenuIcon, TrashIcon, GitBranchIcon, SplitIcon } from "lucide-svelte";
    import { exportChat, importChat } from "src/ts/characters";
    import { alertChatOptions, alertConfirm, alertError, alertNormal, alertSelect, alertStore } from "src/ts/alert";
    import { language } from "src/lang";
    import Button from "../UI/GUI/Button.svelte";
    import { findCharacterbyId, parseKeyValue, sleep, sortableOptions } from "src/ts/util";
    import CheckInput from "../UI/GUI/CheckInput.svelte";
    import { createMultiuserRoom } from "src/ts/sync/multiuser";
    import { MobileGUI, ReloadGUIPointer, selectedCharID } from "src/ts/stores.svelte";
    import Sortable from 'sortablejs/modular/sortable.core.esm.js';
    import { onDestroy, onMount } from "svelte";
    import { v4 } from "uuid";
  import { getChatBranches } from "src/ts/gui/branches";
  import { getModuleToggles } from "src/ts/process/modules";

  interface Props {
    chara: character|groupChat;
  }

  let { chara = $bindable() }: Props = $props();
    let editMode = $state(false)

    let stb: Sortable = null
    let ele: HTMLDivElement = $state()
    let sorted = $state(0)
    let opened = 0
    const createStb = () => {
        stb = Sortable.create(ele, {
            onEnd: async () => {
                let idx:number[] = []
                ele.querySelectorAll('[data-risu-idx]').forEach((e, i) => {
                    idx.push(parseInt(e.getAttribute('data-risu-idx')))
                })
                console.log(idx)
                let newValue:Chat[] = []
                let newChatPage = chara.chatPage
                idx.forEach((i) => {
                    newValue.push(chara.chats[i])
                    if(chara.chatPage === i){
                        newChatPage = newValue.length - 1
                    }
                })
                chara.chats = newValue
                chara.chatPage = newChatPage
                try {
                    stb.destroy()
                } catch (error) {}
                sorted += 1
                await sleep(1)
                createStb()
            },
            ...sortableOptions
        })
    }

    onMount(createStb)

    onDestroy(() => {
        if(stb){
            try {
                stb.destroy()
            } catch (error) {}
        }
    })
</script>
<div class="flex flex-col w-full h-[calc(100%-2rem)] max-h-[calc(100%-2rem)]">

    <Button className="relative bottom-2" onclick={() => {
        const cha = chara
        const len = chara.chats.length
        let chats = chara.chats
        chats.unshift({
            message:[], note:'', name:`New Chat ${len + 1}`, localLore:[], fmIndex: -1
        })
        if(cha.type === 'group'){
            cha.characters.map((c) => {
                chats[len].message.push({
                    saying: c,
                    role: 'char',
                    data: findCharacterbyId(c).firstMessage
                })
            })
        }
        chara.chats = chats
        chara.chatPage = 0
        $ReloadGUIPointer += 1
    }}>{language.newChat}</Button>
    <div class="flex flex-col w-full mt-2 overflow-y-auto flex-grow" bind:this={ele}>
        {#key sorted}
        {#each chara.chats as chat, i}
        <button data-risu-idx={i} onclick={() => {
            if(!editMode){
                chara.chatPage = i
                $ReloadGUIPointer += 1

            }
        }} class="flex items-center text-textcolor  border-solid border-0 border-darkborderc p-2 cursor-pointer rounded-md"class:bg-selected={i === chara.chatPage}>
            {#if editMode}
                <TextInput bind:value={chara.chats[i].name} className="flex-grow min-w-0" padding={false}/>
            {:else}
                <span>{chat.name}</span>
            {/if}
            <div class="flex-grow flex justify-end">
                <div role="button" tabindex="0" onkeydown={(e) => {
                    if(e.key === 'Enter'){
                        e.currentTarget.click()
                    }
                }} class="text-textcolor2 hover:text-green-500 mr-1 cursor-pointer" onclick={async () => {
                    const option = await alertChatOptions()
                    switch(option){
                        case 0:{
                            const newChat = safeStructuredClone($state.snapshot(chara.chats[i]))
                            newChat.name = `Copy of ${newChat.name}`
                            chara.chats.unshift(newChat)
                            chara.chatPage = 0
                            chara.chats = chara.chats
                            break
                        }
                        case 1:{
                            const chat = chara.chats[i]
                            if(chat.bindedPersona){
                                const confirm = await alertConfirm(language.doYouWantToUnbindCurrentPersona)
                                if(confirm){
                                    chat.bindedPersona = ''
                                    alertNormal(language.personaUnbindedSuccess)
                                }
                            }
                            else{
                                const confirm = await alertConfirm(language.doYouWantToBindCurrentPersona)
                                if(confirm){
                                    if(!DBState.db.personas[DBState.db.selectedPersona].id){
                                        DBState.db.personas[DBState.db.selectedPersona].id = v4()
                                    }
                                    chat.bindedPersona = DBState.db.personas[DBState.db.selectedPersona].id
                                    console.log(DBState.db.personas[DBState.db.selectedPersona])
                                    alertNormal(language.personaBindedSuccess)
                                }
                            }
                            break
                        }
                        case 2:{
                            chara.chatPage = i
                            createMultiuserRoom()
                        }
                    }
                }}>
                    <MenuIcon size={18}/>
                </div>
                <div role="button" tabindex="0" onkeydown={(e) => {
                    if(e.key === 'Enter'){
                        e.currentTarget.click()
                    }
                }} class="text-textcolor2 hover:text-green-500 mr-1 cursor-pointer" onclick={() => {
                    editMode = !editMode
                }}>
                    <PencilIcon size={18}/>
                </div>
                <div role="button" tabindex="0" onkeydown={(e) => {
                    if(e.key === 'Enter'){
                        e.currentTarget.click()
                    }
                }} class="text-textcolor2 hover:text-green-500 mr-1 cursor-pointer" onclick={async (e) => {
                    e.stopPropagation()
                    exportChat(i)
                }}>
                    <DownloadIcon size={18}/>
                </div>
                <div role="button" tabindex="0" onkeydown={(e) => {
                    if(e.key === 'Enter'){
                        e.currentTarget.click()
                    }
                }} class="text-textcolor2 hover:text-green-500 cursor-pointer" onclick={async (e) => {
                    e.stopPropagation()
                    if(chara.chats.length === 1){
                        alertError(language.errors.onlyOneChat)
                        return
                    }
                    const d = await alertConfirm(`${language.removeConfirm}${chat.name}`)
                    if(d){
                        chara.chatPage = 0
                        $ReloadGUIPointer += 1
                        let chats = chara.chats
                        chats.splice(i, 1)
                        chara.chats = chats
                    }
                }}>
                    <TrashIcon size={18}/>
                </div>
            </div>
        </button>
        {/each}
        {/key}
    </div>
    
    <div class="border-t border-selected mt-2">
        <div class="flex mt-2 ml-2 items-center">
            <button class="text-textcolor2 hover:text-green-500 mr-2 cursor-pointer" onclick={() => {
                importChat()
            }}>
                <FolderUpIcon size={18}/>
            </button>
            <button class="text-textcolor2 hover:text-green-500 mr-2 cursor-pointer" onclick={() => {
                editMode = !editMode
            }}>
                <PencilIcon size={18}/>
            </button>
            <button class="text-textcolor2 hover:text-green-500 cursor-pointer" onclick={() => {
                alertStore.set({
                  type: "branches",
                  msg: ""
                })
            }}>
                <SplitIcon size={18}/>
            </button>
        </div>

        {#if DBState.db.characters[$selectedCharID]?.chaId !== '§playground'}

            
            {#if parseKeyValue(DBState.db.customPromptTemplateToggle + getModuleToggles()).length > 4}
                <div class="h-48 border-darkborderc p-2 border rounded flex flex-col items-start mt-2 overflow-y-auto">
                    <div class="flex mt-2 items-center w-full" class:justify-end={$MobileGUI}>
                        <CheckInput bind:check={DBState.db.jailbreakToggle} name={language.jailbreakToggle} reverse />
                    </div>
                    {#each parseKeyValue(DBState.db.customPromptTemplateToggle + getModuleToggles()) as toggle}
                        <div class="flex mt-2 items-center w-full" class:justify-end={$MobileGUI}>
                            <CheckInput check={DBState.db.globalChatVariables[`toggle_${toggle[0]}`] === '1'} reverse name={toggle[1]} onChange={() => {
                                DBState.db.globalChatVariables[`toggle_${toggle[0]}`] = DBState.db.globalChatVariables[`toggle_${toggle[0]}`] === '1' ? '0' : '1'
                            }} />
                        </div>
                    {/each}
                    {#if DBState.db.supaModelType !== 'none' || DBState.db.hanuraiEnable}
                        <div class="flex mt-2 items-center w-full" class:justify-end={$MobileGUI}>
                            <CheckInput bind:check={chara.supaMemory} reverse name={DBState.db.hanuraiEnable ? language.hanuraiMemory : DBState.db.hypaMemory ? language.ToggleHypaMemory : language.ToggleSuperMemory}/>
                        </div>
                    {/if}
                </div>
            {:else if parseKeyValue(DBState.db.customPromptTemplateToggle + getModuleToggles()).length > 0}
                <div class="flex mt-2 items-center">
                    <CheckInput bind:check={DBState.db.jailbreakToggle} name={language.jailbreakToggle} reverse/>
                </div>
                {#each parseKeyValue(DBState.db.customPromptTemplateToggle + getModuleToggles()) as toggle}
                    <div class="flex mt-2 items-center">
                        <CheckInput check={DBState.db.globalChatVariables[`toggle_${toggle[0]}`] === '1'} reverse name={toggle[1]} onChange={() => {
                            DBState.db.globalChatVariables[`toggle_${toggle[0]}`] = DBState.db.globalChatVariables[`toggle_${toggle[0]}`] === '1' ? '0' : '1'
                        }} />
                    </div>
                {/each}
                {#if DBState.db.supaModelType !== 'none' || DBState.db.hanuraiEnable}
                    <div class="flex mt-2 items-center">
                        <CheckInput bind:check={chara.supaMemory} reverse name={DBState.db.hanuraiEnable ? language.hanuraiMemory : DBState.db.hypaMemory ? language.ToggleHypaMemory : language.ToggleSuperMemory}/>
                    </div>
                {/if}
            {:else}
                <div class="flex mt-2 items-center">
                    <CheckInput bind:check={DBState.db.jailbreakToggle} name={language.jailbreakToggle}/>
                </div>
                {#if DBState.db.supaModelType !== 'none' || DBState.db.hanuraiEnable}
                    <div class="flex mt-2 items-center">
                        <CheckInput bind:check={chara.supaMemory} name={DBState.db.hanuraiEnable ? language.hanuraiMemory : DBState.db.hypaMemory ? language.ToggleHypaMemory : language.ToggleSuperMemory}/>
                    </div>
                {/if}
            {/if}
        {/if}
    </div>

    {#if chara.type === 'group'}
        <div class="flex mt-2 items-center">
            <CheckInput bind:check={chara.orderByOrder} name={language.orderByOrder}/>
        </div>
    {/if}
</div>