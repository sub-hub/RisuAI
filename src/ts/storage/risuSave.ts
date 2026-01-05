import { Packr, Unpackr, decode } from "msgpackr/index-no-eval";
import * as fflate from "fflate";
import { presetTemplate, type Database } from "./database.svelte";
import localforage from "localforage";
import { forageStorage } from "../globalApi.svelte";
import { isTauri } from "src/ts/platform"
import {
    writeFile,
    BaseDirectory,
    exists,
    mkdir,
    readFile,
} from "@tauri-apps/plugin-fs"

const packr = new Packr({
    useRecords:false
});

const unpackr = new Unpackr({
    int64AsType: 'number',
    useRecords:false
})

const magicHeader = new Uint8Array([0, 82, 73, 83, 85, 83, 65, 86, 69, 0, 7]); 
const magicCompressedHeader = new Uint8Array([0, 82, 73, 83, 85, 83, 65, 86, 69, 0, 8]);
const magicStreamCompressedHeader = new Uint8Array([0, 82, 73, 83, 85, 83, 65, 86, 69, 0, 9]);
const magicRisuSaveHeader = new TextEncoder().encode("RISUSAVE\0");


async function checkCompressionStreams(){
    if(!CompressionStream){
        const {makeCompressionStream} = await import('compression-streams-polyfill/ponyfill');
        //@ts-expect-error polyfill CompressionStream type is incompatible with globalThis.CompressionStream
        globalThis.CompressionStream = makeCompressionStream(TransformStream);
    }
    if(!DecompressionStream){
        const {makeDecompressionStream} = await import('compression-streams-polyfill/ponyfill');
        //@ts-expect-error polyfill DecompressionStream type is incompatible with globalThis.DecompressionStream
        globalThis.DecompressionStream = makeDecompressionStream(TransformStream);
    }
}

export function encodeRisuSaveLegacy(data:any, compression:'noCompression'|'compression' = 'noCompression'){
    let encoded:Uint8Array = packr.encode(data)
    if(compression === 'compression'){
        encoded = fflate.compressSync(encoded)
        const result = new Uint8Array(encoded.length + magicCompressedHeader.length);
        result.set(magicCompressedHeader, 0)
        result.set(encoded, magicCompressedHeader.length)
        return result
    }
    else{
        const result = new Uint8Array(encoded.length + magicHeader.length);
        result.set(magicHeader, 0)
        result.set(encoded, magicHeader.length)
        return result
    }
}

export async function encodeRisuSaveCompressionStream(data:any) {
    await checkCompressionStreams()
    let encoded:Uint8Array = packr.encode(data)
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(encoded as any);
    writer.close();
    const buf = await new Response(cs.readable).arrayBuffer()
    const result = new Uint8Array(new Uint8Array(buf).length + magicStreamCompressedHeader.length);
    result.set(magicStreamCompressedHeader, 0)
    result.set(new Uint8Array(buf), magicStreamCompressedHeader.length)
    return result
}

export type toSaveType = {
    character: string[];
    chat: [string, string][];
    botPreset: boolean;
    modules: boolean;
}

enum RisuSaveType {
    CONFIG = 0,
    ROOT = 1,
    CHARACTER_WITH_CHAT = 2,
    CHAT = 3,
    BOTPRESET = 4,
    MODULES = 5,
    REMOTE = 6
}

type EncodeBlockArg = {
    compression:boolean
    data:string
    type:RisuSaveType
    name:string
    cache?:boolean
    remote?:true|false|'auto'
}

const risuSaveCacheForage = localforage.createInstance({
    name: 'risuSaveCache'
});
export class RisuSaveEncoder {

    private blocks: { [key: string]: Uint8Array } = {};
    private compression: boolean = false;

    async init(data:Database,arg:{
        compression?: boolean
    } = {}){
        const { compression = false } = arg;
        this.compression = compression;
        let obj:Record<any,any> = {}
        let keys = Object.keys(data)
        for(const key of keys){
            if(key !== 'characters' && key !== 'botPresets' && key !== 'modules'){
                obj[key] = data[key]
            }
        }
        this.blocks['root'] = await this.encodeBlock({
            compression,
            data: JSON.stringify(obj),
            type: RisuSaveType.ROOT,
            name: 'root'
        });
        this.blocks['preset'] = await this.encodeBlock({
            compression,
            data: JSON.stringify(data.botPresets),
            type: RisuSaveType.BOTPRESET,
            name: 'preset'
        });
        this.blocks['modules'] = await this.encodeBlock({
            compression,
            data: JSON.stringify(data.modules),
            type: RisuSaveType.MODULES,
            name: 'modules'
        });
        for( const character of data.characters) {
            this.blocks[character.chaId] = await this.encodeBlock({
                compression,
                data: JSON.stringify(character),
                type: RisuSaveType.CHARACTER_WITH_CHAT,
                name: character.chaId
            });
        }
        this.blocks['config'] = await this.encodeBlock({
            compression,
            data: JSON.stringify({
                version: 1
            }),
            type: RisuSaveType.CONFIG,
            name: "config"
        })
    }

