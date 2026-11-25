/**
 * Image Generation Settings Data
 *
 * Data-driven definition for the Image Generation tab of OtherBotSettings.
 */

import type { SettingContext, SettingItem } from './types';
import { isTauri } from '../platform';

/** Provider names in the order of the provider select; also used as the sidebar group */
const PROVIDER_NAMES = {
    webui: 'Stable Diffusion WebUI',
    novelai: 'Novel AI',
    dalle: 'Dall-E',
    stability: 'Stability API',
    fal: 'Fal.ai',
    comfyui: 'ComfyUI',
    Imagen: 'Imagen',
    'openai-compat': 'OpenAI Compatible',
    wavespeed: 'WaveSpeedAI',
    comfy: 'ComfyUI (Legacy)',
};
type ProviderId = keyof typeof PROVIDER_NAMES;

const provider = (name: ProviderId) => (ctx: SettingContext) => ctx.db.sdProvider === name;
const naiModelIn = (...models: string[]) => (ctx: SettingContext) => models.includes(ctx.db.NAIImgModel);
const naiV4 = naiModelIn('nai-diffusion-4-full', 'nai-diffusion-4-curated-preview', 'nai-diffusion-4-5-full', 'nai-diffusion-4-5-curated');
const naiV45 = naiModelIn('nai-diffusion-4-5-full', 'nai-diffusion-4-5-curated');
const notDdim = (ctx: SettingContext) => ctx.db.NAIImgConfig.sampler !== 'ddim_v3';

/** Shows the items only for the given provider, on top of their own condition, and names the provider in the sidebar */
function forProvider(name: ProviderId, items: SettingItem[]): SettingItem[] {
    const isProvider = provider(name);
    return items.map((item) => {
        const own = item.condition;
        return {
            ...item,
            condition: own ? (ctx) => isProvider(ctx) && own(ctx) : isProvider,
            group: PROVIDER_NAMES[name],
        };
    });
}

const webuiItems = forProvider('webui', [
    { id: 'imageGen.webui.apiWarning', type: 'header', fallbackLabel: 'You must use WebUI with --api flag', options: { level: 'warning' } },
    {
        id: 'imageGen.webui.licenseWarning', type: 'header', options: { level: 'warning' },
        fallbackLabel: 'You must use WebUI without agpl license or use unmodified version with agpl license to observe the contents of the agpl license.',
    },
    {
        id: 'imageGen.webui.webWarning', type: 'header', options: { level: 'warning' },
        fallbackLabel: 'You are using web version. you must use ngrok or other tunnels to use your local webui.',
        condition: () => !isTauri,
    },
    {
        id: 'imageGen.webui.url', type: 'text', labelPrefix: 'WebUI', labelKey: 'providerURL', bindKey: 'webUiUrl', classes: 'mt-2',
        options: { placeholder: 'https://...' }, keywords: ['webui', 'url'],
    },
    { id: 'imageGen.webui.steps', type: 'number', fallbackLabel: 'Steps', bindKey: 'sdSteps', options: { min: 0, max: 100 }, keywords: ['webui', 'steps'] },
    { id: 'imageGen.webui.cfg', type: 'number', fallbackLabel: 'CFG Scale', bindKey: 'sdCFG', options: { min: 0, max: 20 }, keywords: ['webui', 'cfg'] },
    {
        id: 'imageGen.webui.width', type: 'number', fallbackLabel: 'Width', bindPath: 'sdConfig.width', options: { min: 0, max: 2048 },
        keywords: ['webui', 'width'],
    },
    {
        id: 'imageGen.webui.height', type: 'number', fallbackLabel: 'Height', bindPath: 'sdConfig.height', options: { min: 0, max: 2048 },
        keywords: ['webui', 'height'],
    },
    { id: 'imageGen.webui.sampler', type: 'text', fallbackLabel: 'Sampler', bindPath: 'sdConfig.sampler_name', keywords: ['webui', 'sampler'] },
    { id: 'imageGen.webui.hires', type: 'check', fallbackLabel: 'Enable Hires', bindPath: 'sdConfig.enable_hr', keywords: ['webui', 'hires'] },
    {
        id: 'imageGen.webui.denoising', type: 'number', fallbackLabel: 'denoising_strength', bindPath: 'sdConfig.denoising_strength',
        condition: (ctx) => ctx.db.sdConfig.enable_hr === true, options: { min: 0, max: 10 }, keywords: ['webui', 'hires', 'denoising'],
    },
    {
        id: 'imageGen.webui.hrScale', type: 'number', fallbackLabel: 'hr_scale', bindPath: 'sdConfig.hr_scale',
        condition: (ctx) => ctx.db.sdConfig.enable_hr === true, options: { min: 0, max: 10 }, keywords: ['webui', 'hires', 'scale'],
    },
    {
        id: 'imageGen.webui.upscaler', type: 'text', fallbackLabel: 'Upscaler', bindPath: 'sdConfig.hr_upscaler',
        condition: (ctx) => ctx.db.sdConfig.enable_hr === true, keywords: ['webui', 'hires', 'upscaler'],
    },
]);

