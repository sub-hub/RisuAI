import {
    writeFile,
    BaseDirectory,
    readFile,
    exists,
    mkdir,
    readDir,
    remove
} from "@tauri-apps/plugin-fs"
import { changeFullscreen, checkNullish, sleep } from "./util"
import { v4 as uuidv4 } from 'uuid';
import { get } from "svelte/store";
import { setDatabase, type Database, defaultSdDataFunc, getDatabase } from "./storage/database.svelte";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { checkRisuUpdate } from "./update";
import { MobileGUI, botMakerMode, selectedCharID, loadedStore, DBState, LoadingStatusState } from "./stores.svelte";
import { loadPlugins } from "./plugins/plugins";
import { alertError, alertMd, alertTOS, waitAlert, alertSelect, alertConfirm, alertWait, alertClear } from "./alert";
import { checkDriverInit } from "./drive/drive";
import { characterURLImport } from "./characterCards";
import { defaultJailbreak, defaultMainPrompt, oldJailbreak, oldMainPrompt } from "./storage/defaultPrompts";
import { loadRisuAccountData } from "./drive/accounter";
import { decodeRisuSave, encodeRisuSaveLegacy, tryRecoverRisuSave, type RecoveryResult } from "./storage/risuSave";
import { updateAnimationSpeed } from "./gui/animation";
import { updateColorScheme, updateTextThemeAndCSS } from "./gui/colorscheme";
import { autoServerBackup } from "./kei/backup";
import { Capacitor } from '@capacitor/core';
import { language } from "src/lang";
import { startObserveDom } from "./observer.svelte";
import { updateGuisize } from "./gui/guisize";
import { updateLorebooks } from "./characters";
import { initMobileGesture } from "./hotkey";
import { moduleUpdate } from "./process/modules";
import type { AccountStorage } from "./storage/accountStorage";
import { makeColdData } from "./process/coldstorage.svelte";
import {
    forageStorage,
    saveDb,
    getDbBackups,
    getUnpargeables,
    getBasename,
    setUsingSw,
    checkCharOrder,
    downloadFile,
    VirtualWriter
} from "./globalApi.svelte";
import { isTauri } from "./platform";

const appWindow = isTauri ? getCurrentWebviewWindow() : null

/**
 * Loads the application data.
 */
