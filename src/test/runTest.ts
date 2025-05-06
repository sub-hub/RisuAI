

export function declareTest() {
    if(import.meta.env.DEV){
        globalThis.test = async () => {
            console.log("test");
        }
    }
}