const naiItems = forProvider('novelai', [
    {
        id: 'imageGen.nai.url', type: 'text', labelPrefix: 'Novel AI', labelKey: 'providerURL', bindKey: 'NAIImgUrl', classes: 'mt-2',
        options: { placeholder: 'https://image.novelai.net' }, keywords: ['novelai', 'nai', 'url'],
    },
    {
        id: 'imageGen.nai.key', type: 'text', fallbackLabel: 'API Key', bindKey: 'NAIApiKey', options: { placeholder: 'pst-...' },
        keywords: ['novelai', 'nai', 'api', 'key'],
    },
    {
        id: 'imageGen.nai.model', type: 'select', fallbackLabel: 'Model', bindKey: 'NAIImgModel', classes: '',
        options: {
            inputClassName: 'mb-4',
            keepUnlistedValue: true,
            selectOptions: [
                'nai-diffusion-5-full',
                'nai-diffusion-5-full-medium',
                'nai-diffusion-5-curated',
                'nai-diffusion-4-5-full',
                'nai-diffusion-4-5-curated',
                'nai-diffusion-4-full',
                'nai-diffusion-4-curated-preview',
                'nai-diffusion-3',
                'nai-diffusion-furry-3',
            ].map((value) => ({ value, label: value })),
        },
        keywords: ['novelai', 'nai', 'model'],
    },
    {
        id: 'imageGen.nai.width', type: 'number', fallbackLabel: 'Width', bindPath: 'NAIImgConfig.width', options: { min: 0, max: 2048 },
        keywords: ['novelai', 'nai', 'width'],
    },
    {
        id: 'imageGen.nai.height', type: 'number', fallbackLabel: 'Height', bindPath: 'NAIImgConfig.height', options: { min: 0, max: 2048 },
        keywords: ['novelai', 'nai', 'height'],
    },
    {
        // V4 models and the others list different samplers, in different orders,
        // so DPM++ SDE appears twice with opposite conditions to keep each order.
        id: 'imageGen.nai.sampler', type: 'select', fallbackLabel: 'Sampler', bindPath: 'NAIImgConfig.sampler', classes: '',
        options: {
            inputClassName: 'mb-4',
            keepUnlistedValue: true,
            selectOptions: [
                { value: 'k_euler_ancestral', label: 'Euler Ancestral' },
                { value: 'k_dpmpp_2s_ancestral', label: 'DPM++ 2S Ancestral' },
                { value: 'k_dpmpp_2m_sde', label: 'DPM++ 2M SDE', condition: naiV4 },
                { value: 'k_dpmpp_sde', label: 'DPM++ SDE', condition: (ctx) => !naiV4(ctx) },
                { value: 'k_euler', label: 'Euler' },
                { value: 'k_dpmpp_2m', label: 'DPM++ 2M' },
                { value: 'k_dpmpp_sde', label: 'DPM++ SDE', condition: naiV4 },
                { value: 'k_dpmpp_2s', label: 'DPM++ 2S', condition: (ctx) => !naiV4(ctx) },
                { value: 'ddim_v3', label: 'DDIM', condition: (ctx) => !naiV4(ctx) },
            ],
        },
        keywords: ['novelai', 'nai', 'sampler'],
    },
    {
        id: 'imageGen.nai.noiseSchedule', type: 'select', fallbackLabel: 'Noise Schedule', bindPath: 'NAIImgConfig.noise_schedule',
        classes: '',
        options: {
            inputClassName: 'mb-4',
            keepUnlistedValue: true,
            selectOptions: ['native', 'karras', 'exponential', 'polyexponential'].map((value) => ({ value, label: value })),
        },
        keywords: ['novelai', 'nai', 'noise', 'schedule'],
    },
    {
        id: 'imageGen.nai.steps', type: 'number', fallbackLabel: 'steps', bindPath: 'NAIImgConfig.steps', options: { min: 0, max: 2048 },
        keywords: ['novelai', 'nai', 'steps'],
    },
    {
        id: 'imageGen.nai.scale', type: 'number', fallbackLabel: 'CFG scale', bindPath: 'NAIImgConfig.scale',
        options: { min: 0, max: 2048 }, keywords: ['novelai', 'nai', 'cfg', 'scale'],
    },
    {
        id: 'imageGen.nai.cfgRescale', type: 'number', fallbackLabel: 'CFG rescale', bindPath: 'NAIImgConfig.cfg_rescale',
        options: { min: 0, max: 1 }, keywords: ['novelai', 'nai', 'cfg', 'rescale'],
    },
    {
        id: 'imageGen.nai.referenceMode', type: 'select', fallbackLabel: 'Image Reference', bindPath: 'NAIImgConfig.reference_mode', classes: '',
        options: {
            inputClassName: 'mb-4',
            keepUnlistedValue: true,
            selectOptions: [
                { value: '', label: 'None' },
                { value: 'vibe', label: 'Vibe Transfer' },
                { value: 'character', label: 'Character Reference', condition: naiV45 },
            ],
        },
        keywords: ['novelai', 'nai', 'reference', 'vibe', 'character'],
    },
    {
        id: 'imageGen.nai.vibe', type: 'custom', fallbackLabel: 'Vibe Transfer', componentId: 'NAIVibeTransfer',
        condition: (ctx) => ctx.db.NAIImgConfig.reference_mode === 'vibe',
        keywords: ['novelai', 'nai', 'vibe'],
    },
    {
        id: 'imageGen.nai.characterImage', type: 'custom', fallbackLabel: 'Character Reference Image', componentId: 'AssetImageUpload',
        componentProps: {
            config: 'NAIImgConfig', imageKey: 'character_image', base64Key: 'character_base64image',
            note: "Leave blank to use the character's default image.", noteClass: 'mb-2',
        },
        condition: (ctx) => ctx.db.NAIImgConfig.reference_mode === 'character' && naiV45(ctx),
        keywords: ['novelai', 'nai', 'character', 'reference', 'image'],
    },
    {
        id: 'imageGen.nai.styleAware', type: 'check', fallbackLabel: 'Style Aware', bindPath: 'NAIImgConfig.style_aware', classes: 'mb-4',
        condition: (ctx) => ctx.db.NAIImgConfig.reference_mode === 'character' && naiV45(ctx),
        keywords: ['novelai', 'nai', 'style', 'aware'],
    },
    {
        id: 'imageGen.nai.smea', type: 'check', fallbackLabel: 'Use SMEA', bindPath: 'NAIImgConfig.sm', classes: '',
        condition: (ctx) => naiModelIn('nai-diffusion-3', 'nai-diffusion-furry-3', 'nai-diffusion-2')(ctx) && notDdim(ctx),
        keywords: ['novelai', 'nai', 'smea'],
    },
    {
        id: 'imageGen.nai.dyn', type: 'check', fallbackLabel: 'Use DYN', bindPath: 'NAIImgConfig.sm_dyn', classes: '',
        condition: (ctx) => naiModelIn('nai-diffusion-3')(ctx) && notDdim(ctx),
        keywords: ['novelai', 'nai', 'dyn', 'smea'],
    },
    {
        id: 'imageGen.nai.varietyPlus', type: 'check', fallbackLabel: 'Variety+', bindPath: 'NAIImgConfig.variety_plus', classes: '',
        condition: naiModelIn(
            'nai-diffusion-4-5-full', 'nai-diffusion-4-5-curated', 'nai-diffusion-4-full',
            'nai-diffusion-4-curated-preview', 'nai-diffusion-3', 'nai-diffusion-furry-3',
        ),
        keywords: ['novelai', 'nai', 'variety'],
    },
    {
        id: 'imageGen.nai.decrisp', type: 'check', fallbackLabel: 'Decrisp', bindPath: 'NAIImgConfig.decrisp', classes: '',
        condition: naiModelIn('nai-diffusion-3', 'nai-diffusion-furry-3', 'nai-diffusion-2'),
        keywords: ['novelai', 'nai', 'decrisp'],
    },
    {
        id: 'imageGen.nai.legacyUc', type: 'check', fallbackLabel: 'Use legacy uc', bindPath: 'NAIImgConfig.legacy_uc', classes: '',
        condition: naiModelIn('nai-diffusion-4-full', 'nai-diffusion-4-curated-preview'),
        keywords: ['novelai', 'nai', 'legacy', 'uc'],
    },
    {
        id: 'imageGen.nai.i2i', type: 'check', fallbackLabel: 'Enable I2I', bindKey: 'NAII2I', classes: 'mt-4 mb-4',
        keywords: ['novelai', 'nai', 'i2i', 'image'],
    },
    {
        id: 'imageGen.nai.i2iImage', type: 'custom', fallbackLabel: 'I2I Image', componentId: 'AssetImageUpload',
        componentProps: {
            config: 'NAIImgConfig', imageKey: 'image', base64Key: 'base64image',
            note: "Leave blank to use the character's default image.",
        },
        condition: (ctx) => ctx.db.NAII2I,
        keywords: ['novelai', 'nai', 'i2i', 'image'],
    },
    {
        id: 'imageGen.nai.i2iStrength', type: 'slider', fallbackLabel: 'Strength', bindPath: 'NAIImgConfig.strength', classes: 'mt-2',
        condition: (ctx) => ctx.db.NAII2I, options: { min: 0, max: 0.99, step: 0.01, fixed: 2, marginBottom: false },
        keywords: ['novelai', 'nai', 'i2i', 'strength'],
    },
    {
        id: 'imageGen.nai.i2iNoise', type: 'slider', fallbackLabel: 'Noise', bindPath: 'NAIImgConfig.noise', classes: 'mt-2',
        condition: (ctx) => ctx.db.NAII2I, options: { min: 0, max: 0.99, step: 0.01, fixed: 2, marginBottom: false },
        keywords: ['novelai', 'nai', 'i2i', 'noise'],
    },
]);