    async set(data:Database, toSave:toSaveType){
        let obj:Record<any,any> = {}
        let keys = Object.keys(data)
        for(const key of keys){
            if(key !== 'characters' && key !== 'botPresets'){
                obj[key] = data[key]
            }
        }

        const savedId = new Set<string>();
        for(const character of data.characters) {
            const index = toSave.character.indexOf(character.chaId);
            if (index !== -1) {
                this.blocks[character.chaId] = await this.encodeBlock({
                    compression: this.compression,
                    data: JSON.stringify(character),
                    type: RisuSaveType.CHARACTER_WITH_CHAT,
                    name: character.chaId
                });
                savedId.add(character.chaId);
                toSave.character.splice(index, 1);
            }
            else if(!this.blocks[character.chaId]){
                this.blocks[character.chaId] = await this.encodeBlock({
                    compression: this.compression,
                    data: JSON.stringify(character),
                    type: RisuSaveType.CHARACTER_WITH_CHAT,
                    name: character.chaId
                });
                savedId.add(character.chaId);
            }
        }
        if(toSave.character.length > 0){
            console.log(`Deleting character data: ${toSave.character.join(', ')}`);
            //probably deleted characters
            for(const chaId of toSave.character){
                if(!savedId.has(chaId)){
                    delete this.blocks[chaId];
                }
            }
        }

        if(toSave.botPreset){
            this.blocks['preset'] = await this.encodeBlock({
                compression: this.compression,
                data: JSON.stringify(data.botPresets),
                type: RisuSaveType.BOTPRESET,
                name: 'preset'
            });
        }
        if(toSave.modules){
            this.blocks['modules'] = await this.encodeBlock({
                compression: this.compression,
                data: JSON.stringify(data.modules),
                type: RisuSaveType.MODULES,
                name: 'modules'
            });
        }

        obj["__directory"] = Object.keys(this.blocks).filter(key => key !== 'root');
        this.blocks['root'] = await this.encodeBlock({
            compression: this.compression,
            data: JSON.stringify(obj),
            type: RisuSaveType.ROOT,
            name: 'root'
        });
    }

    encode(arg:{
        compression?: boolean
    } = {}){
        if(!this.blocks['config']){
            return null
        }
        let totalLength = 0
        for(const key in this.blocks){
            totalLength += this.blocks[key].length;
        }
        totalLength += magicRisuSaveHeader.length;
        const arrayBuf = new ArrayBuffer(totalLength);
        const view = new Uint8Array(arrayBuf);
        let offset = 0;
        view.set(magicRisuSaveHeader, offset);
        offset += magicRisuSaveHeader.length;
        for(const key in this.blocks){
            view.set(this.blocks[key], offset);
            offset += this.blocks[key].length;
        }
        console.log(Object.keys(this.blocks).length, 'blocks encoded');
        return arrayBuf;
    }

    async encodeBlock(arg:EncodeBlockArg){
        let databuf: Uint8Array;
        const cacheBlock = arg.cache ?? true;
        if(arg.compression){
            await checkCompressionStreams();
            const cs = new CompressionStream('gzip');
            const writer = cs.writable.getWriter();
            writer.write(new TextEncoder().encode(arg.data));
            writer.close();
            const compressedData = await new Response(cs.readable).arrayBuffer();
            databuf = (new Uint8Array(compressedData));
        }
        else{
            databuf = (new TextEncoder().encode(arg.data));
        }
        const nameBuf = new TextEncoder().encode(arg.name);
        const lengthBuf = new ArrayBuffer(4);
        new Uint32Array(lengthBuf)[0] = databuf.length;
        const arrayBuf = new ArrayBuffer(2 + 1 + nameBuf.length + 4 + databuf.length);
        const buf = new Uint8Array(arrayBuf);
        buf.set(new Uint8Array([arg.type, arg.compression ? 1 : 0]), 0);
        buf.set(new Uint8Array([nameBuf.length]), 2);
        buf.set(nameBuf, 3);
        buf.set(new Uint8Array(lengthBuf), 3 + nameBuf.length);
        buf.set(databuf, 7 + nameBuf.length);
        await risuSaveCacheForage.setItem(`risuSaveBlock_${arg.name}`, {
            type: arg.type,
            data: arg.data,
            name: arg.name,
        });
        return buf;
    }