export async function loadData() {
    const loaded = get(loadedStore)
    if (!loaded) {
        try {
            if (isTauri) {
                LoadingStatusState.text = "Checking Files..."
                appWindow.maximize()
                if (!await exists('', { baseDir: BaseDirectory.AppData })) {
                    await mkdir('', { baseDir: BaseDirectory.AppData })
                }
                if (!await exists('database', { baseDir: BaseDirectory.AppData })) {
                    await mkdir('database', { baseDir: BaseDirectory.AppData })
                }
                if (!await exists('assets', { baseDir: BaseDirectory.AppData })) {
                    await mkdir('assets', { baseDir: BaseDirectory.AppData })
                }
                if (!await exists('database/database.bin', { baseDir: BaseDirectory.AppData })) {
                    await writeFile('database/database.bin', encodeRisuSaveLegacy({}), { baseDir: BaseDirectory.AppData });
                }
                let tauriDbLoaded = false
                let tauriCorruptedData: Uint8Array | null = null
                try {
                    LoadingStatusState.text = "Reading Save File..."
                    const readed = await readFile('database/database.bin', { baseDir: BaseDirectory.AppData })
                    tauriCorruptedData = readed // Keep a copy in case decoding fails
                    LoadingStatusState.text = "Cleaning Unnecessary Files..."
                    getDbBackups() //this also cleans the backups
                    LoadingStatusState.text = "Decoding Save File..."
                    const decoded = await decodeRisuSave(readed)
                    setDatabase(decoded)
                    tauriDbLoaded = true
                } catch (error) {
                    LoadingStatusState.text = "Reading Backup Files..."
                    const backups = await getDbBackups()
                    for (const backup of backups) {
                        if (!tauriDbLoaded) {
                            try {
                                LoadingStatusState.text = `Reading Backup File ${backup}...`
                                const backupData = await readFile(`database/dbbackup-${backup}.bin`, { baseDir: BaseDirectory.AppData })
                                setDatabase(
                                    await decodeRisuSave(backupData)
                                )
                                tauriDbLoaded = true
                            } catch (error) {
                                console.error(error)
                            }
                        }
                    }
                    if (!tauriDbLoaded && tauriCorruptedData) {
                        // Offer recovery options to user
                        const recovered = await handleCorruptedSaveFile(tauriCorruptedData, 'Tauri database.bin')
                        if (!recovered) {
                            // User chose not to continue or recovery failed completely
                            return
                        }
                        tauriDbLoaded = true
                    } else if (!tauriDbLoaded) {
                        throw "Your save file is corrupted and no data is available for recovery"
                    }
                }
                LoadingStatusState.text = "Checking Update..."
                await checkRisuUpdate()
                await changeFullscreen()

            }
            else {
                await forageStorage.Init()

                LoadingStatusState.text = "Loading Local Save File..."
                let gotStorage: Uint8Array = await forageStorage.getItem('database/database.bin') as unknown as Uint8Array
                let forageCorruptedData: Uint8Array | null = null
                LoadingStatusState.text = "Decoding Local Save File..."
                if (checkNullish(gotStorage)) {
                    gotStorage = encodeRisuSaveLegacy({})
                    await forageStorage.setItem('database/database.bin', gotStorage)
                }
                let forageDbLoaded = false
                forageCorruptedData = gotStorage // Keep a copy in case decoding fails
                try {
                    const decoded = await decodeRisuSave(gotStorage)
                    console.log(decoded)
                    setDatabase(decoded)
                    forageDbLoaded = true
                } catch (error) {
                    console.error(error)
                    const backups = await getDbBackups()
                    for (const backup of backups) {
                        if (!forageDbLoaded) {
                            try {
                                LoadingStatusState.text = `Reading Backup File ${backup}...`
                                const backupData: Uint8Array = await forageStorage.getItem(`database/dbbackup-${backup}.bin`) as unknown as Uint8Array
                                setDatabase(
                                    await decodeRisuSave(backupData)
                                )
                                forageDbLoaded = true
                            } catch (error) { }
                        }
                    }
                    if (!forageDbLoaded && forageCorruptedData) {
                        // Offer recovery options to user
                        const recovered = await handleCorruptedSaveFile(forageCorruptedData, 'Local Storage')
                        if (!recovered) {
                            // User chose not to continue or recovery failed completely
                            return
                        }
                        forageDbLoaded = true
                    } else if (!forageDbLoaded) {
                        throw "Forage: Your save file is corrupted and no data is available for recovery"
                    }
                }

                if (await forageStorage.checkAccountSync()) {
                    LoadingStatusState.text = "Checking Account Sync..."
                    let remoteSaveData: Uint8Array = await (forageStorage.realStorage as AccountStorage).getItem('database/database.bin', (v) => {
                        LoadingStatusState.text = `Loading Remote Save File ${(v * 100).toFixed(2)}%`
                    })
                    if (checkNullish(remoteSaveData)) {
                        remoteSaveData = encodeRisuSaveLegacy({})
                        await forageStorage.setItem('database/database.bin', remoteSaveData)
                    }
                    let remoteSaveLoaded = false
                    try {
                        setDatabase(
                            await decodeRisuSave(remoteSaveData)
                        )
                        remoteSaveLoaded = true
                    } catch (error) {
                        const backups = await getDbBackups()
                        for (const backup of backups) {
                            if (!remoteSaveLoaded) {
                                try {
                                    LoadingStatusState.text = `Reading Backup File ${backup}...`
                                    const backupData: Uint8Array = await forageStorage.getItem(`database/dbbackup-${backup}.bin`) as unknown as Uint8Array
                                    setDatabase(
                                        await decodeRisuSave(backupData)
                                    )
                                    remoteSaveLoaded = true
                                } catch (error) { }
                            }
                        }
                        if (!remoteSaveLoaded) {
                            // Offer recovery options to user for remote save
                            const recovered = await handleCorruptedSaveFile(remoteSaveData, 'Account Sync (Remote)')
                            if (!recovered) {
                                // Try server backup as last resort
                                await autoServerBackup()
                                await sleep(10000)
                            }
                        }
                    }
                }
                LoadingStatusState.text = "Rechecking Account Sync..."
                await forageStorage.checkAccountSync()
                LoadingStatusState.text = "Checking Drive Sync..."
                const isDriverMode = await checkDriverInit()
                if (isDriverMode) {
                    return
                }
                LoadingStatusState.text = "Checking Service Worker..."
                if (navigator.serviceWorker && (!Capacitor.isNativePlatform())) {
                    setUsingSw(true)
                    await registerSw()
                }
                else {
                    setUsingSw(false)
                }
                if (getDatabase().didFirstSetup) {
                    characterURLImport()
                }
            }
            LoadingStatusState.text = "Checking Unnecessary Files..."
            try {
                await pargeChunks()
            } catch (error) {
                console.error(error)
            }
            LoadingStatusState.text = "Loading Plugins..."
            try {
                await loadPlugins()
            } catch (error) { }
            if (getDatabase().account) {
                LoadingStatusState.text = "Checking Account Data..."
                try {
                    await loadRisuAccountData()
                } catch (error) { }
            }
            try {
                //@ts-expect-error navigator.standalone is iOS Safari non-standard property, not in Navigator interface
                const isInStandaloneMode = (window.matchMedia('(display-mode: standalone)').matches) || (window.navigator.standalone) || document.referrer.includes('android-app://');
                if (isInStandaloneMode) {
                    await navigator.storage.persist()
                }
            } catch (error) {

            }
            LoadingStatusState.text = "Checking For Format Update..."
            await checkNewFormat()
            const db = getDatabase();

            LoadingStatusState.text = "Updating States..."
            updateColorScheme()
            updateTextThemeAndCSS()
            updateAnimationSpeed()
            updateHeightMode()
            updateErrorHandling()
            updateGuisize()
            if (!localStorage.getItem('nightlyWarned') && window.location.hostname === 'nightly.risuai.xyz') {
                alertMd(language.nightlyWarning)
                await waitAlert()
                //for testing, leave empty
                localStorage.setItem('nightlyWarned', '')
            }
            if (db.botSettingAtStart) {
                botMakerMode.set(true)
            }
            if ((db.betaMobileGUI && window.innerWidth <= 800) || import.meta.env.VITE_RISU_LITE === 'TRUE') {
                initMobileGesture()
                MobileGUI.set(true)
            }
            loadedStore.set(true)
            selectedCharID.set(-1)
            startObserveDom()
            assignIds()
            makeColdData()
            saveDb()
            moduleUpdate()
            if (import.meta.env.VITE_RISU_TOS === 'TRUE') {
                alertTOS().then((a) => {
                    if (a === false) {
                        location.reload()
                    }
                })
            }
        } catch (error) {
            alertError(error)
        }
    }
}