const dalleItems = forProvider('dalle', [
    {
        id: 'imageGen.dalle.key', type: 'text', fallbackLabel: 'OpenAI API Key', bindKey: 'openAIKey', options: { placeholder: 'sk-...' },
        keywords: ['dalle', 'openai', 'key'],
    },
    {
        id: 'imageGen.dalle.quality', type: 'select', fallbackLabel: 'Dall-E Quality', bindKey: 'dallEQuality',
        options: {
            inputClassName: 'mt-2 mb-4',
            keepUnlistedValue: true,
            selectOptions: [{ value: 'standard', label: 'Standard' }, { value: 'hd', label: 'HD' }],
        },
        keywords: ['dalle', 'quality'],
    },
]);

const stabilityItems = forProvider('stability', [
    {
        id: 'imageGen.stability.key', type: 'text', fallbackLabel: 'Stability API Key', bindKey: 'stabilityKey',
        options: { placeholder: '...' }, keywords: ['stability', 'key'],
    },
    {
        id: 'imageGen.stability.model', type: 'select', fallbackLabel: 'Stability Model', bindKey: 'stabilityModel', classes: '',
        options: {
            inputClassName: 'mt-2 mb-4',
            keepUnlistedValue: true,
            selectOptions: [
                { value: 'ultra', label: 'SD Ultra' },
                { value: 'core', label: 'SD Core' },
                { value: 'sd3-large', label: 'SD3 Large' },
                { value: 'sd3-medium', label: 'SD3 Medium' },
            ],
        },
        keywords: ['stability', 'model'],
    },
    {
        id: 'imageGen.stability.style', type: 'select', fallbackLabel: 'SD Core Style', bindKey: 'stabllityStyle', classes: '',
        condition: (ctx) => ctx.db.stabilityModel === 'core',
        options: {
            inputClassName: 'mt-2 mb-4',
            keepUnlistedValue: true,
            selectOptions: [
                { value: '', label: 'Unspecified' },
                { value: '3d-model', label: '3D Model' },
                { value: 'analog-film', label: 'Analog Film' },
                { value: 'anime', label: 'Anime' },
                { value: 'cinematic', label: 'Cinematic' },
                { value: 'comic-book', label: 'Comic Book' },
                { value: 'digital-art', label: 'Digital Art' },
                { value: 'enhance', label: 'Enhance' },
                { value: 'fantasy-art', label: 'Fantasy Art' },
                { value: 'isometric', label: 'Isometric' },
                { value: 'line-art', label: 'Line Art' },
                { value: 'low-poly', label: 'Low Poly' },
                { value: 'modeling-compound', label: 'Modeling Compound' },
                { value: 'neon-punk', label: 'Neon Punk' },
                { value: 'origami', label: 'Origami' },
                { value: 'photographic', label: 'Photographic' },
                { value: 'pixel-art', label: 'Pixel Art' },
                { value: 'tile-texture', label: 'Tile Texture' },
            ],
        },
        keywords: ['stability', 'style', 'core'],
    },
]);