    async encodeRemoteBlock(arg:EncodeBlockArg){
        const encoded = new TextEncoder().encode(arg.data);
        const fileName = `remotes/${arg.name}.local.bin`
        if(isTauri){
            if(!(await exists('remotes'))){
                await mkdir('remotes', { recursive: true, baseDir: BaseDirectory.AppData });
            }
            await writeFile('remotes/' + fileName, encoded!, { baseDir: BaseDirectory.AppData });
        }
        else{
            await forageStorage.setItem(fileName, encoded);
        }
        return await this.encodeBlock({
            compression: false,
            data: JSON.stringify({
                v: 1,
                type: arg.type,
                name: arg.name,
            }),
            type: RisuSaveType.REMOTE,
            name: arg.name
        });
    }
}

export class RisuSaveDecoder {
    private blocks: {
        name: string;
        type: RisuSaveType;
        compression: boolean;
        content: string;
    }[] = []
    async decode(data: Uint8Array): Promise<Database> {
        console.log('Decoding RisuSave data');
        let offset = magicRisuSaveHeader.length;
        //@ts-expect-error Database has required fields, but we initialize empty and populate incrementally during decode
        let db:Database = {}
        const loadedBlocks = new Set<string>();
        while (offset < data.length) {
            try {
                const type = data[offset];
                const compression = data[offset + 1] === 1;
                offset += 2;

                const nameLength = data[offset];
                offset += 1;
                const name = new TextDecoder().decode(data.subarray(offset, offset + nameLength));
                offset += nameLength;

                const newArrayBuf = new ArrayBuffer(4);
                const lengthSubUint8Buf = data.slice(offset, offset + 4);
                new Uint8Array(newArrayBuf).set(lengthSubUint8Buf);
                const length = new Uint32Array(newArrayBuf)[0];
                offset += 4;

                let blockData = data.subarray(offset, offset + length);
                offset += length;

                if (compression) {
                    //decode using DecompressionStream
                    await checkCompressionStreams();
                    const cs = new DecompressionStream('gzip');
                    const writer = cs.writable.getWriter();
                    writer.write(blockData as any);
                    writer.close();
                    const buf = await new Response(cs.readable).arrayBuffer();
                    blockData = new Uint8Array(buf);
                }

                loadedBlocks.add(name);
                this.blocks.push({
                    name,
                    type,
                    compression,
                    content: new TextDecoder().decode(blockData)
                })   
            } catch (error) {
                continue
            }
        }
        console.log('blocks',this.blocks)
        let directory: string[] = []
        for(let i = 0; i < this.blocks.length; i++){
            const key = i;
            switch(this.blocks[key].type){
                case RisuSaveType.ROOT:{
                    const rootData = JSON.parse(this.blocks[key].content);
                    for(const rootKey in rootData){
                        if(!db[rootKey] && !rootKey.startsWith('__')){
                            db[rootKey] = rootData[rootKey];
                        }
                        if(rootKey === '__directory'){
                            directory = rootData[rootKey];
                            console.log('RisuSave directory:', directory);
                            for(const dirKey of directory){
                                if(!loadedBlocks.has(dirKey)){
                                    try {
                                        console.log(`Loading directory block ${dirKey} from cache`);
                                        const dirData:{
                                            type:RisuSaveType
                                            data:string
                                            name:string
                                        } = await risuSaveCacheForage.getItem(`risuSaveBlock_${dirKey}`) as any;

                                        if(dirData){
                                            this.blocks.push({
                                                name: dirData.name,
                                                type: dirData.type,
                                                compression: false,
                                                content: dirData.data
                                            });
                                            loadedBlocks.add(dirKey);
                                        }
                                    } catch (error) {
                                        console.error(`Error loading directory block ${dirKey}:`, error);
                                    }
                                }
                            }
                        }
                    }
                    break;
                }
                case RisuSaveType.CHARACTER_WITH_CHAT:{
                    db.characters ??= [];
                    const character = JSON.parse(this.blocks[key].content);
                    db.characters.push(character);
                    break
                }
                case RisuSaveType.BOTPRESET:{
                    db.botPresets = JSON.parse(this.blocks[key].content);
                    break;
                }
                case RisuSaveType.MODULES:{
                    db.modules = JSON.parse(this.blocks[key].content);
                    break;
                }
                case RisuSaveType.CONFIG:{
                    //ignore for now
                    break;
                }
                case RisuSaveType.REMOTE:{
                    const remoteInfo:{
                        v:number
                        type:RisuSaveType
                        name:string
                    } = JSON.parse(this.blocks[key].content);
                    const fileName = `remotes/${remoteInfo.name}.local.bin`
                    let remoteData:Uint8Array|null = null
                    if(isTauri){
                        try {
                            if(await exists('remotes/' + remoteInfo.name + '.local.bin')){
                                remoteData = await readFile('remotes/' + remoteInfo.name + '.local.bin', { baseDir: BaseDirectory.AppData });
                            }
                        } catch (error) {
                            console.error(`Error reading remote file ${fileName} in Tauri:`, error);
                        }
                    }
                    else{
                        const stored = await forageStorage.getItem(fileName);
                        if(stored){
                            remoteData = stored as Uint8Array;
                        }
                    }

                    if(!remoteData){
                        console.warn(`Remote file ${fileName} not found.`);
                        break;
                    }
                    const decoded = new TextDecoder().decode(remoteData)

                    //add to blocks for further processing
                    this.blocks.push({
                        name: remoteInfo.name,
                        type: remoteInfo.type,
                        compression: false,
                        content: decoded
                    });
                    break;
                }
                default:{
                    console.warn(`Not Implemented RisuSaveType: ${this.blocks[key].type} for ${this.blocks[key].name}`);
                }
            }
        }
        //to fix botpreset bugs
        if(!Array.isArray(db.botPresets) || db.botPresets.length === 0){
            db.botPresets = [presetTemplate]
            db.botPresetsId = 0
        }
        console.log('Decoded RisuSave data', db);
        return db;
    }
}

