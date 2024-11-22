import type { OpenAIChat } from "./index.svelte";
import { getDatabase } from "../storage/database.svelte";
import { getUserName } from "../util";

export function multiChatReplacer(){

}

export function stringlizeChat(formated:OpenAIChat[], char:string, continued:boolean){
    let resultString:string[] = []
    for(const form of formated){
        if(form.memo?.startsWith('inlayImage')){
            continue
        }
        if(form.role === 'system'){
            resultString.push("system: " + form.content)
        }
        else if(form.name){
            resultString.push(form.name + ": " + form.content)
        }
        else{
            resultString.push(form.content)
        }
    }
    let res = resultString.join('\n\n')

    if(!continued){
        res += `\n\n${char}:`
    }
    return res
}

function appendWhitespace(prefix:string, seperator:string=" ") {
    if(!prefix){
        return ""
    }
    if(prefix && !"> \n".includes(prefix[prefix.length-1])){
        prefix += seperator.includes("\n\n") ? "\n" : " "
    }
    return prefix
}
export function stringlizeChatOba(formated:OpenAIChat[], characterName:string, suggesting:boolean, continued:boolean){
    const db = getDatabase()
    let resultString:string[] = []
    let { systemPrefix, userPrefix, assistantPrefix, seperator } = db.ooba.formating;
    systemPrefix = systemPrefix ?? ""
    userPrefix = userPrefix ?? ""
    assistantPrefix = assistantPrefix ?? ""
    seperator = seperator ?? "\n"

    for(const form of formated){
        if(form.content === "[Start a new chat]"){
            resultString.push("<START>")
            continue
        }
        let prefix = ""
        let name = form.name
        if(form.role === 'user'){
            prefix = appendWhitespace(suggesting ? assistantPrefix : userPrefix, seperator)
            name ??= `${getUserName()}`
            name += ': '
        }
        else if(form.role === 'assistant'){
            prefix = appendWhitespace(suggesting ? userPrefix : assistantPrefix, seperator)
            name ??= `${characterName}`
            name += ': '
        }
        else if(form.role === 'system'){
            prefix = appendWhitespace(systemPrefix, seperator)
            name = ""
        }
        if(db.ooba.formating.useName){
            console.log(name)
            resultString.push(prefix + name + form.content)
        }
        else{
            resultString.push(prefix + form.content)
        }
    }
    if(!continued){
        if(db.ooba.formating.useName){
            if (suggesting){
                resultString.push(appendWhitespace(assistantPrefix, seperator) + `${getUserName()}:\n` + db.autoSuggestPrefix)
            } else {
                resultString.push(assistantPrefix + `${characterName}:`)
            }
        }
        else{
            if (suggesting){
                resultString.push(appendWhitespace(assistantPrefix, seperator) + `\n` + db.autoSuggestPrefix)
            } else {
                resultString.push(assistantPrefix)
            }
        }
    }
    console.log(resultString)
    return resultString.join(seperator).trim()
}

const userStrings = ["user", "human", "input", "inst", "instruction"]
function toTitleCase(s:string){
    return s[0].toUpperCase() + s.slice(1).toLowerCase()
}
export function getStopStrings(suggesting:boolean=false){
    const db = getDatabase()
    let { userPrefix, seperator } = db.ooba.formating;
    if(!seperator){
        seperator = "\n"
    }
    const { username } = db
    const stopStrings = [
        "GPT4 User",
        "</s>",
        "<|end",
        "<|im_end",
        userPrefix,
        `${username}:`,
    ]
    if(suggesting){
        stopStrings.push("\n\n")
    }
    for (const user of userStrings){
        for (const u of [
            user.toLowerCase(),
            user.toUpperCase(),
            user.replace(/\w\S*/g, toTitleCase),
        ]){
            stopStrings.push(`${u}:`)
            stopStrings.push(`<<${u}>>`)
            stopStrings.push(`### ${u}`)
        }
    }
    return [...new Set(stopStrings)]
}

export function unstringlizeChat(text:string, formated:OpenAIChat[], char:string = ''){
    let minIndex = -1

    const chunks = getUnstringlizerChunks(formated, char).chunks


    for(const chunk of chunks){
        const ind = text.indexOf(chunk)
        if(ind === -1){
            continue
        }
        if(minIndex === -1 || minIndex > ind){
            minIndex = ind
        }
    }

    if(minIndex !== -1){
        text = text.substring(0, minIndex).trim()
    }

    return text
}

export function getUnstringlizerChunks(formated:OpenAIChat[], char:string, mode:'ain'|'normal' = 'normal'){
    let chunks:string[] = ["system note:", "system:","system note：", "system："]
    let charNames:string[] = []
    const db = getDatabase()
    if(char){
        charNames.push(char)
        if(mode === 'ain'){
            chunks.push(`${char} `)
            chunks.push(`${char}　`)
        }
        else{
            chunks.push(`${char}:`)
            chunks.push(`${char}：`)
            chunks.push(`${char}: `)
            chunks.push(`${char}： `) 
        }
    }
    if(getUserName()){
        charNames.push(getUserName())
        if(mode === 'ain'){
            chunks.push(`${getUserName()} `)
            chunks.push(`${getUserName()}　`)
        }
        else{
            chunks.push(`${getUserName()}:`)
            chunks.push(`${getUserName()}：`)
            chunks.push(`${getUserName()}: `)
            chunks.push(`${getUserName()}： `) 
        }
    }

    for(const form of formated){
        if(form.name){
            charNames.push(form.name)
            if(mode === 'ain'){
                if(!chunks.includes(`${form.name} `)){
                    chunks.push(`${form.name} `)
                    chunks.push(`${form.name}　`)
                }
            }
            else{
                if(!chunks.includes(`${form.name}:`)){
                    chunks.push(`${form.name}:`)
                    chunks.push(`${form.name}：`)
                    chunks.push(`${form.name}: `)
                    chunks.push(`${form.name}： `) 
                }
            }
        }
    }
    return {chunks,extChunk:charNames.concat(chunks)}
}