const comfyuiItems = forProvider('comfyui', [
    {
        id: 'imageGen.comfyui.url', type: 'text', labelPrefix: 'ComfyUI', labelKey: 'providerURL', bindKey: 'comfyUiUrl', classes: 'mt-2',
        options: { placeholder: 'http://127.0.0.1:8188' }, keywords: ['comfyui', 'url'],
    },
    { id: 'imageGen.comfyui.workflow', type: 'custom', labelKey: 'comfyWorkflow', componentId: 'ComfyWorkflowInput', keywords: ['comfyui', 'workflow'] },
    {
        id: 'imageGen.comfyui.timeout', type: 'number', fallbackLabel: 'Timeout (sec)', bindPath: 'comfyConfig.timeout',
        options: { min: 1, max: 120 }, keywords: ['comfyui', 'timeout'],
    },
]);

const comfyLegacyItems = forProvider('comfy', [
    {
        id: 'imageGen.comfy.firstImageWarning', type: 'header', fallbackLabel: 'The first image generated by the prompt will be selected. ',
        options: { level: 'warning' },
    },
    {
        id: 'imageGen.comfy.corsWarning', type: 'header', fallbackLabel: '"Please run comfyUI with --enable-cors-header."',
        options: { level: 'warning' }, condition: () => !isTauri,
    },
    {
        id: 'imageGen.comfy.url', type: 'text', labelPrefix: 'ComfyUI', labelKey: 'providerURL', bindKey: 'comfyUiUrl', classes: 'mt-2',
        options: { placeholder: 'http://127.0.0.1:8188' }, keywords: ['comfy', 'url'],
    },
    {
        id: 'imageGen.comfy.workflow', type: 'text', fallbackLabel: 'Workflow', bindPath: 'comfyConfig.workflow',
        options: { placeholder: 'valid ComfyUI API json (Enable Dev mode Options in ComfyUI)' }, keywords: ['comfy', 'workflow'],
    },
    {
        id: 'imageGen.comfy.posNodeID', type: 'text', fallbackLabel: 'Positive Text Node: ID', bindPath: 'comfyConfig.posNodeID',
        options: { placeholder: 'eg. 1, 3, etc' }, keywords: ['comfy', 'node'],
    },
    {
        id: 'imageGen.comfy.posInputName', type: 'text', fallbackLabel: 'Positive Text Node: Input Field Name',
        bindPath: 'comfyConfig.posInputName', options: { placeholder: 'eg. text' }, keywords: ['comfy', 'node'],
    },
    {
        id: 'imageGen.comfy.negNodeID', type: 'text', fallbackLabel: 'Negative Text Node: ID', bindPath: 'comfyConfig.negNodeID',
        options: { placeholder: 'eg. 1, 3, etc' }, keywords: ['comfy', 'node'],
    },
    {
        id: 'imageGen.comfy.negInputName', type: 'text', fallbackLabel: 'Negative Text Node: Input Field Name',
        bindPath: 'comfyConfig.negInputName', options: { placeholder: 'eg. text' }, keywords: ['comfy', 'node'],
    },
    {
        id: 'imageGen.comfy.timeout', type: 'number', fallbackLabel: 'Timeout (sec)', bindPath: 'comfyConfig.timeout',
        options: { min: 1, max: 120 }, keywords: ['comfy', 'timeout'],
    },
]);