export async function decodeRisuSave(data:Uint8Array){
    try {
        const header = checkHeader(data)
        switch(header){
            case "compressed":
                data = data.slice(magicCompressedHeader.length)
                return decode(fflate.decompressSync(data))
            case "raw":
                data = data.slice(magicHeader.length)
                return unpackr.decode(data)
            case "stream":{
                await checkCompressionStreams()
                data = data.slice(magicStreamCompressedHeader.length)
                const cs = new DecompressionStream('gzip');
                const writer = cs.writable.getWriter();
                writer.write(data as any);
                writer.close();
                const buf = await new Response(cs.readable).arrayBuffer()
                return unpackr.decode(new Uint8Array(buf))
            }
            case "risusave":{
                const decoder = new RisuSaveDecoder();
                return await decoder.decode(data);
            }
        }
        return unpackr.decode(data)
    }
    catch (error) {
        console.error('Error decoding RisuSave data:', error);
        try {
            console.log('risudecode')
            const risuSaveHeader = new Uint8Array(Buffer.from("\u0000\u0000RISU",'utf-8'))
            const realData = data.subarray(risuSaveHeader.length)
            const dec = unpackr.decode(realData)
            return dec   
        } catch (error) {
            const buf = Buffer.from(fflate.decompressSync(Buffer.from(data)))
            try {
                return JSON.parse(buf.toString('utf-8'))                            
            } catch (error) {
                return unpackr.decode(buf)
            }
        }
    }
}

function checkHeader(data: Uint8Array) {

    let header:'none'|'compressed'|'raw'|'stream'|'risusave' = 'raw'

    if (data.length < magicHeader.length) {
      return false;
    }
  
    for (let i = 0; i < magicHeader.length; i++) {
      if (data[i] !== magicHeader[i]) {
        header = 'none'
        break
      }
    }

    if(header === 'none'){
        header = 'compressed'
        for (let i = 0; i < magicCompressedHeader.length; i++) {
            if (data[i] !== magicCompressedHeader[i]) {
                header = 'none'
                break
            }
        }
    }

    if(header === 'none'){
        header = 'stream'
        for (let i = 0; i < magicStreamCompressedHeader.length; i++) {
            if (data[i] !== magicStreamCompressedHeader[i]) {
                header = 'none'
                break
            }
        }
    }

    if(header === 'none'){
        header = 'risusave'
        for (let i = 0; i < magicRisuSaveHeader.length; i++) {
            if (data[i] !== magicRisuSaveHeader[i]) {
                header = 'none'
                break
            }
        }
    }

    // All bytes matched
    return header;
  }