/**
 * Registers the service worker and initializes it.
 */
async function registerSw() {
    await navigator.serviceWorker.register("/sw.js", {
        scope: "/"
    });
    await sleep(100);
    const da = await fetch('/sw/init');
    if (!(da.status >= 200 && da.status < 300)) {
        location.reload();
    }
}

/**
 * Updates the error handling by adding custom handlers for errors and unhandled promise rejections.
 */
function updateErrorHandling() {
    const errorHandler = (event: ErrorEvent) => {
        console.error(event.error);
        alertError(event.error);
    };
    const rejectHandler = (event: PromiseRejectionEvent) => {
        console.error(event.reason);
        alertError(event.reason);
    };
    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectHandler);
}

/**
 * Updates the height mode of the document based on the value stored in the database.
 */
function updateHeightMode() {
    const db = getDatabase()
    const root = document.querySelector(':root') as HTMLElement;
    switch (db.heightMode) {
        case 'auto':
            root.style.setProperty('--risu-height-size', '100%');
            break
        case 'vh':
            root.style.setProperty('--risu-height-size', '100vh');
            break
        case 'dvh':
            root.style.setProperty('--risu-height-size', '100dvh');
            break
        case 'lvh':
            root.style.setProperty('--risu-height-size', '100lvh');
            break
        case 'svh':
            root.style.setProperty('--risu-height-size', '100svh');
            break
        case 'percent':
            root.style.setProperty('--risu-height-size', '100%');
            break
    }
}

/**
 * Checks and updates the database format to the latest version.
 */