const falItems = forProvider('fal', [
    { id: 'imageGen.fal.key', type: 'text', fallbackLabel: 'Fal.ai API Key', bindKey: 'falToken', options: { placeholder: '...' }, keywords: ['fal', 'key'] },
    {
        id: 'imageGen.fal.width', type: 'number', fallbackLabel: 'Width', bindPath: 'sdConfig.width', classes: 'mt-4',
        options: { min: 0, max: 2048 }, keywords: ['fal', 'width'],
    },
    {
        id: 'imageGen.fal.height', type: 'number', fallbackLabel: 'Height', bindPath: 'sdConfig.height', classes: 'mt-4',
        options: { min: 0, max: 2048 }, keywords: ['fal', 'height'],
    },
    {
        id: 'imageGen.fal.model', type: 'select', fallbackLabel: 'Model', bindKey: 'falModel',
        options: {
            inputClassName: 'mt-2',
            keepUnlistedValue: true,
            selectOptions: [
                { value: 'fal-ai/flux/dev', label: 'Flux[Dev]' },
                { value: 'fal-ai/flux-lora', label: 'Flux[Dev] with Lora' },
                { value: 'fal-ai/flux-pro', label: 'Flux[Pro]' },
                { value: 'fal-ai/flux/schnell', label: 'Flux[Schnell]' },
            ],
        },
        keywords: ['fal', 'model', 'flux'],
    },
    {
        id: 'imageGen.fal.lora', type: 'text', fallbackLabel: 'Lora Model URL', helpKey: 'urllora', bindKey: 'falLora', classes: 'mt-4',
        condition: (ctx) => ctx.db.falModel === 'fal-ai/flux-lora', keywords: ['fal', 'lora'],
    },
    {
        id: 'imageGen.fal.loraScale', type: 'slider', fallbackLabel: 'Lora Weight', bindKey: 'falLoraScale', classes: 'mt-4',
        condition: (ctx) => ctx.db.falModel === 'fal-ai/flux-lora', options: { min: 0, max: 2, step: 0.01, fixed: 2 },
        keywords: ['fal', 'lora', 'weight'],
    },
]);

