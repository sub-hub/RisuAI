import { getDatabase } from "../storage/database.svelte"

export async function openRouterModels() {
    try {
        const db = getDatabase()
        let headers = {
            "Authorization": "Bearer " + db.openrouterKey,
            "Content-Type": "application/json"
        }

        const aim = fetch("https://openrouter.ai/api/v1/models", {
            headers: headers
        })  
        const res = await (await aim).json()
        return res.data.map((model: any) => {
            let name = model.name
            let price = ((Number(model.pricing.prompt) * 3) + Number(model.pricing.completion)) / 4
            console.log(model.pricing, price)
            if(price > 0){
                name += ` - $${(price*1000).toFixed(5)}/1k`
            }
            else{
                name += " - Free"
            }
            return {
                id: model.id,
                name: name,
                price: price,
                context_length: model.context_length,
            }
        }).sort((a: any, b: any) => {
            return a.price - b.price
        }).filter((model: any) => {
            return model.price >= 0
        })
    } catch (error) {
        return []
    }
}

export async function getFreeOpenRouterModel(){
    const models = await openRouterModels()
    return models.filter((model: any) => {
        return model.name.endsWith("Free")
    }).sort((a: any, b: any) => {
        return b.context_length - a.context_length
    })[0].id ?? ''
}