async function checkNewFormat(): Promise<void> {
    let db = getDatabase();

    // Check data integrity
    db.characters = db.characters.map((v) => {
        if (!v) {
            return null;
        }
        v.chaId ??= uuidv4();
        v.type ??= 'character';
        v.chatPage ??= 0;
        v.chats ??= [];
        v.customscript ??= [];
        v.firstMessage ??= '';
        v.globalLore ??= [];
        v.name ??= '';
        v.viewScreen ??= 'none';
        v.emotionImages = v.emotionImages ?? [];

        if (v.type === 'character') {
            v.bias ??= [];
            v.characterVersion ??= '';
            v.creator ??= '';
            v.desc ??= '';
            v.utilityBot ??= false;
            v.tags ??= [];
            v.systemPrompt ??= '';
            v.scenario ??= '';
        }
        return v;
    }).filter((v) => {
        return v !== null;
    });

    db.modules = (db.modules ?? []).map((v) => {
        if (v?.lorebook) {
            v.lorebook = updateLorebooks(v.lorebook);
        }
        return v
    }).filter((v) => {
        return v !== null && v !== undefined;
    });

    db.personas = (db.personas ?? []).map((v) => {
        v.id ??= uuidv4()
        return v
    }).filter((v) => {
        return v !== null && v !== undefined;
    });

    if (!db.formatversion) {
        function checkParge(data: string) {

            if (data.startsWith('assets') || (data.length < 3)) {
                return data
            }
            else {
                const d = 'assets/' + (data.replace(/\\/g, '/').split('assets/')[1])
                if (!d) {
                    return data
                }
                return d;
            }
        }

        db.customBackground = checkParge(db.customBackground);
        db.userIcon = checkParge(db.userIcon);

        for (let i = 0; i < db.characters.length; i++) {
            if (db.characters[i].image) {
                db.characters[i].image = checkParge(db.characters[i].image);
            }
            if (db.characters[i].emotionImages) {
                for (let i2 = 0; i2 < db.characters[i].emotionImages.length; i2++) {
                    if (db.characters[i].emotionImages[i2] && db.characters[i].emotionImages[i2].length >= 2) {
                        db.characters[i].emotionImages[i2][1] = checkParge(db.characters[i].emotionImages[i2][1]);
                    }
                }
            }
        }

        db.formatversion = 2;
    }
    if (db.formatversion < 3) {
        for (let i = 0; i < db.characters.length; i++) {
            let cha = db.characters[i];
            if (cha.type === 'character') {
                if (checkNullish(cha.sdData)) {
                    cha.sdData = defaultSdDataFunc();
                }
            }
        }

        db.formatversion = 3;
    }
    if (db.formatversion < 4) {
        //migration removed due to issues
        db.formatversion = 4;
    }
    if (db.formatversion < 5) {
        if (db.loreBookToken < 8000) {
            db.loreBookToken = 8000;
        }
        db.formatversion = 5;
    }
    if (!db.characterOrder) {
        db.characterOrder = [];
    }
    if (db.mainPrompt === oldMainPrompt) {
        db.mainPrompt = defaultMainPrompt;
    }
    if (db.mainPrompt === oldJailbreak) {
        db.mainPrompt = defaultJailbreak;
    }
    for (let i = 0; i < db.characters.length; i++) {
        const trashTime = db.characters[i].trashTime;
        const targetTrashTime = trashTime ? trashTime + 1000 * 60 * 60 * 24 * 3 : 0;
        if (trashTime && targetTrashTime < Date.now()) {
            db.characters.splice(i, 1);
            i--;
        }
    }
    setDatabase(db);
    checkCharOrder();
}

/**
 * Purges chunks of data that are not needed.
 */
async function pargeChunks() {
    const db = getDatabase()
    if (db.account?.useSync) {
        return
    }

    const unpargeable = new Set(getUnpargeables(db))
    if (isTauri) {
        const assets = await readDir('assets', { baseDir: BaseDirectory.AppData })
        console.log(assets)
        for (const asset of assets) {
            try {
                const n = getBasename(asset.name)
                if (unpargeable.has(n)) {
                    console.log('unpargeable', n)
                }
                else {
                    console.log('pargeable', n)
                    await remove('assets/' + asset.name, { baseDir: BaseDirectory.AppData })
                }
            } catch (error) {
                console.log('error', asset.name)
            }
        }
    }
    else {
        const indexes = await forageStorage.keys()
        for (const asset of indexes) {
            if (!asset.startsWith('assets/')) {
                continue
            }
            const n = getBasename(asset)
            if (unpargeable.has(n)) {
            }
            else {
                await forageStorage.removeItem(asset)
            }
        }
    }
}