const imagenItems = forProvider('Imagen', [
    {
        id: 'imageGen.imagen.key', type: 'text', fallbackLabel: 'GoogleAI API Key', bindPath: 'google.accessToken', classes: 'mt-2',
        options: { placeholder: '...', hideText: (ctx) => ctx.db.hideApiKey }, keywords: ['imagen', 'google', 'key'],
    },
    {
        id: 'imageGen.imagen.model', type: 'select', fallbackLabel: 'Model', bindKey: 'ImagenModel', classes: '',
        options: {
            inputClassName: 'mb-4',
            keepUnlistedValue: true,
            selectOptions: [
                { value: 'imagen-4.0-generate-001', label: 'Imagen 4' },
                { value: 'imagen-4.0-ultra-generate-001', label: 'Imagen 4 Ultra' },
                { value: 'imagen-4.0-fast-generate-001', label: 'Imagen 4 Fast' },
                { value: 'imagen-3.0-generate-002', label: 'Imagen 3.0' },
            ],
        },
        keywords: ['imagen', 'model'],
    },
    {
        id: 'imageGen.imagen.size', type: 'select', fallbackLabel: 'Image size', bindKey: 'ImagenImageSize',
        condition: (ctx) => ctx.db.ImagenModel === 'imagen-4.0-generate-001' || ctx.db.ImagenModel === 'imagen-4.0-ultra-generate-001',
        classes: '',
        options: {
            inputClassName: 'mb-4',
            keepUnlistedValue: true,
            selectOptions: [{ value: '1K', label: '1K' }, { value: '2K', label: '2K' }],
        },
        keywords: ['imagen', 'size'],
    },
    {
        id: 'imageGen.imagen.aspectRatio', type: 'select', fallbackLabel: 'Aspect ratio', bindKey: 'ImagenAspectRatio',
        classes: '',
        options: {
            inputClassName: 'mb-4',
            keepUnlistedValue: true,
            selectOptions: ['1:1', '3:4', '4:3', '9:16', '16:9'].map((value) => ({ value, label: value })),
        },
        keywords: ['imagen', 'aspect', 'ratio'],
    },
    {
        id: 'imageGen.imagen.personGeneration', type: 'select', fallbackLabel: 'Person generation', bindKey: 'ImagenPersonGeneration',
        classes: '',
        options: {
            inputClassName: 'mb-4',
            keepUnlistedValue: true,
            selectOptions: [
                { value: 'allow_all', label: 'Allow all' },
                { value: 'allow_adult', label: 'Allow adult' },
                { value: 'dont_allow', label: "Don't allow" },
            ],
        },
        keywords: ['imagen', 'person'],
    },
]);