export interface RecoveryResult {
    success: boolean
    partialData: Partial<Database> | null
    recoveredItems: string[]
    failedItems: string[]
    errorMessages: string[]
}

/**
 * Attempts to recover as much data as possible from a corrupted save file.
 * This function tries multiple decoding strategies and extracts whatever is readable.
 */
export async function tryRecoverRisuSave(data: Uint8Array): Promise<RecoveryResult> {
    const result: RecoveryResult = {
        success: false,
        partialData: null,
        recoveredItems: [],
        failedItems: [],
        errorMessages: []
    }

    // Try each format in order
    const header = checkHeader(data)
    
    // Strategy 1: Try RisuSave format with partial block recovery
    if (header === 'risusave') {
        const blockResult = await tryRecoverRisuSaveBlocks(data)
        if (blockResult.partialData && Object.keys(blockResult.partialData).length > 0) {
            return blockResult
        }
    }

    // Strategy 2: Try compressed format
    if (header === 'compressed') {
        try {
            const decompressed = fflate.decompressSync(data.slice(magicCompressedHeader.length))
            const decoded = decode(decompressed)
            if (decoded && typeof decoded === 'object') {
                result.success = true
                result.partialData = decoded as Partial<Database>
                result.recoveredItems.push('Full database (compressed format)')
                return result
            }
        } catch (e) {
            result.errorMessages.push(`Compressed format recovery failed: ${e}`)
        }
    }

    // Strategy 3: Try stream compressed format
    if (header === 'stream') {
        try {
            await checkCompressionStreams()
            const slicedData = data.slice(magicStreamCompressedHeader.length)
            const cs = new DecompressionStream('gzip')
            const writer = cs.writable.getWriter()
            writer.write(slicedData as any)
            writer.close()
            const buf = await new Response(cs.readable).arrayBuffer()
            const decoded = unpackr.decode(new Uint8Array(buf))
            if (decoded && typeof decoded === 'object') {
                result.success = true
                result.partialData = decoded as Partial<Database>
                result.recoveredItems.push('Full database (stream compressed format)')
                return result
            }
        } catch (e) {
            result.errorMessages.push(`Stream compressed format recovery failed: ${e}`)
        }
    }

    // Strategy 4: Try raw msgpack format
    if (header === 'raw') {
        try {
            const decoded = unpackr.decode(data.slice(magicHeader.length))
            if (decoded && typeof decoded === 'object') {
                result.success = true
                result.partialData = decoded as Partial<Database>
                result.recoveredItems.push('Full database (raw format)')
                return result
            }
        } catch (e) {
            result.errorMessages.push(`Raw format recovery failed: ${e}`)
        }
    }

    // Strategy 5: Try legacy formats without header
    try {
        const risuSaveHeader = new Uint8Array(Buffer.from("\u0000\u0000RISU", 'utf-8'))
        const realData = data.subarray(risuSaveHeader.length)
        const decoded = unpackr.decode(realData)
        if (decoded && typeof decoded === 'object') {
            result.success = true
            result.partialData = decoded as Partial<Database>
            result.recoveredItems.push('Full database (legacy format)')
            return result
        }
    } catch (e) {
        result.errorMessages.push(`Legacy format recovery failed: ${e}`)
    }

    // Strategy 6: Try raw decompression + JSON
    try {
        const buf = Buffer.from(fflate.decompressSync(Buffer.from(data)))
        try {
            const parsed = JSON.parse(buf.toString('utf-8'))
            if (parsed && typeof parsed === 'object') {
                result.success = true
                result.partialData = parsed as Partial<Database>
                result.recoveredItems.push('Full database (JSON format)')
                return result
            }
        } catch {
            const decoded = unpackr.decode(buf)
            if (decoded && typeof decoded === 'object') {
                result.success = true
                result.partialData = decoded as Partial<Database>
                result.recoveredItems.push('Full database (raw msgpack)')
                return result
            }
        }
    } catch (e) {
        result.errorMessages.push(`Raw decompression recovery failed: ${e}`)
    }

    return result
}

/**
 * Attempts to recover individual blocks from a RisuSave format file.
 * Even if some blocks are corrupted, this will try to extract the valid ones.
 */