/**
 * Assigns unique IDs to characters and chats.
 */
function assignIds() {
    if (!DBState?.db?.characters) {
        return
    }
    const assignedIds = new Set<string>()
    for (let i = 0; i < DBState.db.characters.length; i++) {
        const cha = DBState.db.characters[i]
        if (!cha.chaId) {
            cha.chaId = uuidv4()
        }
        if (assignedIds.has(cha.chaId)) {
            console.warn(`Duplicate chaId found: ${cha.chaId}. Assigning new ID.`);
            cha.chaId = uuidv4();
        }
        assignedIds.add(cha.chaId)
        for (let i2 = 0; i2 < cha.chats.length; i2++) {
            const chat = cha.chats[i2]
            if (!chat.id) {
                chat.id = uuidv4()
            }
            if (assignedIds.has(chat.id)) {
                console.warn(`Duplicate chat ID found: ${chat.id}. Assigning new ID.`);
                chat.id = uuidv4();
            }
            assignedIds.add(chat.id)
        }
    }
}

/**
 * Handles corrupted save file by offering recovery options to the user.
 * @param corruptedData - The raw corrupted save file data
 * @param source - Description of where the corrupted file came from (for display)
 * @returns true if recovery was successful and app should continue, false if app should stop
 */
async function handleCorruptedSaveFile(corruptedData: Uint8Array, source: string): Promise<boolean> {
    alertClear()
    
    // Recovery messages (with fallbacks for when language.recovery doesn't exist)
    const msg = {
        saveFileCorrupted: `Save file is corrupted (${source}). What would you like to do?`,
        downloadCorrupted: 'Download corrupted file (for backup)',
        attemptRecovery: 'Attempt to recover data',
        downloadComplete: 'Corrupted file downloaded. You can try importing it elsewhere or contact support.',
        attemptingRecovery: 'Attempting to recover data...',
        recoveryFailed: 'Recovery failed. No data could be recovered.\n\n',
        downloadCorruptedPrompt: 'Would you like to download the corrupted file for backup?',
        downloadCorruptedConfirm: 'Download the corrupted file?',
        recoverySuccessTitle: 'Data Recovery Results',
        recoveredItems: 'Successfully Recovered:',
        failedItems: 'Failed to Recover:',
        totalCharacters: 'Total Characters Recovered:',
        overwriteCurrentSave: 'Overwrite current (corrupted) save with recovered data',
        downloadAsBackup: 'Download recovered data as backup file',
        whatToDoWithRecovered: 'What would you like to do with the recovered data?',
        confirmOverwrite: '⚠️ WARNING: This will replace your current corrupted save file with the recovered data. Some data may have been lost during recovery. Are you sure you want to proceed?',
        downloadBeforeOverwrite: 'Would you like to download the corrupted file before overwriting? (Recommended)',
        overwriteComplete: '✅ Recovery complete! Your save has been updated with the recovered data.',
        creatingBackup: 'Creating backup file...',
        backupDownloaded: '✅ Backup file downloaded!',
        backupInstructions: 'You can import this file using:\n**Settings → Backup → Load Local Backup**\n\nNote: This backup only contains the database. Image assets from the corrupted save are not included.'
    }
    
    // First, ask user what they want to do
    const choice = await alertSelect([
        msg.downloadCorrupted,
        msg.attemptRecovery
    ], msg.saveFileCorrupted)

    if (choice === '0') {
        // Download the corrupted file as-is
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        await downloadFile(`corrupted-save-${timestamp}.bin`, corruptedData)
        alertMd(msg.downloadComplete)
        await waitAlert()
        return false
    }

    if (choice === '1') {
        // Attempt recovery
        alertWait(msg.attemptingRecovery)
        
        const recoveryResult = await tryRecoverRisuSave(corruptedData)
        
        if (!recoveryResult.success || !recoveryResult.partialData) {
            // Recovery failed completely
            let errorMsg = msg.recoveryFailed
            if (recoveryResult.errorMessages.length > 0) {
                errorMsg += '**Errors:**\n'
                for (const err of recoveryResult.errorMessages) {
                    errorMsg += `- ${err}\n`
                }
            }
            errorMsg += '\n\n' + msg.downloadCorruptedPrompt
            
            alertMd(errorMsg)
            await waitAlert()
            
            if (await alertConfirm(msg.downloadCorruptedConfirm)) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
                await downloadFile(`corrupted-save-${timestamp}.bin`, corruptedData)
            }
            return false
        }

        // Recovery succeeded (at least partially)
        await showRecoveryResultAndOfferOptions(corruptedData, recoveryResult, msg)
        return true
    }

    return false
}