export function stringlizeAINChat(formated:OpenAIChat[], char:string, continued: boolean){
    let resultString:string[] = []
    const db = getDatabase()

    for(const form of formated){
        console.log(form)
        if(form.memo && form.memo.startsWith("newChat") || form.content === "[Start a new chat]"){
            resultString.push("[新しいチャットの始まり]")
            continue
        }
        if(form.role === 'system'){
            resultString.push(form.content)
        }
        else if(form.role === 'user'){
            resultString.push(...formatToAIN(getUserName(), form.content))
        }
        else if(form.name || form.role === 'assistant'){
            resultString.push(...formatToAIN(form.name ?? char, form.content))
        }
        else{
            resultString.push(form.content)
        }
    }
    let res = resultString.join('\n\n')
    if(!continued){
        res +=  + `\n\n${char} 「`
    }
    else{
        res += " 「"
    }
    return res
}

function extractAINOutputStrings(inputString:string, characters:string[]) {
    let results:{
        content:string
        character:string
    }[] = [];
    
    let remainingString = inputString;
    
    while (remainingString.length > 0) {
        let characterIndex = -1;
        let character = null;
        for (let i = 0; i < characters.length; i++) {
        const index = remainingString.indexOf(characters[i] + '「');
        if (index >= 0 && (characterIndex == -1 || index < characterIndex)) {
            character = characters[i];
            characterIndex = index;
        }
        }
    
        if (characterIndex > 0) {
        results.push({content: remainingString.substring(0, characterIndex).trim(), character: '[narrator]'});
        }
    
        if (characterIndex == -1) {
            results.push({content: remainingString.trim(),  character: '[narrator]'});
            break;
        } else {
            let endQuoteIndex = remainingString.indexOf('」', characterIndex + character.length);
            if (endQuoteIndex == -1) {
                results.push({
                character, 
                content: remainingString.substring(characterIndex + character.length + 1).trim() // plus 1 to exclude 「
                });
                break;
            } else {
                results.push({
                character, 
                content: remainingString.substring(characterIndex + character.length + 1, endQuoteIndex).trim() // plus 1 to exclude 「
                });
                remainingString = remainingString.substring(endQuoteIndex + 1);
            }
        }
    }

    return results;
}

export function unstringlizeAIN(data:string,formated:OpenAIChat[], char:string = ''){

    const db = getDatabase()
    const chunksResult = getUnstringlizerChunks(formated, char ,'ain')
    const chunks = chunksResult.chunks
    let result:['char'|'user',string][] = []
    data = `${char} 「` + data

    for(const n of chunksResult.extChunk){
        if(data.endsWith(n)){
            data = data.substring(0, data.length - n.length)
            console.log('trimed')
        }
    }

    const contents = extractAINOutputStrings(data, chunks)
    for(const cont of contents){
        if(cont.character === '[narrator]'){
            if(result.length === 0){
                result[0] = ['char', cont.content]
            }
            else{
                result[result.length - 1][1] += "\n" + cont.content
            }
        }
        else{
            const role = (cont.character.trim() ===  getUserName() ? 'user' : 'char')
            result.push([
                role,
                `「${cont.content}」`
            ])
        }
    }

    return result
}


function formatToAIN(name:string, content:string){
    function extractContent(str:string) {
        let result:{
            type: "outside"|"inside"
           content:string
        }[] = [];
        let lastEndIndex = 0;
        let regex = /「(.*?)」/g;
        let match:RegExpExecArray | null = null;

        
    
        while ((match = regex.exec(str)) !== null) {
            let start = match.index;
            let end = start + match[0].length;
            let inside = match[1];
            
            if (start != lastEndIndex) {
                let outside = str.slice(lastEndIndex, start);
                result.push({
                    type: "outside",
                    content: outside
                });
            }
    
            result.push({
                type: "inside",
                content: inside
            });
            
            lastEndIndex = end;
        }
    
        if (lastEndIndex < str.length) {
            let outside = str.slice(lastEndIndex);
            result.push({
                type: "outside",
                content: outside
            });
        }
        
        return result;
    }

    let quoteCounter = 0;
    content = content.replace(/"/g, () => {
        quoteCounter++;
        if (quoteCounter % 2 !== 0) {
            return '「';
        } else {
            return '」';
        }
    });

    const conts = extractContent(content)
    let strs:string[] = []
    for(const cont of conts){
        if(cont.type === 'inside'){
            strs.push(`${name} 「${cont.content}」`)
        }
        else{
            strs.push(cont.content)
        }
    }
    return strs
}