const openaiCompatItems = forProvider('openai-compat', [
    {
        id: 'imageGen.openaiCompat.url', type: 'text', fallbackLabel: 'API URL', bindPath: 'openaiCompatImage.url', classes: 'mt-2',
        options: { placeholder: 'https://api.example.com/v1/images/generations' }, keywords: ['openai', 'compatible', 'url'],
    },
    {
        id: 'imageGen.openaiCompat.key', type: 'text', fallbackLabel: 'API Key', bindPath: 'openaiCompatImage.key',
        options: { placeholder: 'sk-...', hideText: (ctx) => ctx.db.hideApiKey }, keywords: ['openai', 'compatible', 'key'],
    },
    {
        id: 'imageGen.openaiCompat.model', type: 'text', fallbackLabel: 'Model', bindPath: 'openaiCompatImage.model',
        options: { placeholder: 'dall-e-3' }, keywords: ['openai', 'compatible', 'model'],
    },
    {
        id: 'imageGen.openaiCompat.size', type: 'select', fallbackLabel: 'Image Size', bindPath: 'openaiCompatImage.size', classes: '',
        options: {
            inputClassName: 'mb-4',
            keepUnlistedValue: true,
            selectOptions: ['1024x1024', '1536x1024', '1024x1536', '512x512', '256x256'].map((value) => ({ value, label: value })),
        },
        keywords: ['openai', 'compatible', 'size'],
    },
    {
        id: 'imageGen.openaiCompat.quality', type: 'select', fallbackLabel: 'Quality', bindPath: 'openaiCompatImage.quality',
        classes: '',
        options: {
            inputClassName: 'mb-4',
            keepUnlistedValue: true,
            selectOptions: [
                { value: 'auto', label: 'Auto' },
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
            ],
        },
        keywords: ['openai', 'compatible', 'quality'],
    },
]);

const wavespeedItems = forProvider('wavespeed', [
    {
        id: 'imageGen.wavespeed.key', type: 'text', fallbackLabel: 'API Key', bindPath: 'wavespeedImage.key',
        options: { placeholder: 'sk-...', hideText: (ctx) => ctx.db.hideApiKey }, keywords: ['wavespeed', 'key'],
    },
    {
        id: 'imageGen.wavespeed.model', type: 'custom', fallbackLabel: 'Model, LoRA, Image Reference', componentId: 'WavespeedModelSettings',
        keywords: ['wavespeed', 'model', 'lora', 'reference'],
    },
]);

export const imageGenerationSettingsItems: SettingItem[] = [
    {
        id: 'imageGen.provider',
        type: 'select',
        labelPrefixKey: 'imageGeneration',
        labelKey: 'provider',
        helpKey: 'sdProvider',
        bindKey: 'sdProvider',
        classes: 'mt-2',
        options: {
            inputClassName: 'mt-2 mb-4',
            keepUnlistedValue: true,
            selectOptions: [
                { value: '', label: 'None' },
                ...(Object.entries(PROVIDER_NAMES) as [ProviderId, string][]).map(([value, label]) => ({
                    value,
                    label,
                    // the legacy ComfyUI is listed only while it is still selected
                    condition: value === 'comfy' ? provider('comfy') : undefined,
                })),
            ],
        },
        keywords: ['image', 'generation', 'provider', 'stable diffusion'],
    },
    ...webuiItems,
    ...naiItems,
    ...dalleItems,
    ...stabilityItems,
    ...comfyuiItems,
    ...comfyLegacyItems,
    ...falItems,
    ...imagenItems,
    ...openaiCompatItems,
    ...wavespeedItems,
];