interface RecoveryMessages {
    recoverySuccessTitle: string
    recoveredItems: string
    failedItems: string
    totalCharacters: string
    overwriteCurrentSave: string
    downloadAsBackup: string
    whatToDoWithRecovered: string
    confirmOverwrite: string
    downloadBeforeOverwrite: string
    overwriteComplete: string
    creatingBackup: string
    backupDownloaded: string
    backupInstructions: string
}

/**
 * Shows the recovery result to the user and offers options for what to do next.
 */
async function showRecoveryResultAndOfferOptions(
    corruptedData: Uint8Array,
    recoveryResult: RecoveryResult,
    msg: RecoveryMessages
): Promise<void> {
    // Build the recovery summary message
    let summaryMsg = `## ${msg.recoverySuccessTitle}\n\n`
    
    if (recoveryResult.recoveredItems.length > 0) {
        summaryMsg += `### ${msg.recoveredItems}\n`
        for (const item of recoveryResult.recoveredItems) {
            summaryMsg += `- ✅ ${item}\n`
        }
        summaryMsg += '\n'
    }

    if (recoveryResult.failedItems.length > 0) {
        summaryMsg += `### ${msg.failedItems}\n`
        for (const item of recoveryResult.failedItems) {
            summaryMsg += `- ❌ ${item}\n`
        }
        summaryMsg += '\n'
    }

    // Count recovered characters
    const charCount = recoveryResult.partialData?.characters?.length ?? 0
    summaryMsg += `\n**${msg.totalCharacters} ${charCount}**\n`

    alertMd(summaryMsg)
    await waitAlert()

    // Now offer options for what to do with recovered data
    const actionChoice = await alertSelect([
        msg.overwriteCurrentSave,
        msg.downloadAsBackup
    ], msg.whatToDoWithRecovered)

    if (actionChoice === '0') {
        // Overwrite current save
        // First, confirm this action
        const confirmOverwrite = await alertConfirm(msg.confirmOverwrite)

        if (!confirmOverwrite) {
            return
        }

        // Offer to download the corrupted file first
        if (await alertConfirm(msg.downloadBeforeOverwrite)) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
            await downloadFile(`corrupted-save-before-overwrite-${timestamp}.bin`, corruptedData)
        }

        // Apply the recovered data
        setDatabase(recoveryResult.partialData as Database)
        await saveDb()
        
        alertMd(msg.overwriteComplete)
        await waitAlert()
    } else if (actionChoice === '1') {
        // Download as local backup file (compatible with LoadLocalBackup)
        await downloadRecoveredAsBackup(recoveryResult, msg)
    }
}

/**
 * Downloads the recovered data as a local backup file that can be imported via LoadLocalBackup.
 */
async function downloadRecoveredAsBackup(recoveryResult: RecoveryResult, msg: RecoveryMessages): Promise<void> {
    alertWait(msg.creatingBackup)

    const writer = new VirtualWriter()
    
    // Write the database as a risudat file (same format as SaveLocalBackup)
    const dbData = encodeRisuSaveLegacy(recoveryResult.partialData, 'compression')
    
    // Write using the same format as LocalWriter.writeBackup
    const encodedName = new TextEncoder().encode('database.risudat')
    const nameLength = new Uint32Array([encodedName.byteLength])
    writer.write(new Uint8Array(nameLength.buffer))
    writer.write(encodedName)
    const dataLength = new Uint32Array([dbData.byteLength])
    writer.write(new Uint8Array(dataLength.buffer))
    writer.write(dbData)

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    await downloadFile(`recovered-backup-${timestamp}.bin`, writer.buf.buffer)

    alertMd(msg.backupDownloaded + '\n\n' + msg.backupInstructions)
    await waitAlert()
}