async function tryRecoverRisuSaveBlocks(data: Uint8Array): Promise<RecoveryResult> {
    const result: RecoveryResult = {
        success: false,
        partialData: {},
        recoveredItems: [],
        failedItems: [],
        errorMessages: []
    }

    let offset = magicRisuSaveHeader.length
    const db: Partial<Database> = {}
    db.characters = []

    while (offset < data.length) {
        const blockStartOffset = offset
        try {
            // Read block header
            if (offset + 7 > data.length) {
                result.errorMessages.push(`Incomplete block header at offset ${offset}`)
                break
            }

            const type = data[offset]
            const compression = data[offset + 1] === 1
            offset += 2

            const nameLength = data[offset]
            offset += 1

            if (offset + nameLength > data.length) {
                result.errorMessages.push(`Incomplete block name at offset ${blockStartOffset}`)
                break
            }

            const name = new TextDecoder().decode(data.subarray(offset, offset + nameLength))
            offset += nameLength

            if (offset + 4 > data.length) {
                result.errorMessages.push(`Incomplete block length at offset ${blockStartOffset}`)
                break
            }

            const newArrayBuf = new ArrayBuffer(4)
            const lengthSubUint8Buf = data.slice(offset, offset + 4)
            new Uint8Array(newArrayBuf).set(lengthSubUint8Buf)
            const length = new Uint32Array(newArrayBuf)[0]
            offset += 4

            if (offset + length > data.length) {
                result.errorMessages.push(`Block data truncated for "${name}" at offset ${blockStartOffset}`)
                result.failedItems.push(`Block: ${name} (truncated)`)
                break
            }

            let blockData = data.subarray(offset, offset + length)
            offset += length

            // Try to decompress if needed
            if (compression) {
                try {
                    await checkCompressionStreams()
                    const cs = new DecompressionStream('gzip')
                    const writer = cs.writable.getWriter()
                    writer.write(blockData as any)
                    writer.close()
                    const buf = await new Response(cs.readable).arrayBuffer()
                    blockData = new Uint8Array(buf)
                } catch (e) {
                    result.errorMessages.push(`Failed to decompress block "${name}": ${e}`)
                    result.failedItems.push(`Block: ${name} (decompression failed)`)
                    continue
                }
            }

            // Try to parse the block content
            const content = new TextDecoder().decode(blockData)
            let parsed: any

            try {
                parsed = JSON.parse(content)
            } catch (e) {
                result.errorMessages.push(`Failed to parse block "${name}": ${e}`)
                result.failedItems.push(`Block: ${name} (JSON parse failed)`)
                continue
            }

            // Process based on block type
            switch (type) {
                case 1: // ROOT
                    for (const key in parsed) {
                        if (!key.startsWith('__')) {
                            (db as any)[key] = parsed[key]
                        }
                    }
                    result.recoveredItems.push('Settings & Configuration (ROOT)')
                    break
                case 2: // CHARACTER_WITH_CHAT
                    db.characters!.push(parsed)
                    result.recoveredItems.push(`Character: ${parsed.name || name}`)
                    break
                case 4: // BOTPRESET
                    db.botPresets = parsed
                    result.recoveredItems.push('Bot Presets')
                    break
                case 5: // MODULES
                    db.modules = parsed
                    result.recoveredItems.push('Modules')
                    break
                case 0: // CONFIG
                    result.recoveredItems.push('Config block')
                    break
                default:
                    result.recoveredItems.push(`Unknown block type ${type}: ${name}`)
            }
        } catch (e) {
            result.errorMessages.push(`Error processing block at offset ${blockStartOffset}: ${e}`)
            // Try to skip to next potential block by scanning for patterns
            // This is a last resort recovery attempt
            offset = blockStartOffset + 1
            let found = false
            while (offset < data.length - 7) {
                // Look for valid block type (0-6) followed by compression flag (0 or 1)
                if (data[offset] <= 6 && (data[offset + 1] === 0 || data[offset + 1] === 1)) {
                    const possibleNameLen = data[offset + 2]
                    if (possibleNameLen > 0 && possibleNameLen < 100) {
                        found = true
                        break
                    }
                }
                offset++
            }
            if (!found) {
                break
            }
        }
    }

    // Set success if we recovered anything meaningful
    if (result.recoveredItems.length > 0) {
        result.success = true
        result.partialData = db

        // Ensure botPresets has default if missing
        if (!db.botPresets || !Array.isArray(db.botPresets) || db.botPresets.length === 0) {
            db.botPresets = [presetTemplate]
            result.recoveredItems.push('Bot Presets (default)')
        }
    }

    return result
}